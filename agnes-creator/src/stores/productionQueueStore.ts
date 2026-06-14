import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "@/services/IndexedDBStorage";
import type { ProductionQueueItem, ProductionStatus } from "@/types";
import { logger } from "@/lib/logger";
interface ProductionQueueState {
  items: ProductionQueueItem[];
  isPaused: boolean;
  
  initFromShots: (projectId: string, scenes: Array<{ id: string; title: string; shots: Array<{ id: string; title: string; order: number }> }>) => void;
  updateItem: (shotId: string, patch: Partial<ProductionQueueItem>) => void;
  updateImageStatus: (shotId: string, status: ProductionStatus, taskId?: string, resultUrl?: string, error?: string) => void;
  updateVideoStatus: (shotId: string, status: ProductionStatus, taskId?: string, resultUrl?: string, error?: string) => void;
  resetShot: (shotId: string) => void;
  resetVideoOnly: (shotId: string) => void;
  resetImageOnly: (shotId: string) => void;
  getProjectItems: (projectId: string) => ProductionQueueItem[];
  
  // V2.5: Lock/Unlock
  lockImage: (shotId: string) => void;
  lockVideo: (shotId: string) => void;
  unlockImage: (shotId: string) => void;
  unlockVideo: (shotId: string) => void;
  
  // V2.5: Delete asset
  deleteImageAsset: (shotId: string) => void;
  deleteVideoAsset: (shotId: string) => void;
  
  // V2.5: Single-shot regenerate
  regenImageOnly: (shotId: string) => void;
  regenVideoOnly: (shotId: string) => void;
  
  // V2.5: Stats
  getProjectStats: (projectId: string) => { total: number; imagesCompleted: number; videosCompleted: number; imagesLocked: number; videosLocked: number; };
  
  getPendingImageItems: (projectId: string) => ProductionQueueItem[];
  getPendingVideoItems: (projectId: string) => ProductionQueueItem[];
  setPaused: (paused: boolean) => void;
  clearProject: (projectId: string) => void;
  incrementImageRetry: (shotId: string) => void;
  incrementVideoRetry: (shotId: string) => void;
  getItems: () => ProductionQueueItem[];
  recoverPendingTasks: () => Array<{ shotId: string; type: "image" | "video" }>;
}
let _qCounter = 0;
function genQueueId(): string {
  _qCounter++; return `prod-${Date.now()}-${_qCounter}`;
}
const MAX_RETRIES = 3;
export const useProductionQueue = create<ProductionQueueState>()(
  persist(
    (set, get) => ({
      items: [],
      isPaused: false,
      
      initFromShots: (projectId, scenes) => {
        const items: ProductionQueueItem[] = [];
        for (const scene of scenes) {
          for (const shot of scene.shots) {
            items.push({
              id: genQueueId(),
              projectId,
              sceneId: scene.id,
              shotId: shot.id,
              shotTitle: shot.title,
              sceneTitle: scene.title,
              order: shot.order,
              imageStatus: "pending",
              videoStatus: "pending",
              imageRetries: 0,
              videoRetries: 0,
              imageLocked: false,
              videoLocked: false,
            });
          }
        }
        logger.info("ProductionQueue", `初始化队列: ${items.length} 个镜头`);
        set((s) => ({ items: [...items, ...s.items.filter(i => i.projectId !== projectId)] }));
      },
      
      updateItem: (shotId, patch) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, ...patch } : i),
      })),
      
      updateImageStatus: (shotId, status, taskId, resultUrl, error) => {
        logger.info("ProductionQueue", `镜头 ${shotId.slice(-8)} 图片状态: ${status}`, { taskId, error });
        set((s) => ({
          items: s.items.map((i) => i.shotId === shotId ? {
            ...i, imageStatus: status, imageTaskId: taskId || i.imageTaskId,
            imageResultUrl: resultUrl || i.imageResultUrl, imageError: error || i.imageError,
            imageStartedAt: status === "generating" ? Date.now() : i.imageStartedAt,
            imageCompletedAt: status === "completed" || status === "failed" ? Date.now() : i.imageCompletedAt,
          } : i),
        }));
      },
      
      updateVideoStatus: (shotId, status, taskId, resultUrl, error) => {
        logger.info("ProductionQueue", `镜头 ${shotId.slice(-8)} 视频状态: ${status}`, { taskId, error });
        set((s) => ({
          items: s.items.map((i) => i.shotId === shotId ? {
            ...i, videoStatus: status, videoTaskId: taskId || i.videoTaskId,
            videoResultUrl: resultUrl || i.videoResultUrl, videoError: error || i.videoError,
            videoStartedAt: status === "generating" ? Date.now() : i.videoStartedAt,
            videoCompletedAt: status === "completed" || status === "failed" ? Date.now() : i.videoCompletedAt,
          } : i),
        }));
      },
      
      resetShot: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, imageStatus: "pending" as ProductionStatus, videoStatus: "pending" as ProductionStatus,
          imageTaskId: undefined, videoTaskId: undefined,
          imageResultUrl: undefined, videoResultUrl: undefined,
          imageError: undefined, videoError: undefined,
          imageRetries: 0, videoRetries: 0,
          imageLocked: false, videoLocked: false,
        } : i),
      })),
      
      getProjectItems: (projectId) => get().items.filter((i) => i.projectId === projectId),
      
      resetVideoOnly: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, videoStatus: "pending" as ProductionStatus,
          videoTaskId: undefined, videoResultUrl: undefined,
          videoError: undefined, videoRetries: 0,
        } : i),
      })),
      
      resetImageOnly: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, imageStatus: "pending" as ProductionStatus,
          imageTaskId: undefined, imageResultUrl: undefined,
          imageError: undefined, imageRetries: 0,
        } : i),
      })),
      
      // V2.5: Lock/Unlock
      lockImage: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, imageLocked: true } : i),
      })),
      lockVideo: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, videoLocked: true } : i),
      })),
      unlockImage: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, imageLocked: false } : i),
      })),
      unlockVideo: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, videoLocked: false } : i),
      })),
      
      // V2.5: Delete asset (marks as deleted, keeps metadata)
      deleteImageAsset: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, imageStatus: "image_deleted" as ProductionStatus,
          imageResultUrl: undefined, imageTaskId: undefined,
        } : i),
      })),
      deleteVideoAsset: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, videoStatus: "video_deleted" as ProductionStatus,
          videoResultUrl: undefined, videoTaskId: undefined,
        } : i),
      })),
      
      // V2.5: Single-shot regenerate
      regenImageOnly: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, imageStatus: "regenerating_image" as ProductionStatus,
          imageTaskId: undefined, imageResultUrl: undefined,
          imageError: undefined, imageRetries: 0,
          imageLocked: false,
        } : i),
      })),
      regenVideoOnly: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, videoStatus: "regenerating_video" as ProductionStatus,
          videoTaskId: undefined, videoResultUrl: undefined,
          videoError: undefined, videoRetries: 0,
          videoLocked: false,
        } : i),
      })),
      
      // V2.5: Stats
      getProjectStats: (projectId) => {
        const items = get().items.filter((i) => i.projectId === projectId);
        return {
          total: items.length,
          imagesCompleted: items.filter((i) => i.imageStatus === "completed").length,
          videosCompleted: items.filter((i) => i.videoStatus === "completed").length,
          imagesLocked: items.filter((i) => i.imageLocked).length,
          videosLocked: items.filter((i) => i.videoLocked).length,
        };
      },
      
      // V2.5: Respect locks when getting pending items
      getPendingImageItems: (projectId) => get().items.filter(
        (i) => i.projectId === projectId && i.imageStatus === "pending" && !i.imageLocked
      ),
      getPendingVideoItems: (projectId) => get().items.filter(
        (i) => i.projectId === projectId && i.videoStatus === "pending" && !i.videoLocked
          && i.imageStatus === "completed"
      ),
      
      setPaused: (paused) => {
        logger.info("ProductionQueue", paused ? "已暂停" : "已恢复");
        set({ isPaused: paused });
      },
      
      clearProject: (projectId) => {
        logger.info("ProductionQueue", `清除项目队列: ${projectId}`);
        set((s) => ({ items: s.items.filter((i) => i.projectId !== projectId) }));
      },
      
      incrementImageRetry: (shotId) => set((s) => {
        const item = s.items.find((i) => i.shotId === shotId);
        const retries = (item?.imageRetries ?? 0) + 1;
        const isFailed = retries >= MAX_RETRIES;
        logger.warn("ProductionQueue", `镜头 ${shotId.slice(-8)} 图片重试 ${retries}/${MAX_RETRIES}`, { isFailed });
        return {
          items: s.items.map((i) => i.shotId === shotId ? {
            ...i, imageRetries: retries,
            imageStatus: isFailed ? "failed" as ProductionStatus : "pending" as ProductionStatus,
            imageError: isFailed ? `重试失败 (${retries}次)` : undefined,
          } : i),
        };
      }),
      
      incrementVideoRetry: (shotId) => set((s) => {
        const item = s.items.find((i) => i.shotId === shotId);
        const retries = (item?.videoRetries ?? 0) + 1;
        const isFailed = retries >= MAX_RETRIES;
        logger.warn("ProductionQueue", `镜头 ${shotId.slice(-8)} 视频重试 ${retries}/${MAX_RETRIES}`, { isFailed });
        return {
          items: s.items.map((i) => i.shotId === shotId ? {
            ...i, videoRetries: retries,
            videoStatus: isFailed ? "failed" as ProductionStatus : "pending" as ProductionStatus,
            videoError: isFailed ? `重试失败 (${retries}次)` : undefined,
          } : i),
        };
      }),
      getItems: () => get().items,
      recoverPendingTasks: () => {
        const items = get().items;
        const pending: Array<{ shotId: string; type: "image" | "video" }> = [];
        for (const item of items) {
          if ((item.imageStatus === "generating" || item.imageStatus === "pending") && !item.imageLocked) {
            pending.push({ shotId: item.shotId, type: "image" });
          }
          if ((item.videoStatus === "generating" || item.videoStatus === "pending") && !item.videoLocked) {
            pending.push({ shotId: item.shotId, type: "video" });
          }
        }
        if (pending.length > 0) {
          logger.info("ProductionQueue", `断点恢复: ${pending.length} 个待完成任务`);
          set((s) => ({
            items: s.items.map((i) => ({
              ...i,
              imageStatus: i.imageStatus === "generating" && !i.imageLocked ? "pending" as ProductionStatus : i.imageStatus,
              videoStatus: i.videoStatus === "generating" && !i.videoLocked ? "pending" as ProductionStatus : i.videoStatus,
            })),
          }));
        }
        return pending;
      },
    }),
    { name: "agnes-production-queue", version: 4, storage: createJSONStorage(() => indexedDBStorage) }
  )
);
