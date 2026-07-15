/**
 * GitHub repository import utility
 * Imports code files from a GitHub repository as Markdown context
 */

import { signedApiFetch, readJsonResponseOrThrow } from "@/lib/api/client";

export interface GitHubImportResult {
  owner: string;
  repo: string;
  branch: string;
  fileCount: number;
  totalSize: number;
  content: string;
}

export interface GitHubImportError {
  error: string;
}

/**
 * Import a GitHub repository's code files as markdown context
 * @param url GitHub repository URL (e.g. https://github.com/owner/repo)
 * @returns Structured content with all filtered code files
 */
export async function importGitHubRepo(
  url: string,
  signal?: AbortSignal,
): Promise<GitHubImportResult> {
  const response = await signedApiFetch("/api/github-import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Import failed" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return readJsonResponseOrThrow<GitHubImportResult>(
    response,
    "Failed to import GitHub repository",
  );
}

/**
 * Validate GitHub URL format
 */
export function isValidGitHubUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return false;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length >= 2;
  } catch {
    return false;
  }
}
