/**
 * Per-user request quota tracking for the multi-user SaaS account layer.
 *
 * Reuses the same store abstraction as `rateLimitStore.ts` (in-memory for
 * single-instance/local deployments, Upstash-backed for multi-instance
 * hosted deployments) so quota counters share the same shared-store
 * requirements and fallback behavior already established for rate
 * limiting. Quota is deliberately request-count based (not token-based)
 * per project scope.
 */

import { ACCOUNT_LIMITS } from "@/config/limits";
import {
  getRateLimitBucket,
  incrementRateLimitBucket,
} from "./rateLimitStore";

const DEFAULT_DAILY_QUOTA_ENV = "DEFAULT_DAILY_QUOTA";
const QUOTA_KEY_PREFIX = "quota";

export interface QuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  resetAt: number;
  exceeded: boolean;
}

function quotaKey(userId: string): string {
  return `${QUOTA_KEY_PREFIX}:${userId}`;
}

/**
 * The default daily quota applied to users without a custom `dailyQuota`
 * column value, overridable per deployment via DEFAULT_DAILY_QUOTA.
 */
export function getDefaultDailyQuota(): number {
  const raw = process.env[DEFAULT_DAILY_QUOTA_ENV]?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return ACCOUNT_LIMITS.defaultDailyQuota;
}

/**
 * Resolves the effective quota for a user, honoring a per-user override
 * (e.g. set directly in the database) over the deployment default.
 */
export function resolveDailyQuota(userDailyQuota: number | null | undefined): number {
  if (
    typeof userDailyQuota === "number" &&
    Number.isFinite(userDailyQuota) &&
    userDailyQuota > 0
  ) {
    return Math.trunc(userDailyQuota);
  }
  return getDefaultDailyQuota();
}

/**
 * Reads the current quota usage for a user without incrementing it.
 */
export async function getQuotaStatus(
  userId: string,
  limit: number,
  now = Date.now(),
): Promise<QuotaStatus> {
  const bucket = await getRateLimitBucket(quotaKey(userId), now);
  const used = bucket?.count ?? 0;
  const resetAt = bucket?.resetAt ?? now + ACCOUNT_LIMITS.quotaWindowMs;

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetAt,
    exceeded: used >= limit,
  };
}

/**
 * Checks and consumes one unit of quota for a metered request. If the user
 * is already at or over their limit, the request is rejected and the
 * counter is left untouched (so retries after the window resets aren't
 * penalized by unbounded counter growth). Call this once per metered
 * request, after confirming the account is enabled and not disabled.
 */
export async function consumeQuota(
  userId: string,
  limit: number,
  now = Date.now(),
): Promise<QuotaStatus> {
  const before = await getQuotaStatus(userId, limit, now);
  if (before.exceeded) return before;

  const bucket = await incrementRateLimitBucket(
    quotaKey(userId),
    ACCOUNT_LIMITS.quotaWindowMs,
    now,
  );

  return {
    limit,
    used: bucket.count,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    exceeded: bucket.count > limit,
  };
}
