import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  isAccountsEnabled: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/client", () => ({
  isAccountsEnabled: mocks.isAccountsEnabled,
}));

vi.mock("@/lib/accounts/accountService", () => ({
  findUserById: mocks.findUserById,
}));

vi.mock("@/config/limits", async () => vi.importActual("../config/limits"));
vi.mock("@/lib/security/accessControl", async () =>
  vi.importActual("../lib/security/accessControl"),
);
vi.mock("@/lib/security/accountSession", async () =>
  vi.importActual("../lib/security/accountSession"),
);
vi.mock("@/lib/security/rateLimitStore", async () =>
  vi.importActual("../lib/security/rateLimitStore"),
);
vi.mock("@/lib/security/requestGuards", async () =>
  vi.importActual("../lib/security/requestGuards"),
);
vi.mock("@/lib/security/requestProof", async () =>
  vi.importActual("../lib/security/requestProof"),
);
vi.mock("@/lib/security/quota", async () =>
  vi.importActual("../lib/security/quota"),
);

import { clearRateLimitStoreForTesting } from "../lib/security/rateLimitStore";
import { clearRequestRateLimitBuckets } from "../lib/security/requestGuards";
import {
  ACCOUNT_SESSION_COOKIE,
  createAccountSessionCookieValue,
} from "../lib/security/accountSession";
import { middleware } from "../middleware";

function makeRequest(
  path: string,
  {
    method = "GET",
    cookie,
    ip = "203.0.113.30",
  }: { method?: string; cookie?: string; ip?: string } = {},
): NextRequest {
  return new NextRequest(`https://neo.test${path}`, {
    method,
    headers: {
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
  });
}

describe("middleware enforceAccountGate", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    clearRateLimitStoreForTesting();
    clearRequestRateLimitBuckets();
    mocks.isAccountsEnabled.mockReset();
    mocks.findUserById.mockReset();
    mocks.isAccountsEnabled.mockReturnValue(true);
    vi.stubEnv("ACCESS_PASSWORD", "");
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret");
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    vi.stubEnv("DEFAULT_DAILY_QUOTA", "3");
  });

  it("is a no-op when accounts are not enabled", async () => {
    mocks.isAccountsEnabled.mockReturnValue(false);
    const response = await middleware(makeRequest("/api/config"));
    expect(response.status).toBe(200);
  });

  it("allows /api/auth/* through without a session (allowlist)", async () => {
    const response = await middleware(makeRequest("/api/auth/login"));
    expect(response.status).toBe(200);
  });

  it("allows /api/access/verify through without a session (allowlist)", async () => {
    const response = await middleware(makeRequest("/api/access/verify"));
    expect(response.status).toBe(200);
  });

  it("rejects a request without a session cookie", async () => {
    const response = await middleware(makeRequest("/api/config"));
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.code).toBe("ACCOUNT_SESSION_REQUIRED");
  });

  it("rejects when the cookie's tokenVersion doesn't match the stored user", async () => {
    mocks.findUserById.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      passwordHash: "hash",
      tokenVersion: 5,
      disabled: false,
      dailyQuota: null,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u1",
      tokenVersion: 4,
    });
    const response = await middleware(
      makeRequest("/api/config", {
        cookie: `${ACCOUNT_SESSION_COOKIE}=${cookieValue}`,
      }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("ACCOUNT_SESSION_REQUIRED");
  });

  it("rejects when the user is disabled", async () => {
    mocks.findUserById.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      passwordHash: "hash",
      tokenVersion: 0,
      disabled: true,
      dailyQuota: null,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u1",
      tokenVersion: 0,
    });
    const response = await middleware(
      makeRequest("/api/config", {
        cookie: `${ACCOUNT_SESSION_COOKIE}=${cookieValue}`,
      }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("ACCOUNT_SESSION_REQUIRED");
  });

  it("passes non-metered paths through with a valid session", async () => {
    mocks.findUserById.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      passwordHash: "hash",
      tokenVersion: 0,
      disabled: false,
      dailyQuota: null,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u1",
      tokenVersion: 0,
    });
    const response = await middleware(
      makeRequest("/api/config", {
        cookie: `${ACCOUNT_SESSION_COOKIE}=${cookieValue}`,
      }),
    );
    expect(response.status).toBe(200);
  });

  it("consumes quota on metered paths and returns 429 with Retry-After once exceeded", async () => {
    mocks.findUserById.mockResolvedValue({
      id: "u-quota",
      email: "q@test.com",
      passwordHash: "hash",
      tokenVersion: 0,
      disabled: false,
      dailyQuota: null,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u-quota",
      tokenVersion: 0,
    });

    let response: Response | null = null;
    // DEFAULT_DAILY_QUOTA=3 → the first 3 pass, the 4th is over
    for (let i = 0; i < 4; i += 1) {
      response = await middleware(
        makeRequest("/api/chat", {
          method: "POST",
          cookie: `${ACCOUNT_SESSION_COOKIE}=${cookieValue}`,
        }),
      );
    }

    expect(response?.status).toBe(429);
    const data = await response!.json();
    expect(data.code).toBe("QUOTA_EXCEEDED");
    expect(data.retryAfter).toEqual(expect.any(Number));
    expect(response!.headers.get("Retry-After")).toBeTruthy();
  });

  it("honors a per-user dailyQuota override", async () => {
    mocks.findUserById.mockResolvedValue({
      id: "u-big",
      email: "b@test.com",
      passwordHash: "hash",
      tokenVersion: 0,
      disabled: false,
      dailyQuota: 10,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u-big",
      tokenVersion: 0,
    });

    // With per-user quota=10 and DEFAULT=3, the 4th request should still pass
    // because the per-user override wins.
    let response: Response | null = null;
    for (let i = 0; i < 4; i += 1) {
      response = await middleware(
        makeRequest("/api/chat", {
          method: "POST",
          cookie: `${ACCOUNT_SESSION_COOKIE}=${cookieValue}`,
        }),
      );
    }
    expect(response?.status).toBe(200);
  });
});
