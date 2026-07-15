"use client";

import React from "react";
import {
  Calculator,
  Clock,
  Cloud,
  Search,
  DollarSign,
  Dices,
  Hash,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ToolCallDisplayProps {
  toolName: string;
  arguments: any;
  result?: any;
  error?: string;
  isLoading?: boolean;
}

const toolIcons: Record<string, React.ReactNode> = {
  calculator: <Calculator size={16} />,
  get_current_time: <Clock size={16} />,
  get_weather: <Cloud size={16} />,
  web_search: <Search size={16} />,
  convert_currency: <DollarSign size={16} />,
  generate_random_number: <Dices size={16} />,
  generate_uuid: <Hash size={16} />,
};

const toolLabels: Record<string, string> = {
  calculator: "计算器",
  get_current_time: "获取时间",
  get_weather: "天气查询",
  web_search: "网络搜索",
  convert_currency: "货币转换",
  generate_random_number: "随机数",
  generate_uuid: "UUID生成",
};

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  toolName,
  arguments: args,
  result,
  error,
  isLoading = false,
}) => {
  const icon = toolIcons[toolName] || <Hash size={16} />;
  const label = toolLabels[toolName] || toolName;

  return (
    <div className="my-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-1">
          <div className="text-blue-500">{icon}</div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
        </div>
        {isLoading && (
          <Loader2 size={16} className="text-blue-500 animate-spin" />
        )}
        {!isLoading && result && (
          <CheckCircle2 size={16} className="text-green-500" />
        )}
        {!isLoading && error && (
          <XCircle size={16} className="text-red-500" />
        )}
      </div>

      {/* Arguments */}
      <div className="px-4 py-3 text-sm">
        <div className="text-gray-600 dark:text-gray-400 mb-2">参数:</div>
        <pre className="text-xs bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 overflow-x-auto text-gray-800 dark:text-gray-200">
          {JSON.stringify(args, null, 2)}
        </pre>
      </div>

      {/* Result */}
      {result && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm">
          <div className="text-gray-600 dark:text-gray-400 mb-2">结果:</div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <pre className="text-xs overflow-x-auto text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm">
          <div className="text-red-600 dark:text-red-400 mb-2">错误:</div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolCallDisplay;
