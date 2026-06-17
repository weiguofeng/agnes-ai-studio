import { AssetsDB, type AssetRecord } from "./AssetsDB";
import { logger } from "@/lib/logger";

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function genId(): string {
  return "asset-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.blob();
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) arr[index] = bytes.charCodeAt(index);
  return new Blob([arr], { type: mime });
}

async function proxyUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch("/api/pipeline/download-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
  const payload = await res.json() as { success?: boolean; data?: string; error?: string; mimeType?: string };
  if (!payload.success || !payload.data) throw new Error(payload.error || "Proxy fetch failed");
  const proxyBlob = dataUrlToBlob(payload.data);
  if (payload.mimeType && !proxyBlob.type) {
    return new Blob([await proxyBlob.arrayBuffer()], { type: payload.mimeType });
  }
  return proxyBlob;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, index)).toFixed(1)) + " " + sizes[index];
}

export const StorageService = {
  async saveAssetFromUrl(params: {
    url: string;
    type: AssetRecord["type"];
    projectId?: string;
    sceneId?: string;
    shotId?: string;
    characterId?: string;
    characterName?: string;
    sceneTitle?: string;
    shotTitle?: string;
    mimeType?: string;
  }): Promise<StorageResult<AssetRecord>> {
    try {
      const id = genId();
      let blob: Blob;
      if (params.url.startsWith("data:")) {
        blob = dataUrlToBlob(params.url);
      } else {
        // Always use server-side proxy to avoid CORS issues with CDN URLs
        blob = await proxyUrlToBlob(params.url);
      }

      const storeName = params.type === "video" ? "videos" : params.type === "thumbnail" ? "thumbnails" : "images";
      await AssetsDB.save(storeName, id, blob);

      const record: AssetRecord = {
        id,
        url: URL.createObjectURL(blob),
        originalUrl: params.url,
        type: params.type,
        status: "active",
        fileSize: blob.size,
        mimeType: params.mimeType || blob.type,
        projectId: params.projectId,
        sceneId: params.sceneId,
        shotId: params.shotId,
        characterId: params.characterId,
        characterName: params.characterName,
        sceneTitle: params.sceneTitle,
        shotTitle: params.shotTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        integrityCheckedAt: Date.now(),
        integrityStatus: "pending",
      };
      await AssetsDB.saveMeta(record);
      return { success: true, data: record };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("StorageService", "saveAssetFromUrl failed", { error: msg, url: params.url.slice(0, 80) });
      return { success: false, error: msg };
    }
  },

  async saveAssetFromBlob(params: {
    blob: Blob;
    type: AssetRecord["type"];
    projectId?: string;
    sceneId?: string;
    shotId?: string;
    characterId?: string;
    characterName?: string;
    sceneTitle?: string;
    shotTitle?: string;
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
        sceneId: params.sceneId,
        shotId: params.shotId,
        characterId: params.characterId,
        characterName: params.characterName,
        sceneTitle: params.sceneTitle,
        shotTitle: params.shotTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        integrityCheckedAt: Date.now(),
        integrityStatus: "pending",
      };
      await AssetsDB.saveMeta(record);
      return { success: true, data: record };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

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

  async deleteAsset(id: string): Promise<StorageResult<void>> {
    try {
      const meta = await AssetsDB.loadMeta(id);
      if (!meta) return { success: false, error: "Asset not found" };

      const storeName = meta.type === "video" ? "videos" : meta.type === "thumbnail" ? "thumbnails" : "images";
      await AssetsDB.delete(storeName, id);
      await AssetsDB.deleteMeta(id);

      URL.revokeObjectURL(meta.url);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  async deleteProjectAssets(projectId: string): Promise<StorageResult<number>> {
    try {
      const metas = await AssetsDB.queryMeta("projectId", projectId);
      let count = 0;
      for (const meta of metas) {
        const result = await StorageService.deleteAsset(meta.id);
        if (result.success) count++;
      }
      return { success: true, data: count };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  async refreshAssetUrl(asset: AssetRecord): Promise<AssetRecord> {
    // Blob URLs expire after page refresh - recreate from stored blob
    if (asset.url && asset.url.startsWith("blob:")) {
      try {
        const blob = await AssetsDB.load(
          asset.type === "video" ? "videos" : asset.type === "thumbnail" ? "thumbnails" : "images",
          asset.id
        );
        if (blob) {
          URL.revokeObjectURL(asset.url); // clean up old URL
          return { ...asset, url: URL.createObjectURL(blob) };
        }
      } catch {
        // fallback to original URL
      }
    }
    return asset;
  },

  async listAssets(): Promise<AssetRecord[]> {
    return AssetsDB.getAllMeta();
  },

  async listAssetsByType(type: AssetRecord["type"]): Promise<AssetRecord[]> {
    const all = await AssetsDB.getAllMeta();
    return all.filter((asset) => asset.type === type && asset.status === "active");
  },

  async getStorageInfo(): Promise<{ used: number; quota: number; count: number }> {
    return AssetsDB.getStorageInfo();
  },

  async getCleanupPreview(): Promise<{
    totalAssets: number;
    totalSize: number;
    imageCount: number;
    videoCount: number;
    thumbnailCount: number;
    projects: string[];
  }> {
    const metas = await AssetsDB.getAllMeta();
    const projects = [...new Set(metas.map((meta) => meta.projectId).filter(Boolean))] as string[];
    const totalSize = metas.reduce((sum, meta) => sum + (meta.fileSize || 0), 0);
    return {
      totalAssets: metas.length,
      totalSize,
      imageCount: metas.filter((meta) => meta.type === "image").length,
      videoCount: metas.filter((meta) => meta.type === "video").length,
      thumbnailCount: metas.filter((meta) => meta.type === "thumbnail").length,
      projects,
    };
  },

  async confirmCleanup(confirmation: string): Promise<{ success: boolean; error?: string }> {
    if (confirmation !== "DELETE") {
      return { success: false, error: "Confirmation code is incorrect. Please enter DELETE" };
    }
    return { success: true };
  },

  async executeSafeCleanup(): Promise<StorageResult<{ deletedCount: number }>> {
    try {
      const metas = await AssetsDB.getAllMeta();
      let count = 0;
      for (const meta of metas) {
        URL.revokeObjectURL(meta.url);
        count++;
      }
      await AssetsDB.clearAll();
      logger.info("StorageService", `Safe cleanup completed: deleted ${count} assets`);
      return { success: true, data: { deletedCount: count } };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  async cleanupByStatus(status: string): Promise<StorageResult<{ deletedCount: number }>> {
    try {
      const all = await AssetsDB.getAllMeta();
      const targets = all.filter((meta) => meta.status === status);
      let count = 0;
      for (const target of targets) {
        const result = await StorageService.deleteAsset(target.id);
        if (result.success) count++;
      }
      return { success: true, data: { deletedCount: count } };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  async clearAll(): Promise<StorageResult<void>> {
    logger.warn("StorageService", "clearAll is deprecated. Use safe cleanup flow instead.");
    return StorageService.executeSafeCleanup().then(() => ({ success: true }));
  },
};


