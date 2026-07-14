/**
 * LocalStorage manager for AI roles. Provides CRUD operations with
 * built-in roles always available and user roles persisted locally.
 */

import type { AIRole, NewAIRole } from "@/types/aiRole";
import { BUILT_IN_ROLES } from "@/types/aiRole";

const STORAGE_KEY = "baotuo_ai_roles";

function getStorageKey(userId?: string): string {
  // If multi-user accounts are enabled, namespace roles per user
  return userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
}

/**
 * Loads user-created roles from localStorage. Built-in roles are always
 * included and cannot be modified or deleted.
 */
export function loadAIRoles(userId?: string): AIRole[] {
  try {
    const key = getStorageKey(userId);
    const stored = localStorage.getItem(key);
    if (!stored) return [...BUILT_IN_ROLES];

    const userRoles = JSON.parse(stored) as AIRole[];
    return [...BUILT_IN_ROLES, ...userRoles];
  } catch {
    return [...BUILT_IN_ROLES];
  }
}

/**
 * Saves user-created roles to localStorage. Built-in roles are filtered out
 * since they're always available and should not be persisted.
 */
function saveUserRoles(roles: AIRole[], userId?: string): void {
  try {
    const key = getStorageKey(userId);
    const userRoles = roles.filter((role) => !role.isBuiltIn);
    localStorage.setItem(key, JSON.stringify(userRoles));
  } catch (error) {
    console.error("Failed to save AI roles:", error);
  }
}

/**
 * Creates a new user role and persists it to localStorage.
 */
export function createAIRole(data: NewAIRole, userId?: string): AIRole {
  const newRole: AIRole = {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: false,
  };

  const roles = loadAIRoles(userId);
  roles.push(newRole);
  saveUserRoles(roles, userId);

  return newRole;
}

/**
 * Updates an existing user role. Built-in roles cannot be updated.
 */
export function updateAIRole(
  id: string,
  updates: Partial<NewAIRole>,
  userId?: string,
): AIRole | null {
  const roles = loadAIRoles(userId);
  const index = roles.findIndex((role) => role.id === id);

  if (index === -1) return null;
  if (roles[index].isBuiltIn) {
    throw new Error("Cannot modify built-in roles");
  }

  const updated: AIRole = {
    ...roles[index],
    ...updates,
    updatedAt: Date.now(),
  };

  roles[index] = updated;
  saveUserRoles(roles, userId);

  return updated;
}

/**
 * Deletes a user role. Built-in roles cannot be deleted.
 */
export function deleteAIRole(id: string, userId?: string): boolean {
  const roles = loadAIRoles(userId);
  const role = roles.find((r) => r.id === id);

  if (!role) return false;
  if (role.isBuiltIn) {
    throw new Error("Cannot delete built-in roles");
  }

  const filtered = roles.filter((r) => r.id !== id);
  saveUserRoles(filtered, userId);

  return true;
}

/**
 * Finds a role by ID, checking both built-in and user roles.
 */
export function getAIRoleById(id: string, userId?: string): AIRole | null {
  const roles = loadAIRoles(userId);
  return roles.find((role) => role.id === id) ?? null;
}
