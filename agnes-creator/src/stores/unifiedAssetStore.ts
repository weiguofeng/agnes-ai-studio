import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssetIndex, AssetFilter, AssetCategory } from "@/types/asset";
import { StorageService } from "@/services/StorageService";
import type { AssetRecord } from "@/services/AssetsDB";
import { useProjectStore } from "@/stores/projectStore";

function genAssetIndexId(): string {
  return "aidx-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function deriveName(url: string, type: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() || "";
    if (seg.includes(".")) return decodeURIComponent(seg);
  } catch { /* ignore */ }
  return type === "image" ? "Image " + Date.now().toString(36) : "Video " + Date.now().toString(36);
}

interface UnifiedAssetStoreState {
  indexes: AssetIndex[];
  loading: boolean;
  error: string | null;
  syncFromStorage: () => Promise<void>;
  addIndex: (entry: Omit<AssetIndex, "id" | "createdAt" | "updatedAt"> & { id?: string }) => string;
  updateIndex: (id: string, patch: Partial<AssetIndex>) => void;
  removeIndex: (id: string) => void;
  removeIndexes: (ids: string[]) => void;
  toggleFavorite: (id: string) => void;
  getIndex: (id: string) => AssetIndex | undefined;
  search: (filter: AssetFilter) => AssetIndex[];
  getProjectNames: () => string[];
  getCharacterNames: () => string[];
  getAllTags: () => string[];
  clearIndexes: () => void;
}

export const useUnifiedAssetStore = create<UnifiedAssetStoreState>()(
  persist(
    (set, get) => ({
      indexes: [],
      loading: false,
      error: null,

      syncFromStorage: async () => {
        set({ loading: true, error: null });
        try {
          const records = await StorageService.listAssets();
          const indexes: AssetIndex[] = records
            .filter((r): r is AssetRecord & { type: "image" | "video" } =>
              r.status === "active" && (r.type === "image" || r.type === "video"))
            .map((r) => ({
              id: r.id,
              name: r.shotTitle || r.characterName || deriveName(r.originalUrl || r.url, r.type),
              type: r.type,
              tags: [] as string[],
              projectId: r.projectId,
              projectName: r.projectId ? (() => { try { return useProjectStore.getState().getProjectById(r.projectId)?.name || r.projectId; } catch { return r.projectId; } })() : undefined,
              characterId: r.characterId,
              characterName: r.characterName,
              sceneId: r.sceneId,
              shotId: r.shotId,
              category: (r.type === "video" ? "output" : "generated") as AssetCategory,
              isFavorite: false,
              fileSize: r.fileSize || 0,
              mimeType: r.mimeType || "",
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            }));
          set({ indexes, loading: false });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          set({ loading: false, error: msg });
        }
      },

      addIndex: (entry) => {
        const now = Date.now();
        const entryWithMaybeId = entry as any;
        const id = entryWithMaybeId.id || genAssetIndexId();
        const { id: _discard, ...rest } = entryWithMaybeId;
        set((s) => ({
          indexes: [{ ...rest, id, createdAt: now, updatedAt: now }, ...s.indexes],
        }));
        return id;
      },

      updateIndex: (id, patch) =>
        set((s) => ({
          indexes: s.indexes.map((idx) =>
            idx.id === id ? { ...idx, ...patch, updatedAt: Date.now() } : idx
          ),
        })),

      removeIndex: (id) =>
        set((s) => ({ indexes: s.indexes.filter((idx) => idx.id !== id) })),

      removeIndexes: (ids) =>
        set((s) => ({ indexes: s.indexes.filter((idx) => !ids.includes(idx.id)) })),

      toggleFavorite: (id) =>
        set((s) => ({
          indexes: s.indexes.map((idx) =>
            idx.id === id ? { ...idx, isFavorite: !idx.isFavorite, updatedAt: Date.now() } : idx
          ),
        })),

      getIndex: (id) => get().indexes.find((idx) => idx.id === id),

      search: (filter) => {
        let results = get().indexes;
        if (filter.search) {
          const q = filter.search.toLowerCase();
          results = results.filter(
            (idx) =>
              idx.name.toLowerCase().includes(q) ||
              idx.tags.some((t) => t.toLowerCase().includes(q)) ||
              idx.projectName?.toLowerCase().includes(q) ||
              idx.characterName?.toLowerCase().includes(q)
          );
        }
        if (filter.type && filter.type !== "all") {
          results = results.filter((idx) => idx.type === filter.type);
        }
        if (filter.projectId) {
          results = results.filter((idx) => idx.projectId === filter.projectId);
        }
        if (filter.characterId) {
          results = results.filter((idx) => idx.characterId === filter.characterId);
        }
        const tagFilterVal = filter.tag;
        if (tagFilterVal) {
          results = results.filter((idx) => idx.tags.includes(tagFilterVal));
        }
        if (filter.category) {
          results = results.filter((idx) => idx.category === filter.category);
        }
        const sortBy = filter.sortBy || "createdAt";
        const sortOrder = filter.sortOrder || "desc";
        results = [...results].sort((a, b) => {
          let cmp = 0;
          if (sortBy === "name") cmp = a.name.localeCompare(b.name);
          else if (sortBy === "fileSize") cmp = (a.fileSize || 0) - (b.fileSize || 0);
          else cmp = a.createdAt - b.createdAt;
          return sortOrder === "desc" ? -cmp : cmp;
        });
        results.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
        return results;
      },

      getProjectNames: () => {
        const names = new Set<string>();
        get().indexes.forEach((idx) => { if (idx.projectName) names.add(idx.projectName); });
        return Array.from(names).sort();
      },

      getCharacterNames: () => {
        const names = new Set<string>();
        get().indexes.forEach((idx) => { if (idx.characterName) names.add(idx.characterName); });
        return Array.from(names).sort();
      },

      getAllTags: () => {
        const tags = new Set<string>();
        get().indexes.forEach((idx) => idx.tags.forEach((t) => tags.add(t)));
        return Array.from(tags).sort();
      },

      clearIndexes: () => set({ indexes: [] }),
    }),
    {
      name: "agnes-unified-asset-store",
      version: 1,
      partialize: (state) => ({ indexes: state.indexes }),
    }
  )
);




