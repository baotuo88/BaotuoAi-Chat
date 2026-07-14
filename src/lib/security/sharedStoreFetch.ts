import { getSafeUrlPolicy } from "./urlPolicy";

const SHARED_STORE_TIMEOUT_MS = 10_000;
const SHARED_STORE_MAX_RESPONSE_BYTES = 1024 * 1024;

/**
 * Fetch a shared store (Upstash REST etc.) endpoint.
 *
 * Returns `{ response, data, text, url }`.
 *
 * - When `response.ok` is true and the body is valid JSON, `data` is parsed
 *   (typed as T). When the body cannot be parsed as JSON, `data` is undefined
 *   but `text` still holds the raw response so callers can inspect it.
 * - When `response.ok` is false, JSON parsing is skipped entirely and `data`
 *   is undefined. Callers should read `text` for the raw error message
 *   (e.g. `{"error":"ERR wrong number of arguments"}`) and include it in any
 *   thrown Error so debugging Upstash failures is possible.
 *
 * This intentionally does NOT throw on non-JSON responses — earlier behavior
 * masked Upstash 400 payloads behind a generic "Expected a JSON response"
 * error, making bugs like wrong-command-format essentially undiagnosable.
 */
export async function safeFetchSharedStoreJson<T = unknown>(
  input: string | URL,
  init: RequestInit = {},
): Promise<{
  response: Response;
  data: T | undefined;
  text: string;
  url: string;
}> {
  const { safeFetchText } = await import("./safeFetch");
  const { response, text, url } = await safeFetchText(
    input,
    {
      ...init,
      cache: "no-store",
    },
    {
      policy: getSafeUrlPolicy("sharedStore"),
      timeoutMs: SHARED_STORE_TIMEOUT_MS,
      maxResponseBytes: SHARED_STORE_MAX_RESPONSE_BYTES,
    },
  );

  let data: T | undefined;
  if (response.ok && text.length > 0) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = undefined;
    }
  }

  return { response, data, text, url };
}
