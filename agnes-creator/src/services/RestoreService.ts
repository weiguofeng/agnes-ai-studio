// ========== RestoreService — V2.8 ==========
// 项目恢复：导入 .project.json，恢复完整项目状态

import { useProjectStore } from "@/stores/projectStore";
import { useProductionQueue } from "@/stores/productionQueueStore";
import { useEditorStore } from "@/stores/editorStore";
import { usePromptHistoryStore } from "@/stores/promptHistoryStore";
import { AssetsDB, type AssetRecord } from "./AssetsDB";
import { logger } from "@/lib/logger";
import type { ProjectBackup, ProjectBackupAsset } from "./BackupService";

export interface RestoreResult {
  success: boolean;
  restoredItems: string[];
  failedItems: string[];
  warnings: string[];
  error?: string;
}

function storeNameForAsset(type: AssetRecord["type"]): "images" | "videos" | "thumbnails" {
  return type === "video" ? "videos" : type === "thumbnail" ? "thumbnails" : "images";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mimeType = meta.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

async function restoreAssets(assets: ProjectBackupAsset[], result: RestoreResult): Promise<void> {
  for (const asset of assets || []) {
    const { dataUrl, ...record } = asset;
    try {
      if (!dataUrl) {
        await AssetsDB.saveMeta({ ...record, status: "missing", integrityStatus: "failed", updatedAt: Date.now() });
        result.warnings.push(`asset:${record.id}:missing-binary`);
        continue;
      }
      const blob = dataUrlToBlob(dataUrl);
      await AssetsDB.save(storeNameForAsset(record.type), record.id, blob);
      await AssetsDB.saveMeta({
        ...record,
        url: typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : record.url,
        status: "active",
        fileSize: blob.size,
        mimeType: record.mimeType || blob.type,
        integrityStatus: "pending",
        integrityCheckedAt: Date.now(),
        updatedAt: Date.now(),
      });
      result.restoredItems.push(`asset:${record.id.slice(-8)}`);
    } catch (err) {
      result.failedItems.push(`asset:${record.id}`);
      result.warnings.push(`asset:${record.id}:${String(err)}`);
    }
  }
}

/** 恢复项目 */
export async function restoreProject(backup: ProjectBackup): Promise<RestoreResult> {
  const result: RestoreResult = { success: false, restoredItems: [], failedItems: [], warnings: [] };

  try {
    // 1. 恢复项目设置
    const projectStore = useProjectStore.getState();
    const existingProject = projectStore.projects.find(p => p.id === backup.project.id);

    if (existingProject) {
      // 更新已有项目
      projectStore.updateProject(backup.project.id, {
        name: backup.project.name,
        description: backup.project.description,
        tags: backup.project.tags,
        styleDna: backup.project.styleDna,
        lockedCharacterIds: backup.project.lockedCharacterIds,
        scenes: backup.project.scenes,
        storyScript: backup.project.storyScript || "",
      });
      result.restoredItems.push("project");
    } else {
      // 创建新项目（使用原 ID）
      projectStore.addProject({
        id: backup.project.id,
        name: backup.project.name,
        description: backup.project.description,
        tags: backup.project.tags,
        storyScript: backup.project.storyScript || "",
      });
      projectStore.updateProject(backup.project.id, {
        styleDna: backup.project.styleDna,
        lockedCharacterIds: backup.project.lockedCharacterIds,
        scenes: backup.project.scenes,
        storyScript: backup.project.storyScript || "",
      });
      result.restoredItems.push("project(new)");
    }

    // 2. 恢复生产队列
    const queueStore = useProductionQueue.getState();
    if (backup.productionQueue && backup.productionQueue.length > 0) {
      queueStore.clearProject(backup.project.id);
      useProductionQueue.setState((state) => ({
        items: [
          ...backup.productionQueue,
          ...state.items.filter((item) => item.projectId !== backup.project.id),
        ],
      }));
      for (const item of backup.productionQueue) result.restoredItems.push(`queue:${item.shotId.slice(-8)}`);
    }

    // 3. 恢复时间轴
    const editorStore = useEditorStore.getState();
    if (backup.timeline && backup.timeline.length > 0) {
      useEditorStore.setState((state) => ({
        timelines: state.timelines.filter((timeline) => timeline.projectId !== backup.project.id),
        activeTimelineId: state.activeTimelineId && state.timelines.some((timeline) => timeline.id === state.activeTimelineId && timeline.projectId === backup.project.id)
          ? null
          : state.activeTimelineId,
      }));
      for (const tl of backup.timeline) {
        const newId = editorStore.createTimeline({
          name: tl.name,
          projectId: backup.project.id,
          duration: tl.duration,
          fps: tl.fps,
          width: tl.width,
          height: tl.height,
        });
        for (const clip of tl.clips || []) {
          editorStore.addClip(newId, {
            timelineId: newId,
            source: clip.source,
            type: clip.type,
            title: clip.title,
            startTime: clip.startTime,
            endTime: clip.endTime,
            duration: clip.duration,
            src: clip.src,
            thumbnailUrl: clip.thumbnailUrl,
            properties: clip.properties || {},
          });
        }
        result.restoredItems.push(`timeline:${tl.name}`);
      }
    }

    if (backup.promptHistory) {
      usePromptHistoryStore.setState((state) => ({
        history: { ...(state.history || {}), ...backup.promptHistory },
      }));
      result.restoredItems.push("promptHistory");
    }

    await restoreAssets(backup.assets || [], result);

    result.success = true;
    logger.info("Restore", `项目恢复完成: ${result.restoredItems.length} 项`);
  } catch (err) {
    result.success = false;
    result.error = String(err);
    logger.error("Restore", "项目恢复失败", { error: String(err) });
  }

  return result;
}
