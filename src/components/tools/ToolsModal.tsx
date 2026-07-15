"use client";

import React, { useState, useEffect } from "react";
import { X, Wrench } from "lucide-react";
import ToolList from "@/components/tools/ToolList";
import ToolTester from "@/components/tools/ToolTester";
import { useSettingsStore } from "@/store/core/settingsStore";

interface ToolsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ToolsModal: React.FC<ToolsModalProps> = ({ open, onClose }) => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [tools, setTools] = useState<any[]>([]);
  const { enabledBuiltInTools, toggleBuiltInTool } = useSettingsStore();

  useEffect(() => {
    if (open) {
      fetchTools();
    }
  }, [open]);

  const fetchTools = async () => {
    try {
      const response = await fetch("/api/tools/list");
      const data = await response.json();
      setTools(data.tools || []);
    } catch (error) {
      console.error("Failed to fetch tools:", error);
    }
  };

  const selectedToolDefinition = tools.find(
    (t) => t.function.name === selectedTool,
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="glass-popover w-full max-w-3xl max-h-[90vh] rounded-2xl border flex flex-col transform transition-transform duration-200 scale-100 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/50 dark:border-border">
          <h3 className="text-lg font-bold text-gray-800 dark:text-foreground flex items-center gap-2">
            <Wrench size={20} className="text-blue-500" aria-hidden="true" />
            {selectedTool ? "工具测试" : "工具管理"}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {selectedTool && selectedToolDefinition ? (
            <div>
              <button
                onClick={() => setSelectedTool(null)}
                className="mb-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                ← 返回工具列表
              </button>
              <div className="mb-4">
                <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  {selectedTool}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedToolDefinition.function.description}
                </p>
              </div>
              <ToolTester
                toolName={selectedTool}
                toolDefinition={selectedToolDefinition}
              />
            </div>
          ) : (
            <ToolList
              onToolSelect={setSelectedTool}
              enabledTools={enabledBuiltInTools}
              onToggleTool={toggleBuiltInTool}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200/50 dark:border-border bg-gray-50/50 dark:bg-card/50 rounded-b-2xl">
          <p className="text-xs text-gray-500 dark:text-muted-foreground text-center">
            这些工具可以在对话中被 AI 自动调用，也可以在此手动测试
          </p>
        </div>
      </div>
    </div>
  );
};

export default ToolsModal;
