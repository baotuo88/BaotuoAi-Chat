import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/accountSession", async () =>
  vi.importActual("../lib/security/accountSession"),
);

import { ACCOUNT_SESSION_COOKIE } from "../lib/security/accountSession";

describe("auth/logout route", () => {
  it("clears the account session cookie with Max-Age=0", async () => {
    const { POST } = await import("../app/api/auth/logout/route");

    const response = await POST();
    const setCookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(setCookie).toContain(`${ACCOUNT_SESSION_COOKIE}=`);
    expect(setCookie).toContain("Max-Age=0");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
