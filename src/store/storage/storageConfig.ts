import localforage from "localforage";
import type { StateStorage } from "zustand/middleware";
import {
  ensureLegacyGeminiCoreSettingsMigration,
  ensureLegacyGeminiNextChatMigration,
} from "./legacyGeminiMigration";
import { logDevError } from "../../lib/utils/devLogger";

/**
 * Storage Configuration
 * Unified IndexedDB storage for all application data
 */

// Unified storage with multiple stores
export const appDb = localforage.createInstance({
  name: "neo-chat",
  storeName: "app_data",
  description: "Unified application storage",
});

/**
 * Non-httpOnly companion cookie carrying the signed-in user's opaque id.
 * Set by the login/register routes so client-side storage can namespace
 * per-user local data. Must match ACCOUNT_UID_COOKIE in accountSession.ts.
 */
const ACCOUNT_UID_COOKIE = "neo_account_uid";

/**
 * Reads the current account uid from the companion cookie, or null when no
 * account is signed in (or accounts aren't enabled for this deployment). The
 * value is a plain UUID — safe to use as a storage-key suffix.
 */
function getCurrentAccountUid(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ACCOUNT_UID_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(ACCOUNT_UID_COOKIE.length + 1));
  // Guard against odd values; only accept a UUID-shaped token.
  return /^[0-9a-fA-F-]{16,64}$/.test(value) ? value : null;
}

/**
 * Namespaces a persisted storage key by the current account uid so different
 * users on the same browser keep separate local data. When no account is
 * signed in (accounts disabled, or the single-password deployment) the key is
 * returned unchanged, so those deployments behave exactly as before.
 */
function namespacedKey(name: string): string {
  const uid = getCurrentAccountUid();
  return uid ? `${name}::u:${uid}` : name;
}

/**
 * One-time "claim" migration: when a namespaced key has no data yet but the
 * legacy un-namespaced key does, copy the legacy value into the current
 * user's namespace. This preserves history created before per-user
 * namespacing shipped by attributing it to the first user who signs in, while
 * keeping the original (so nothing is destroyed). Runs at most once per key
 * per user (guarded by a marker key).
 */
async function claimLegacyKeyIfNeeded(
  namespaced: string,
  legacyName: string,
): Promise<void> {
  if (namespaced === legacyName) return; // no account signed in
  const claimMarker = `${namespaced}::claimed`;
  try {
    const alreadyClaimed = await appDb.getItem<string>(claimMarker);
    if (alreadyClaimed) return;

    const existingNamespaced = await appDb.getItem<string>(namespaced);
    if (existingNamespaced === null || existingNamespaced === undefined) {
      const legacyValue = await appDb.getItem<string>(legacyName);
      if (legacyValue !== null && legacyValue !== undefined) {
        await appDb.setItem(namespaced, legacyValue);
      }
    }
    await appDb.setItem(claimMarker, "1");
  } catch (error) {
    logDevError("Per-user storage claim migration failed:", error);
  }
}

export const STORAGE_VERSION = 4;
export type StorageVersion = typeof STORAGE_VERSION;

export const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const getAppDbStorage = (): StateStorage => {
  if (typeof window === "undefined") return noopStorage;
  return {
    getItem: async (name) => {
      try {
        await ensureLegacyGeminiNextChatMigration({
          targetDb: appDb,
          localStorageRef: window.localStorage,
          storageKeys: STORAGE_KEYS,
        });
      } catch (error) {
        logDevError("Legacy Gemini data migration failed:", error);
      }
      const key = namespacedKey(name);
      await claimLegacyKeyIfNeeded(key, name);
      return appDb.getItem<string>(key);
    },
    setItem: (name, value) => appDb.setItem(namespacedKey(name), value),
    removeItem: (name) => appDb.removeItem(namespacedKey(name)),
  };
};

export const getBrowserLocalStorage = (): StateStorage => {
  if (typeof window === "undefined") return noopStorage;
  return {
    getItem: (name) => {
      try {
        ensureLegacyGeminiCoreSettingsMigration({
          localStorageRef: window.localStorage,
          storageKeys: STORAGE_KEYS,
        });
      } catch (error) {
        logDevError("Legacy Gemini core settings migration failed:", error);
      }
      return window.localStorage.getItem(name);
    },
    setItem: (name, value) => window.localStorage.setItem(name, value),
    removeItem: (name) => window.localStorage.removeItem(name),
  };
};

// Storage keys
export const STORAGE_KEYS = {
  // Core settings (localStorage via zustand default)
  CORE_SETTINGS: "neo-chat-core-settings",

  // Store names (IndexedDB)
  SETTINGS: "neo-chat-settings",
  CHAT: "neo-chat-storage",
  KNOWLEDGE: "knowledge-storage",
  MEMORY: "neo-chat-memory",
} as const;
