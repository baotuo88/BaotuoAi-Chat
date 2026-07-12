import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  isAccountsEnabled: vi.fn(),
  findUserByEmail: vi.fn(),
  recordAuditLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/client", () => ({
  isAccountsEnabled: mocks.isAccountsEnabled,
}));

vi.mock("@/lib/accounts/accountService", () => ({
  findUserByEmail: mocks.findUserByEmail,
  recordAuditLog: mocks.recordAuditLog,
}));

vi.mock("@/config/limits", async () => vi.importActual("../config/limits"));
vi.mock("@/lib/api/schemas", async () =>
  vi.importActual("../lib/api/schemas"),
);
vi.mock("@/lib/api/middleware", async () =>
  vi.importActual("../lib/api/middleware"),
);
vi.mock("@/lib/errors", async () => vi.importActual("../lib/errors"));
vi.mock("@/lib/security/accountSession", async () =>
  vi.importActual("../lib/security/accountSession"),
);
vi.mock("@/lib/security/passwordHash", async () =>
  vi.importActual("../lib/security/passwordHash"),
);
vi.mock("@/lib/security/rateLimitStore", async () =>
  vi.importActual("../lib/security/rateLimitStore"),
);
vi.mock("@/lib/security/requestGuards", async () =>
  vi.importActual("../lib/security/requestGuards"),
);

import { clearRateLimitStoreForTesting } from "../lib/security/rateLimitStore";
import {
  ACCOUNT_SESSION_COOKIE,
  readAccountSessionCookie,
} from "../lib/security/accountSession";
import { hashPassword } from "../lib/security/passwordHash";

function makeRequest(body: object, headers: Record<string, string> = {}) {
  return new NextRequest("https://neo.test/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function extractCookie(setCookie: string, name: string): string {
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] || "";
}

describe("auth/login route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    clearRateLimitStoreForTesting();
    mocks.isAccountsEnabled.mockReset();
    mocks.findUserByEmail.mockReset();
    mocks.recordAuditLog.mockReset();
    mocks.isAccountsEnabled.mockReturnValue(true);
    mocks.recordAuditLog.mockResolvedValue(undefined);
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret");
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
  });

  it("returns 404 ACCOUNTS_DISABLED when accounts are not enabled", async () => {
    mocks.isAccountsEnabled.mockReturnValue(false);
    const { POST } = await import("../app/api/auth/login/route");

    const response = await POST(
      makeRequest({ email: "a@test.com", password: "correcthorse" }),
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("ACCOUNTS_DISABLED");
  });

  it("signs a valid session cookie for correct credentials", async () => {
    const passwordHash = await hashPassword("correcthorse");
    mocks.findUserByEmail.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      passwordHash,
      tokenVersion: 3,
      disabled: false,
      dailyQuota: null,
    });
    const { POST } = await import("../app/api/auth/login/route");

    const response = await POST(
      makeRequest({ email: "a@test.com", password: "correcthorse" }),
    );
    const setCookie = response.headers.get("set-cookie") || "";
    const cookieValue = extractCookie(setCookie, ACCOUNT_SESSION_COOKIE);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      user: { id: "u1", email: "a@test.com" },
    });
    expect(cookieValue).toBeTruthy();
    const session = await readAccountSessionCookie(cookieValue);
    expect(session).toEqual({ userId: "u1", tokenVersion: 3 });
    expect(mocks.recordAuditLog).toHaveBeenCalledWith("u1", "login");
  });

  it("returns 401 INVALID_CREDENTIALS for a wrong password", async () => {
    const passwordHash = await hashPassword("correcthorse");
    mocks.findUserByEmail.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      passwordHash,
      tokenVersion: 0,
      disabled: false,
      dailyQuota: null,
    });
    const { POST } = await import("../app/api/auth/login/route");

    const response = await POST(
      makeRequest({ email: "a@test.com", password: "wrongpassword" }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("INVALID_CREDENTIALS");
    expect(mocks.recordAuditLog).toHaveBeenCalledWith("u1", "login_failed", {
      email: "a@test.com",
    });
  });

  it("returns 401 INVALID_CREDENTIALS for an unknown email (no user record)", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    const { POST } = await import("../app/api/auth/login/route");

    const response = await POST(
      makeRequest({ email: "missing@test.com", password: "correcthorse" }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("INVALID_CREDENTIALS");
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(null, "login_failed", {
      email: "missing@test.com",
    });
  });

  it("returns 403 ACCOUNT_DISABLED and audit-logs when a disabled user provides correct credentials", async () => {
    const passwordHash = await hashPassword("correcthorse");
    mocks.findUserByEmail.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      passwordHash,
      tokenVersion: 0,
      disabled: true,
      dailyQuota: null,
    });
    const { POST } = await import("../app/api/auth/login/route");

    const response = await POST(
      makeRequest({ email: "a@test.com", password: "correcthorse" }),
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe("ACCOUNT_DISABLED");
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(
      "u1",
      "account_disabled_login_attempt",
    );
  });

  it("locks with 423 after 8 consecutive failed attempts from the same IP", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    const { POST } = await import("../app/api/auth/login/route");

    const headers = { "x-forwarded-for": "203.0.113.20" };
    let response: Response | null = null;
    for (let i = 0; i < 9; i += 1) {
      response = await POST(
        makeRequest(
          { email: `attacker${i}@test.com`, password: "correcthorse" },
          headers,
        ),
      );
    }

    expect(response?.status).toBe(423);
    const data = await response!.json();
    expect(data.code).toBe("LOGIN_LOCKED");
    expect(data.lockedUntil).toEqual(expect.any(Number));
  });
});
