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
vi.mock("@/lib/security/accountSession", async () =>
  vi.importActual("../lib/security/accountSession"),
);
vi.mock("@/lib/security/quota", async () =>
  vi.importActual("../lib/security/quota"),
);
vi.mock("@/lib/security/rateLimitStore", async () =>
  vi.importActual("../lib/security/rateLimitStore"),
);
vi.mock("@/lib/security/deployment", async () =>
  vi.importActual("../lib/security/deployment"),
);

import {
  ACCOUNT_SESSION_COOKIE,
  createAccountSessionCookieValue,
} from "../lib/security/accountSession";
import { clearRateLimitStoreForTesting } from "../lib/security/rateLimitStore";

function makeRequest(cookieHeader?: string) {
  return new NextRequest("https://neo.test/api/auth/me", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

describe("auth/me route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    clearRateLimitStoreForTesting();
    mocks.isAccountsEnabled.mockReset();
    mocks.findUserById.mockReset();
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret");
  });

  it("returns { enabled: false, user: null } when accounts are disabled", async () => {
    mocks.isAccountsEnabled.mockReturnValue(false);
    const { GET } = await import("../app/api/auth/me/route");

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: false, user: null });
  });

  it("returns { enabled: true, user: null } when no session cookie", async () => {
    mocks.isAccountsEnabled.mockReturnValue(true);
    const { GET } = await import("../app/api/auth/me/route");

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: true, user: null });
  });

  it("returns { enabled: true, user: null } when the tokenVersion doesn't match", async () => {
    mocks.isAccountsEnabled.mockReturnValue(true);
    mocks.findUserById.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      tokenVersion: 2,
      disabled: false,
      dailyQuota: null,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u1",
      tokenVersion: 1,
    });
    const { GET } = await import("../app/api/auth/me/route");

    const response = await GET(
      makeRequest(`${ACCOUNT_SESSION_COOKIE}=${cookieValue}`),
    );
    expect(await response.json()).toEqual({ enabled: true, user: null });
  });

  it("returns { enabled: true, user: null } when the account is disabled", async () => {
    mocks.isAccountsEnabled.mockReturnValue(true);
    mocks.findUserById.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      tokenVersion: 0,
      disabled: true,
      dailyQuota: null,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u1",
      tokenVersion: 0,
    });
    const { GET } = await import("../app/api/auth/me/route");

    const response = await GET(
      makeRequest(`${ACCOUNT_SESSION_COOKIE}=${cookieValue}`),
    );
    expect(await response.json()).toEqual({ enabled: true, user: null });
  });

  it("returns user + quota status for a valid session", async () => {
    mocks.isAccountsEnabled.mockReturnValue(true);
    mocks.findUserById.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      tokenVersion: 0,
      disabled: false,
      dailyQuota: null,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u1",
      tokenVersion: 0,
    });
    const { GET } = await import("../app/api/auth/me/route");

    const response = await GET(
      makeRequest(`${ACCOUNT_SESSION_COOKIE}=${cookieValue}`),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enabled).toBe(true);
    expect(data.user).toEqual({ id: "u1", email: "a@test.com" });
    expect(data.quota).toMatchObject({
      limit: expect.any(Number),
      used: 0,
      remaining: expect.any(Number),
      exceeded: false,
    });
  });

  it("uses the user's per-account dailyQuota override when set", async () => {
    mocks.isAccountsEnabled.mockReturnValue(true);
    mocks.findUserById.mockResolvedValue({
      id: "u1",
      email: "a@test.com",
      tokenVersion: 0,
      disabled: false,
      dailyQuota: 50,
    });
    const cookieValue = await createAccountSessionCookieValue({
      userId: "u1",
      tokenVersion: 0,
    });
    const { GET } = await import("../app/api/auth/me/route");

    const response = await GET(
      makeRequest(`${ACCOUNT_SESSION_COOKIE}=${cookieValue}`),
    );
    const data = await response.json();

    expect(data.quota.limit).toBe(50);
  });
});
