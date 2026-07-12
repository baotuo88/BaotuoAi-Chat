import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_LIMITS } from "../config/limits";
import { clearRateLimitStoreForTesting } from "../lib/security/rateLimitStore";
import {
  consumeQuota,
  getDefaultDailyQuota,
  getQuotaStatus,
  resolveDailyQuota,
} from "../lib/security/quota";

describe("quota", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    clearRateLimitStoreForTesting();
  });

  describe("getDefaultDailyQuota", () => {
    it("falls back to ACCOUNT_LIMITS.defaultDailyQuota when unset", () => {
      vi.stubEnv("DEFAULT_DAILY_QUOTA", "");
      expect(getDefaultDailyQuota()).toBe(ACCOUNT_LIMITS.defaultDailyQuota);
    });

    it("falls back when the env value is not a positive number", () => {
      vi.stubEnv("DEFAULT_DAILY_QUOTA", "not-a-number");
      expect(getDefaultDailyQuota()).toBe(ACCOUNT_LIMITS.defaultDailyQuota);

      vi.stubEnv("DEFAULT_DAILY_QUOTA", "0");
      expect(getDefaultDailyQuota()).toBe(ACCOUNT_LIMITS.defaultDailyQuota);

      vi.stubEnv("DEFAULT_DAILY_QUOTA", "-5");
      expect(getDefaultDailyQuota()).toBe(ACCOUNT_LIMITS.defaultDailyQuota);
    });

    it("uses a valid positive env override", () => {
      vi.stubEnv("DEFAULT_DAILY_QUOTA", "500");
      expect(getDefaultDailyQuota()).toBe(500);
    });
  });

  describe("resolveDailyQuota", () => {
    it("uses the per-user override when it is a positive finite number", () => {
      expect(resolveDailyQuota(50)).toBe(50);
      expect(resolveDailyQuota(12.9)).toBe(12);
    });

    it("falls back to the default when the override is null, undefined, zero, or negative", () => {
      vi.stubEnv("DEFAULT_DAILY_QUOTA", "500");
      expect(resolveDailyQuota(null)).toBe(500);
      expect(resolveDailyQuota(undefined)).toBe(500);
      expect(resolveDailyQuota(0)).toBe(500);
      expect(resolveDailyQuota(-10)).toBe(500);
      expect(resolveDailyQuota(Number.NaN)).toBe(500);
    });
  });

  describe("getQuotaStatus", () => {
    it("reports full remaining quota with no usage yet", async () => {
      const status = await getQuotaStatus("user-a", 10, 1_000);
      expect(status).toMatchObject({
        limit: 10,
        used: 0,
        remaining: 10,
        exceeded: false,
      });
    });

    it("does not increment usage when only reading status", async () => {
      const now = 1_000;
      await consumeQuota("user-b", 10, now);
      const first = await getQuotaStatus("user-b", 10, now);
      const second = await getQuotaStatus("user-b", 10, now);

      expect(first.used).toBe(1);
      expect(second.used).toBe(1);
    });
  });

  describe("consumeQuota", () => {
    it("increments usage on each call up to the limit", async () => {
      const now = 1_000;
      const first = await consumeQuota("user-c", 2, now);
      expect(first).toMatchObject({ used: 1, remaining: 1, exceeded: false });

      const second = await consumeQuota("user-c", 2, now);
      expect(second).toMatchObject({ used: 2, remaining: 0, exceeded: false });
    });

    it("marks the status exceeded once usage reaches the limit and stops incrementing on retry", async () => {
      const now = 1_000;
      await consumeQuota("user-d", 1, now);
      const exceeded = await consumeQuota("user-d", 1, now);
      expect(exceeded).toMatchObject({ used: 1, remaining: 0, exceeded: true });

      // A retry after already being exceeded must not further increment the
      // counter (avoids unbounded growth from client retries).
      const retried = await consumeQuota("user-d", 1, now);
      expect(retried).toMatchObject({ used: 1, remaining: 0, exceeded: true });
    });

    it("resets after the quota window elapses", async () => {
      const windowMs = ACCOUNT_LIMITS.quotaWindowMs;
      const start = 1_000;
      await consumeQuota("user-e", 1, start);
      const exceeded = await consumeQuota("user-e", 1, start);
      expect(exceeded.exceeded).toBe(true);

      const afterWindow = start + windowMs + 1;
      const fresh = await consumeQuota("user-e", 1, afterWindow);
      expect(fresh).toMatchObject({ used: 1, remaining: 0, exceeded: false });
    });

    it("tracks separate users independently", async () => {
      const now = 1_000;
      await consumeQuota("user-f", 1, now);
      const other = await getQuotaStatus("user-g", 1, now);
      expect(other.used).toBe(0);
    });
  });
});
