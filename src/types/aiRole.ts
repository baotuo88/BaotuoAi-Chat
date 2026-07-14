/**
 * AI Role (Persona) definitions for custom system prompts.
 * Roles are stored locally in localStorage and applied when creating new sessions.
 */

export interface AIRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  avatar?: string; // emoji or icon name
  createdAt: number;
  updatedAt: number;
  isBuiltIn?: boolean; // built-in roles cannot be deleted
}

export interface NewAIRole {
  name: string;
  description: string;
  systemPrompt: string;
  avatar?: string;
}

/**
 * Built-in roles provided by default. Users can create custom roles
 * or use these as starting points.
 */
export const BUILT_IN_ROLES: AIRole[] = [
  {
    id: "assistant",
    name: "助手",
    description: "通用 AI 助手，适合日常对话和任务",
    systemPrompt: "你是一个有帮助的 AI 助手。",
    avatar: "🤖",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: "translator",
    name: "翻译专家",
    description: "专业翻译，支持多语言互译",
    systemPrompt:
      "你是一位专业的翻译专家。请将用户输入的文本翻译成目标语言，保持原意和语气。如果用户未指定目标语言，请根据上下文判断。翻译要准确、流畅、符合目标语言的表达习惯。",
    avatar: "🌐",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: "coder",
    name: "编程助手",
    description: "代码编写、调试、优化专家",
    systemPrompt:
      "你是一位资深的编程专家。帮助用户编写、调试、优化代码。提供清晰的代码示例和解释。遵循最佳实践和编码规范。支持多种编程语言和技术栈。",
    avatar: "💻",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: "writer",
    name: "写作助手",
    description: "文案创作、文章撰写、内容润色",
    systemPrompt:
      "你是一位优秀的写作助手。帮助用户撰写各类文章、文案、邮件等内容。注重语言的准确性、流畅性和表现力。根据不同场景调整文风和语气。",
    avatar: "✍️",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: "teacher",
    name: "教学导师",
    description: "耐心解释知识，循序渐进教学",
    systemPrompt:
      "你是一位耐心的教学导师。用简单易懂的语言解释复杂概念。采用循序渐进的方式，确保学生理解。多举例子和类比，鼓励提问和互动。",
    avatar: "👨‍🏫",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: "analyzer",
    name: "数据分析师",
    description: "数据分析、洞察挖掘、报告撰写",
    systemPrompt:
      "你是一位专业的数据分析师。帮助用户分析数据、发现规律、提供洞察。用清晰的逻辑和可视化建议呈现分析结果。注重数据的准确性和结论的可靠性。",
    avatar: "📊",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
  },
];
