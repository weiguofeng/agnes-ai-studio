// ========== Unified Asset System Types ==========
// Lightweight index stored in Zustand (no blob data)
// Full binary data stays in IndexedDB via StorageService

export interface AssetIndex {
  id: string;
  name: string;
  type: "image" | "video";
  /** Tags for filtering: project names, character names, etc. */
  tags: string[];
  projectId?: string;
  projectName?: string;
  characterId?: string;
  characterName?: string;
  sceneId?: string;
  shotId?: string;
  /** Category: generated, uploaded, reference, output */
  category: AssetCategory;
  isFavorite: boolean;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  mimeType?: string;
  /** Created at timestamp */
  createdAt: number;
  updatedAt: number;
}

export type AssetCategory = "generated" | "uploaded" | "reference" | "output";

export interface AssetFilter {
  search?: string;
  type?: "image" | "video" | "all";
  projectId?: string;
  characterId?: string;
  tag?: string;
  category?: AssetCategory;
  sortBy?: "createdAt" | "name" | "fileSize";
  sortOrder?: "asc" | "desc";
}
