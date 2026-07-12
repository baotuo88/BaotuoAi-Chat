/**
 * Drizzle ORM schema for the multi-user SaaS account layer.
 *
 * Scope is deliberately minimal per project decision: only accounts and
 * quota tracking live server-side. Chat history, knowledge bases, and all
 * other user content remain local-first (IndexedDB/OPFS) and are never
 * written to this database.
 *
 * There is intentionally no admin UI for this data — quota/ban changes are
 * made by editing rows directly (see docs/environment-variables.md).
 */

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),

  /**
   * Bumped to invalidate every previously issued session cookie for this
   * user (e.g. on password change or manual "log out everywhere").
   */
  tokenVersion: integer("token_version").notNull().default(0),

  /**
   * Max AI requests allowed per rolling 24h window. Null means "use the
   * DEFAULT_DAILY_QUOTA env value". Edit directly in the database to grant
   * a custom quota to a specific account.
   */
  dailyQuota: integer("daily_quota"),

  /**
   * Manual kill switch for abuse control. Set to true directly in the
   * database to block an account from authenticating.
   */
  disabled: boolean("disabled").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * Nullable so system-level or pre-auth events (e.g. a failed login for
   * an unknown email) can still be recorded without a foreign key.
   */
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),

  /** e.g. "register", "login", "login_failed", "quota_exceeded" */
  action: text("action").notNull(),

  /** Arbitrary structured detail (ip, userAgent, reason, etc). */
  detail: jsonb("detail"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
