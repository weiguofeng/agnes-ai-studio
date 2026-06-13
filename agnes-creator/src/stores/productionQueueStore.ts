import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductionQueueItem, ProductionStatus } from "@/types";
import { logger } from "@/lib/logger";

interface ProductionQueueState {
  items: ProductionQueueItem[];
  isPaused: boolean;
  
  /** Initialize queue from storyboard shots */
  initFromShots: (projectId: string, scenes: Array<{ id: string; title: string; shots: Array<{ id: string; title: string; order: number }> }>) => void;
  
  /** Update a single item"s status */
  updateItem: (shotId: string, patch: Partial<ProductionQueueItem>) => void;
  
  /** Update image generation status */
  updateImageStatus: (shotId: string, status: ProductionStatus, taskId?: string, resultUrl?: string, error?: string) => void;
  
  /** Update video generation status */
  updateVideoStatus: (shotId: string, status: ProductionStatus, taskId?: string, resultUrl?: string, error?: string) => void;
  
  /** Reset a specific shot for regeneration */
  resetShot: (shotId: string) => void;
  resetVideoOnly: (shotId: string) => void;
  resetImageOnly: (shotId: string) => void;
  
  /** Get queue items for a project */
  getProjectItems: (projectId: string) => ProductionQueueItem[];
  
  /** Get pending image generation items */
  getPendingImageItems: (projectId: string) => ProductionQueueItem[];
  
  /** Get pending video generation items */
  getPendingVideoItems: (projectId: string) => ProductionQueueItem[];
  
  /** Pause/resume */
  setPaused: (paused: boolean) => void;
  
  /** Clear queue for a project */
  clearProject: (projectId: string) => void;
  
  /** Retry management */
  incrementImageRetry: (shotId: string) => void;
  incrementVideoRetry: (shotId: string) => void;
  
  /** Get all items for queue persistence check */
  getItems: () => ProductionQueueItem[];
  
  /** V2.4: Recover pending tasks on page load */
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
        } : i),
      })),
      
      getProjectItems: (projectId) => get().items.filter((i) => i.projectId === projectId),
      getPendingImageItems: (projectId) => get().items.filter((i) => i.projectId === projectId && i.imageStatus === "pending"),
      getPendingVideoItems: (projectId) => get().items.filter((i) => i.projectId === projectId && i.videoStatus === "pending" && i.imageStatus === "completed"),
      
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

      /** 断点恢复：找出所有 generating 状态的任务 */
      recoverPendingTasks: () => {
        const items = get().items;
        const pending: Array<{ shotId: string; type: "image" | "video" }> = [];
        for (const item of items) {
          if (item.imageStatus === "generating" || item.imageStatus === "pending") {
            pending.push({ shotId: item.shotId, type: "image" });
          }
          if (item.videoStatus === "generating" || item.videoStatus === "pending") {
            pending.push({ shotId: item.shotId, type: "video" });
          }
        }
        if (pending.length > 0) {
          logger.info("ProductionQueue", `断点恢复: ${pending.length} 个待完成任务`);
          // Reset generating to pending for retry
          set((s) => ({
            items: s.items.map((i) => ({
              ...i,
              imageStatus: i.imageStatus === "generating" ? "pending" as ProductionStatus : i.imageStatus,
              videoStatus: i.videoStatus === "generating" ? "pending" as ProductionStatus : i.videoStatus,
            })),
          }));
        }
        return pending;
      },
    }),
    { name: "agnes-production-queue", version: 2 }
  )
);



