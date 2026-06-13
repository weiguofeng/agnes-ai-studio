import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Asset, AssetType, AssetCategory } from "@/types";

interface AssetStoreState {
  assets: Asset[];
  addAsset: (asset: Omit<Asset, "id" | "createdAt" | "updatedAt">) => string;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  removeAssets: (ids: string[]) => void;
  toggleFavorite: (id: string) => void;
  getAssetById: (id: string) => Asset | undefined;
  searchAssets: (query: string, typeFilter?: AssetType[], categoryFilter?: AssetCategory, tagFilter?: string[]) => Asset[];
}

let _aCounter = 0;
function genAssetId(): string {
  _aCounter++; return `asset-${Date.now()}-${_aCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAssetStore = create<AssetStoreState>()(
  persist(
    (set, get) => ({
      assets: [],
      addAsset: (data) => {
        const id = genAssetId(); const now = Date.now();
        set((s) => ({ assets: [{ ...data, id, createdAt: now, updatedAt: now }, ...s.assets] }));
        return id;
      },
      updateAsset: (id, patch) => set((s) => ({ assets: s.assets.map((a) => a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a) })),
      removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
      removeAssets: (ids) => set((s) => ({ assets: s.assets.filter((a) => !ids.includes(a.id)) })),
      toggleFavorite: (id) => set((s) => ({ assets: s.assets.map((a) => a.id === id ? { ...a, isFavorite: !a.isFavorite, updatedAt: Date.now() } : a) })),
      getAssetById: (id) => get().assets.find((a) => a.id === id),
      searchAssets: (query, typeFilter, categoryFilter, tagFilter) => {
        let results = get().assets;
        if (query) { const q = query.toLowerCase(); results = results.filter((a) => a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q))); }
        if (typeFilter && typeFilter.length > 0) results = results.filter((a) => typeFilter.includes(a.type));
        if (categoryFilter) results = results.filter((a) => a.category === categoryFilter);
        if (tagFilter && tagFilter.length > 0) results = results.filter((a) => tagFilter.some((t) => a.tags.includes(t)));
        return results.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) || b.updatedAt - a.updatedAt);
      },
    }),
    { name: "agnes-asset-store", version: 1 }
  )
);
