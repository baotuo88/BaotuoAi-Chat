/**
 * Shared authorization guard for the admin API routes. Resolves the current
 * user from the account-session cookie and asserts they exist, are active,
 * hold a still-valid session (matching tokenVersion), and are an admin.
 *
 * Throws typed Apierrors so the route's shared catch/`createApiErrorResponse`
 * produces the right status codes:
 *   - AccountsDisabledError (404) when accounts aren't configured at all
 *   - AuthRequiredError (401) when there's no valid session
 *   - AdminRequiredError (403) when the session is valid but not an admin
 */

import type { NextRequest } from "next/server";
import { findUserById } from "@/lib/accounts/accountService";
import { isAccountsEnabled } from "@/lib/db/client";
import {
  AccountsDisabledError,
  AdminRequiredError,
  AuthRequiredError,
} from "@/lib/errors";
import {
  ACCOUNT_SESSION_COOKIE,
  readAccountSessionCookie,
} from "@/lib/security/accountSession";
import type { User } from "@/lib/db/schema";

export async function requireAdmin(request: NextRequest): Promise<User> {
  if (!isAccountsEnabled()) {
    throw new AccountsDisabledError();
  }

  const cookieValue = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value;
  const session = await readAccountSessionCookie(cookieValue);
  if (!session) {
    throw new AuthRequiredError();
  }

  const user = await findUserById(session.userId);
  if (
    !user ||
    user.tokenVersion !== session.tokenVersion ||
    user.disabled
  ) {
    throw new AuthRequiredError();
  }

  if (!user.isAdmin) {
    throw new AdminRequiredError();
  }

  return user;
}
