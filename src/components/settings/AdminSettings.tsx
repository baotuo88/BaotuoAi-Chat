"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface AdminUserRow {
  id: string;
  email: string;
  disabled: boolean;
  isAdmin: boolean;
  dailyQuota: number | null;
  effectiveQuota: number;
  quotaUsed: number;
  quotaRemaining: number;
  quotaResetAt: number;
  createdAt: string;
}

interface MeResponse {
  enabled: boolean;
  user: { id: string; email: string; isAdmin?: boolean } | null;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "";
  }
}

const AdminSettings: React.FC = () => {
  const t = useTranslations("Admin");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const meResponse = await fetch("/api/auth/me", {
        headers: { Accept: "application/json" },
      });
      const me = (await meResponse
        .json()
        .catch(() => ({}))) as Partial<MeResponse>;
      const admin = Boolean(me.user?.isAdmin);
      setIsAdmin(admin);
      setCurrentUserId(me.user?.id ?? null);
      if (!admin) {
        setIsLoading(false);
        return;
      }

      const [usersResponse, settingsResponse] = await Promise.all([
        fetch("/api/admin/users", { headers: { Accept: "application/json" } }),
        fetch("/api/admin/settings", {
          headers: { Accept: "application/json" },
        }),
      ]);

      if (!usersResponse.ok || !settingsResponse.ok) {
        throw new Error("Request failed");
      }

      const usersData = (await usersResponse.json()) as {
        users: AdminUserRow[];
      };
      const settingsData = (await settingsResponse.json()) as {
        registrationEnabled: boolean;
      };
      setUsers(usersData.users ?? []);
      setRegistrationEnabled(Boolean(settingsData.registrationEnabled));
    } catch {
      setError(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchUser = useCallback(
    async (userId: string, body: Record<string, unknown>) => {
      setBusyUserId(userId);
      setError(null);
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error("Request failed");
        await load();
      } catch {
        setError(t("actionError"));
      } finally {
        setBusyUserId(null);
      }
    },
    [load, t],
  );

  const handleToggleDisabled = (user: AdminUserRow) => {
    void patchUser(user.id, { disabled: !user.disabled });
  };

  const handleQuotaSave = (user: AdminUserRow, rawValue: string) => {
    const trimmed = rawValue.trim();
    // Empty means clear the override (fall back to deployment default).
    const dailyQuota = trimmed === "" ? null : Number.parseInt(trimmed, 10);
    if (dailyQuota !== null && (!Number.isFinite(dailyQuota) || dailyQuota < 0)) {
      setError(t("invalidQuota"));
      return;
    }
    void patchUser(user.id, { dailyQuota });
  };

  const handleForceLogout = (user: AdminUserRow) => {
    if (!window.confirm(t("confirmForceLogout", { email: user.email }))) return;
    setBusyUserId(user.id);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/users/${user.id}/force-logout`,
          { method: "POST" },
        );
        if (!response.ok) throw new Error("Request failed");
        await load();
      } catch {
        setError(t("actionError"));
      } finally {
        setBusyUserId(null);
      }
    })();
  };

  const handleResetPassword = (user: AdminUserRow) => {
    const newPassword = window.prompt(
      t("promptNewPassword", { email: user.email }),
    );
    if (newPassword === null) return;
    if (newPassword.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    setBusyUserId(user.id);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/users/${user.id}/reset-password`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: newPassword }),
          },
        );
        if (!response.ok) throw new Error("Request failed");
        await load();
        window.alert(t("passwordResetDone", { email: user.email }));
      } catch {
        setError(t("actionError"));
      } finally {
        setBusyUserId(null);
      }
    })();
  };

  const handleToggleRegistration = async () => {
    const next = !registrationEnabled;
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationEnabled: next }),
      });
      if (!response.ok) throw new Error("Request failed");
      setRegistrationEnabled(next);
    } catch {
      setError(t("actionError"));
    }
  };

  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-4 duration-300">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          <ShieldAlert
            size={18}
            className="mt-0.5 shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <p>{t("notAdmin")}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw size={12} aria-hidden="true" />
            {t("refresh")}
          </button>
        </div>

        {/* Registration toggle */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="min-w-0 pr-4">
            <div className="text-sm font-medium text-foreground">
              {t("registrationTitle")}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("registrationDescription")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={registrationEnabled}
            onClick={() => void handleToggleRegistration()}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              registrationEnabled ? "bg-blue-500" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                registrationEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {/* User list */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          {t("usersTitle", { count: users.length })}
        </h3>
        <div className="space-y-3">
          {users.map((user) => (
            <AdminUserCard
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              busy={busyUserId === user.id}
              onToggleDisabled={() => handleToggleDisabled(user)}
              onQuotaSave={(value) => handleQuotaSave(user, value)}
              onForceLogout={() => handleForceLogout(user)}
              onResetPassword={() => handleResetPassword(user)}
            />
          ))}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
};

interface AdminUserCardProps {
  user: AdminUserRow;
  isSelf: boolean;
  busy: boolean;
  onToggleDisabled: () => void;
  onQuotaSave: (value: string) => void;
  onForceLogout: () => void;
  onResetPassword: () => void;
}

const AdminUserCard: React.FC<AdminUserCardProps> = ({
  user,
  isSelf,
  busy,
  onToggleDisabled,
  onQuotaSave,
  onForceLogout,
  onResetPassword,
}) => {
  const t = useTranslations("Admin");
  const [quotaInput, setQuotaInput] = useState<string>(
    user.dailyQuota === null ? "" : String(user.dailyQuota),
  );

  useEffect(() => {
    setQuotaInput(user.dailyQuota === null ? "" : String(user.dailyQuota));
  }, [user.dailyQuota]);

  const quotaDirty =
    quotaInput.trim() !== (user.dailyQuota === null ? "" : String(user.dailyQuota));

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-opacity ${
        user.disabled
          ? "border-red-300/60 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
          : "border-border bg-card"
      } ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
          <UserRound size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {user.email}
            </span>
            {user.isAdmin ? (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {t("adminBadge")}
              </span>
            ) : null}
            {user.disabled ? (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-950 dark:text-red-300">
                {t("disabledBadge")}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {t("joined", { date: formatDate(user.createdAt) })}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* Quota editor */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("quotaLabel")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={quotaInput}
              onChange={(event) => setQuotaInput(event.target.value)}
              placeholder={t("quotaDefaultPlaceholder", {
                value: user.effectiveQuota,
              })}
              className="w-full min-w-0 rounded-lg border border-input bg-muted px-3 py-1.5 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              disabled={!quotaDirty}
              onClick={() => onQuotaSave(quotaInput)}
              className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("save")}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("quotaUsage", {
              used: user.quotaUsed,
              limit: user.effectiveQuota,
            })}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={onToggleDisabled}
            disabled={isSelf}
            title={isSelf ? t("cannotDisableSelf") : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {user.disabled ? t("enable") : t("disable")}
          </button>
          <button
            type="button"
            onClick={onResetPassword}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <KeyRound size={13} aria-hidden="true" />
            {t("resetPassword")}
          </button>
          <button
            type="button"
            onClick={onForceLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <LogOut size={13} aria-hidden="true" />
            {t("forceLogout")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
