"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Copy, Check, RotateCw, Plus, Trash2 } from "lucide-react";
import type { ModelInfo } from "@/services/api/chatService";
import { streamChatResponse } from "@/services/api/chatService";
import MessageItem from "@/components/chat/MessageItem";
import { useComparisonStore } from "@/store/core/comparisonStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ModelComparisonViewProps {
  availableModels: ModelInfo[];
  onClose: () => void;
}

const displayNameFor = (
  model: string,
  availableModels: ModelInfo[],
): string => {
  const info = availableModels.find((m) => m.name === model);
  if (info) return info.displayName;
  // Fallback: strip provider prefix "providerId:modelName"
  const idx = model.indexOf(":");
  return idx > 0 ? model.slice(idx + 1) : model;
};

export const ModelComparisonView: React.FC<ModelComparisonViewProps> = ({
  availableModels,
  onClose,
}) => {
  const columns = useComparisonStore((s) => s.columns);
  const addModel = useComparisonStore((s) => s.addModel);
  const removeModel = useComparisonStore((s) => s.removeModel);
  const regenerate = useComparisonStore((s) => s.regenerate);
  const patchColumn = useComparisonStore((s) => s.patchColumn);
  const updateAssistantContent = useComparisonStore(
    (s) => s.updateAssistantContent,
  );

  // Subscribe only to generation-relevant fields to avoid re-triggering on content updates
  const generationTrigger = useComparisonStore(
    (s) =>
      s.columns
        .map((c) => {
          const last = c.messages[c.messages.length - 1];
          return `${c.model}:${c.isGenerating}:${last?.id || 'none'}:${last?.content ? 'filled' : 'empty'}`;
        })
        .join('|'),
    (a, b) => a === b, // Custom equality function to prevent unnecessary updates
  );

  const [copiedModel, setCopiedModel] = useState<string | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  // Track which (model + last message id) pairs we've already started, so a
  // re-render doesn't re-fire an in-flight or completed generation.
  const startedRef = useRef<Set<string>>(new Set());

  const runGeneration = useCallback(
    async (model: string) => {
      const state = useComparisonStore.getState();
      const column = state.columns.find((c) => c.model === model);
      if (!column) return;

      const lastMessage = column.messages[column.messages.length - 1];
      if (!lastMessage || lastMessage.role !== "model" || lastMessage.content) {
        return;
      }

      // History = all messages before the trailing placeholder.
      const history = column.messages.slice(0, -1);
      const lastUser = [...history].reverse().find((m) => m.role === "user");
      if (!lastUser) return;
      const priorHistory = history.slice(0, history.length - 1);

      const key = `${model}::${lastMessage.id}`;
      if (startedRef.current.has(key)) return;
      startedRef.current.add(key);

      const abortController = new AbortController();
      abortControllersRef.current.set(model, abortController);

      // Throttle content updates to avoid triggering too many re-renders
      let contentBuffer = "";
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 100; // Update every 100ms instead of every chunk

      const flushContent = () => {
        if (contentBuffer) {
          updateAssistantContent(model, lastMessage.id, contentBuffer);
        }
      };

      try {
        await streamChatResponse(
          "comparison",
          model,
          priorHistory,
          lastUser.content,
          [],
          {},
          (text) => {
            contentBuffer = text;
            const now = Date.now();
            if (now - lastUpdateTime >= UPDATE_INTERVAL) {
              flushContent();
              lastUpdateTime = now;
            }
          },
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          abortController.signal,
        );
        // Flush any remaining content
        flushContent();
        patchColumn(model, { isGenerating: false });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        patchColumn(model, {
          isGenerating: false,
          error: error instanceof Error ? error.message : "生成失败",
        });
      } finally {
        abortControllersRef.current.delete(model);
      }
    },
    [patchColumn, updateAssistantContent],
  );

  // Drive generation for any column whose trailing message is an empty
  // assistant placeholder and is flagged generating.
  useEffect(() => {
    columns.forEach((column) => {
      if (!column.isGenerating) return;
      const last = column.messages[column.messages.length - 1];
      if (last && last.role === "model" && !last.content) {
        runGeneration(column.model);
      }
    });
  }, [generationTrigger, runGeneration]);

  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const handleCopy = async (model: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedModel(model);
      setTimeout(() => setCopiedModel(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleStop = (model: string) => {
    const controller = abortControllersRef.current.get(model);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(model);
    }
    patchColumn(model, { isGenerating: false });
  };

  const handleRegenerate = (model: string) => {
    handleStop(model);
    regenerate(model);
  };

  const handleRemove = (model: string) => {
    handleStop(model);
    removeModel(model);
  };

  const activeModels = new Set(columns.map((c) => c.model));
  const addableModels = availableModels.filter(
    (m) => !activeModels.has(m.name),
  );

  return (
    <div className="w-full">
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-pink-50/50 p-4 shadow-sm backdrop-blur-sm dark:border-gray-700/50 dark:from-gray-800/50 dark:via-gray-800/30 dark:to-gray-800/50">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent dark:from-gray-100 dark:to-gray-300">
              模型对比
            </h2>
          </div>
          <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
            {columns.length} 个模型并行响应 · 继续追问以对比更多轮次
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {addableModels.length > 0 && columns.length < 4 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 shadow-sm transition-all hover:bg-blue-100 hover:shadow-md dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  title="添加模型"
                >
                  <Plus size={14} />
                  <span>添加模型</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-72 w-56 overflow-y-auto"
              >
                {addableModels.map((m) => (
                  <DropdownMenuItem
                    key={m.name}
                    onSelect={() => addModel(m.name)}
                  >
                    <span className="truncate">{m.displayName}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition-all hover:bg-gray-200/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
            aria-label="关闭对比"
            title="关闭对比"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 对比列：横向滚动，每列固定宽度，便于并排阅读 */}
      <div className="-mx-1 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600">
        <div className="flex gap-4 px-1">
          {columns.map((column, index) => {
            const answered = column.messages.some(
              (m) => m.role === "model" && m.content,
            );
            const lastAssistant = [...column.messages]
              .reverse()
              .find((m) => m.role === "model" && m.content);

            // Gradient colors for each column
            const gradients = [
              'from-blue-500/10 to-cyan-500/10 dark:from-blue-900/20 dark:to-cyan-900/20',
              'from-purple-500/10 to-pink-500/10 dark:from-purple-900/20 dark:to-pink-900/20',
              'from-orange-500/10 to-red-500/10 dark:from-orange-900/20 dark:to-red-900/20',
              'from-green-500/10 to-emerald-500/10 dark:from-green-900/20 dark:to-emerald-900/20',
            ];
            const gradient = gradients[index % gradients.length];

            return (
              <div
                key={column.model}
                className={`flex w-96 shrink-0 flex-col rounded-2xl border border-gray-200/80 bg-gradient-to-b ${gradient} shadow-lg backdrop-blur-sm transition-all hover:shadow-xl dark:border-gray-700/50`}
              >
                {/* 列头 */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-2xl border-b border-gray-200/50 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-900/80">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="truncate text-sm font-bold text-gray-900 dark:text-gray-100"
                      title={column.model}
                    >
                      {displayNameFor(column.model, availableModels)}
                    </h3>
                    {column.isGenerating && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">生成中...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {column.isGenerating ? (
                      <button
                        onClick={() => handleStop(column.model)}
                        className="rounded-lg p-1.5 text-gray-500 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        aria-label="停止生成"
                        title="停止生成"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRegenerate(column.model)}
                        className="rounded-lg p-1.5 text-gray-500 transition-all hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                        aria-label="重新生成"
                        title="重新生成"
                      >
                        <RotateCw size={16} />
                      </button>
                    )}
                    {lastAssistant && (
                      <button
                        onClick={() =>
                          handleCopy(column.model, lastAssistant.content)
                        }
                        className="rounded-lg p-1.5 text-gray-500 transition-all hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400"
                        aria-label="复制最新回答"
                        title="复制最新回答"
                      >
                        {copiedModel === column.model ? (
                          <Check size={16} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(column.model)}
                      className="rounded-lg p-1.5 text-gray-500 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      aria-label="移除该模型"
                      title="移除该模型"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* 对话内容：整列多轮消息 */}
                <div className="flex-1 space-y-2 overflow-y-auto p-4 pb-12">
                  {column.messages.map((message) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      isTyping={
                        column.isGenerating &&
                        message.role === "model" &&
                        !message.content
                      }
                    />
                  ))}
                  {column.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
                      <div className="flex items-start gap-2">
                        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>{column.error}</span>
                      </div>
                    </div>
                  ) : column.isGenerating && !answered ? (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50/50 px-3 py-2 text-gray-600 dark:bg-blue-900/20 dark:text-gray-400">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-blue-800 dark:border-t-blue-400" />
                      <span className="text-sm">正在生成回答...</span>
                    </div>
                  ) : column.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-8 text-center dark:border-gray-600">
                      <svg className="mb-2 h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        发送消息开始对比
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ModelComparisonView;
