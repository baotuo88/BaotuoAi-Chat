/**
 * Password hashing for account credentials, implemented with Web Crypto
 * (PBKDF2) so it works identically on Node.js and edge/Workers runtimes.
 *
 * Deliberately avoids bcrypt/scrypt native bindings, which are not
 * available in edge runtimes and would break the project's single
 * deployment story across Vercel and Cloudflare Workers.
 */

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BITS = 256;
const HASH_ALGORITHM = "SHA-256";

const encoder = new TextEncoder();

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

function timingSafeBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;

  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

async function derivePbkdf2Bits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    DERIVED_KEY_BITS,
  );

  return new Uint8Array(derived);
}

/**
 * Produces a self-describing hash string of the form:
 *   pbkdf2:<iterations>:<saltBase64Url>:<hashBase64Url>
 * so the work factor and salt can evolve without a schema migration.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derivePbkdf2Bits(password, salt, PBKDF2_ITERATIONS);

  return [
    "pbkdf2",
    String(PBKDF2_ITERATIONS),
    encodeBase64Url(salt),
    encodeBase64Url(derived),
  ].join(":");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = decodeBase64Url(parts[2]);
    expected = decodeBase64Url(parts[3]);
  } catch {
    return false;
  }

  const actual = await derivePbkdf2Bits(password, salt, iterations);
  return timingSafeBytesEqual(actual, expected);
}
