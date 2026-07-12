/**
 * Database client for the account/quota layer, backed by Neon's HTTP
 * driver (works from both Vercel serverless/edge functions and Cloudflare
 * Workers without a persistent TCP connection).
 *
 * The account system as a whole is optional: it only activates when
 * `DATABASE_URL` is configured. Deployments that don't set it keep working
 * exactly as before (single `ACCESS_PASSWORD` gate, fully local-first,
 * no accounts).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const DATABASE_URL_ENV = "DATABASE_URL";

export function getDatabaseUrl(): string {
  return process.env[DATABASE_URL_ENV]?.trim() || "";
}

/**
 * Whether the multi-user account system (register/login, quotas, audit
 * log) is active for this deployment. Gate any account-related route or
 * middleware behavior behind this check so accounts remain fully opt-in.
 */
export function isAccountsEnabled(): boolean {
  return Boolean(getDatabaseUrl());
}

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let cachedUrl = "";

/**
 * Lazily creates (and memoizes) the drizzle client. Throws if
 * `DATABASE_URL` is not configured — callers must check
 * `isAccountsEnabled()` first.
 */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured; accounts are disabled for this deployment.",
    );
  }

  if (!cachedDb || cachedUrl !== url) {
    cachedDb = drizzle(neon(url), { schema });
    cachedUrl = url;
  }

  return cachedDb;
}
