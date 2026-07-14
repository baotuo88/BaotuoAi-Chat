"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, Calendar, Lock } from "lucide-react";
import type { SharedConversation } from "@/types/share";
import { getSharedConversation, incrementViewCount } from "@/lib/chat/shareStorage";
import MessageItem from "./MessageItem";

interface SharedChatViewProps {
  shareId: string;
}

const SharedChatView: React.FC<SharedChatViewProps> = ({ shareId }) => {
  const t = useTranslations("share");
  const [sharedConv, setSharedConv] = useState<SharedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedConversation = async () => {
      try {
        const conv = getSharedConversation(shareId);

        if (!conv) {
          setError("notFound");
          setLoading(false);
          return;
        }

        setSharedConv(conv);
        incrementViewCount(shareId);
      } catch (err) {
        console.error("Failed to load shared conversation:", err);
        setError("loadError");
      } finally {
        setLoading(false);
      }
    };

    void loadSharedConversation();
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="mb-4 text-gray-500 dark:text-gray-400">
            {t("loading")}
          </div>
        </div>
      </div>
    );
  }

  if (error || !sharedConv) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <Lock size={48} className="mx-auto mb-4 text-gray-400" />
          <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            {error === "notFound"
              ? "Conversation Not Found"
              : "Failed to Load"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {error === "notFound"
              ? "This conversation doesn't exist, has expired, or has been deleted."
              : "Something went wrong while loading this conversation."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <MessageSquare size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {sharedConv.title}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Calendar size={12} />
                <span>
                  {new Date(sharedConv.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span>•</span>
                <span>{sharedConv.messages.length} messages</span>
                <span>•</span>
                <span>{sharedConv.viewCount} views</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {sharedConv.messages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No messages in this conversation
            </div>
          ) : (
            <div className="space-y-6">
              {sharedConv.messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isSharedView={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl text-center text-xs text-gray-500 dark:text-gray-400">
          Shared with Baotuo Chat • Read-only view
        </div>
      </div>
    </div>
  );
};

export default SharedChatView;
