/**
 * Database-backed operations for the admin panel: listing users with their
 * current quota usage, changing a user's quota / disabled state, resetting a
 * password, and forcing a user to sign out everywhere.
 *
 * All functions here assume the *caller* has already verified that the
 * requester is an admin (see `requireAdmin` in the admin API routes). They do
 * no authorization themselves — they are pure data operations.
 */

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";
import { getQuotaStatus, resolveDailyQuota } from "@/lib/security/quota";

export interface AdminUserRow {
  id: string;
  email: string;
  disabled: boolean;
  isAdmin: boolean;
  /** Per-user override; null means "use the deployment default". */
  dailyQuota: number | null;
  /** The effective limit actually enforced (override or default). */
  effectiveQuota: number;
  /** Requests consumed in the current rolling window. */
  quotaUsed: number;
  quotaRemaining: number;
  quotaResetAt: number;
  createdAt: string;
}

/**
 * Lists every account, newest first, each annotated with its current quota
 * usage. Quota usage is read (not incremented) from the same store the
 * middleware meters against.
 */
export async function listUsersWithUsage(): Promise<AdminUserRow[]> {
  const db = getDb();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  const now = Date.now();
  return Promise.all(
    rows.map(async (user) => {
      const effectiveQuota = resolveDailyQuota(user.dailyQuota);
      const quota = await getQuotaStatus(user.id, effectiveQuota, now);
      return {
        id: user.id,
        email: user.email,
        disabled: user.disabled,
        isAdmin: user.isAdmin,
        dailyQuota: user.dailyQuota,
        effectiveQuota,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        quotaResetAt: quota.resetAt,
        createdAt: user.createdAt.toISOString(),
      };
    }),
  );
}

/**
 * Updates a user's per-user daily quota override. Pass null to clear the
 * override so the account falls back to the deployment default.
 */
export async function updateUserQuota(
  userId: string,
  dailyQuota: number | null,
): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .update(users)
    .set({ dailyQuota, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
}

/**
 * Enables or disables an account. A disabled account cannot authenticate and
 * its existing sessions are rejected by the account gate.
 */
export async function updateUserDisabled(
  userId: string,
  disabled: boolean,
): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .update(users)
    .set({ disabled, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
}

/**
 * Sets a new password hash for a user and bumps `tokenVersion` so every
 * previously issued session cookie is immediately invalidated (the user must
 * sign in again with the new password). Caller supplies an already-hashed
 * password.
 */
export async function resetUserPassword(
  userId: string,
  passwordHash: string,
): Promise<User | null> {
  const db = getDb();
  const existing = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existing[0]) return null;

  const rows = await db
    .update(users)
    .set({
      passwordHash,
      tokenVersion: existing[0].tokenVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
}

/**
 * Forces a user to sign out of every device by bumping `tokenVersion`, which
 * invalidates all outstanding session cookies without changing the password.
 */
export async function forceUserLogout(userId: string): Promise<User | null> {
  const db = getDb();
  const existing = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existing[0]) return null;

  const rows = await db
    .update(users)
    .set({
      tokenVersion: existing[0].tokenVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
}
