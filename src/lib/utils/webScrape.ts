/**
 * Web scraping client utility
 * Extracts readable content from URLs via server API
 */

export interface WebScrapeResult {
  url: string;
  title: string;
  description?: string;
  content: string;
  contentLength: number;
}

export interface WebScrapeError {
  error: string;
}

/**
 * Detect URLs in a text string
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const matches = text.match(urlRegex) || [];
  // Remove duplicates and filter out invalid URLs
  const uniqueUrls = Array.from(new Set(matches));
  return uniqueUrls.filter((url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Check if a string is a valid HTTP/HTTPS URL
 */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Scrape a web page and extract readable content
 */
export async function scrapeWebPage(url: string): Promise<WebScrapeResult> {
  const response = await fetch("/api/web-scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorData = (await response
      .json()
      .catch(() => ({ error: "Failed to scrape page" }))) as WebScrapeError;
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return (await response.json()) as WebScrapeResult;
}

/**
 * Format scraped content as markdown for AI context
 */
export function formatScrapedContentAsMarkdown(
  result: WebScrapeResult,
): string {
  const parts: string[] = [];
  parts.push(`# ${result.title}`);
  parts.push(`\n**来源:** ${result.url}`);
  if (result.description) {
    parts.push(`\n**描述:** ${result.description}`);
  }
  parts.push("\n---\n");
  parts.push(result.content);
  return parts.join("\n");
}
