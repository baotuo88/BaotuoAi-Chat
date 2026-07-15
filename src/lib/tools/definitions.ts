/**
 * 工具定义
 * 定义所有内置工具的元数据和参数
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    name: "calculator",
    description: "执行数学计算。支持基本运算、三角函数、对数等。",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "要计算的数学表达式，例如：'2 + 2'、'sin(pi/2)'、'sqrt(16)'",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "get_current_time",
    description: "获取当前日期和时间。",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "时区，例如：'Asia/Shanghai'、'America/New_York'。默认为用户本地时区。",
        },
      },
      required: [],
    },
  },
  {
    name: "get_weather",
    description: "获取指定城市的天气信息（模拟数据）。",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "城市名称，例如：'北京'、'上海'、'New York'",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "web_search",
    description: "在网络上搜索信息（模拟搜索）。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "convert_currency",
    description: "转换货币金额（使用模拟汇率）。",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "要转换的金额",
        },
        from: {
          type: "string",
          description: "源货币代码，例如：'USD'、'CNY'、'EUR'",
        },
        to: {
          type: "string",
          description: "目标货币代码，例如：'USD'、'CNY'、'EUR'",
        },
      },
      required: ["amount", "from", "to"],
    },
  },
  {
    name: "generate_random_number",
    description: "生成指定范围内的随机数。",
    parameters: {
      type: "object",
      properties: {
        min: {
          type: "number",
          description: "最小值（包含）",
        },
        max: {
          type: "number",
          description: "最大值（包含）",
        },
      },
      required: ["min", "max"],
    },
  },
  {
    name: "generate_uuid",
    description: "生成一个唯一的 UUID（通用唯一识别码）。",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "execute_javascript",
    description: "在安全的沙箱环境中执行 JavaScript 代码。代码会在隔离环境中运行，无法访问网络和文件系统。",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "要执行的 JavaScript 代码。可以使用 console.log() 输出结果。最后一行的表达式结果会被返回。",
        },
      },
      required: ["code"],
    },
  },
];

/**
 * 根据名称获取工具定义
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return BUILT_IN_TOOLS.find((tool) => tool.name === name);
}
