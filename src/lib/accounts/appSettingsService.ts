/**
 * Database-backed accessors for deployment-wide runtime settings stored in
 * the `app_settings` key/value table. These are settings an admin can change
 * at runtime from the admin panel without a redeploy (currently just the
 * new-registration on/off switch).
 *
 * Kept separate from `accountService.ts` so the account (user row) logic and
 * the global-settings logic stay independently testable.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";

export const APP_SETTING_KEYS = {
  registrationEnabled: "registration_enabled",
} as const;

const TRUE_VALUE = "true";
const FALSE_VALUE = "false";

/**
 * Reads a raw setting value, returning null when the key has never been set.
 */
async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

/**
 * Upserts a setting value, bumping `updated_at`.
 */
async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Whether new account registration is currently accepted. Defaults to true
 * when the row is missing so a deployment that hasn't seeded the setting yet
 * keeps behaving as before (open registration).
 */
export async function isRegistrationEnabled(): Promise<boolean> {
  const value = await getSetting(APP_SETTING_KEYS.registrationEnabled);
  if (value === null) return true;
  return value !== FALSE_VALUE;
}

/**
 * Enables or disables new account registration.
 */
export async function setRegistrationEnabled(enabled: boolean): Promise<void> {
  await setSetting(
    APP_SETTING_KEYS.registrationEnabled,
    enabled ? TRUE_VALUE : FALSE_VALUE,
  );
}
