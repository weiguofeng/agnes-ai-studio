import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "@/services/IndexedDBStorage";
import type { ProductionQueueItem, ProductionStatus } from "@/types";
import { logger } from "@/lib/logger";

interface ProductionQueueState {
  items: ProductionQueueItem[];
  isPaused: boolean;
  // V2.7: Production mode (draft vs production)
  productionMode: "draft" | "production";
  // V2.7: Selected shot IDs for batch operations
  selectedShotIds: string[];

  setProductionMode: (mode: "draft" | "production") => void;
  toggleSelectShot: (shotId: string) => void;
  selectAllShots: (shotIds: string[]) => void;
  deselectAllShots: () => void;

  initFromShots: (projectId: string, scenes: Array<{ id: string; title: string; shots: Array<{ id: string; title: string; order: number; imagePrompt?: string; videoPrompt?: string; negativePrompt?: string }> }>) => void;
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
  updatePrompt: (shotId: string, prompt: string) => void;

  // V2.7: Batch operations
  batchRegenImages: (shotIds: string[]) => void;
  batchRegenVideos: (shotIds: string[]) => void;
  batchPause: (shotIds: string[]) => void;
  batchResume: (shotIds: string[]) => void;
  batchDelete: (shotIds: string[]) => void;
  batchLock: (shotIds: string[]) => void;
  getBatchStats: (projectId: string) => {
    totalShots: number; totalScenes: number;
    imagesCompleted: number; videosCompleted: number;
    failedCount: number; pendingCount: number;
    successRate: number; avgDuration: number;
    estimatedRemaining: number;
  };
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
      productionMode: "draft",
      selectedShotIds: [],

      setProductionMode: (mode) => {
        logger.info("ProductionQueue", `生产模式切换: ${mode}`);
        set({ productionMode: mode });
      },

      toggleSelectShot: (shotId) => set((s) => {
        const exists = s.selectedShotIds.includes(shotId);
        return {
          selectedShotIds: exists
            ? s.selectedShotIds.filter(id => id !== shotId)
            : [...s.selectedShotIds, shotId],
        };
      }),

      selectAllShots: (shotIds) => set({ selectedShotIds: shotIds }),
      deselectAllShots: () => set({ selectedShotIds: [] }),
      
      initFromShots: (projectId, scenes) => {
        const items: ProductionQueueItem[] = [];
        let sceneIdx = 0;
        for (const scene of scenes) {
          sceneIdx++;
          let shotIdx = 0;
          for (const shot of scene.shots) {
            shotIdx++;
            items.push({
              sceneOrder: sceneIdx,
              shotOrder: shotIdx,
              id: genQueueId(),
              projectId,
              sceneId: scene.id,
              shotId: shot.id,
              shotTitle: shot.title,
              sceneTitle: scene.title,
              order: shot.order,
              imagePrompt: shot.imagePrompt,
              videoPrompt: shot.videoPrompt,
              negativePrompt: shot.negativePrompt,
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
          imageTaskId: undefined, imageResultUrl: undefined, imageError: undefined, imageRetries: 0,
          videoTaskId: undefined, videoResultUrl: undefined, videoError: undefined, videoRetries: 0,
          imageLocked: false, videoLocked: false,
          imageStartedAt: undefined, imageCompletedAt: undefined,
          videoStartedAt: undefined, videoCompletedAt: undefined,
        } : i),
      })),
      
      resetVideoOnly: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, videoStatus: "pending" as ProductionStatus,
          videoTaskId: undefined, videoResultUrl: undefined,
          videoError: undefined, videoRetries: 0, videoLocked: false,
          videoStartedAt: undefined, videoCompletedAt: undefined,
        } : i),
      })),
      
      resetImageOnly: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, imageStatus: "pending" as ProductionStatus,
          imageTaskId: undefined, imageResultUrl: undefined,
          imageError: undefined, imageRetries: 0, imageLocked: false,
          imageStartedAt: undefined, imageCompletedAt: undefined,
        } : i),
      })),
      getProjectItems: (projectId) => get().items.filter((i) => i.projectId === projectId),
      
      lockImage: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, imageLocked: true, imageStatus: "image_locked" as ProductionStatus } : i),
      })),
      lockVideo: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, videoLocked: true, videoStatus: "video_locked" as ProductionStatus } : i),
      })),
      unlockImage: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, imageLocked: false, imageStatus: i.imageResultUrl ? "completed" as ProductionStatus : "pending" as ProductionStatus } : i),
      })),
      unlockVideo: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, videoLocked: false, videoStatus: i.videoResultUrl ? "completed" as ProductionStatus : "pending" as ProductionStatus } : i),
      })),
      
      deleteImageAsset: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, imageStatus: "image_deleted" as ProductionStatus,
          imageResultUrl: undefined, imageTaskId: undefined, imageLocked: false,
        } : i),
      })),
      deleteVideoAsset: (shotId) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? {
          ...i, videoStatus: "video_deleted" as ProductionStatus,
          videoResultUrl: undefined, videoTaskId: undefined, videoLocked: false,
        } : i),
      })),
      
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
      
      updatePrompt: (shotId, prompt) => set((s) => ({
        items: s.items.map((i) => i.shotId === shotId ? { ...i, customPrompt: prompt } : i),
      })),

      getPendingImageItems: (projectId) => get().items.filter(
        (i) => i.projectId === projectId && i.imageStatus === "pending" && !i.imageLocked
      ),
      getPendingVideoItems: (projectId) => get().items.filter(
        (i) => i.projectId === projectId && i.videoStatus === "pending" && !i.videoLocked
          && i.imageStatus === "completed" && !!i.imageResultUrl
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

      // V2.7: Batch operations
      batchRegenImages: (shotIds) => set((s) => ({
        items: s.items.map((i) => shotIds.includes(i.shotId) ? {
          ...i, imageStatus: "regenerating_image" as ProductionStatus,
          imageTaskId: undefined, imageResultUrl: undefined,
          imageError: undefined, imageRetries: 0, imageLocked: false,
        } : i),
      })),

      batchRegenVideos: (shotIds) => set((s) => ({
        items: s.items.map((i) => shotIds.includes(i.shotId) ? {
          ...i, videoStatus: "regenerating_video" as ProductionStatus,
          videoTaskId: undefined, videoResultUrl: undefined,
          videoError: undefined, videoRetries: 0, videoLocked: false,
        } : i),
      })),

      batchPause: (shotIds) => set((s) => ({
        items: s.items.map((i) => shotIds.includes(i.shotId) ? {
          ...i, imageStatus: (i.imageStatus === "generating" ? "pending" as ProductionStatus : i.imageStatus),
          videoStatus: (i.videoStatus === "generating" ? "pending" as ProductionStatus : i.videoStatus),
        } : i),
      })),

      batchResume: (shotIds) => set((s) => ({
        items: s.items.map((i) => shotIds.includes(i.shotId) ? {
          ...i, imageStatus: (i.imageStatus === "pending" || i.imageStatus === "failed" ? "pending" as ProductionStatus : i.imageStatus),
          videoStatus: (i.videoStatus === "pending" || i.videoStatus === "failed" ? "pending" as ProductionStatus : i.videoStatus),
          imageError: undefined, videoError: undefined,
        } : i),
      })),

      batchDelete: (shotIds) => set((s) => ({
        items: s.items.map((i) => shotIds.includes(i.shotId) ? {
          ...i, imageStatus: "image_deleted" as ProductionStatus,
          videoStatus: "video_deleted" as ProductionStatus,
          imageResultUrl: undefined, videoResultUrl: undefined,
          imageTaskId: undefined, videoTaskId: undefined,
          imageLocked: false, videoLocked: false,
        } : i),
      })),

      batchLock: (shotIds) => set((s) => ({
        items: s.items.map((i) => shotIds.includes(i.shotId) ? {
          ...i, imageLocked: true, videoLocked: true,
          imageStatus: "image_locked" as ProductionStatus,
          videoStatus: "video_locked" as ProductionStatus,
        } : i),
      })),

      getBatchStats: (projectId) => {
        const items = get().items.filter((i) => i.projectId === projectId);
        const totalShots = items.length;
        const totalScenes = new Set(items.map(i => i.sceneId)).size;
        const imagesCompleted = items.filter(i => i.imageStatus === "completed").length;
        const videosCompleted = items.filter(i => i.videoStatus === "completed").length;
        const failedCount = items.filter(i => i.imageStatus === "failed" || i.videoStatus === "failed").length;
        const pendingCount = items.filter(i => i.imageStatus === "pending" || i.videoStatus === "pending").length;
        const successRate = totalShots > 0 ? Math.round((videosCompleted / totalShots) * 100) : 0;

        // Calculate average duration from completed items
        const completedItems = items.filter(i => i.imageCompletedAt && i.imageStartedAt);
        const avgDuration = completedItems.length > 0
          ? Math.round(completedItems.reduce((sum, i) => sum + (i.imageCompletedAt! - i.imageStartedAt!), 0) / completedItems.length / 1000)
          : 0;

        // Estimated remaining time
        const remainingItems = items.filter(i => i.videoStatus !== "completed" && i.videoStatus !== "failed");
        const estimatedRemaining = avgDuration > 0 ? Math.round((remainingItems.length * avgDuration) / 60) : 0;

        return {
          totalShots, totalScenes, imagesCompleted, videosCompleted,
          failedCount, pendingCount, successRate, avgDuration, estimatedRemaining,
        };
      },
    }),
    { name: "agnes-production-queue", version: 5, storage: createJSONStorage(() => indexedDBStorage) }
  )
);
