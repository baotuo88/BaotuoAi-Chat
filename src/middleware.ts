import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "./lib/accounts/accountService";
import {
  ACCESS_ATTEMPTS_COOKIE,
  ACCESS_ERROR_CODES,
  ACCESS_SESSION_COOKIE,
  getAccessAttemptState,
  isAccessLocked,
  isAccessPasswordEnabled,
  isValidAccessSessionCookie,
} from "./lib/security/accessControl";
import {
  ACCOUNT_SESSION_COOKIE,
  readAccountSessionCookie,
} from "./lib/security/accountSession";
import { isAccountsEnabled } from "./lib/db/client";
import { applyRequestGuards } from "./lib/security/requestGuards";
import { REQUEST_PROOF_SESSION_PATH } from "./lib/security/requestProof";
import { consumeQuota, resolveDailyQuota } from "./lib/security/quota";

const ACCESS_VERIFY_PATH = "/api/access/verify";

const ACCOUNT_ERROR_CODES = {
  required: "ACCOUNT_SESSION_REQUIRED",
  quotaExceeded: "QUOTA_EXCEEDED",
} as const;

// Paths reachable before a user is logged in (auth flow itself, the
// deployment-password gate, request-proof bootstrap, and health checks).
const ACCOUNT_GATE_ALLOWLIST = [
  /^\/api\/auth(?:\/|$)/,
  /^\/api\/access\/verify$/,
  /^\/api\/health$/,
];

// Routes that consume AI/provider resources and should count against a
// user's daily request quota. Mirrors the mutating-route subset of
// RATE_LIMIT_RULES in requestGuards.ts (chat/search/rag/voice/doc-parse),
// excluding metadata-only endpoints like plugins/agents/providers listings.
const METERED_PATH_PATTERNS: RegExp[] = [
  /^\/api\/chat(?:\/|$)/,
  /^\/api\/search$/,
  /^\/api\/rag(?:\/|$)/,
  /^\/api\/voice(?:\/|$)/,
  /^\/api\/doc-parse(?:\/|$)/,
];

function isAccountGateAllowlisted(pathname: string): boolean {
  if (pathname === REQUEST_PROOF_SESSION_PATH) return true;
  return ACCOUNT_GATE_ALLOWLIST.some((pattern) => pattern.test(pathname));
}

function isMeteredPath(pathname: string): boolean {
  return METERED_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function jsonError(
  status: number,
  payload: Record<string, unknown>,
): NextResponse {
  const response = NextResponse.json(
    { ...payload, statusCode: status },
    { status },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function enforceAccessPasswordGate(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!isAccessPasswordEnabled()) return null;

  if (
    request.nextUrl.pathname === ACCESS_VERIFY_PATH ||
    request.nextUrl.pathname === REQUEST_PROOF_SESSION_PATH
  ) {
    return null;
  }

  const sessionCookie = request.cookies.get(ACCESS_SESSION_COOKIE)?.value;
  if (await isValidAccessSessionCookie(sessionCookie)) {
    return null;
  }

  const attemptState = await getAccessAttemptState(
    request.cookies.get(ACCESS_ATTEMPTS_COOKIE)?.value,
  );
  if (isAccessLocked(attemptState)) {
    return jsonError(423, {
      error: "Access is temporarily locked",
      code: ACCESS_ERROR_CODES.locked,
      lockedUntil: attemptState.lockedUntil,
    });
  }

  return jsonError(401, {
    error: "Access password is required",
    code: ACCESS_ERROR_CODES.required,
  });
}

/**
 * Account-session gating, layered on top of the deployment-wide access
 * password gate above. Only active when `isAccountsEnabled()` (i.e.
 * `DATABASE_URL` configured) — deployments without accounts configured
 * keep working exactly as before. When active, every non-allowlisted API
 * route requires a valid per-user session, and metered AI routes
 * additionally consume one unit of daily quota.
 */
async function enforceAccountGate(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!isAccountsEnabled()) return null;

  const pathname = request.nextUrl.pathname;
  if (isAccountGateAllowlisted(pathname)) return null;

  const sessionCookie = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value;
  const session = await readAccountSessionCookie(sessionCookie);
  if (!session) {
    return jsonError(401, {
      error: "Sign in is required",
      code: ACCOUNT_ERROR_CODES.required,
    });
  }

  const user = await findUserById(session.userId);
  if (!user || user.tokenVersion !== session.tokenVersion || user.disabled) {
    return jsonError(401, {
      error: "Sign in is required",
      code: ACCOUNT_ERROR_CODES.required,
    });
  }

  if (!isMeteredPath(pathname)) return null;

  const limit = resolveDailyQuota(user.dailyQuota);
  const quota = await consumeQuota(user.id, limit);
  if (quota.exceeded) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((quota.resetAt - Date.now()) / 1000),
    );
    const response = jsonError(429, {
      error: "Daily request quota exceeded. Please try again later.",
      code: ACCOUNT_ERROR_CODES.quotaExceeded,
      retryAfter: retryAfterSeconds,
      resetAt: quota.resetAt,
    });
    response.headers.set("Retry-After", String(retryAfterSeconds));
    return response;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const guardResponse = await applyRequestGuards(request);
  if (guardResponse) return guardResponse;

  const accessResponse = await enforceAccessPasswordGate(request);
  if (accessResponse) return accessResponse;

  const accountResponse = await enforceAccountGate(request);
  if (accountResponse) return accountResponse;

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
