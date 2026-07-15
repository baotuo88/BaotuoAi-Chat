"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v7 as uuidv7 } from "uuid";
import { getAppDbStorage, STORAGE_VERSION } from "../storage/storageConfig";
import { logDevError } from "../../lib/utils/devLogger";
import type { Message } from "@/types";

export interface ComparisonColumn {
  model: string;
  messages: Message[];
  isGenerating: boolean;
  error?: string;
}

interface ComparisonState {
  active: boolean;
  columns: ComparisonColumn[];
  _hasHydrated: boolean;

  setHasHydrated: (value: boolean) => void;
  start: (models: string[]) => void;
  addUserTurn: (prompt: string) => void;
  addModel: (model: string) => void;
  removeModel: (model: string) => void;
  regenerate: (model: string) => void;
  patchColumn: (model: string, patch: Partial<ComparisonColumn>) => void;
  updateAssistantContent: (
    model: string,
    messageId: string,
    content: string,
  ) => void;
  close: () => void;
}

const makeUserMessage = (content: string): Message => ({
  id: uuidv7(),
  role: "user",
  content,
  timestamp: Date.now(),
});

const makeAssistantPlaceholder = (model: string): Message => ({
  id: uuidv7(),
  role: "model",
  content: "",
  timestamp: Date.now(),
  model,
});

/**
 * Latest user prompt across all columns (columns stay in lockstep for shared
 * turns, but a newly added model may lag — we use the longest column as the
 * source of truth for replaying the most recent prompt).
 */
const latestPrompt = (columns: ComparisonColumn[]): string => {
  let prompt = "";
  columns.forEach((column) => {
    for (let i = column.messages.length - 1; i >= 0; i -= 1) {
      if (column.messages[i].role === "user") {
        if (column.messages[i].content) prompt = column.messages[i].content;
        break;
      }
    }
  });
  return prompt;
};

export const useComparisonStore = create<ComparisonState>()(
  persist(
    (set, get) => ({
      active: false,
      columns: [],
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      start: (models) => {
        const unique = Array.from(new Set(models));
        const columns: ComparisonColumn[] = unique.map((model) => ({
          model,
          messages: [],
          isGenerating: false,
          error: undefined,
        }));
        set({ active: true, columns });
      },

      addUserTurn: (prompt) => {
        set((state) => ({
          columns: state.columns.map((column) => ({
            ...column,
            messages: [
              ...column.messages,
              makeUserMessage(prompt),
              makeAssistantPlaceholder(column.model),
            ],
            isGenerating: true,
            error: undefined,
          })),
        }));
      },

      addModel: (model) => {
        set((state) => {
          if (state.columns.some((column) => column.model === model)) {
            return state;
          }
          const prompt = latestPrompt(state.columns);
          const messages: Message[] = prompt
            ? [makeUserMessage(prompt), makeAssistantPlaceholder(model)]
            : [];
          return {
            columns: [
              ...state.columns,
              {
                model,
                messages,
                isGenerating: !!prompt,
                error: undefined,
              },
            ],
          };
        });
      },

      removeModel: (model) => {
        set((state) => {
          const columns = state.columns.filter(
            (column) => column.model !== model,
          );
          // Removing the last model closes the comparison entirely so the UI
          // returns to the normal chat composer instead of an empty shell.
          if (columns.length === 0) {
            return { columns, active: false };
          }
          return { columns };
        });
      },

      regenerate: (model) => {
        set((state) => ({
          columns: state.columns.map((column) => {
            if (column.model !== model) return column;
            const messages = [...column.messages];
            // Replace trailing assistant message with a fresh placeholder so
            // the view re-triggers generation (keyed by message id).
            for (let i = messages.length - 1; i >= 0; i -= 1) {
              if (messages[i].role === "model") {
                messages[i] = makeAssistantPlaceholder(model);
                break;
              }
            }
            return {
              ...column,
              messages,
              isGenerating: true,
              error: undefined,
            };
          }),
        }));
      },

      patchColumn: (model, patch) => {
        set((state) => ({
          columns: state.columns.map((column) =>
            column.model === model ? { ...column, ...patch } : column,
          ),
        }));
      },

      updateAssistantContent: (model, messageId, content) => {
        set((state) => ({
          columns: state.columns.map((column) => {
            if (column.model !== model) return column;
            return {
              ...column,
              messages: column.messages.map((message) =>
                message.id === messageId ? { ...message, content } : message,
              ),
            };
          }),
        }));
      },

      close: () => set({ active: false, columns: [] }),
    }),
    {
      name: "neo-chat-comparison",
      storage: createJSONStorage(getAppDbStorage),
      version: STORAGE_VERSION,
      skipHydration: false,
      // Persist structure + history, but never a stuck "generating" flag.
      partialize: (state) => ({
        active: state.active,
        columns: state.columns.map((column) => ({
          model: column.model,
          messages: column.messages,
          isGenerating: false,
          error: column.error,
        })),
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (typeof window === "undefined") return;
          if (error) {
            logDevError("Comparison store hydration failed:", error);
            state?.setHasHydrated(true);
          } else if (state) {
            // Clear any placeholder that was mid-generation when persisted:
            // drop trailing empty assistant messages so nothing auto-restarts.
            state.columns = state.columns.map((column) => {
              const messages = [...column.messages];
              const last = messages[messages.length - 1];
              if (last && last.role === "model" && !last.content) {
                messages.pop();
                // also drop the dangling user prompt with no answer
                const prevUser = messages[messages.length - 1];
                if (prevUser && prevUser.role === "user") messages.pop();
              }
              return { ...column, messages, isGenerating: false };
            });
            state.setHasHydrated(true);
          }
        };
      },
    },
  ),
);
