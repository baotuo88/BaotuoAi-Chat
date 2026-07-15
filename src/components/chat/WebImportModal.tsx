"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Globe, Link as LinkIcon, Loader2, X } from "lucide-react";
import {
  scrapeWebPage,
  formatScrapedContentAsMarkdown,
} from "@/lib/utils/webScrape";
import {
  importGitHubRepo,
  type GitHubImportResult,
} from "@/lib/utils/githubImport";

interface WebImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (content: string, filename: string) => void;
}

type ImportMode = "web" | "github";

function githubImportToMarkdown(result: GitHubImportResult): string {
  return result.content;
}

const WebImportModal: React.FC<WebImportModalProps> = ({
  open,
  onClose,
  onImport,
}) => {
  const [mode, setMode] = useState<ImportMode>("web");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleImport = async () => {
    if (!url.trim()) {
      setError("请输入有效的 URL");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (mode === "web") {
        const result = await scrapeWebPage(url.trim());
        const markdown = formatScrapedContentAsMarkdown(result);
        const filename = `${result.title.slice(0, 50).replace(/[^\w一-龥-]/g, "_")}.md`;
        onImport(markdown, filename);
      } else {
        const result = await importGitHubRepo(url.trim());
        const markdown = githubImportToMarkdown(result);
        const filename = `${result.owner}-${result.repo}.md`;
        onImport(markdown, filename);
      }
      setUrl("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="glass-popover w-full max-w-md rounded-2xl border flex flex-col transform transition-transform duration-200 scale-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/50 dark:border-border">
          <h3 className="text-lg font-bold text-gray-800 dark:text-foreground flex items-center gap-2">
            {mode === "web" ? (
              <Globe size={20} className="text-blue-500" aria-hidden="true" />
            ) : (
              <LinkIcon size={20} className="text-blue-500" aria-hidden="true" />
            )}
            {mode === "web" ? "抓取网页" : "导入 GitHub 仓库"}
          </h3>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-accent/50 rounded-full transition-colors text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tab Switch */}
          <div className="flex gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-700/50">
            <button
              type="button"
              onClick={() => setMode("web")}
              disabled={isLoading}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "web"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              }`}
            >
              <Globe size={14} />
              网页
            </button>
            <button
              type="button"
              onClick={() => setMode("github")}
              disabled={isLoading}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "github"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              }`}
            >
              <LinkIcon size={14} />
              GitHub
            </button>
          </div>

          {/* Input Group */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider ml-1">
              {mode === "web" ? "网页 URL" : "GitHub 仓库 URL"}
            </label>
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                mode === "web"
                  ? "https://example.com/article"
                  : "https://github.com/owner/repo"
              }
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) handleImport();
              }}
              className="w-full px-3 py-3 bg-white dark:bg-muted/50 border border-gray-200 dark:border-border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-[border-color,box-shadow] text-sm placeholder-gray-400 text-gray-800 dark:text-foreground focus:outline-none"
            />
            <p className="text-xs text-gray-500 dark:text-muted-foreground ml-1">
              {mode === "web"
                ? "自动提取网页正文，转换为 Markdown 附加到对话"
                : "下载仓库代码文件（限 100 个文件 / 5MB），跳过 node_modules 等"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-1"
            >
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200/50 dark:border-border bg-gray-50/50 dark:bg-card/50 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-muted-foreground hover:bg-white dark:hover:bg-muted rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isLoading || !url.trim()}
            className="flex items-center gap-2 px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isLoading ? "导入中..." : "导入"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WebImportModal;
