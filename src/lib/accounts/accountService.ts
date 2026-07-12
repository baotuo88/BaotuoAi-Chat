/**
 * Database-backed operations for the account layer (register/login/audit).
 * Kept separate from the API route handlers so routes stay thin, mirroring
 * how `accessControl.ts` separates logic from `access/verify/route.ts`.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditLogs, users, type User } from "@/lib/db/schema";

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(userId: string): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createUser(
  email: string,
  passwordHash: string,
): Promise<User> {
  const db = getDb();
  const rows = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning();
  return rows[0];
}

export type AuditAction =
  | "register"
  | "login"
  | "login_failed"
  | "quota_exceeded"
  | "account_disabled_login_attempt";

/**
 * Best-effort audit log write. Failures are swallowed so a logging hiccup
 * never blocks a login/register response.
 */
export async function recordAuditLog(
  userId: string | null,
  action: AuditAction,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLogs).values({ userId, action, detail });
  } catch {
    // Auditing is best-effort; never fail the request because of it.
  }
}
