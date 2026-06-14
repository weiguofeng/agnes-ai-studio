// ========== RestoreService — V2.8 ==========
// 项目恢复：导入 .project.json，恢复完整项目状态

import { useProjectStore } from "@/stores/projectStore";
import { useProductionQueue } from "@/stores/productionQueueStore";
import { useEditorStore } from "@/stores/editorStore";
import { logger } from "@/lib/logger";
import type { ProjectBackup } from "./BackupService";

export interface RestoreResult {
  success: boolean;
  restoredItems: string[];
  failedItems: string[];
  warnings: string[];
  error?: string;
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
      });
      result.restoredItems.push("project");
    } else {
      // 创建新项目（使用原 ID）
      projectStore.addProject({
        id: backup.project.id,
        name: backup.project.name,
        description: backup.project.description,
        tags: backup.project.tags,
      });
      projectStore.updateProject(backup.project.id, {
        styleDna: backup.project.styleDna,
        lockedCharacterIds: backup.project.lockedCharacterIds,
        scenes: backup.project.scenes,
      });
      result.restoredItems.push("project(new)");
    }

    // 2. 恢复生产队列
    const queueStore = useProductionQueue.getState();
    if (backup.productionQueue && backup.productionQueue.length > 0) {
      // 清除旧队列项
      queueStore.clearProject(backup.project.id);
      // 逐个恢复
      for (const item of backup.productionQueue) {
        queueStore.updateItem(item.shotId, item);
        result.restoredItems.push(`queue:${item.shotId.slice(-8)}`);
      }
    }

    // 3. 恢复时间轴
    const editorStore = useEditorStore.getState();
    if (backup.timeline && backup.timeline.length > 0) {
      // 清除旧时间线
      const existingTimelines = editorStore.timelines.filter(t => t.projectId === backup.project.id);
      for (const t of existingTimelines) {
        // Use store method to update existing timelines
      }
      // 恢复时间线（通过 store 重建）
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

    result.success = true;
    logger.info("Restore", `项目恢复完成: ${result.restoredItems.length} 项`);
  } catch (err) {
    result.success = false;
    result.error = String(err);
    logger.error("Restore", "项目恢复失败", { error: String(err) });
  }

  return result;
}
