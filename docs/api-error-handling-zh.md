# API 错误处理使用指南

本指南介绍如何在客户端代码中使用 `clientErrorHandler` 统一处理 API 错误，为用户提供友好的错误提示。

## 基本用法

### 1. 在 fetch 调用中捕获错误

```typescript
import { handleApiError, handleNetworkError } from "@/lib/api/clientErrorHandler";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/use-toast"; // 或你使用的 toast 库

async function sendMessage() {
  const t = useTranslations("apiErrorHandler");
  
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Hello" }),
    });
    
    if (!response.ok) {
      const errorConfig = await handleApiError(response, {
        messages: {
          QUOTA_EXCEEDED: t("quotaExceeded"),
          RATE_LIMITED: t("rateLimited"),
          UNAUTHORIZED: t("unauthorized"),
          // ... 其他翻译
        },
        defaultTitle: t("defaultTitle"),
        defaultDescription: t("defaultDescription"),
      });
      
      toast({
        title: errorConfig.title,
        description: errorConfig.description,
        variant: errorConfig.variant,
        duration: errorConfig.duration,
      });
      
      return;
    }
    
    const data = await response.json();
    // 处理成功响应
  } catch (error) {
    // 网络错误（无响应）
    const errorConfig = handleNetworkError({
      title: t("networkError"),
      description: t("networkErrorDesc"),
    });
    
    toast({
      title: errorConfig.title,
      description: errorConfig.description,
      variant: errorConfig.variant,
      duration: errorConfig.duration,
    });
  }
}
```

### 2. 简化用法（使用默认英文消息）

如果不需要国际化，可以直接使用默认消息：

```typescript
try {
  const response = await fetch("/api/chat", { /* ... */ });
  
  if (!response.ok) {
    const errorConfig = await handleApiError(response);
    toast(errorConfig);
    return;
  }
  
  // 处理成功
} catch (error) {
  const errorConfig = handleNetworkError();
  toast(errorConfig);
}
```

## 错误类型处理

### 配额超限 (429 QUOTA_EXCEEDED)

当用户达到每日请求限制时，会显示：
- 标题："每日配额已用完"
- 描述：包含配额重置时间，例如 "您的每日请求次数已达上限。明天 9:00 AM 重置。"
- 持续时间：8 秒

服务器会返回 `Retry-After` 头，`handleApiError` 会自动解析并格式化为友好的时间描述。

### 速率限制 (429 RATE_LIMITED)

针对短时间内过多请求：
- 标题："请求过于频繁"
- 描述：包含等待时间，例如 "请等待 30 秒后再试。"
- 持续时间：6 秒

### 认证失败 (401)

会话过期或未登录：
- 标题："需要登录"
- 描述："您的登录已过期，请重新登录。"
- 建议：可以在显示 toast 后重定向到登录页

```typescript
if (response.status === 401) {
  const errorConfig = await handleApiError(response);
  toast(errorConfig);
  
  // 延迟跳转让用户看到提示
  setTimeout(() => {
    window.location.assign("/");
  }, 1500);
}
```

### 权限不足 (403)

用户尝试执行无权限的操作：
- 标题："访问被拒绝"
- 描述："您没有权限执行此操作。"

### 资源不存在 (404)

请求的资源未找到：
- 标题："未找到"
- 描述："请求的资源不存在。"

### 服务器错误 (500+)

服务器内部错误：
- 标题："服务器错误"
- 描述："服务器遇到错误，请稍后再试。"

### 网络错误

无法连接到服务器（fetch 抛出异常）：
- 标题："网络错误"
- 描述："无法连接到服务器，请检查您的网络连接。"

## 创建通用错误处理 Hook

可以封装一个 React Hook 简化调用：

```typescript
// src/hooks/useApiErrorHandler.ts
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/use-toast";
import { handleApiError, handleNetworkError } from "@/lib/api/clientErrorHandler";

export function useApiErrorHandler() {
  const t = useTranslations("apiErrorHandler");
  const { toast } = useToast();
  
  const handleError = async (error: unknown) => {
    if (error instanceof Response) {
      const errorConfig = await handleApiError(error, {
        messages: {
          QUOTA_EXCEEDED: t("quotaExceeded"),
          RATE_LIMITED: t("rateLimited"),
          UNAUTHORIZED: t("unauthorized"),
          FORBIDDEN: t("forbidden"),
          NOT_FOUND: t("notFound"),
          SERVER_ERROR: t("serverError"),
        },
        defaultTitle: t("defaultTitle"),
        defaultDescription: t("defaultDescription"),
      });
      
      toast(errorConfig);
      
      // 401 自动跳转登录
      if (error.status === 401) {
        setTimeout(() => window.location.assign("/"), 1500);
      }
    } else {
      const errorConfig = handleNetworkError({
        title: t("networkError"),
        description: t("networkErrorDesc"),
      });
      toast(errorConfig);
    }
  };
  
  return { handleError };
}

// 使用示例
function MyComponent() {
  const { handleError } = useApiErrorHandler();
  
  async function doSomething() {
    try {
      const response = await fetch("/api/endpoint");
      if (!response.ok) {
        await handleError(response);
        return;
      }
      // 处理成功
    } catch (error) {
      await handleError(error);
    }
  }
  
  return <button onClick={doSomething}>Action</button>;
}
```

## 在现有代码中集成

### 聊天发送逻辑

找到负责发送聊天消息的代码（通常在 chatStore 或组件中），在 fetch 调用周围添加错误处理：

```typescript
// 示例：src/store/core/chatStore.ts 或类似位置
async function sendMessage(content: string) {
  try {
    const response = await fetch("/api/chat/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content }),
    });
    
    if (!response.ok) {
      const errorConfig = await handleApiError(response);
      showToast(errorConfig); // 你的 toast 显示函数
      return;
    }
    
    // 处理流式响应
    const reader = response.body?.getReader();
    // ...
  } catch (error) {
    const errorConfig = handleNetworkError();
    showToast(errorConfig);
  }
}
```

### 知识库上传

```typescript
async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  
  try {
    const response = await fetch("/api/rag/upload", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const errorConfig = await handleApiError(response, {
        messages: {
          QUOTA_EXCEEDED: "文件上传配额已用完",
          // 自定义上传相关的错误消息
        },
      });
      toast(errorConfig);
      return;
    }
    
    // 处理成功
  } catch (error) {
    const errorConfig = handleNetworkError();
    toast(errorConfig);
  }
}
```

## 注意事项

1. **toast 组件依赖**：确保项目中已安装并配置 toast 组件（shadcn/ui 或其他）
2. **i18n 翻译**：已提供中/英/日三语翻译文件，需要在 i18n 配置中注册 `apiErrors` 命名空间
3. **401 跳转逻辑**：可以统一在 `useApiErrorHandler` hook 中处理，避免到处重复
4. **配额预警**：考虑在用户接近配额限制时（如 90%）主动显示提醒
5. **重试机制**：对于临时性的 429 或 500 错误，可以考虑添加自动重试逻辑

## 高级：配额预警

可以在 Sidebar 或 Header 中监控配额使用率，接近限制时显示警告：

```typescript
function QuotaWarning() {
  const { state } = useAccountState();
  
  if (!state?.quota) return null;
  
  const usagePercent = (state.quota.used / state.quota.limit) * 100;
  
  if (usagePercent < 80) return null;
  
  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/30">
      <p className="text-sm text-amber-800 dark:text-amber-300">
        ⚠️ 您已使用 {usagePercent.toFixed(0)}% 的配额
        （{state.quota.remaining} 次剩余）
      </p>
    </div>
  );
}
```

## 示例：完整的聊天发送流程

```typescript
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { useChatStore } from "@/store/core/chatStore";

function ChatInput() {
  const { handleError } = useApiErrorHandler();
  const { addMessage } = useChatStore();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  async function handleSend() {
    if (!input.trim() || isSending) return;
    
    setIsSending(true);
    
    try {
      const response = await fetch("/api/chat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      
      if (!response.ok) {
        await handleError(response);
        return;
      }
      
      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        accumulated += decoder.decode(value, { stream: true });
        addMessage({ role: "assistant", content: accumulated });
      }
      
      setInput("");
    } catch (error) {
      await handleError(error);
    } finally {
      setIsSending(false);
    }
  }
  
  return (
    <div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSend} disabled={isSending}>
        Send
      </button>
    </div>
  );
}
```
