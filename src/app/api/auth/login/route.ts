import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, recordAuditLog } from "@/lib/accounts/accountService";
import { createApiErrorResponse, readJsonRequestBody } from "@/lib/api/middleware";
import { LoginRequestSchema } from "@/lib/api/schemas";
import { isAccountsEnabled } from "@/lib/db/client";
import {
  AccountDisabledError,
  AccountsDisabledError,
  InvalidCredentialsError,
} from "@/lib/errors";
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_MAX_AGE_SECONDS,
  createAccountSessionCookieValue,
} from "@/lib/security/accountSession";
import { verifyPassword } from "@/lib/security/passwordHash";
import {
  getRateLimitBucket,
  incrementRateLimitBucket,
  resetRateLimitBucket,
} from "@/lib/security/rateLimitStore";
import { getRateLimitClientIp } from "@/lib/security/requestGuards";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// Dual-layer lockout mirroring `access/verify/route.ts`: throttle by client
// IP (defends against brute-forcing many accounts from one source) and by
// account email (defends against credential-stuffing one account from many
// IPs), independently of each other.
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_LOCKOUT_MS = 30 * 60 * 1000;

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function getIpFailureKey(request: NextRequest): string {
  return `auth-login-ip:${getRateLimitClientIp(request)}`;
}

function getAccountFailureKey(email: string): string {
  return `auth-login-account:${email}`;
}

function isLocked(bucket: { count: number; resetAt: number } | null): boolean {
  return Boolean(bucket && bucket.count >= LOGIN_MAX_ATTEMPTS);
}

export async function POST(request: NextRequest) {
  try {
    if (!isAccountsEnabled()) {
      throw new AccountsDisabledError();
    }

    const ipFailureKey = getIpFailureKey(request);
    const ipFailures = await getRateLimitBucket(ipFailureKey);
    if (isLocked(ipFailures)) {
      return noStore(
        NextResponse.json(
          {
            error: "Too many login attempts. Please try again later.",
            code: "LOGIN_LOCKED",
            lockedUntil: ipFailures!.resetAt,
          },
          { status: 423 },
        ),
      );
    }

    const body = await readJsonRequestBody(request);
    const parsed = LoginRequestSchema.parse(body);

    const accountFailureKey = getAccountFailureKey(parsed.email);
    const accountFailures = await getRateLimitBucket(accountFailureKey);
    if (isLocked(accountFailures)) {
      return noStore(
        NextResponse.json(
          {
            error: "Too many login attempts. Please try again later.",
            code: "LOGIN_LOCKED",
            lockedUntil: accountFailures!.resetAt,
          },
          { status: 423 },
        ),
      );
    }

    const user = await findUserByEmail(parsed.email);
    const passwordValid = user
      ? await verifyPassword(parsed.password, user.passwordHash)
      : false;

    if (!user || !passwordValid) {
      await incrementRateLimitBucket(ipFailureKey, LOGIN_LOCKOUT_MS);
      await incrementRateLimitBucket(accountFailureKey, LOGIN_LOCKOUT_MS);
      await recordAuditLog(user?.id ?? null, "login_failed", {
        email: parsed.email,
      });
      throw new InvalidCredentialsError();
    }

    if (user.disabled) {
      await recordAuditLog(user.id, "account_disabled_login_attempt");
      throw new AccountDisabledError();
    }

    await resetRateLimitBucket(ipFailureKey);
    await resetRateLimitBucket(accountFailureKey);
    await recordAuditLog(user.id, "login");

    const response = noStore(
      NextResponse.json({
        ok: true,
        user: { id: user.id, email: user.email },
      }),
    );
    response.cookies.set(
      ACCOUNT_SESSION_COOKIE,
      await createAccountSessionCookieValue({
        userId: user.id,
        tokenVersion: user.tokenVersion,
      }),
      { ...cookieOptions, maxAge: ACCOUNT_SESSION_MAX_AGE_SECONDS },
    );
    return response;
  } catch (error) {
    return noStore(createApiErrorResponse(error));
  }
}
