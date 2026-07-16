/**
 * 工具执行器 - 实际执行工具调用
 */

import { evaluate } from "mathjs";
import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import { runInSandbox } from "@/utils/sandbox";

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * 执行计算器工具
 */
export async function executeCalculator(
  expression: string,
): Promise<ToolExecutionResult> {
  try {
    // 使用 mathjs 进行安全的数学计算
    const result = evaluate(expression);
    return {
      success: true,
      result: {
        expression,
        result: String(result),
        type: typeof result,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `计算错误: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * 获取当前时间
 */
export async function executeGetCurrentTime(
  timezone?: string,
  format?: "full" | "date" | "time" | "timestamp",
): Promise<ToolExecutionResult> {
  try {
    const now = new Date();
    const tz = timezone || "UTC";

    // 格式化选项
    const options: Intl.DateTimeFormatOptions = {
      timeZone: tz,
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    };

    let result: any = {};

    switch (format) {
      case "timestamp":
        result = {
          timestamp: Math.floor(now.getTime() / 1000),
          milliseconds: now.getTime(),
        };
        break;
      case "date":
        result = {
          date: now.toLocaleDateString("zh-CN", {
            timeZone: tz,
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          }),
          iso: now.toISOString().split("T")[0],
        };
        break;
      case "time":
        result = {
          time: now.toLocaleTimeString("zh-CN", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        };
        break;
      default:
        result = {
          full: now.toLocaleString("zh-CN", options),
          iso: now.toISOString(),
          timezone: tz,
          timestamp: Math.floor(now.getTime() / 1000),
        };
    }

    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: `时间获取错误: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * 获取天气信息（使用免费的 wttr.in API）
 */
export async function executeGetWeather(
  location: string,
  unit: "celsius" | "fahrenheit" = "celsius",
): Promise<ToolExecutionResult> {
  try {
    const unitParam = unit === "fahrenheit" ? "?u" : "?m";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}${unitParam}&format=j1`,
      {
        headers: {
          "User-Agent": "BaotuoChat/1.0",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`天气 API 返回错误: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current_condition?.[0];
    const area = data.nearest_area?.[0];

    if (!current) {
      throw new Error("无法获取天气数据");
    }

    return {
      success: true,
      result: {
        location: area?.areaName?.[0]?.value || location,
        country: area?.country?.[0]?.value || "",
        temperature: `${current.temp_C}°C / ${current.temp_F}°F`,
        feelsLike: `${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F`,
        condition: current.weatherDesc?.[0]?.value || "未知",
        humidity: `${current.humidity}%`,
        windSpeed: `${current.windspeedKmph} km/h`,
        precipitation: `${current.precipMM} mm`,
        lastUpdated: current.observation_time,
      },
    };
  } catch (error) {
    // 提供更友好的错误提示和降级方案
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: `天气服务响应超时。wttr.in 可能在您的网络环境下访问较慢，建议：\n1. 稍后重试\n2. 使用其他天气服务（如 weather.com.cn）\n3. 检查网络连接`,
        };
      }
      return {
        success: false,
        error: `天气查询错误: ${error.message}。可能是网络问题或 wttr.in 服务暂时不可用。`,
      };
    }
    return {
      success: false,
      error: "天气查询失败: 未知错误",
    };
  }
}

/**
 * 网络搜索（使用 DuckDuckGo API）
 */
export async function executeWebSearch(
  query: string,
  numResults: number = 5,
): Promise<ToolExecutionResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
      {
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`搜索 API 返回错误: ${response.status}`);
    }

    const data = await response.json();
    const results: any[] = [];

    // 收集相关话题
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, numResults)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text,
            snippet: topic.Text,
            url: topic.FirstURL,
          });
        }
      }
    }

    // 如果有摘要，添加到结果
    if (data.AbstractText && data.AbstractURL) {
      results.unshift({
        title: data.Heading || "摘要",
        snippet: data.AbstractText,
        url: data.AbstractURL,
      });
    }

    return {
      success: true,
      result: {
        query,
        results: results.slice(0, numResults),
        count: results.length,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "搜索服务响应超时，请稍后重试",
      };
    }
    return {
      success: false,
      error: `搜索错误: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * 货币转换（使用 exchangerate-api.com）
 */
export async function executeCurrencyConverter(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<ToolExecutionResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${fromCurrency.toUpperCase()}`,
      {
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`汇率 API 返回错误: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates[toCurrency.toUpperCase()];

    if (!rate) {
      throw new Error(`不支持的货币: ${toCurrency}`);
    }

    const convertedAmount = amount * rate;

    return {
      success: true,
      result: {
        amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate,
        convertedAmount: convertedAmount.toFixed(2),
        lastUpdated: data.date,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "汇率服务响应超时，请稍后重试",
      };
    }
    return {
      success: false,
      error: `货币转换错误: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * 生成随机数
 */
export async function executeGenerateRandomNumber(
  min: number,
  max: number,
  count: number = 1,
  decimals: number = 0,
): Promise<ToolExecutionResult> {
  try {
    const numbers: number[] = [];
    const multiplier = Math.pow(10, decimals);

    for (let i = 0; i < count; i++) {
      const random = Math.random() * (max - min) + min;
      const rounded =
        decimals === 0
          ? Math.floor(random)
          : Math.round(random * multiplier) / multiplier;
      numbers.push(rounded);
    }

    return {
      success: true,
      result: {
        numbers: count === 1 ? numbers[0] : numbers,
        count,
        range: { min, max },
        decimals,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `随机数生成错误: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * 生成 UUID
 */
export async function executeGenerateUUID(
  version: "v4" | "v7" = "v4",
  count: number = 1,
): Promise<ToolExecutionResult> {
  try {
    const uuids: string[] = [];
    const generator = version === "v7" ? uuidv7 : uuidv4;

    for (let i = 0; i < count; i++) {
      uuids.push(generator());
    }

    return {
      success: true,
      result: {
        uuids: count === 1 ? uuids[0] : uuids,
        count,
        version,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `UUID 生成错误: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * 执行工具调用的统一入口
 */
export async function executeToolCall(
  toolName: string,
  args: any,
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case "calculator":
        return await executeCalculator(args.expression);

      case "get_current_time":
        return await executeGetCurrentTime(args.timezone, args.format);

      case "get_weather":
        return await executeGetWeather(args.location, args.unit);

      case "web_search":
        return await executeWebSearch(args.query, args.num_results);

      case "convert_currency":
        return await executeCurrencyConverter(
          args.amount,
          args.from_currency,
          args.to_currency,
        );

      case "generate_random_number":
        return await executeGenerateRandomNumber(
          args.min,
          args.max,
          args.count,
          args.decimals,
        );

      case "generate_uuid":
        return await executeGenerateUUID(args.version, args.count);

      case "execute_javascript":
        return await executeJavaScript(args.code);

      default:
        return {
          success: false,
          error: `未知的工具: ${toolName}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `工具执行错误: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * 在沙箱中执行 JavaScript 代码
 */
export async function executeJavaScript(
  code: string,
): Promise<ToolExecutionResult> {
  try {
    const output = await runInSandbox(code);

    // 检查是否有错误
    if (output.startsWith("Error:")) {
      return {
        success: false,
        error: output,
      };
    }

    return {
      success: true,
      result: output,
    };
  } catch (error) {
    return {
      success: false,
      error: `代码执行错误: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}
