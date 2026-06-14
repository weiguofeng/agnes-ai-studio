// ========== AssetIntegrityService — V2.8 ==========
// 验证资源完整性：图片、视频、Blob、Metadata

import { AssetsDB, type AssetStatus } from "./AssetsDB";
import { logger } from "@/lib/logger";

export interface IntegrityResult {
  totalChecked: number;
  verified: number;
  corrupted: number;
  missing: number;
  expired: number;
  details: Array<{ id: string; status: AssetStatus; error?: string }>;
}

/** 验证单个 Blob 是否可读取 */
async function validateBlob(storeName: "images" | "videos" | "thumbnails", id: string): Promise<boolean> {
  try {
    const blob = await AssetsDB.load(storeName, id);
    if (!blob) return false;
    // 检查 Blob 大小
    if (blob.size === 0) return false;
    // 对于图片，尝试创建 ObjectURL 并加载
    if (storeName === "images" || storeName === "thumbnails") {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
        setTimeout(() => { resolve(false); }, 5000);
      });
      URL.revokeObjectURL(url);
      return loaded;
    }
    return true;
  } catch {
    return false;
  }
}

/** 执行完整性检查 */
export async function runIntegrityCheck(): Promise<IntegrityResult> {
  const result: IntegrityResult = { totalChecked: 0, verified: 0, corrupted: 0, missing: 0, expired: 0, details: [] };
  try {
    const allMeta = await AssetsDB.getAllMeta();
    result.totalChecked = allMeta.length;

    for (const meta of allMeta) {
      const storeName = meta.type === "video" ? "videos" : meta.type === "thumbnail" ? "thumbnails" : "images";
      const isValid = await validateBlob(storeName, meta.id);

      let newStatus: AssetStatus = meta.status;
      let error: string | undefined;

      if (meta.status === "deleted") continue; // 跳过已删除

      if (!isValid) {
        if (meta.type === "image" || meta.type === "thumbnail") {
          // 尝试根据 URL 推断失效类型
          if (meta.originalUrl && meta.originalUrl.startsWith("http")) {
            try {
              const resp = await fetch(meta.originalUrl, { method: "HEAD" });
              if (!resp.ok) {
                newStatus = "expired";
                error = `原始 URL 返回 ${resp.status}`;
              } else {
                newStatus = "corrupted";
                error = "Blob 损坏";
              }
            } catch {
              newStatus = "missing";
              error = "原始 URL 不可访问";
            }
          } else {
            newStatus = "corrupted";
            error = "Blob 损坏";
          }
        } else {
          newStatus = "missing";
          error = "Blob 数据丢失";
        }
      } else {
        newStatus = "active";
        result.verified++;
      }

      if (newStatus !== meta.status) {
        await AssetsDB.saveMeta({
          ...meta,
          status: newStatus,
          integrityCheckedAt: Date.now(),
          integrityStatus: newStatus === "active" ? "verified" : "failed",
        });
      }

      if (newStatus !== "active") {
        if (newStatus === "corrupted") result.corrupted++;
        else if (newStatus === "missing") result.missing++;
        else if (newStatus === "expired") result.expired++;
        result.details.push({ id: meta.id, status: newStatus, error });
      }
    }

    logger.info("IntegrityCheck", `完整性检查完成: ${result.verified}/${result.totalChecked} 正常`, {
      corrupted: result.corrupted, missing: result.missing, expired: result.expired,
    });
  } catch (err) {
    logger.error("IntegrityCheck", "完整性检查失败", { error: String(err) });
  }
  return result;
}