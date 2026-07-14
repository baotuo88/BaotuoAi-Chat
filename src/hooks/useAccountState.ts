import { useEffect, useState } from "react";

export interface AccountState {
  enabled: boolean;
  user: { id: string; email: string } | null;
  quota?: {
    limit: number;
    used: number;
    remaining: number;
    resetAt: number;
    exceeded: boolean;
  };
}

interface AccountApiResponse {
  enabled: boolean;
  user?: { id: string; email: string } | null;
  quota?: {
    limit: number;
    used: number;
    remaining: number;
    resetAt: number;
    exceeded: boolean;
  };
}

let cachedState: AccountState | null = null;
let fetchPromise: Promise<AccountState> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Fetches current account state from /api/auth/me with in-memory caching.
 * Multiple concurrent calls share the same fetch promise to avoid duplicate
 * requests. Cache is invalidated after CACHE_TTL_MS or on explicit refresh.
 */
async function fetchAccountState(force = false): Promise<AccountState> {
  const now = Date.now();

  if (!force && cachedState && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedState;
  }

  if (fetchPromise && !force) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => ({}))) as AccountApiResponse;

      const state: AccountState = {
        enabled: Boolean(data.enabled),
        user: data.user || null,
        quota: data.quota,
      };

      cachedState = state;
      lastFetchTime = Date.now();
      return state;
    } catch {
      const fallback: AccountState = { enabled: false, user: null };
      cachedState = fallback;
      lastFetchTime = Date.now();
      return fallback;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * React hook for account state with shared in-memory cache. Multiple
 * components can use this hook without triggering duplicate API calls.
 *
 * @param autoRefresh - If true, periodically re-fetch quota status
 * @returns Account state, loading flag, and manual refresh function
 */
export function useAccountState(autoRefresh = false) {
  const [state, setState] = useState<AccountState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async (force = false) => {
    setIsLoading(true);
    const newState = await fetchAccountState(force);
    setState(newState);
    setIsLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!autoRefresh || !state?.enabled) return;

    const intervalId = window.setInterval(() => {
      void refresh();
    }, CACHE_TTL_MS);

    return () => window.clearInterval(intervalId);
  }, [autoRefresh, state?.enabled]);

  return { state, isLoading, refresh };
}

/**
 * Invalidates the cache so the next fetch gets fresh data. Useful after
 * actions that change account state (e.g., sign out, quota consumption).
 */
export function invalidateAccountCache(): void {
  cachedState = null;
  lastFetchTime = 0;
  fetchPromise = null;
}
