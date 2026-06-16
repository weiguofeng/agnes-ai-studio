// ========== BackupService — V2.8 ==========
// 项目备份：导出 .project.json，包含所有关键数据

import { useProjectStore } from "@/stores/projectStore";
import { useProductionQueue } from "@/stores/productionQueueStore";
import { useEditorStore } from "@/stores/editorStore";
import { usePromptHistoryStore } from "@/stores/promptHistoryStore";
import { AssetsDB, type AssetRecord } from "./AssetsDB";
import { logger } from "@/lib/logger";

export type ProjectBackupAsset = AssetRecord & {
  dataUrl?: string;
};

export interface ProjectBackup {
  version: "2.8";
  exportedAt: number;
  project: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    styleDna: string;
    lockedCharacterIds: string[];
    scenes: any[];
    storyScript?: string;
    createdAt: number;
    updatedAt: number;
  };
  productionQueue: any[];
  timeline: any[];
  promptHistory: Record<string, any[]>;
  assets: ProjectBackupAsset[];
}

const BACKUP_PREFIX = "agnes-backup-";
const MAX_AUTO_BACKUPS = 7;

function storeNameForAsset(type: AssetRecord["type"]): "images" | "videos" | "thumbnails" {
  return type === "video" ? "videos" : type === "thumbnail" ? "thumbnails" : "images";
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
}

async function collectProjectAssets(projectId: string): Promise<ProjectBackupAsset[]> {
  const assets = await AssetsDB.queryMeta("projectId", projectId);
  const backupAssets: ProjectBackupAsset[] = [];
  for (const asset of assets) {
    try {
      const blob = await AssetsDB.load(storeNameForAsset(asset.type), asset.id);
      backupAssets.push(blob ? { ...asset, dataUrl: await blobToDataUrl(blob) } : asset);
    } catch (err) {
      logger.warn("Backup", "资产二进制导出失败，仅保留 metadata", { id: asset.id, error: String(err) });
      backupAssets.push(asset);
    }
  }
  return backupAssets;
}

/** 生成备份文件名 */
export function generateBackupFilename(projectId: string): string {
  return `${BACKUP_PREFIX}${projectId}-${Date.now()}.project.json`;
}

/** 导出完整项目备份 */
export async function exportBackup(projectId: string): Promise<{ success: boolean; data?: ProjectBackup; error?: string }> {
  try {
    const project = useProjectStore.getState().projects.find(p => p.id === projectId);
    if (!project) return { success: false, error: "项目不存在" };

    const queueItems = useProductionQueue.getState().items.filter(i => i.projectId === projectId);
    const editorState = useEditorStore.getState();
    const promptHistory = usePromptHistoryStore.getState().history;
    const assets = await collectProjectAssets(projectId);
    const timelines = editorState.timelines.filter(t => t.projectId === projectId);

    const backup: ProjectBackup = {
      version: "2.8",
      exportedAt: Date.now(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        tags: project.tags,
        styleDna: project.styleDna || "",
        lockedCharacterIds: project.lockedCharacterIds || [],
        scenes: project.scenes || [],
        storyScript: project.storyScript || "",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      productionQueue: queueItems,
      timeline: timelines,
      promptHistory,
      assets,
    };

    return { success: true, data: backup };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** 下载备份到本地文件 */
export async function downloadBackup(projectId: string, projectName: string): Promise<boolean> {
  const result = await exportBackup(projectId);
  if (!result.success || !result.data) return false;

  const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, "_")}_backup_${Date.now()}.project.json`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** 读取备份文件 */
export function readBackupFile(file: File): Promise<{ success: boolean; data?: ProjectBackup; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ProjectBackup;
        if (data.version !== "2.8") {
          resolve({ success: false, error: `不支持的备份版本: ${data.version}` });
          return;
        }
        resolve({ success: true, data });
      } catch (err) {
        resolve({ success: false, error: "备份文件格式错误" });
      }
    };
    reader.onerror = () => resolve({ success: false, error: "无法读取文件" });
    reader.readAsText(file);
  });
}

/** 管理自动备份：保留最近7份，删除旧的 */
export async function cleanAutoBackups(): Promise<void> {
  try {
    const keys: Array<{ key: string; time: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(BACKUP_PREFIX)) {
        const time = parseInt(key.split("-").pop() || "0", 10);
        keys.push({ key, time });
      }
    }
    keys.sort((a, b) => b.time - a.time);
    if (keys.length > MAX_AUTO_BACKUPS) {
      for (const k of keys.slice(MAX_AUTO_BACKUPS)) {
        localStorage.removeItem(k.key);
      }
      logger.info("Backup", `清理旧备份: 删除 ${keys.length - MAX_AUTO_BACKUPS} 份`);
    }
  } catch { /* ignore */ }
}
