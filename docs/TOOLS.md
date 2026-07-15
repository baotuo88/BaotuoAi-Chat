# 工具系统使用说明

Baotuo Chat 内置了强大的工具调用系统，AI 可以自动调用这些工具来完成各种任务。

## 已实现的工具

### 1. 计算器 (calculator)
执行数学计算，支持基础运算和科学计算。

**示例：**
- `2 + 2 * 3`
- `sqrt(16)`
- `sin(30 * pi / 180)`

### 2. 获取当前时间 (get_current_time)
获取当前日期和时间信息，支持时区转换。

**参数：**
- `timezone`: 时区（如 "Asia/Shanghai"）
- `format`: 格式类型（full/date/time/timestamp）

### 3. 天气查询 (get_weather)
查询指定地点的实时天气信息。

**参数：**
- `location`: 地点名称（如 "北京"）
- `unit`: 温度单位（celsius/fahrenheit）

### 4. 网络搜索 (web_search)
在互联网上搜索实时信息。

**参数：**
- `query`: 搜索关键词
- `num_results`: 返回结果数量（1-10）

### 5. 货币转换 (convert_currency)
转换货币汇率。

**参数：**
- `amount`: 金额
- `from_currency`: 源货币代码（如 "USD"）
- `to_currency`: 目标货币代码（如 "CNY"）

### 6. 随机数生成 (generate_random_number)
生成指定范围内的随机数。

**参数：**
- `min`: 最小值
- `max`: 最大值
- `count`: 生成数量（默认1）
- `decimals`: 小数位数（默认0）

### 7. UUID 生成 (generate_uuid)
生成通用唯一识别码。

**参数：**
- `version`: UUID版本（v4/v7）
- `count`: 生成数量（默认1）

## API 端点

### 获取工具列表
```
GET /api/tools/list
```

返回所有可用工具的定义。

### 执行工具
```
POST /api/tools/execute
Content-Type: application/json

{
  "toolName": "calculator",
  "arguments": {
    "expression": "2 + 2"
  }
}
```

## 在对话中使用

在对话中，AI 会自动识别何时需要使用工具。例如：

**用户：** 现在北京的天气怎么样？  
**AI：** [自动调用 get_weather 工具]

**用户：** 帮我算一下 (15 * 8) + 32  
**AI：** [自动调用 calculator 工具]

**用户：** 100美元等于多少人民币？  
**AI：** [自动调用 convert_currency 工具]

## 手动测试工具

访问工具管理界面可以手动测试每个工具：

1. 打开工具管理弹窗
2. 选择要测试的工具
3. 填写参数
4. 点击"执行工具"查看结果

## 组件使用

### ToolCallDisplay
显示工具调用的结果：

```tsx
import ToolCallDisplay from "@/components/tools/ToolCallDisplay";

<ToolCallDisplay
  toolName="calculator"
  arguments={{ expression: "2 + 2" }}
  result={{ result: "4" }}
  isLoading={false}
/>
```

### ToolList
显示所有可用工具：

```tsx
import ToolList from "@/components/tools/ToolList";

<ToolList onToolSelect={(toolName) => console.log(toolName)} />
```

### ToolTester
测试工具执行：

```tsx
import ToolTester from "@/components/tools/ToolTester";

<ToolTester
  toolName="calculator"
  toolDefinition={toolDefinition}
/>
```

### ToolsModal
完整的工具管理界面：

```tsx
import ToolsModal from "@/components/tools/ToolsModal";

<ToolsModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
/>
```

## 扩展新工具

要添加新工具，需要：

1. 在 `src/lib/tools/definitions.ts` 中定义工具
2. 在 `src/lib/tools/executors.ts` 中实现执行逻辑
3. 在 `executeToolCall` 函数中添加路由

示例：

```typescript
// 1. 定义工具
export const myNewTool: ToolDefinition = {
  type: "function",
  function: {
    name: "my_new_tool",
    description: "工具描述",
    parameters: {
      type: "object",
      properties: {
        param1: {
          type: "string",
          description: "参数说明",
        },
      },
      required: ["param1"],
    },
  },
};

// 2. 实现执行器
export async function executeMyNewTool(param1: string): Promise<ToolExecutionResult> {
  try {
    // 执行逻辑
    return {
      success: true,
      result: { /* 结果 */ },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// 3. 添加路由
export async function executeToolCall(toolName: string, args: any) {
  switch (toolName) {
    case "my_new_tool":
      return await executeMyNewTool(args.param1);
    // ...
  }
}
```

## 注意事项

1. **安全性**：所有外部 API 调用都应该有错误处理
2. **速率限制**：注意第三方 API 的调用频率限制
3. **超时处理**：长时间运行的工具应该设置超时
4. **错误反馈**：提供清晰的错误信息给用户

## 未来计划

- [ ] 数据库查询工具
- [ ] 文件操作工具
- [ ] 图表生成工具
- [ ] 邮件发送工具
- [ ] 日历集成工具
