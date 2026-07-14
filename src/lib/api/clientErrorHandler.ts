/**
 * Client-side error handler for API responses. Intercepts common error
 * scenarios (quota exceeded, auth failures, network issues) and presents
 * user-friendly toast notifications.
 */

interface ApiErrorPayload {
  code?: string;
  message?: string;
  retryAfter?: number;
}

export interface ErrorToastConfig {
  title: string;
  description: string;
  variant?: "default" | "destructive";
  duration?: number;
}

/**
 * Parses an API error response and returns a user-friendly toast config.
 * Falls back to generic messages if the response body is missing or malformed.
 */
export async function handleApiError(
  response: Response,
  options?: {
    /** Localized error messages (keyed by error code) */
    messages?: Record<string, string>;
    /** Default title for unknown errors */
    defaultTitle?: string;
    /** Default description for unknown errors */
    defaultDescription?: string;
  },
): Promise<ErrorToastConfig> {
  const defaultTitle = options?.defaultTitle ?? "Request Failed";
  const defaultDescription =
    options?.defaultDescription ?? "An unexpected error occurred.";

  let payload: ApiErrorPayload = {};
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    // Response body is not JSON or empty
  }

  const code = payload.code ?? "UNKNOWN_ERROR";
  const fallbackMessage = payload.message ?? defaultDescription;

  // 429 Quota Exceeded
  if (response.status === 429 && code === "QUOTA_EXCEEDED") {
    const retryAfter = payload.retryAfter ?? parseRetryAfterHeader(response);
    const resetTime = retryAfter
      ? formatResetTime(Date.now() + retryAfter * 1000)
      : "later";

    return {
      title: options?.messages?.QUOTA_EXCEEDED ?? "Daily Quota Exceeded",
      description: `Your daily request limit has been reached. Resets ${resetTime}.`,
      variant: "destructive",
      duration: 8000,
    };
  }

  // 429 Rate Limited (general)
  if (response.status === 429) {
    const retryAfter = parseRetryAfterHeader(response);
    const waitTime = retryAfter ? `${retryAfter} seconds` : "a moment";

    return {
      title: options?.messages?.RATE_LIMITED ?? "Too Many Requests",
      description: `Please wait ${waitTime} before trying again.`,
      variant: "destructive",
      duration: 6000,
    };
  }

  // 401 Unauthorized
  if (response.status === 401) {
    return {
      title: options?.messages?.UNAUTHORIZED ?? "Authentication Required",
      description:
        options?.messages?.UNAUTHORIZED_DESC ??
        "Your session has expired. Please sign in again.",
      variant: "destructive",
      duration: 6000,
    };
  }

  // 403 Forbidden
  if (response.status === 403) {
    return {
      title: options?.messages?.FORBIDDEN ?? "Access Denied",
      description:
        options?.messages?.FORBIDDEN_DESC ??
        "You do not have permission to perform this action.",
      variant: "destructive",
      duration: 6000,
    };
  }

  // 404 Not Found
  if (response.status === 404) {
    return {
      title: options?.messages?.NOT_FOUND ?? "Not Found",
      description:
        options?.messages?.NOT_FOUND_DESC ?? "The requested resource was not found.",
      variant: "destructive",
      duration: 5000,
    };
  }

  // 500+ Server Errors
  if (response.status >= 500) {
    return {
      title: options?.messages?.SERVER_ERROR ?? "Server Error",
      description:
        options?.messages?.SERVER_ERROR_DESC ??
        "The server encountered an error. Please try again later.",
      variant: "destructive",
      duration: 6000,
    };
  }

  // Custom error codes (if provided in messages)
  if (options?.messages?.[code]) {
    return {
      title: options.messages[code],
      description: fallbackMessage,
      variant: "destructive",
      duration: 5000,
    };
  }

  // Generic fallback
  return {
    title: defaultTitle,
    description: fallbackMessage,
    variant: "destructive",
    duration: 5000,
  };
}

/**
 * Parses the Retry-After response header (seconds or HTTP-date).
 * Returns number of seconds to wait, or null if header is absent/invalid.
 */
function parseRetryAfterHeader(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;

  // Try parsing as integer (seconds)
  const seconds = parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  // Try parsing as HTTP-date
  try {
    const date = new Date(header);
    const now = Date.now();
    const diff = Math.floor((date.getTime() - now) / 1000);
    return diff > 0 ? diff : null;
  } catch {
    return null;
  }
}

/**
 * Formats a future timestamp into a human-readable relative time string.
 * Examples: "in 5 minutes", "in 2 hours", "tomorrow at 9:00 AM"
 */
function formatResetTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = timestamp - now;

  if (diffMs <= 0) return "now";

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
  }

  try {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    const tomorrow = new Date(now + 86_400_000);
    if (date.toDateString() === tomorrow.toDateString()) {
      return `tomorrow at ${timeStr}`;
    }

    return `on ${date.toLocaleDateString()} at ${timeStr}`;
  } catch {
    return "later";
  }
}

/**
 * Network error handler for fetch failures (no response received).
 * Returns a toast config indicating connectivity issues.
 */
export function handleNetworkError(options?: {
  title?: string;
  description?: string;
}): ErrorToastConfig {
  return {
    title: options?.title ?? "Network Error",
    description:
      options?.description ??
      "Unable to reach the server. Please check your connection.",
    variant: "destructive",
    duration: 6000,
  };
}
