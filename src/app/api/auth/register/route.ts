import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail, recordAuditLog } from "@/lib/accounts/accountService";
import { isRegistrationEnabled } from "@/lib/accounts/appSettingsService";
import { createApiErrorResponse, readJsonRequestBody } from "@/lib/api/middleware";
import { RegisterRequestSchema } from "@/lib/api/schemas";
import { isAccountsEnabled } from "@/lib/db/client";
import {
  ApiError,
  AccountsDisabledError,
  DuplicateEmailError,
  RegistrationDisabledError,
} from "@/lib/errors";
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_MAX_AGE_SECONDS,
  ACCOUNT_UID_COOKIE,
  createAccountSessionCookieValue,
} from "@/lib/security/accountSession";
import { hashPassword } from "@/lib/security/passwordHash";
import {
  getRateLimitBucket,
  incrementRateLimitBucket,
} from "@/lib/security/rateLimitStore";
import { getRateLimitClientIp } from "@/lib/security/requestGuards";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

const REGISTER_MAX_PER_WINDOW = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function getRegisterThrottleKey(request: NextRequest): string {
  return `auth-register:${getRateLimitClientIp(request)}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAccountsEnabled()) {
      throw new AccountsDisabledError();
    }

    if (!(await isRegistrationEnabled())) {
      throw new RegistrationDisabledError();
    }

    const throttleKey = getRegisterThrottleKey(request);
    const throttleState = await getRateLimitBucket(throttleKey);
    if (throttleState && throttleState.count >= REGISTER_MAX_PER_WINDOW) {
      throw new ApiError(
        "Too many accounts created from this network. Please try again later.",
        429,
        "REGISTER_RATE_LIMITED",
      );
    }

    const body = await readJsonRequestBody(request);
    const parsed = RegisterRequestSchema.parse(body);

    const existing = await findUserByEmail(parsed.email);
    if (existing) {
      throw new DuplicateEmailError();
    }

    await incrementRateLimitBucket(throttleKey, REGISTER_WINDOW_MS);

    const passwordHash = await hashPassword(parsed.password);
    const user = await createUser(parsed.email, passwordHash);
    await recordAuditLog(user.id, "register");

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
    // Non-httpOnly companion cookie so client-side storage can namespace
    // per-user local data. Carries only the opaque userId (not a credential);
    // all authorization still relies on the signed httpOnly session cookie.
    response.cookies.set(ACCOUNT_UID_COOKIE, user.id, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACCOUNT_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return noStore(createApiErrorResponse(error));
  }
}
