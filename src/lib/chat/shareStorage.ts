import type { Session } from "./types";
import type { SharedConversation, ShareLinkOptions, ShareLinkResult } from "@/types/share";
import { nanoid } from "nanoid";

const SHARE_STORAGE_KEY = "baotuo_shared_conversations";

/**
 * Generate a unique share ID
 */
function generateShareId(): string {
  return nanoid(12);
}

/**
 * Load all shared conversations from localStorage
 */
export function loadSharedConversations(): SharedConversation[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    if (!stored) return [];

    const conversations = JSON.parse(stored) as SharedConversation[];

    // Filter out expired shares
    const now = Date.now();
    const validConversations = conversations.filter(
      (conv) => !conv.expiresAt || conv.expiresAt > now
    );

    // Update storage if any expired shares were removed
    if (validConversations.length !== conversations.length) {
      localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(validConversations));
    }

    return validConversations;
  } catch (error) {
    console.error("Failed to load shared conversations:", error);
    return [];
  }
}

/**
 * Get a shared conversation by shareId
 */
export function getSharedConversation(shareId: string): SharedConversation | null {
  const conversations = loadSharedConversations();
  const conversation = conversations.find((c) => c.id === shareId);

  if (!conversation) return null;

  // Check if expired
  if (conversation.expiresAt && conversation.expiresAt < Date.now()) {
    deleteSharedConversation(shareId);
    return null;
  }

  return conversation;
}

/**
 * Create a shareable link for a session
 */
export function createShareLink(
  session: Session,
  options: ShareLinkOptions
): ShareLinkResult {
  const shareId = generateShareId();
  const now = Date.now();
  const expiresAt = options.expiresIn ? now + options.expiresIn : undefined;

  // Extract messages from session
  const messages = (session.messages || []).map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    model: msg.model,
  }));

  const sharedConversation: SharedConversation = {
    id: shareId,
    sessionId: session.id,
    title: session.title,
    messages,
    createdAt: now,
    expiresAt,
    viewCount: 0,
    isPublic: true,
  };

  // Save to storage
  const conversations = loadSharedConversations();
  conversations.push(sharedConversation);
  localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(conversations));

  // Generate URL
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${baseUrl}/share/${shareId}`;

  return {
    shareId,
    url,
    expiresAt,
  };
}

/**
 * Delete a shared conversation
 */
export function deleteSharedConversation(shareId: string): void {
  const conversations = loadSharedConversations();
  const filtered = conversations.filter((c) => c.id !== shareId);
  localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Increment view count for a shared conversation
 */
export function incrementViewCount(shareId: string): void {
  const conversations = loadSharedConversations();
  const conversation = conversations.find((c) => c.id === shareId);

  if (conversation) {
    conversation.viewCount++;
    localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(conversations));
  }
}

/**
 * Get all shared conversations for a specific session
 */
export function getSessionShares(sessionId: string): SharedConversation[] {
  const conversations = loadSharedConversations();
  return conversations.filter((c) => c.sessionId === sessionId);
}

/**
 * Check if a session has active shares
 */
export function hasActiveShares(sessionId: string): boolean {
  const shares = getSessionShares(sessionId);
  return shares.length > 0;
}
