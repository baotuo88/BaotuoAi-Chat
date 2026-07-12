import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_MAX_AGE_SECONDS,
  createAccountSessionCookieValue,
  getAccountSessionSecret,
  isAccountSessionConfigured,
  readAccountSessionCookie,
} from "../lib/security/accountSession";

describe("account session cookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes the expected cookie name and max age", () => {
    expect(ACCOUNT_SESSION_COOKIE).toBe("neo_account_session");
    expect(ACCOUNT_SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it("is unconfigured when ACCOUNT_SESSION_SECRET is empty", () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "");
    expect(getAccountSessionSecret()).toBe("");
    expect(isAccountSessionConfigured()).toBe(false);
  });

  it("is configured once ACCOUNT_SESSION_SECRET is set", () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret");
    expect(isAccountSessionConfigured()).toBe(true);
  });

  it("signs and verifies a round trip payload", async () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret");

    const cookieValue = await createAccountSessionCookieValue({
      userId: "user-123",
      tokenVersion: 3,
    });

    expect(cookieValue).toBeTruthy();
    await expect(readAccountSessionCookie(cookieValue)).resolves.toEqual({
      userId: "user-123",
      tokenVersion: 3,
    });
  });

  it("rejects tampered cookie values", async () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret");

    const cookieValue = await createAccountSessionCookieValue({
      userId: "user-123",
      tokenVersion: 3,
    });

    await expect(
      readAccountSessionCookie(`${cookieValue}x`),
    ).resolves.toBeNull();
  });

  it("rejects cookies signed under a different secret", async () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "secret-a");
    const cookieValue = await createAccountSessionCookieValue({
      userId: "user-123",
      tokenVersion: 0,
    });

    vi.stubEnv("ACCOUNT_SESSION_SECRET", "secret-b");
    await expect(readAccountSessionCookie(cookieValue)).resolves.toBeNull();
  });

  it("returns an empty signature when signing is unconfigured", async () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "");

    const cookieValue = await createAccountSessionCookieValue({
      userId: "user-123",
      tokenVersion: 0,
    });
    expect(cookieValue).toBe("");
    await expect(readAccountSessionCookie(cookieValue)).resolves.toBeNull();
  });

  it("rejects malformed, empty, or shape-invalid cookie values", async () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret");

    await expect(readAccountSessionCookie(undefined)).resolves.toBeNull();
    await expect(readAccountSessionCookie(null)).resolves.toBeNull();
    await expect(readAccountSessionCookie("")).resolves.toBeNull();
    await expect(readAccountSessionCookie("no-dot-separator")).resolves.toBeNull();
    await expect(
      readAccountSessionCookie("payload-only."),
    ).resolves.toBeNull();
  });
});
