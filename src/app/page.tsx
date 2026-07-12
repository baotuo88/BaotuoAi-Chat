import { cookies } from "next/headers";
import AccessPasswordPage from "@/components/app/AccessPasswordPage";
import AuthPage from "@/components/app/AuthPage";
import ChatApp from "@/components/app/ChatApp";
import { findUserById } from "@/lib/accounts/accountService";
import {
  ACCESS_ATTEMPTS_COOKIE,
  ACCESS_SESSION_COOKIE,
  getAccessAttemptState,
  isAccessLocked,
  isAccessPasswordEnabled,
  isValidAccessSessionCookie,
} from "@/lib/security/accessControl";
import {
  ACCOUNT_SESSION_COOKIE,
  readAccountSessionCookie,
} from "@/lib/security/accountSession";
import { isAccountsEnabled } from "@/lib/db/client";

async function renderAccountGate() {
  if (!isAccountsEnabled()) {
    return <ChatApp />;
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
  const session = await readAccountSessionCookie(sessionCookie);
  if (session) {
    const user = await findUserById(session.userId);
    if (user && user.tokenVersion === session.tokenVersion && !user.disabled) {
      return <ChatApp />;
    }
  }

  return <AuthPage />;
}

export default async function Page() {
  if (!isAccessPasswordEnabled()) {
    return renderAccountGate();
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ACCESS_SESSION_COOKIE)?.value;
  if (await isValidAccessSessionCookie(sessionCookie)) {
    return renderAccountGate();
  }

  const attemptState = await getAccessAttemptState(
    cookieStore.get(ACCESS_ATTEMPTS_COOKIE)?.value,
  );

  if (isAccessLocked(attemptState)) {
    return <AccessPasswordPage initialLockedUntil={attemptState.lockedUntil} />;
  }

  return <AccessPasswordPage />;
}
