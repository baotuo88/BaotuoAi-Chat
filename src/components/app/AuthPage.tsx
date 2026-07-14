"use client";

import React, { useState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

type AuthMode = "login" | "register";

type AuthApiResponse = {
  ok?: boolean;
  code?: string;
  lockedUntil?: number;
};

const ERROR_CODE_KEYS: Record<string, string> = {
  INVALID_CREDENTIALS: "invalidCredentials",
  DUPLICATE_EMAIL: "duplicateEmail",
  ACCOUNT_DISABLED: "accountDisabled",
  LOGIN_LOCKED: "locked",
  REGISTER_RATE_LIMITED: "registerRateLimited",
  VALIDATION_ERROR: "validationError",
  REGISTRATION_DISABLED: "registrationDisabled",
};

export default function AuthPage() {
  const t = useTranslations("Auth");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const canSubmit = trimmedEmail.length > 0 && password.length >= 8;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setErrorKey(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = (await response.json().catch(() => ({}))) as AuthApiResponse;

      if (response.ok && data.ok) {
        // Hard reload (not router.refresh) so the client-side zustand stores
        // are torn down and re-hydrated under the new user's storage
        // namespace. A soft refresh would keep the previous store instances in
        // memory and could write one user's state into another's namespace.
        window.location.assign("/");
        return;
      }

      setErrorKey(
        (data.code && ERROR_CODE_KEYS[data.code]) || "genericError",
      );
    } catch {
      setErrorKey("genericError");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((current) => (current === "login" ? "register" : "login"));
    setErrorKey(null);
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
            <UserRound size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal text-foreground">
              {mode === "login" ? t("loginTitle") : t("registerTitle")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login" ? t("loginSubtitle") : t("registerSubtitle")}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-surface rounded-lg border p-4 shadow-sm"
        >
          <label
            htmlFor="auth-email"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {t("emailLabel")}
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            spellCheck={false}
            disabled={isSubmitting}
            placeholder={t("emailPlaceholder")}
            className="mb-3 w-full min-w-0 rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground transition-[background-color,border-color,box-shadow,color] placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-blue-400"
          />

          <label
            htmlFor="auth-password"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {t("passwordLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id="auth-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              spellCheck={false}
              disabled={isSubmitting}
              placeholder={t("passwordPlaceholder")}
              className="min-w-0 flex-1 rounded-lg border border-input bg-muted px-3 py-2 font-mono text-sm text-foreground transition-[background-color,border-color,box-shadow,color] placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={
                isSubmitting
                  ? t("submitting")
                  : mode === "login"
                    ? t("loginSubmit")
                    : t("registerSubmit")
              }
            >
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 min-h-5 text-xs">
            {errorKey ? (
              <p className="text-red-600 dark:text-red-300">{t(errorKey)}</p>
            ) : (
              <p className="text-muted-foreground">{t("passwordHint")}</p>
            )}
          </div>
        </form>

        <button
          type="button"
          onClick={toggleMode}
          disabled={isSubmitting}
          className="mt-4 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mode === "login" ? t("switchToRegister") : t("switchToLogin")}
        </button>
      </div>
    </main>
  );
}
