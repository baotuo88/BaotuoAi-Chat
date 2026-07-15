import { NextResponse } from "next/server";
import { BUILT_IN_TOOLS } from "@/lib/tools/definitions";

/**
 * GET /api/tools/list
 * 返回所有可用的内置工具列表
 */
export async function GET() {
  try {
    // 将工具定义转换为 OpenAI 格式
    const tools = BUILT_IN_TOOLS.map((tool) => ({
      type: "function",
      function: tool,
    }));

    return NextResponse.json({
      success: true,
      tools,
      count: tools.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取工具列表失败",
      },
      { status: 500 },
    );
  }
}
