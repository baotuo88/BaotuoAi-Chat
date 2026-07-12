import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  isAccountsEnabled: vi.fn(),
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  recordAuditLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/client", () => ({
  isAccountsEnabled: mocks.isAccountsEnabled,
}));

vi.mock("@/lib/accounts/accountService", () => ({
  findUserByEmail: mocks.findUserByEmail,
  createUser: mocks.createUser,
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
import { ACCOUNT_SESSION_COOKIE } from "../lib/security/accountSession";

function makeRequest(body: object, headers: Record<string, string> = {}) {
  return new NextRequest("https://neo.test/api/auth/register", {
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

describe("auth/register route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    clearRateLimitStoreForTesting();
    mocks.isAccountsEnabled.mockReset();
    mocks.findUserByEmail.mockReset();
    mocks.createUser.mockReset();
    mocks.recordAuditLog.mockReset();
    mocks.isAccountsEnabled.mockReturnValue(true);
    mocks.recordAuditLog.mockResolvedValue(undefined);
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret");
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
  });

  it("returns 404 ACCOUNTS_DISABLED when accounts are not enabled", async () => {
    mocks.isAccountsEnabled.mockReturnValue(false);
    const { POST } = await import("../app/api/auth/register/route");

    const response = await POST(
      makeRequest({ email: "new@test.com", password: "correcthorse" }),
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("ACCOUNTS_DISABLED");
  });

  it("creates a user, records an audit log, and sets a session cookie on success", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({
      id: "u1",
      email: "new@test.com",
      passwordHash: "pbkdf2:hash",
      tokenVersion: 0,
      disabled: false,
      dailyQuota: null,
    });
    const { POST } = await import("../app/api/auth/register/route");

    const response = await POST(
      makeRequest({ email: "new@test.com", password: "correcthorse" }),
    );
    const setCookie = response.headers.get("set-cookie") || "";
    const cookieValue = extractCookie(setCookie, ACCOUNT_SESSION_COOKIE);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      user: { id: "u1", email: "new@test.com" },
    });
    expect(mocks.createUser).toHaveBeenCalledWith(
      "new@test.com",
      expect.stringMatching(/^pbkdf2:/),
    );
    expect(mocks.recordAuditLog).toHaveBeenCalledWith("u1", "register");
    expect(cookieValue).toBeTruthy();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
  });

  it("returns 409 DUPLICATE_EMAIL when the email is already registered", async () => {
    mocks.findUserByEmail.mockResolvedValue({
      id: "existing",
      email: "existing@test.com",
    });
    const { POST } = await import("../app/api/auth/register/route");

    const response = await POST(
      makeRequest({ email: "existing@test.com", password: "correcthorse" }),
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe("DUPLICATE_EMAIL");
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR when the password is too short", async () => {
    const { POST } = await import("../app/api/auth/register/route");

    const response = await POST(
      makeRequest({ email: "new@test.com", password: "short" }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("VALIDATION_ERROR");
  });

  it("throttles account creation by client IP after 5 attempts", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.createUser.mockImplementation(async (email: string) => ({
      id: `u-${email}`,
      email,
      passwordHash: "pbkdf2:hash",
      tokenVersion: 0,
      disabled: false,
      dailyQuota: null,
    }));

    const { POST } = await import("../app/api/auth/register/route");

    const headers = { "x-forwarded-for": "203.0.113.9" };
    let last: Response | null = null;
    for (let i = 0; i < 6; i += 1) {
      last = await POST(
        makeRequest(
          { email: `user${i}@test.com`, password: "correcthorse" },
          headers,
        ),
      );
    }

    expect(last?.status).toBe(429);
    expect((await last!.json()).code).toBe("REGISTER_RATE_LIMITED");
  });
});
