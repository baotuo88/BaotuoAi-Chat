"use client";

import React, { useState } from "react";
import { MessageSquare, Plus, X } from "lucide-react";
import { useCoreSettingsStore } from "@/store/core/coreSettingsStore";

interface ModelSelectorProps {
  onStartComparison: (models: string[]) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  onStartComparison,
}) => {
  const providers = useCoreSettingsStore((state) => state.providers);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);

  // 获取所有可用模型
  const availableModels = providers
    .filter((p) => p.enabled)
    .flatMap((provider) =>
      provider.models?.map((model) => ({
        id: `${provider.id}/${model}`,
        name: model,
        provider: provider.name || provider.id,
      })) || []
    );

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  const handleStartComparison = () => {
    if (selectedModels.length >= 2) {
      onStartComparison(selectedModels);
      setShowSelector(false);
      setSelectedModels([]);
    }
  };

  if (!showSelector) {
    return (
      <button
        onClick={() => setShowSelector(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
        title="对比多个模型"
      >
        <MessageSquare size={18} />
        <span className="text-sm font-medium">模型对比</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                选择要对比的模型
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                至少选择 2 个模型，最多 4 个
              </p>
            </div>
            <button
              onClick={() => {
                setShowSelector(false);
                setSelectedModels([]);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 已选模型 */}
        {selectedModels.length > 0 && (
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                已选择 {selectedModels.length} 个:
              </span>
              {selectedModels.map((modelId) => {
                const model = availableModels.find((m) => m.id === modelId);
                return (
                  <span
                    key={modelId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded text-xs"
                  >
                    {model?.name}
                    <button
                      onClick={() => toggleModel(modelId)}
                      className="hover:bg-blue-200 dark:hover:bg-blue-700 rounded p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 模型列表 */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-2">
            {availableModels.map((model) => {
              const isSelected = selectedModels.includes(model.id);
              const isDisabled =
                !isSelected && selectedModels.length >= 4;

              return (
                <button
                  key={model.id}
                  onClick={() => !isDisabled && toggleModel(model.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : isDisabled
                        ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50 cursor-not-allowed"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-750"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {model.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {model.provider}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {availableModels.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                暂无可用模型，请先在设置中配置模型服务商
              </p>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedModels.length < 2
                ? "请至少选择 2 个模型"
                : `准备对比 ${selectedModels.length} 个模型`}
            </p>
            <button
              onClick={handleStartComparison}
              disabled={selectedModels.length < 2}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                selectedModels.length >= 2
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-md hover:shadow-lg"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
            >
              开始对比
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;
