/**
 * Knowledge Base Share Utils
 * Export knowledge collections to JSON files, import from JSON files
 * Enables sharing knowledge bases between users or backing up locally
 */

import type { Collection, KnowledgeFile } from "../../types";
import { normalizeKnowledgeCollection } from "../knowledge/entities";

export interface KnowledgeExportData {
  version: "1.0";
  exportedAt: number;
  exportedBy?: string;
  collections: Collection[];
  metadata: {
    totalCollections: number;
    totalFiles: number;
    appName: string;
  };
}

const EXPORT_FORMAT_VERSION = "1.0" as const;

/**
 * Export knowledge collections to a downloadable JSON file
 */
export function exportKnowledgeCollections(
  collections: Collection[],
  options: {
    selectedIds?: string[];
    exportedBy?: string;
  } = {},
): KnowledgeExportData {
  const filtered = options.selectedIds
    ? collections.filter((c) => options.selectedIds!.includes(c.id))
    : collections;

  const totalFiles = filtered.reduce((sum, c) => sum + (c.files?.length || 0), 0);

  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: Date.now(),
    ...(options.exportedBy ? { exportedBy: options.exportedBy } : {}),
    collections: filtered,
    metadata: {
      totalCollections: filtered.length,
      totalFiles,
      appName: "Baotuo Chat",
    },
  };
}

/**
 * Download knowledge collections as JSON file
 */
export function downloadKnowledgeExport(
  collections: Collection[],
  options: {
    selectedIds?: string[];
    filename?: string;
    exportedBy?: string;
  } = {},
): void {
  const exportData = exportKnowledgeCollections(collections, options);
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split("T")[0];
  const filename =
    options.filename || `baotuo-knowledge-export-${dateStr}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate imported knowledge JSON file
 */
export function parseKnowledgeImport(jsonText: string): {
  success: boolean;
  data?: KnowledgeExportData;
  collections?: Collection[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);

    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "Invalid JSON structure" };
    }

    if (!parsed.version) {
      return { success: false, error: "Missing version field" };
    }

    if (!Array.isArray(parsed.collections)) {
      return { success: false, error: "Missing or invalid collections array" };
    }

    // Normalize and validate each collection
    const normalized: Collection[] = [];
    for (const raw of parsed.collections) {
      const collection = normalizeKnowledgeCollection(raw);
      if (collection) {
        normalized.push(collection);
      }
    }

    if (normalized.length === 0) {
      return {
        success: false,
        error: "No valid collections found in the file",
      };
    }

    return {
      success: true,
      data: parsed as KnowledgeExportData,
      collections: normalized,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse JSON",
    };
  }
}

/**
 * Read a file input and parse as knowledge import
 */
export async function readKnowledgeImportFile(
  file: File,
): Promise<{
  success: boolean;
  data?: KnowledgeExportData;
  collections?: Collection[];
  error?: string;
}> {
  try {
    if (!file.name.toLowerCase().endsWith(".json")) {
      return {
        success: false,
        error: "File must be a .json file",
      };
    }

    if (file.size > 50 * 1024 * 1024) {
      return {
        success: false,
        error: "File is too large (max 50MB)",
      };
    }

    const text = await file.text();
    return parseKnowledgeImport(text);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file",
    };
  }
}

/**
 * Merge imported collections with existing ones
 * Strategy: rename duplicates, skip identical IDs
 */
export function mergeImportedCollections(
  existing: Collection[],
  imported: Collection[],
  strategy: "skip" | "rename" | "replace" = "rename",
): {
  merged: Collection[];
  added: number;
  skipped: number;
  renamed: number;
  replaced: number;
} {
  const existingIds = new Set(existing.map((c) => c.id));
  const existingNames = new Set(existing.map((c) => c.name));

  let added = 0;
  let skipped = 0;
  let renamed = 0;
  let replaced = 0;

  const result = [...existing];

  for (const collection of imported) {
    const idExists = existingIds.has(collection.id);
    const nameExists = existingNames.has(collection.name);

    if (idExists) {
      if (strategy === "skip") {
        skipped++;
        continue;
      }
      if (strategy === "replace") {
        const index = result.findIndex((c) => c.id === collection.id);
        if (index !== -1) {
          result[index] = collection;
          replaced++;
          continue;
        }
      }
      // For "rename" or fallback: generate new ID
      const newId = `${collection.id}-imported-${Date.now()}`;
      const newCollection: Collection = {
        ...collection,
        id: newId,
        name: nameExists ? `${collection.name} (Imported)` : collection.name,
      };
      result.push(newCollection);
      renamed++;
      added++;
      existingIds.add(newId);
      existingNames.add(newCollection.name);
    } else {
      const newCollection: Collection = nameExists
        ? { ...collection, name: `${collection.name} (Imported)` }
        : collection;
      result.push(newCollection);
      added++;
      existingIds.add(newCollection.id);
      existingNames.add(newCollection.name);
    }
  }

  return {
    merged: result,
    added,
    skipped,
    renamed,
    replaced,
  };
}

/**
 * Get summary stats for exported/imported data
 */
export function getKnowledgeExportSummary(data: KnowledgeExportData): {
  collectionCount: number;
  fileCount: number;
  totalSize: number;
  exportDate: string;
} {
  const collectionCount = data.collections.length;
  let fileCount = 0;
  let totalSize = 0;

  for (const collection of data.collections) {
    if (collection.files) {
      fileCount += collection.files.length;
      totalSize += collection.files.reduce(
        (sum: number, f: KnowledgeFile) => sum + (f.size || 0),
        0,
      );
    }
  }

  return {
    collectionCount,
    fileCount,
    totalSize,
    exportDate: new Date(data.exportedAt).toLocaleString(),
  };
}
