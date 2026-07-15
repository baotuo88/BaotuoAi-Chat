"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Github, Loader2, X } from "lucide-react";
import { scrapeWebPage, webScrapeResultToMarkdown } from "@/lib/utils/webScrape";
import { importGitHubRepo, githubImportToMarkdown } from "@/lib/utils/githubImport";

interface WebImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (content: string, filename: string) => void;
}

type ImportMode = "web" | "github";

const WebImportModal: React.FC<WebImportModalProps> = ({
  open,
  onClose,
  onImport,
}) => {
  const t = useTranslations("Message");
  const [mode, setMode] = useState<ImportMode>("web");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const markdown = webScrapeResultToMarkdown(result);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {mode === "web" ? "抓取网页" : "导入 GitHub 仓库"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switch */}
        <div className="mb-4 flex gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
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
            <Github size={14} />
            GitHub
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {mode === "web" ? "网页 URL" : "GitHub 仓库 URL"}
          </label>
          <input
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
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {mode === "web"
              ? "自动提取网页正文，转换为 Markdown 附加到对话"
              : "下载仓库代码文件（限 100 个文件 / 5MB），跳过 node_modules 等"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isLoading || !url.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isLoading ? "导入中..." : "导入"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebImportModal;
