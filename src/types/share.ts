export interface SharedChat {
  id: string; // Unique share ID
  sessionId: string; // Original session ID
  userId: string; // User who created the share
  title: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
  }>;
  model?: string;
  createdAt: number;
  expiresAt?: number; // Optional expiration timestamp
  viewCount: number;
}

export interface CreateShareRequest {
  sessionId: string;
  expiresIn?: number; // Optional expiration in milliseconds
}

export interface CreateShareResponse {
  shareId: string;
  shareUrl: string;
}
