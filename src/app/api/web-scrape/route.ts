import { NextRequest, NextResponse } from "next/server";
import { safeFetchText } from "@/lib/security/safeFetch";
import { getSafeUrlPolicy } from "@/lib/security/urlPolicy";
import { safeServerLogError } from "@/lib/utils/safeServerLog";

const MAX_CONTENT_LENGTH = 500_000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Strip HTML tags and extract readable text content
 */
function extractReadableText(html: string): {
  title: string;
  content: string;
  description?: string;
} {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() || "Untitled";

  // Extract meta description
  const descMatch = html.match(
    /<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i,
  );
  const description = descMatch?.[1]?.trim();

  // Remove script and style tags with their content
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Try to find main content areas (prioritize article, main, div.content)
  const articleMatch = cleanHtml.match(
    /<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i,
  );
  const mainContent = articleMatch?.[1] || cleanHtml;

  // Convert common structural elements to readable format
  let text = mainContent
    // Headings
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n")
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n")
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n")
    // Paragraphs and breaks
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    // Links: keep text but note URL
    .replace(
      /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      "[$2]($1)",
    )
    // Code blocks
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    // Strong/emphasis
    .replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**")
    .replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*")
    // Remove all remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

  if (text.length > MAX_CONTENT_LENGTH) {
    text = text.slice(0, MAX_CONTENT_LENGTH) + "\n\n...(内容已截断)";
  }

  return {
    title,
    content: text,
    ...(description ? { description } : {}),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 },
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP/HTTPS URLs are supported" },
        { status: 400 },
      );
    }

    // Fetch page content with safety limits
    const { response, text } = await safeFetchText(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BaotuoChat/1.0; +https://baotuo.chat)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
      },
      {
        policy: getSafeUrlPolicy("docs"),
        timeoutMs: FETCH_TIMEOUT_MS,
        maxResponseBytes: 5 * 1024 * 1024,
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: HTTP ${response.status}` },
        { status: response.status },
      );
    }

    const extracted = extractReadableText(text);

    return NextResponse.json({
      url,
      title: extracted.title,
      description: extracted.description,
      content: extracted.content,
      contentLength: extracted.content.length,
    });
  } catch (error) {
    safeServerLogError("Web scrape error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to scrape web page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
