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
          description: "时区，例如：'Asia/Shanghai'、'America/New_York'。默认为 UTC。",
        },
        format: {
          type: "string",
          description: "返回格式：full（完整）、date（仅日期）、time（仅时间）、timestamp（时间戳）。默认为 full。",
          enum: ["full", "date", "time", "timestamp"],
        },
      },
      required: [],
    },
  },
  {
    name: "get_weather",
    description: "获取指定地点的实时天气信息（数据来自 wttr.in）。",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "地点名称，例如：'北京'、'上海'、'New York'",
        },
        unit: {
          type: "string",
          description: "温度单位：celsius（摄氏度）或 fahrenheit（华氏度）。默认为 celsius。",
          enum: ["celsius", "fahrenheit"],
        },
      },
      required: ["location"],
    },
  },
  {
    name: "web_search",
    description: "在网络上搜索信息（数据来自 DuckDuckGo）。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词",
        },
        num_results: {
          type: "number",
          description: "返回结果数量，默认为 5",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "convert_currency",
    description: "转换货币金额（使用 exchangerate-api.com 的实时汇率）。",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "要转换的金额",
        },
        from_currency: {
          type: "string",
          description: "源货币代码，例如：'USD'、'CNY'、'EUR'",
        },
        to_currency: {
          type: "string",
          description: "目标货币代码，例如：'USD'、'CNY'、'EUR'",
        },
      },
      required: ["amount", "from_currency", "to_currency"],
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
        count: {
          type: "number",
          description: "生成数量，默认为 1",
        },
        decimals: {
          type: "number",
          description: "小数位数，默认为 0（整数）",
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
      properties: {
        version: {
          type: "string",
          description: "UUID 版本：v4（随机）或 v7（时间有序）。默认为 v4。",
          enum: ["v4", "v7"],
        },
        count: {
          type: "number",
          description: "生成数量，默认为 1",
        },
      },
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
