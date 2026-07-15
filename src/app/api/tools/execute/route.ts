/**
 * 工具执行 API 端点
 */

import { NextRequest, NextResponse } from "next/server";
import { executeToolCall } from "@/lib/tools/executors";
import { getToolByName } from "@/lib/tools/definitions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolName, arguments: args } = body;

    // 验证工具是否存在
    const tool = getToolByName(toolName);
    if (!tool) {
      return NextResponse.json(
        { success: false, error: `未知的工具: ${toolName}` },
        { status: 400 },
      );
    }

    // 执行工具
    const result = await executeToolCall(toolName, args);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "工具执行失败",
      },
      { status: 500 },
    );
  }
}
