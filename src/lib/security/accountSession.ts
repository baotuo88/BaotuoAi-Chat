/**
 * Signed, stateless session cookie for user accounts (email/password SaaS
 * login), mirroring the HMAC signed-cookie pattern used by
 * `accessControl.ts` for the single-password deployment gate.
 *
 * The cookie payload carries `{ userId, tokenVersion }`. `tokenVersion`
 * lets a server-side "log out everywhere" / password-change flow
 * invalidate all previously issued cookies simply by bumping the user's
 * stored `tokenVersion` — no server-side session store is required.
 */

export const ACCOUNT_SESSION_SECRET_ENV = "ACCOUNT_SESSION_SECRET";
export const ACCOUNT_SESSION_COOKIE = "neo_account_session";
export const ACCOUNT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Client-readable companion cookie carrying only the (non-sensitive) user id.
 * The real authentication cookie (`ACCOUNT_SESSION_COOKIE`) stays httpOnly and
 * signed; this one exists purely so client-side code can namespace local
 * IndexedDB/OPFS data per user (so switching accounts in the same browser
 * doesn't leak one user's chat history to another). It carries no
 * authorization weight — the server never trusts it for auth.
 */
export const ACCOUNT_UID_COOKIE = "neo_account_uid";

export interface AccountSessionPayload {
  userId: string;
  tokenVersion: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function getAccountSessionSecret(): string {
  return process.env[ACCOUNT_SESSION_SECRET_ENV]?.trim() || "";
}

/**
 * Whether account-session signing is configured. This is distinct from
 * `isAccountsEnabled()` (which also requires `DATABASE_URL`) so callers
 * that only need cookie signing can check this narrower condition.
 */
export function isAccountSessionConfigured(): boolean {
  return Boolean(getAccountSessionSecret());
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const base64 = padded.padEnd(
    padded.length + ((4 - (padded.length % 4)) % 4),
    "=",
  );
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function normalizeCookieValue(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

async function importSigningKey(
  secret = getAccountSessionSecret(),
): Promise<CryptoKey | null> {
  if (!secret) return null;

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`account-session:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: object): Promise<string> {
  const key = await importSigningKey();
  if (!key) return "";

  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const payloadValue = encodeBase64Url(payloadBytes);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadValue),
  );

  return `${payloadValue}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function verifyPayload<T>(
  cookieValue: string | undefined | null,
): Promise<T | null> {
  const normalized = normalizeCookieValue(cookieValue);
  const [payloadValue, signatureValue] = normalized.split(".");

  if (!payloadValue || !signatureValue) return null;

  const key = await importSigningKey();
  if (!key) return null;

  try {
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(decodeBase64Url(signatureValue)),
      encoder.encode(payloadValue),
    );
    if (!isValid) return null;

    return JSON.parse(decoder.decode(decodeBase64Url(payloadValue))) as T;
  } catch {
    return null;
  }
}

export async function createAccountSessionCookieValue(
  payload: AccountSessionPayload,
): Promise<string> {
  return signPayload({ v: 1, ...payload });
}

/**
 * Verifies the cookie signature and shape, returning the payload. Callers
 * that need to confirm the session is still valid (e.g. after a password
 * change) must additionally compare `tokenVersion` against the current
 * value stored for the user in the database.
 */
export async function readAccountSessionCookie(
  cookieValue: string | undefined | null,
): Promise<AccountSessionPayload | null> {
  const payload = await verifyPayload<{
    v?: number;
    userId?: string;
    tokenVersion?: number;
  }>(cookieValue);

  if (
    payload?.v !== 1 ||
    typeof payload.userId !== "string" ||
    !payload.userId ||
    typeof payload.tokenVersion !== "number"
  ) {
    return null;
  }

  return { userId: payload.userId, tokenVersion: payload.tokenVersion };
}
