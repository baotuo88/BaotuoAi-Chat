import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { users, auditLogs } from "../lib/db/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: mocks.getDb,
}));

import {
  createUser,
  findUserByEmail,
  findUserById,
  recordAuditLog,
} from "../lib/accounts/accountService";

function createFakeDb() {
  const limitMock = vi.fn();
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));

  const valuesMock = vi.fn();
  const insertMock = vi.fn(() => ({ values: valuesMock }));

  const db = { select: selectMock, insert: insertMock };
  return { db, selectMock, fromMock, whereMock, limitMock, insertMock, valuesMock };
}

describe("accountService", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
  });

  describe("findUserByEmail", () => {
    it("returns the first matching row", async () => {
      const fake = createFakeDb();
      fake.limitMock.mockResolvedValue([{ id: "u1", email: "a@test.com" }]);
      mocks.getDb.mockReturnValue(fake.db);

      const user = await findUserByEmail("a@test.com");

      expect(user).toEqual({ id: "u1", email: "a@test.com" });
      expect(fake.fromMock).toHaveBeenCalledWith(users);
      expect(fake.whereMock).toHaveBeenCalledWith(eq(users.email, "a@test.com"));
      expect(fake.limitMock).toHaveBeenCalledWith(1);
    });

    it("returns null when no row matches", async () => {
      const fake = createFakeDb();
      fake.limitMock.mockResolvedValue([]);
      mocks.getDb.mockReturnValue(fake.db);

      expect(await findUserByEmail("missing@test.com")).toBeNull();
    });
  });

  describe("findUserById", () => {
    it("returns the first matching row", async () => {
      const fake = createFakeDb();
      fake.limitMock.mockResolvedValue([{ id: "u1", email: "a@test.com" }]);
      mocks.getDb.mockReturnValue(fake.db);

      const user = await findUserById("u1");

      expect(user).toEqual({ id: "u1", email: "a@test.com" });
      expect(fake.whereMock).toHaveBeenCalledWith(eq(users.id, "u1"));
    });

    it("returns null when no row matches", async () => {
      const fake = createFakeDb();
      fake.limitMock.mockResolvedValue([]);
      mocks.getDb.mockReturnValue(fake.db);

      expect(await findUserById("missing")).toBeNull();
    });
  });

  describe("createUser", () => {
    it("inserts a new user and returns the inserted row", async () => {
      const fake = createFakeDb();
      const inserted = { id: "u1", email: "a@test.com", passwordHash: "hash" };
      fake.valuesMock.mockReturnValue({
        returning: vi.fn().mockResolvedValue([inserted]),
      });
      mocks.getDb.mockReturnValue(fake.db);

      const user = await createUser("a@test.com", "hash");

      expect(user).toEqual(inserted);
      expect(fake.insertMock).toHaveBeenCalledWith(users);
      expect(fake.valuesMock).toHaveBeenCalledWith({
        email: "a@test.com",
        passwordHash: "hash",
      });
    });
  });

  describe("recordAuditLog", () => {
    it("inserts an audit log row with the given action and detail", async () => {
      const fake = createFakeDb();
      fake.valuesMock.mockResolvedValue(undefined);
      mocks.getDb.mockReturnValue(fake.db);

      await recordAuditLog("u1", "login", { ip: "203.0.113.1" });

      expect(fake.insertMock).toHaveBeenCalledWith(auditLogs);
      expect(fake.valuesMock).toHaveBeenCalledWith({
        userId: "u1",
        action: "login",
        detail: { ip: "203.0.113.1" },
      });
    });

    it("supports a null userId for pre-auth events", async () => {
      const fake = createFakeDb();
      fake.valuesMock.mockResolvedValue(undefined);
      mocks.getDb.mockReturnValue(fake.db);

      await recordAuditLog(null, "login_failed", { email: "a@test.com" });

      expect(fake.valuesMock).toHaveBeenCalledWith({
        userId: null,
        action: "login_failed",
        detail: { email: "a@test.com" },
      });
    });

    it("swallows errors instead of throwing (best-effort logging)", async () => {
      const fake = createFakeDb();
      fake.valuesMock.mockRejectedValue(new Error("db unavailable"));
      mocks.getDb.mockReturnValue(fake.db);

      await expect(
        recordAuditLog("u1", "quota_exceeded"),
      ).resolves.toBeUndefined();
    });

    it("swallows errors even when getDb() itself throws", async () => {
      mocks.getDb.mockImplementation(() => {
        throw new Error("DATABASE_URL is not configured");
      });

      await expect(
        recordAuditLog("u1", "account_disabled_login_attempt"),
      ).resolves.toBeUndefined();
    });
  });
});
