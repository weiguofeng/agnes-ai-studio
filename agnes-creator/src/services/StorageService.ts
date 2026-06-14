// ========== StorageService - Unified Asset Management ==========
// V2.5: Centralized asset storage with IndexedDB backend

import { AssetsDB, type AssetRecord } from "./AssetsDB";

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function genId(): string {
  return "asset-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

/** Download a remote URL to a Blob */
async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch: ${res.status}");
  return res.blob();
}

/** Convert data URL to Blob */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export const StorageService = {
  /** Save an asset from URL (fetches and stores in IndexedDB) */
  async saveAssetFromUrl(params: {
    url: string;
    type: AssetRecord["type"];
    projectId?: string;
    shotId?: string;
    mimeType?: string;
  }): Promise<StorageResult<AssetRecord>> {
    try {
      const id = genId();
      const blob = params.url.startsWith("data:")
        ? dataUrlToBlob(params.url)
        : await urlToBlob(params.url);

      const storeName = params.type === "video" ? "videos" : params.type === "thumbnail" ? "thumbnails" : "images";
      await AssetsDB.save(storeName, id, blob);

      const record: AssetRecord = {
        id,
        url: URL.createObjectURL(blob),
        type: params.type,
        status: "active",
        fileSize: blob.size,
        mimeType: params.mimeType || blob.type,
        projectId: params.projectId,
        shotId: params.shotId,
        createdAt: Date.now(),
      };
      await AssetsDB.saveMeta(record);
      return { success: true, data: record };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /** Save an asset from an existing Blob */
  async saveAssetFromBlob(params: {
    blob: Blob;
    type: AssetRecord["type"];
    projectId?: string;
    shotId?: string;
  }): Promise<StorageResult<AssetRecord>> {
    try {
      const id = genId();
      const storeName = params.type === "video" ? "videos" : params.type === "thumbnail" ? "thumbnails" : "images";
      await AssetsDB.save(storeName, id, params.blob);

      const record: AssetRecord = {
        id,
        url: URL.createObjectURL(params.blob),
        type: params.type,
        status: "active",
        fileSize: params.blob.size,
        mimeType: params.blob.type,
        projectId: params.projectId,
        shotId: params.shotId,
        createdAt: Date.now(),
      };
      await AssetsDB.saveMeta(record);
      return { success: true, data: record };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /** Load asset blob by id */
  async loadAsset(id: string, type: AssetRecord["type"]): Promise<StorageResult<Blob>> {
    try {
      const storeName = type === "video" ? "videos" : type === "thumbnail" ? "thumbnails" : "images";
      const blob = await AssetsDB.load(storeName, id);
      if (!blob) return { success: false, error: "Asset not found" };
      return { success: true, data: blob };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /** Delete asset by id */
  async deleteAsset(id: string): Promise<StorageResult<void>> {
    try {
      const meta = await AssetsDB.loadMeta(id);
      if (!meta) return { success: false, error: "Asset not found" };

      const storeName = meta.type === "video" ? "videos" : meta.type === "thumbnail" ? "thumbnails" : "images";
      await AssetsDB.delete(storeName, id);
      await AssetsDB.deleteMeta(id);

      // Revoke blob URL
      URL.revokeObjectURL(meta.url);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /** Delete all assets for a project */
  async deleteProjectAssets(projectId: string): Promise<StorageResult<number>> {
    try {
      const metas = await AssetsDB.queryMeta("projectId", projectId);
      let count = 0;
      for (const m of metas) {
        const r = await StorageService.deleteAsset(m.id);
        if (r.success) count++;
      }
      return { success: true, data: count };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /** Get all asset metadata */
  async listAssets(): Promise<AssetRecord[]> {
    return AssetsDB.getAllMeta();
  },

  /** Get assets filtered by type */
  async listAssetsByType(type: AssetRecord["type"]): Promise<AssetRecord[]> {
    const all = await AssetsDB.getAllMeta();
    return all.filter((a) => a.type === type && a.status === "active");
  },

  /** Get storage information */
  async getStorageInfo(): Promise<{ used: number; quota: number; count: number }> {
    return AssetsDB.getStorageInfo();
  },

  /** Clear all stored assets */
  async clearAll(): Promise<StorageResult<void>> {
    try {
      // Revoke all blob URLs
      const metas = await AssetsDB.getAllMeta();
      for (const m of metas) URL.revokeObjectURL(m.url);
      await AssetsDB.clearAll();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
};
