/**
 * 自动工具调用处理器
 * 实现工具调用循环：AI 调用工具 -> 执行工具 -> 将结果返回给 AI -> AI 生成最终响应
 */

import type { ToolCall } from "@/types";
import { executeToolCall } from "../tools/executors";

const MAX_TOOL_ITERATIONS = 5; // 最多允许5轮工具调用，防止无限循环

/**
 * 执行单个工具调用
 */
export async function executeSingleToolCall(toolCall: ToolCall): Promise<ToolCall> {
  try {
    // 更新状态为运行中
    const runningToolCall: ToolCall = {
      ...toolCall,
      status: "running",
    };

    // 执行工具
    const result = await executeToolCall(toolCall.name, toolCall.args);

    // 返回结果
    return {
      ...runningToolCall,
      status: result.success ? "success" : "error",
      result: result.success ? result.result : result.error,
      isError: !result.success,
    };
  } catch (error) {
    return {
      ...toolCall,
      status: "error",
      result: error instanceof Error ? error.message : "工具执行失败",
      isError: true,
    };
  }
}

/**
 * 批量执行工具调用
 */
export async function executeToolCalls(toolCalls: ToolCall[]): Promise<ToolCall[]> {
  const results: ToolCall[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeSingleToolCall(toolCall);
    results.push(result);
  }

  return results;
}
