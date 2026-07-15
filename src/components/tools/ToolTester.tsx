"use client";

import React, { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import ToolCallDisplay from "@/components/tools/ToolCallDisplay";

interface ToolTesterProps {
  toolName: string;
  toolDefinition: any;
}

export const ToolTester: React.FC<ToolTesterProps> = ({
  toolName,
  toolDefinition,
}) => {
  const [args, setArgs] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleArgChange = (paramName: string, value: any) => {
    setArgs((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const executeTool = async () => {
    setIsExecuting(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/tools/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toolName,
          arguments: args,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.result);
      } else {
        setError(data.error || "执行失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setIsExecuting(false);
    }
  };

  const parameters = toolDefinition.function.parameters.properties || {};
  const required = toolDefinition.function.parameters.required || [];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {Object.entries(parameters).map(([paramName, param]: [string, any]) => (
          <div key={paramName}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {paramName}
              {required.includes(paramName) && (
                <span className="text-red-500 ml-1">*</span>
              )}
              <span className="text-xs text-gray-500 ml-2">
                ({param.type})
              </span>
            </label>
            <input
              type={param.type === "number" ? "number" : "text"}
              value={args[paramName] || ""}
              onChange={(e) => {
                const value =
                  param.type === "number"
                    ? parseFloat(e.target.value)
                    : e.target.value;
                handleArgChange(paramName, value);
              }}
              placeholder={param.description}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {param.description}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={executeTool}
        disabled={isExecuting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
      >
        {isExecuting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            执行中...
          </>
        ) : (
          <>
            <Play size={16} />
            执行工具
          </>
        )}
      </button>

      {(result || error) && (
        <ToolCallDisplay
          toolName={toolName}
          arguments={args}
          result={result}
          error={error || undefined}
          isLoading={isExecuting}
        />
      )}
    </div>
  );
};

export default ToolTester;
