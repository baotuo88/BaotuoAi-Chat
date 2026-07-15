"use client";

import React, { useState, useEffect } from "react";
import { Wrench, Info, ChevronDown, ChevronRight } from "lucide-react";

interface ToolListProps {
  onToolSelect?: (toolName: string) => void;
  enabledTools?: string[];
  onToggleTool?: (toolName: string) => void;
}

export const ToolList: React.FC<ToolListProps> = ({
  onToolSelect,
  enabledTools = [],
  onToggleTool,
}) => {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await fetch("/api/tools/list");
      const data = await response.json();
      setTools(data.tools || []);
    } catch (error) {
      console.error("Failed to fetch tools:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (toolName: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolName)) {
      newExpanded.delete(toolName);
    } else {
      newExpanded.add(toolName);
    }
    setExpandedTools(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 dark:text-gray-400">加载工具列表...</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <Wrench size={20} className="text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          可用工具 ({tools.length})
        </h3>
      </div>

      {tools.map((tool) => {
        const isExpanded = expandedTools.has(tool.function.name);
        const isEnabled = enabledTools.includes(tool.function.name);
        return (
          <div
            key={tool.function.name}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleTool(tool.function.name)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-500" />
                ) : (
                  <ChevronRight size={16} className="text-gray-500" />
                )}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {tool.function.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {onToggleTool && (
                  <label
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => onToggleTool(tool.function.name)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      启用
                    </span>
                  </label>
                )}
                <Info size={14} className="text-gray-400" />
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                <div className="space-y-3">
                  {/* Description */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      描述
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {tool.function.description}
                    </p>
                  </div>

                  {/* Parameters */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                      参数
                    </div>
                    <div className="space-y-2">
                      {Object.entries(
                        tool.function.parameters.properties || {},
                      ).map(([name, prop]: [string, any]) => (
                        <div
                          key={name}
                          className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs font-mono text-blue-600 dark:text-blue-400">
                              {name}
                            </code>
                            {tool.function.parameters.required?.includes(
                              name,
                            ) && (
                              <span className="text-xs text-red-500">*</span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {prop.type}
                            </span>
                          </div>
                          {prop.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {prop.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Try it button */}
                  {onToolSelect && (
                    <button
                      onClick={() => onToolSelect(tool.function.name)}
                      className="w-full px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      试用此工具
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ToolList;
