"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { useAIRoleStore } from "@/store/aiRoleStore";

interface AIRoleSelectorProps {
  userId?: string;
  onRoleChange?: (roleId: string) => void;
}

const AIRoleSelector: React.FC<AIRoleSelectorProps> = ({
  userId,
  onRoleChange,
}) => {
  const t = useTranslations("aiRoles");
  const { roles, selectedRoleId, selectRole } = useAIRoleStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (roleId: string) => {
    selectRole(roleId);
    setIsOpen(false);
    onRoleChange?.(roleId);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750"
      >
        <span className="text-base">{selectedRole?.avatar || "🤖"}</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {selectedRole?.name || t("selectRole")}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="max-h-96 overflow-y-auto p-2">
            {roles.map((role) => {
              const isSelected = role.id === selectedRoleId;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelect(role.id)}
                  className={`w-full rounded-lg p-3 text-left transition-colors ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/30"
                      : "hover:bg-gray-50 dark:hover:bg-gray-750"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-700">
                      {role.avatar || "🤖"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate font-medium text-gray-900 dark:text-gray-100">
                          {role.name}
                        </h4>
                        {role.isBuiltIn && (
                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            {t("builtInRoles")}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {role.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIRoleSelector;
