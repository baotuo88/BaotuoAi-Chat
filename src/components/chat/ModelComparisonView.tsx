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

      try {
        await streamChatResponse(
          "comparison",
          model,
          priorHistory,
          lastUser.content,
          [],
          {},
          (text) => {
            updateAssistantContent(model, lastMessage.id, text);
          },
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          abortController.signal,
        );
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
  }, [columns, runGeneration]);

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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            模型对比
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {columns.length} 个模型 · 在下方输入框继续追问
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {addableModels.length > 0 && columns.length < 4 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="添加模型"
                >
                  <Plus size={14} />
                  <span className="hidden sm:inline">添加模型</span>
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
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="关闭对比"
            title="关闭对比"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 对比列：横向滚动，每列固定宽度，便于并排阅读 */}
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex gap-3 px-1">
          {columns.map((column) => {
            const answered = column.messages.some(
              (m) => m.role === "model" && m.content,
            );
            const lastAssistant = [...column.messages]
              .reverse()
              .find((m) => m.role === "model" && m.content);
            return (
              <div
                key={column.model}
                className="flex w-80 shrink-0 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              >
                {/* 列头 */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/60">
                  <h3
                    className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
                    title={column.model}
                  >
                    {displayNameFor(column.model, availableModels)}
                  </h3>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {column.isGenerating ? (
                      <button
                        onClick={() => handleStop(column.model)}
                        className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                        aria-label="停止生成"
                        title="停止生成"
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRegenerate(column.model)}
                        className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                        aria-label="重新生成"
                        title="重新生成"
                      >
                        <RotateCw size={14} />
                      </button>
                    )}
                    {lastAssistant && (
                      <button
                        onClick={() =>
                          handleCopy(column.model, lastAssistant.content)
                        }
                        className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                        aria-label="复制最新回答"
                        title="复制最新回答"
                      >
                        {copiedModel === column.model ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(column.model)}
                      className="rounded p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      aria-label="移除该模型"
                      title="移除该模型"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 对话内容：整列多轮消息 */}
                <div className="flex-1 space-y-1 overflow-y-auto p-2">
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
                    <div className="px-2 py-1 text-sm text-red-500">
                      错误: {column.error}
                    </div>
                  ) : column.isGenerating && !answered ? (
                    <div className="flex items-center gap-2 px-2 py-1 text-gray-500 dark:text-gray-400">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                      <span className="text-sm">正在生成...</span>
                    </div>
                  ) : column.messages.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-gray-400 dark:text-gray-600">
                      发送一条消息开始对比
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
