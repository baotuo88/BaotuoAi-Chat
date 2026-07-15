import { NextRequest, NextResponse } from "next/server";
import { safeFetchJson, safeFetchArrayBuffer } from "@/lib/security/safeFetch";
import { getSafeUrlPolicy } from "@/lib/security/urlPolicy";
import { safeServerLogError } from "@/lib/utils/safeServerLog";
import { unzipSync, strFromU8 } from "fflate";

const MAX_FILE_SIZE = 500_000; // 500KB per file
const MAX_TOTAL_SIZE = 5_000_000; // 5MB total
const MAX_FILES = 100;
const FETCH_TIMEOUT_MS = 30_000;

// File extensions to include (code files)
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".swift",
  ".php", ".sh", ".bash", ".zsh", ".fish",
  ".md", ".markdown", ".mdx", ".rst", ".txt",
  ".json", ".yaml", ".yml", ".toml", ".xml",
  ".html", ".htm", ".css", ".scss", ".sass", ".less",
  ".sql", ".graphql", ".gql", ".proto",
  ".vue", ".svelte", ".astro",
  ".dockerfile", ".env.example",
]);

// Paths to skip
const SKIP_PATH_PATTERNS = [
  /^node_modules\//,
  /^\.git\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^\.turbo\//,
  /^\.cache\//,
  /^coverage\//,
  /^\.vscode\//,
  /^\.idea\//,
  /\/node_modules\//,
  /\.min\.(js|css)$/,
  /\.map$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
];

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
}

function parseGitHubUrl(url: string): GitHubRepoInfo | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const [owner, repo, tree, branch] = parts;
    return {
      owner,
      repo: repo.replace(/\.git$/, ""),
      branch: tree === "tree" ? branch : undefined,
    };
  } catch {
    return null;
  }
}

function shouldIncludeFile(path: string): boolean {
  // Skip based on path patterns
  for (const pattern of SKIP_PATH_PATTERNS) {
    if (pattern.test(path)) return false;
  }

  // Check extension
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) {
    // No extension - check for special files
    const filename = path.split("/").pop() || "";
    return [
      "README", "LICENSE", "Dockerfile", "Makefile",
      "CHANGELOG", "CONTRIBUTING",
    ].some((special) => filename.toUpperCase().startsWith(special));
  }

  const ext = path.slice(lastDot).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

async function getDefaultBranch(
  owner: string,
  repo: string,
): Promise<string> {
  const { data } = await safeFetchJson<{ default_branch?: string }>(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
    {
      policy: getSafeUrlPolicy("docs"),
      timeoutMs: 10_000,
      maxResponseBytes: 100_000,
    },
  );
  return data?.default_branch || "main";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "GitHub URL is required" },
        { status: 400 },
      );
    }

    const repoInfo = parseGitHubUrl(url);
    if (!repoInfo) {
      return NextResponse.json(
        { error: "Invalid GitHub URL. Expected format: https://github.com/owner/repo" },
        { status: 400 },
      );
    }

    // Resolve default branch if not specified
    const branch = repoInfo.branch || (await getDefaultBranch(repoInfo.owner, repoInfo.repo));

    // Download repository ZIP
    const zipUrl = `https://codeload.github.com/${repoInfo.owner}/${repoInfo.repo}/zip/refs/heads/${branch}`;
    const { response, arrayBuffer } = await safeFetchArrayBuffer(
      zipUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/zip",
        },
      },
      {
        policy: getSafeUrlPolicy("docs"),
        timeoutMs: FETCH_TIMEOUT_MS,
        maxResponseBytes: 50 * 1024 * 1024, // 50MB max download
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download repository: HTTP ${response.status}` },
        { status: response.status },
      );
    }

    // Unzip and filter files
    const zipBytes = new Uint8Array(arrayBuffer);
    const files = unzipSync(zipBytes);

    const fileEntries: Array<{ path: string; content: string; size: number }> = [];
    let totalSize = 0;
    let skippedLarge = 0;
    let skippedType = 0;

    // Files come with owner-repo-branch/ prefix, strip it
    const rootPrefixRegex = /^[^/]+\//;

    for (const [rawPath, bytes] of Object.entries(files)) {
      if (fileEntries.length >= MAX_FILES) break;
      if (totalSize >= MAX_TOTAL_SIZE) break;

      const path = rawPath.replace(rootPrefixRegex, "");
      if (!path || path.endsWith("/")) continue;

      if (!shouldIncludeFile(path)) {
        skippedType++;
        continue;
      }

      if (bytes.length > MAX_FILE_SIZE) {
        skippedLarge++;
        continue;
      }

      try {
        const content = strFromU8(bytes);
        // Skip if content appears to be binary
        if (content.includes("\x00")) {
          skippedType++;
          continue;
        }

        fileEntries.push({
          path,
          content,
          size: bytes.length,
        });
        totalSize += bytes.length;
      } catch {
        skippedType++;
      }
    }

    // Build markdown summary
    let markdown = `# GitHub Repository: ${repoInfo.owner}/${repoInfo.repo}\n\n`;
    markdown += `**Branch:** ${branch}\n`;
    markdown += `**Files included:** ${fileEntries.length}\n`;
    if (skippedLarge > 0) markdown += `**Files skipped (too large):** ${skippedLarge}\n`;
    if (skippedType > 0) markdown += `**Files skipped (type):** ${skippedType}\n`;
    markdown += `\n---\n\n`;

    for (const entry of fileEntries) {
      const ext = entry.path.slice(entry.path.lastIndexOf(".") + 1);
      markdown += `## ${entry.path}\n\n`;
      markdown += "```" + ext + "\n";
      markdown += entry.content;
      markdown += "\n```\n\n";
    }

    return NextResponse.json({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      branch,
      fileCount: fileEntries.length,
      totalSize,
      content: markdown,
    });
  } catch (error) {
    safeServerLogError("GitHub import error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to import repository";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
