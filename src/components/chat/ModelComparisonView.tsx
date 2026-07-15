"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Copy, Check, RotateCw, Trash2 } from "lucide-react";
import { Message } from "@/types";
import MessageItem from "@/components/chat/MessageItem";
import { useChatStore } from "@/store/core/chatStore";

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

  useEffect(() => {
    // 初始化结果
    const initialResults = new Map<string, ComparisonResult>();
    models.forEach((model) => {
      initialResults.set(model, {
        model,
        messages: [],
        isGenerating: true,
      });
    });
    setResults(initialResults);

    // 为每个模型发起请求
    models.forEach((model) => {
      generateResponse(model);
    });

    // 清理函数
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  const generateResponse = async (model: string) => {
    const abortController = new AbortController();
    abortControllersRef.current.set(model, abortController);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          model,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "content") {
                accumulatedContent += parsed.content;

                setResults((prev) => {
                  const newResults = new Map(prev);
                  const result = newResults.get(model);
                  if (result) {
                    result.messages = [
                      {
                        id: `comparison-${model}`,
                        role: "assistant",
                        content: accumulatedContent,
                        createdAt: Date.now(),
                      },
                    ];
                    result.isGenerating = true;
                  }
                  return newResults;
                });
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      // 完成生成
      setResults((prev) => {
        const newResults = new Map(prev);
        const result = newResults.get(model);
        if (result) {
          result.isGenerating = false;
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
          result.isGenerating = false;
          result.error =
            error instanceof Error ? error.message : "生成失败";
        }
        return newResults;
      });
    } finally {
      abortControllersRef.current.delete(model);
    }
  };

  const handleCopy = async (model: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedModel(model);
      setTimeout(() => setCopiedModel(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleRegenerate = (model: string) => {
    // 取消现有请求
    const controller = abortControllersRef.current.get(model);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(model);
    }

    // 重置状态
    setResults((prev) => {
      const newResults = new Map(prev);
      newResults.set(model, {
        model,
        messages: [],
        isGenerating: true,
      });
      return newResults;
    });

    // 重新生成
    generateResponse(model);
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
        result.isGenerating = false;
      }
      return newResults;
    });
  };

  return (
    <div className="fixed inset-0 z-9999 bg-white dark:bg-gray-900">
      {/* 头部 */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              模型对比
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              对比 {models.length} 个模型的回答
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="关闭对比视图"
          >
            <X size={20} />
          </button>
        </div>

        {/* 提示词显示 */}
        <div className="px-6 pb-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              提示词:
            </p>
            <p className="text-gray-900 dark:text-gray-100">{prompt}</p>
          </div>
        </div>
      </div>

      {/* 对比网格 */}
      <div
        className="overflow-auto"
        style={{ height: "calc(100vh - 180px)" }}
      >
        <div
          className={`grid gap-4 p-6 ${
            models.length === 2
              ? "grid-cols-2"
              : models.length === 3
                ? "grid-cols-3"
                : "grid-cols-2 xl:grid-cols-4"
          }`}
        >
          {Array.from(results.entries()).map(([model, result]) => (
            <div
              key={model}
              className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 flex flex-col"
            >
              {/* 模型头部 */}
              <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {model}
                </h3>
                <div className="flex items-center gap-2">
                  {result.isGenerating ? (
                    <button
                      onClick={() => handleStop(model)}
                      className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      aria-label="停止生成"
                      title="停止生成"
                    >
                      <X size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRegenerate(model)}
                      className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      aria-label="重新生成"
                      title="重新生成"
                    >
                      <RotateCw size={16} />
                    </button>
                  )}
                  {result.messages.length > 0 && (
                    <button
                      onClick={() =>
                        handleCopy(model, result.messages[0].content)
                      }
                      className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      aria-label="复制回答"
                      title="复制回答"
                    >
                      {copiedModel === model ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 回答内容 */}
              <div className="flex-1 overflow-auto p-4">
                {result.error ? (
                  <div className="text-red-500 text-sm">
                    错误: {result.error}
                  </div>
                ) : result.messages.length > 0 ? (
                  <div className="prose dark:prose-invert max-w-none">
                    <MessageItem
                      message={result.messages[0]}
                      isStreaming={result.isGenerating}
                      onRegenerate={() => {}}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onCopy={() => {}}
                      showActions={false}
                    />
                  </div>
                ) : result.isGenerating ? (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500"></div>
                    <span className="text-sm">正在生成...</span>
                  </div>
                ) : (
                  <div className="text-gray-400 dark:text-gray-600 text-sm">
                    暂无内容
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModelComparisonView;
