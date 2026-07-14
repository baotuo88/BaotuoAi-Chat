"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { useAIRoleStore } from "@/store/aiRoleStore";
import type { AIRole } from "@/types/aiRole";

interface AIRoleManagerProps {
  userId?: string;
}

const AIRoleManager: React.FC<AIRoleManagerProps> = ({ userId }) => {
  const t = useTranslations("aiRoles");
  const { roles, createRole, updateRole, deleteRole } = useAIRoleStore();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    avatar: "",
  });

  const builtInRoles = roles.filter((role) => role.isBuiltIn);
  const customRoles = roles.filter((role) => !role.isBuiltIn);

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      alert(
        !formData.name.trim()
          ? t("roleNameRequired")
          : t("systemPromptRequired"),
      );
      return;
    }

    try {
      createRole(formData, userId);
      setFormData({ name: "", description: "", systemPrompt: "", avatar: "" });
      setIsCreating(false);
    } catch (error) {
      alert(t("createError"));
    }
  };

  const handleUpdate = (id: string) => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      alert(
        !formData.name.trim()
          ? t("roleNameRequired")
          : t("systemPromptRequired"),
      );
      return;
    }

    try {
      updateRole(id, formData, userId);
      setEditingId(null);
      setFormData({ name: "", description: "", systemPrompt: "", avatar: "" });
    } catch (error) {
      alert(t("updateError"));
    }
  };

  const handleDelete = (id: string, isBuiltIn?: boolean) => {
    if (isBuiltIn) {
      alert(t("cannotDeleteBuiltIn"));
      return;
    }

    if (!confirm(t("confirmDelete"))) return;

    try {
      deleteRole(id, userId);
    } catch (error) {
      alert(t("deleteError"));
    }
  };

  const startEdit = (role: AIRole) => {
    if (role.isBuiltIn) {
      alert(t("cannotEditBuiltIn"));
      return;
    }

    setEditingId(role.id);
    setFormData({
      name: role.name,
      description: role.description,
      systemPrompt: role.systemPrompt,
      avatar: role.avatar || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ name: "", description: "", systemPrompt: "", avatar: "" });
  };

  const renderRoleCard = (role: AIRole) => {
    const isEditing = editingId === role.id;

    if (isEditing) {
      return (
        <div
          key={role.id}
          className="rounded-lg border border-blue-500 bg-blue-50 p-4 dark:bg-blue-950/30"
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("avatarPlaceholder")}
                value={formData.avatar}
                onChange={(e) =>
                  setFormData({ ...formData, avatar: e.target.value })
                }
                className="w-16 rounded border border-gray-300 px-2 py-1 text-center dark:border-gray-600 dark:bg-gray-800"
                maxLength={2}
              />
              <input
                type="text"
                placeholder={t("namePlaceholder")}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="flex-1 rounded border border-gray-300 px-3 py-1 dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <input
              type="text"
              placeholder={t("descriptionPlaceholder")}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full rounded border border-gray-300 px-3 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
            <textarea
              placeholder={t("systemPromptPlaceholder")}
              value={formData.systemPrompt}
              onChange={(e) =>
                setFormData({ ...formData, systemPrompt: e.target.value })
              }
              rows={4}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <X size={16} className="inline" /> {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleUpdate(role.id)}
                className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
              >
                <Check size={16} className="inline" /> {t("save")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={role.id}
        className="group rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl dark:bg-gray-700">
            {role.avatar || "🤖"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-medium text-gray-900 dark:text-gray-100">
                  {role.name}
                </h3>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {role.description}
                </p>
              </div>
              {!role.isBuiltIn && (
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(role)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    aria-label={t("editRole")}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(role.id, role.isBuiltIn)}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label={t("deleteRole")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-mono text-gray-600 dark:text-gray-400">
              {role.systemPrompt}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("description")}
        </p>
      </div>

      {/* Built-in roles */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("builtInRoles")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {builtInRoles.map((role) => renderRoleCard(role))}
        </div>
      </div>

      {/* Custom roles */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("customRoles")}
          </h3>
          {!isCreating && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
            >
              <Plus size={16} />
              {t("createRole")}
            </button>
          )}
        </div>

        {isCreating && (
          <div className="mb-3 rounded-lg border border-blue-500 bg-blue-50 p-4 dark:bg-blue-950/30">
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t("avatarPlaceholder")}
                  value={formData.avatar}
                  onChange={(e) =>
                    setFormData({ ...formData, avatar: e.target.value })
                  }
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-center dark:border-gray-600 dark:bg-gray-800"
                  maxLength={2}
                />
                <input
                  type="text"
                  placeholder={t("namePlaceholder")}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="flex-1 rounded border border-gray-300 px-3 py-1 dark:border-gray-600 dark:bg-gray-800"
                />
              </div>
              <input
                type="text"
                placeholder={t("descriptionPlaceholder")}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full rounded border border-gray-300 px-3 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
              <textarea
                placeholder={t("systemPromptPlaceholder")}
                value={formData.systemPrompt}
                onChange={(e) =>
                  setFormData({ ...formData, systemPrompt: e.target.value })
                }
                rows={4}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <X size={16} className="inline" /> {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
                >
                  <Check size={16} className="inline" /> {t("save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {customRoles.length === 0 && !isCreating && (
          <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
            {t("noCustomRoles")}
          </p>
        )}

        {customRoles.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {customRoles.map((role) => renderRoleCard(role))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIRoleManager;
