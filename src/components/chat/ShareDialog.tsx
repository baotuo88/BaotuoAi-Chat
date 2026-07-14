import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Share2, Copy, Check, ExternalLink, Trash2, Clock } from "lucide-react";
import type { Session } from "@/lib/chat/types";
import { createShareLink, getSessionShares, deleteSharedConversation } from "@/lib/chat/shareStorage";
import type { SharedConversation } from "@/types/share";

interface ShareDialogProps {
  session: Session;
  onClose: () => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ session, onClose }) => {
  const t = useTranslations("share");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [expiresIn, setExpiresIn] = useState<string>("never");
  const [isCopied, setIsCopied] = useState(false);
  const [existingShares, setExistingShares] = useState<SharedConversation[]>(
    getSessionShares(session.id)
  );

  const handleCreateShare = () => {
    const expiresInMs =
      expiresIn === "never"
        ? undefined
        : expiresIn === "1hour"
          ? 60 * 60 * 1000
          : expiresIn === "1day"
            ? 24 * 60 * 60 * 1000
            : expiresIn === "7days"
              ? 7 * 24 * 60 * 60 * 1000
              : undefined;

    const result = createShareLink(session, {
      sessionId: session.id,
      expiresIn: expiresInMs,
    });

    setShareUrl(result.url);
    setExistingShares(getSessionShares(session.id));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDeleteShare = (shareId: string) => {
    if (!confirm(t("confirmDelete"))) return;

    deleteSharedConversation(shareId);
    setExistingShares(getSessionShares(session.id));

    if (shareUrl.includes(shareId)) {
      setShareUrl("");
    }
  };

  const formatExpiresAt = (timestamp?: number) => {
    if (!timestamp) return t("neverExpires");

    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            <Share2 size={20} className="inline mr-2" />
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {t("description")}
        </p>

        {/* Create new share */}
        <div className="mb-6 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("expiresIn")}
            </label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="never">{t("neverExpires")}</option>
              <option value="1hour">{t("1hour")}</option>
              <option value="1day">{t("1day")}</option>
              <option value="7days">{t("7days")}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleCreateShare}
            className="w-full rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            {t("createLink")}
          </button>

          {shareUrl && (
            <div className="flex gap-2 rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="rounded px-2 py-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded px-2 py-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          )}
        </div>

        {/* Existing shares */}
        {existingShares.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("existingShares")}
            </h3>
            <div className="space-y-2">
              {existingShares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                >
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {t("views")}: {share.viewCount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <Clock size={12} className="inline mr-1" />
                      {formatExpiresAt(share.expiresAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/share/${share.id}`;
                        navigator.clipboard.writeText(url);
                      }}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteShare(share.id)}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareDialog;
