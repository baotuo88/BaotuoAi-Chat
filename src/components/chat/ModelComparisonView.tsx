"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Copy, Check, RotateCw } from "lucide-react";
import { Message } from "@/types";
import MessageItem from "@/components/chat/MessageItem";
import { streamChatResponse } from "@/services/api/chatService";

interface ComparisonResult {
  model: string;
  messages: Message[];
  isGenerating: boolean;
  error?: string;
}

interface ModelComparisonViewProps {
  prompt: string;
  models: string[];
  onClose: () => void;
}

export const ModelComparisonView: React.FC<ModelComparisonViewProps> = ({
  prompt,
  models,
  onClose,
}) => {
  const [results, setResults] = useState<Map<string, ComparisonResult>>(
    new Map(),
  );
  const [copiedModel, setCopiedModel] = useState<string | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const generateResponse = useCallback(
    async (model: string, promptText: string) => {
      const abortController = new AbortController();
      abortControllersRef.current.set(model, abortController);

      let accumulated = "";

      try {
        await streamChatResponse(
          "comparison",
          model,
          [],
          promptText,
          [],
          {},
          (text) => {
            accumulated = text;
            setResults((prev) => {
              const newResults = new Map(prev);
              const result = newResults.get(model);
              if (result) {
                newResults.set(model, {
                  ...result,
                  messages: [
                    {
                      id: `comparison-${model}`,
                      role: "model",
                      content: accumulated,
                      timestamp: Date.now(),
                    },
                  ],
                  isGenerating: true,
                });
              }
              return newResults;
            });
          },
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          abortController.signal,
        );

        setResults((prev) => {
          const newResults = new Map(prev);
          const result = newResults.get(model);
          if (result) {
            newResults.set(model, { ...result, isGenerating: false });
          }
          return newResults;
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setResults((prev) => {
          const newResults = new Map(prev);
          const result = newResults.get(model);
          if (result) {
            newResults.set(model, {
              ...result,
              isGenerating: false,
              error: error instanceof Error ? error.message : "生成失败",
            });
          }
          return newResults;
        });
      } finally {
        abortControllersRef.current.delete(model);
      }
    },
    [],
  );

  useEffect(() => {
    const controllers = abortControllersRef.current;
    controllers.forEach((controller) => controller.abort());
    controllers.clear();

    const initialResults = new Map<string, ComparisonResult>();
    models.forEach((model) => {
      initialResults.set(model, {
        model,
        messages: [],
        isGenerating: true,
      });
    });
    setResults(initialResults);

    models.forEach((model) => {
      generateResponse(model, prompt);
    });

    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, [prompt, models, generateResponse]);

  const handleCopy = async (model: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedModel(model);
      setTimeout(() => setCopiedModel(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleRegenerate = (model: string) => {
    const controller = abortControllersRef.current.get(model);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(model);
    }

    setResults((prev) => {
      const newResults = new Map(prev);
      newResults.set(model, {
        model,
        messages: [],
        isGenerating: true,
      });
      return newResults;
    });

    generateResponse(model, prompt);
  };

  const handleStop = (model: string) => {
    const controller = abortControllersRef.current.get(model);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(model);
    }

    setResults((prev) => {
      const newResults = new Map(prev);
      const result = newResults.get(model);
      if (result) {
        newResults.set(model, { ...result, isGenerating: false });
      }
      return newResults;
    });
  };

  const gridColsClass =
    models.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : models.length === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";

  return (
    <div className="w-full">
      {/* 头部 */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            模型对比
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            对比 {models.length} 个模型的回答
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="关闭对比"
          title="关闭对比"
        >
          <X size={18} />
        </button>
      </div>

      {/* 提示词 */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
        <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">提示词</p>
        <p className="text-sm text-gray-900 dark:text-gray-100">{prompt}</p>
      </div>

      {/* 对比网格 */}
      <div className={`grid gap-4 ${gridColsClass}`}>
        {Array.from(results.entries()).map(([model, result]) => (
          <div
            key={model}
            className="flex flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          >
            {/* 模型头部 */}
            <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
              <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {model}
              </h3>
              <div className="flex items-center gap-1">
                {result.isGenerating ? (
                  <button
                    onClick={() => handleStop(model)}
                    className="rounded p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                    aria-label="停止生成"
                    title="停止生成"
                  >
                    <X size={15} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleRegenerate(model)}
                    className="rounded p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                    aria-label="重新生成"
                    title="重新生成"
                  >
                    <RotateCw size={15} />
                  </button>
                )}
                {result.messages.length > 0 && (
                  <button
                    onClick={() =>
                      handleCopy(model, result.messages[0].content)
                    }
                    className="rounded p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                    aria-label="复制回答"
                    title="复制回答"
                  >
                    {copiedModel === model ? (
                      <Check size={15} className="text-green-500" />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 回答内容 */}
            <div className="flex-1 overflow-auto p-3">
              {result.error ? (
                <div className="text-sm text-red-500">
                  错误: {result.error}
                </div>
              ) : result.messages.length > 0 ? (
                <MessageItem
                  message={result.messages[0]}
                  isTyping={result.isGenerating}
                />
              ) : result.isGenerating ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                  <span className="text-sm">正在生成...</span>
                </div>
              ) : (
                <div className="text-sm text-gray-400 dark:text-gray-600">
                  暂无内容
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelComparisonView;
