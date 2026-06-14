// ========== StorageService — V2.8 (Hardened) ==========
// 统一资源管理：始终保存 Blob，支持完整性检查、三级清理确认

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

/** 下载远程 URL 到 Blob */
async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.blob();
}

/** Data URL 转 Blob */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** 格式化字节大小 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export const StorageService = {
  /** 保存资产（始终保存 Blob，即使 URL 未来会失效） */
  async saveAssetFromUrl(params: {
    url: string;
    type: AssetRecord["type"];
    projectId?: string;
    sceneId?: string;
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
        originalUrl: params.url,
        type: params.type,
        status: "active",
        fileSize: blob.size,
        mimeType: params.mimeType || blob.type,
        projectId: params.projectId,
        sceneId: params.sceneId,
        shotId: params.shotId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        integrityCheckedAt: Date.now(),
        integrityStatus: "pending",
      };
      await AssetsDB.saveMeta(record);
      return { success: true, data: record };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("StorageService", "saveAssetFromUrl 失败", { error: msg, url: params.url.slice(0, 80) });
      return { success: false, error: msg };
    }
  },

  /** 从已有 Blob 保存 */
  async saveAssetFromBlob(params: {
    blob: Blob;
    type: AssetRecord["type"];
    projectId?: string;
    sceneId?: string;
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
        sceneId: params.sceneId,
        shotId: params.shotId,
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

  /** 加载资产 Blob */
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

  /** 删除单个资产 */
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

  /** 删除项目所有资产 */
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

  /** 获取所有资产元数据 */
  async listAssets(): Promise<AssetRecord[]> {
    return AssetsDB.getAllMeta();
  },

  /** 按类型筛选资产 */
  async listAssetsByType(type: AssetRecord["type"]): Promise<AssetRecord[]> {
    const all = await AssetsDB.getAllMeta();
    return all.filter((a) => a.type === type && a.status === "active");
  },

  /** 获取存储信息 */
  async getStorageInfo(): Promise<{ used: number; quota: number; count: number }> {
    return AssetsDB.getStorageInfo();
  },

  // ============================================================
  // V2.8: Safe Cleanup — 三级确认
  // ============================================================

  /** 第一步：获取清理预览（显示会影响哪些数据） */
  async getCleanupPreview(): Promise<{
    totalAssets: number;
    totalSize: number;
    imageCount: number;
    videoCount: number;
    thumbnailCount: number;
    projects: string[];
  }> {
    const metas = await AssetsDB.getAllMeta();
    const projects = [...new Set(metas.map(m => m.projectId).filter(Boolean))] as string[];
    const totalSize = metas.reduce((sum, m) => sum + (m.fileSize || 0), 0);
    return {
      totalAssets: metas.length,
      totalSize,
      imageCount: metas.filter(m => m.type === "image").length,
      videoCount: metas.filter(m => m.type === "video").length,
      thumbnailCount: metas.filter(m => m.type === "thumbnail").length,
      projects,
    };
  },

  /** 第二步：确认清理（需要传入 "DELETE" 字符串） */
  async confirmCleanup(confirmation: string): Promise<{ success: boolean; error?: string }> {
    if (confirmation !== "DELETE") {
      return { success: false, error: "确认码不正确，请输入 DELETE" };
    }
    return { success: true };
  },

  /** 第三步：执行安全清理 */
  async executeSafeCleanup(): Promise<StorageResult<{ deletedCount: number }>> {
    try {
      const metas = await AssetsDB.getAllMeta();
      let count = 0;
      for (const m of metas) {
        URL.revokeObjectURL(m.url);
        count++;
      }
      await AssetsDB.clearAll();
      logger.info("StorageService", `安全清理完成: 删除 ${count} 个资源`);
      return { success: true, data: { deletedCount: count } };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /** V2.8: 清理指定状态的资产（如 corrupted、missing、expired） */
  async cleanupByStatus(status: string): Promise<StorageResult<{ deletedCount: number }>> {
    try {
      const all = await AssetsDB.getAllMeta();
      const targets = all.filter(m => m.status === status);
      let count = 0;
      for (const t of targets) {
        const r = await StorageService.deleteAsset(t.id);
        if (r.success) count++;
      }
      return { success: true, data: { deletedCount: count } };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /** 清空所有资产（保留原有接口，内部调用安全接口） */
  async clearAll(): Promise<StorageResult<void>> {
    logger.warn("StorageService", "clearAll 已弃用，请使用 safeCleanup 流程");
    return StorageService.executeSafeCleanup().then(() => ({ success: true }));
  },
};
