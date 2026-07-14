import { create } from "zustand";
import type { AIRole } from "@/types/aiRole";
import {
  loadAIRoles,
  createAIRole as createRole,
  updateAIRole as updateRole,
  deleteAIRole as deleteRole,
  getAIRoleById,
} from "@/lib/aiRole/roleStorage";

interface AIRoleState {
  roles: AIRole[];
  selectedRoleId: string | null;

  // Actions
  loadRoles: (userId?: string) => void;
  createRole: (data: { name: string; description: string; systemPrompt: string; avatar?: string }, userId?: string) => AIRole;
  updateRole: (id: string, updates: { name?: string; description?: string; systemPrompt?: string; avatar?: string }, userId?: string) => void;
  deleteRole: (id: string, userId?: string) => void;
  selectRole: (id: string | null) => void;
  getRoleById: (id: string) => AIRole | null;
}

export const useAIRoleStore = create<AIRoleState>((set, get) => ({
  roles: loadAIRoles(),
  selectedRoleId: "assistant", // default to built-in assistant

  loadRoles: (userId) => {
    set({ roles: loadAIRoles(userId) });
  },

  createRole: (data, userId) => {
    const newRole = createRole(data, userId);
    set({ roles: loadAIRoles(userId) });
    return newRole;
  },

  updateRole: (id, updates, userId) => {
    updateRole(id, updates, userId);
    set({ roles: loadAIRoles(userId) });
  },

  deleteRole: (id, userId) => {
    deleteRole(id, userId);
    set({ roles: loadAIRoles(userId) });

    // If the deleted role was selected, reset to default
    if (get().selectedRoleId === id) {
      set({ selectedRoleId: "assistant" });
    }
  },

  selectRole: (id) => {
    set({ selectedRoleId: id });
  },

  getRoleById: (id) => {
    return get().roles.find((role) => role.id === id) ?? null;
  },
}));
