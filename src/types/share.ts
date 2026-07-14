export interface SharedConversation {
  id: string; // shareId
  sessionId: string;
  title: string;
  messages: Array<{
    id: string;
    role: "user" | "model";
    content: string;
    timestamp: number;
    model?: string;
  }>;
  createdAt: number;
  expiresAt?: number;
  viewCount: number;
  isPublic: boolean;
}

export interface ShareLinkOptions {
  sessionId: string;
  includeSystemPrompt?: boolean;
  expiresIn?: number; // milliseconds, undefined = never expires
}

export interface ShareLinkResult {
  shareId: string;
  url: string;
  expiresAt?: number;
}
