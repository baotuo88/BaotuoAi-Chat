"use client";

import React, { useCallback, useEffect, useState } from "react";
import { LogOut, RefreshCw, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  resetAt: number;
  exceeded: boolean;
}

interface AccountMeResponse {
  enabled: boolean;
  user: { id: string; email: string } | null;
  quota?: QuotaInfo;
}

function formatDateTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "";
  }
}

const AccountSettings: React.FC = () => {
  const t = useTranslations("Account");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [state, setState] = useState<AccountMeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = (await response
        .json()
        .catch(() => ({}))) as Partial<AccountMeResponse>;
      if (!response.ok) {
        throw new Error("Request failed");
      }
      setState({
        enabled: Boolean(data.enabled),
        user: data.user ?? null,
        quota: data.quota,
      });
    } catch {
      setError(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed");
      // Hard reload (not router.refresh) so the client-side zustand stores are
      // torn down; the next user starts from their own namespace.
      window.location.assign("/");
    } catch {
      setError(t("signOutError"));
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-4 duration-300">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!state?.enabled) {
    return (
      <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t("disabledDescription")}
        </p>
      </section>
    );
  }

  if (!state.user) {
    return (
      <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("notSignedIn")}</p>
      </section>
    );
  }

  const quota = state.quota;
  const quotaPercent = quota
    ? Math.min(100, Math.round((quota.used / Math.max(1, quota.limit)) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
              <UserRound size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("emailLabel")}
              </div>
              <div className="truncate text-sm font-medium text-foreground">
                {state.user.email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={14} aria-hidden="true" />
              {isSigningOut ? t("signingOut") : t("signOut")}
            </button>
          </div>
        </div>
      </section>

      {quota ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              {t("quotaTitle")}
            </h3>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw size={12} aria-hidden="true" />
              {t("refresh")}
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {t("quotaUsage", {
                  used: quota.used,
                  limit: quota.limit,
                })}
              </div>
              <div className="text-sm font-medium text-foreground">
                {t("quotaRemaining", { remaining: quota.remaining })}
              </div>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={quota.limit}
              aria-valuenow={quota.used}
            >
              <div
                className={`h-full transition-all ${
                  quota.exceeded
                    ? "bg-red-500"
                    : quotaPercent >= 80
                      ? "bg-amber-500"
                      : "bg-blue-500"
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("quotaResetAt", { at: formatDateTime(quota.resetAt) })}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("quotaDescription")}
            </p>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
};

export default AccountSettings;
