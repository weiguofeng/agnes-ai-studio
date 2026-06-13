// ============================================================
// Task Manager — 多任务执行管理器
// ============================================================
// 支持并发控制、任务队列、取消、重试
// ============================================================

import { agnes } from "@/services/agnes";
import { useConfigStore } from "@/stores/configStore";
import { taskPollingService } from "./taskPolling";
import type { UnifiedTask, TaskType, TaskStatus } from "@/stores/taskStore";

export interface ConcurrencyConfig {
  image: number; // 图片任务最大并发
  video: number; // 视频任务最大并发
}

const DEFAULT_CONCURRENCY: ConcurrencyConfig = {
  image: 5,
  video: 3,
};

interface PendingTask {
  task: {
    type: TaskType; model: string; prompt: string;
    id: string; thumbnail: string; taskId: string;
    params?: Record<string, unknown>; duration?: number;
    status: TaskStatus; progress: number;
    resultUrl: string; errorMessage: string;
  };
  resolve: (result: UnifiedTask) => void;
  reject: (error: Error) => void;
}

class TaskManager {
  private concurrency: ConcurrencyConfig = { ...DEFAULT_CONCURRENCY };
  private runningCount = { image: 0, video: 0 };
  private pendingQueue: PendingTask[] = [];
  private abortControllers = new Map<string, AbortController>();

  /**
   * 设置并发数
   */
  setConcurrency(config: Partial<ConcurrencyConfig>): void {
    this.concurrency = { ...this.concurrency, ...config };
  }

  /**
   * 创建并执行一个任务
   */
  async createTask(
    task: { type: TaskType; model: string; prompt: string; id?: string; thumbnail?: string; taskId?: string; params?: Record<string, unknown>; duration?: number }
  ): Promise<UnifiedTask> {
    const { useTaskStore } = await import("@/stores/taskStore");

    const category: "image" | "video" = 
      task.type === "text-to-video" || task.type === "image-to-video" ? "video" : "image";

    // 创建本地任务记录
    const localId = useTaskStore.getState().addTask({
      id: task.id || "",
      taskId: (task as any).taskId || "",
      type: task.type,
      model: task.model,
      prompt: task.prompt,
      status: "queued",
      progress: 0,
      resultUrl: "",
      thumbnail: task.thumbnail || "",
      errorMessage: "",
      params: (task as any).params,
      duration: (task as any).duration,
    });

    // 包装为 Promise
    return new Promise<UnifiedTask>((resolve, reject) => {
      const pending: PendingTask = {
        task: {
          id: localId,
          taskId: task.taskId || "",
          type: task.type,
          model: task.model,
          prompt: task.prompt,
          status: "queued",
          progress: 0,
          resultUrl: "",
          thumbnail: task.thumbnail || "",
          errorMessage: "",
          params: task.params,
          duration: task.duration,
        },
        resolve,
        reject,
      };

      if (this.canRun(category)) {
        this._executeTask(pending, category);
      } else {
        this.pendingQueue.push(pending);
      }
    });
  }

  /**
   * 取消任务
   */
  cancelTask(localId: string): void {
    // 检查是否在队列中
    const queueIndex = this.pendingQueue.findIndex(
      (p) => p.task.id === localId
    );
    if (queueIndex >= 0) {
      const [removed] = this.pendingQueue.splice(queueIndex, 1);
      removed.reject(new Error("已取消"));
      return;
    }

    // 检查是否正在运行
    const controller = this.abortControllers.get(localId);
    if (controller) {
      controller.abort();
    }

    // 停止轮询
    taskPollingService.stopPolling(localId);
  }

  /**
   * 重试任务
   */
  async retryTask(localId: string): Promise<UnifiedTask | null> {
    const { useTaskStore } = await import("@/stores/taskStore");
    const task = useTaskStore.getState().getTaskById(localId);
    if (!task) return null;

    // 更新状态为重试
    useTaskStore.getState().updateTask(localId, {
      status: "queued",
      progress: 0,
      errorMessage: "",
    });

    // 根据类型重新执行
    return this.createTask({
      id: localId,
      type: task.type,
      model: task.model,
      prompt: task.prompt,
      params: task.params,
      duration: task.duration,
      thumbnail: task.thumbnail,
    });
  }

  /**
   * 重新执行（使用新参数）
   */
  async recreateTask(
    oldId: string,
    newParams: Partial<Omit<UnifiedTask, "id" | "createTime" | "updateTime">>
  ): Promise<UnifiedTask> {
    const { useTaskStore } = await import("@/stores/taskStore");
    const oldTask = useTaskStore.getState().getTaskById(oldId);
    if (!oldTask) throw new Error("原任务不存在");

    return this.createTask({
      type: newParams.type || oldTask.type,
      model: newParams.model || oldTask.model,
      prompt: newParams.prompt || oldTask.prompt,
      params: newParams.params || oldTask.params,
      duration: newParams.duration || oldTask.duration,
      thumbnail: newParams.thumbnail || oldTask.thumbnail,
    });
  }

  // ---------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------

  private canRun(category: "image" | "video"): boolean {
    const max = this.concurrency[category];
    return this.runningCount[category] < max;
  }

  private async _executeTask(pending: PendingTask, category: "image" | "video"): Promise<void> {
    this.runningCount[category]++;
    const { useTaskStore } = await import("@/stores/taskStore");
    const localId = pending.task.id;

    try {
      useTaskStore.getState().updateTask(localId, { status: "processing" });

      const config = useConfigStore.getState();
      const controller = new AbortController();
      this.abortControllers.set(localId, controller);

      // 根据类型执行
      if (category === "image") {
        await this._executeImageTask(localId, pending.task, controller.signal);
      } else {
        await this._executeVideoTask(localId, pending.task);
      }

      // 成功
      const updated = useTaskStore.getState().getTaskById(localId);
      if (updated) pending.resolve(updated);
    } catch (err: unknown) {
      const isCancelled = err instanceof Error && 
        (err.name === "AbortError" || err.message.includes("取消"));
      
      useTaskStore.getState().updateTask(localId, {
        status: isCancelled ? "cancelled" : "failed",
        errorMessage: err instanceof Error ? err.message : "生成失败",
      });

      pending.reject(err instanceof Error ? err : new Error("生成失败"));
    } finally {
      this.runningCount[category]--;
      this.abortControllers.delete(localId);

      // 执行下一个等待的任务
      this._processQueue(category);
    }
  }

  private async _executeImageTask(
    localId: string,
    task: { type: TaskType; model: string; prompt: string; id: string; thumbnail: string; taskId: string; params?: Record<string, unknown>; duration?: number; status: TaskStatus; progress: number; resultUrl: string; errorMessage: string },
    signal: AbortSignal
  ): Promise<void> {
    const { useTaskStore } = await import("@/stores/taskStore");

    let result: { url: string; revisedPrompt?: string }[];

      if (task.type === "text-to-image") {
        result = await agnes.image.generate({
          prompt: task.prompt,
          size: ((task.params?.size || "1024x1024") as "1024x1024" | "512x512" | "256x256" | "768x1344" | "1344x768" | "1024x1792" | "1792x1024"),
          n: (task.params?.n as number) || 1,
          model: task.model,
        });
      } else {
        // image-to-image - 需要从 thumbnail 还原
        throw new Error("图生图需要上传文件，请使用页面上的生成功能");
      }

      if (result && result.length > 0) {
        useTaskStore.getState().updateTask(localId, {
          status: "completed",
          progress: 100,
          resultUrl: result[0].url,
        });
      }
  }

  private async _executeVideoTask(
    localId: string,
    task: { type: TaskType; model: string; prompt: string; id: string; thumbnail: string; taskId: string; params?: Record<string, unknown>; duration?: number; status: TaskStatus; progress: number; resultUrl: string; errorMessage: string }
  ): Promise<void> {
    const { useTaskStore } = await import("@/stores/taskStore");

    let taskResult: { taskId: string; videoId: string };

      if (task.type === "text-to-video") {
        const duration = (task.params?.duration as number) || 5;
        const fps = (task.params?.fps as number) || 24;
        const numFrames = duration * fps;
        const aspectRatio = (task.params?.aspect_ratio as string) || "16:9";
        const [w, h] = aspectRatio === "16:9" ? [1152, 768] : aspectRatio === "9:16" ? [768, 1152] : [1024, 1024];

        taskResult = await agnes.video.create({
          prompt: task.prompt,
          model: task.model,
          height: h,
          width: w,
          numFrames,
          frameRate: fps,
        }) as unknown as { taskId: string; videoId: string };
      } else {
        throw new Error("图生视频需要上传文件，请使用页面上的生成功能");
      }

      const videoId = taskResult.videoId || taskResult.taskId;
      // 开始轮询
      taskPollingService.startPolling(localId, videoId, task.type as "text-to-video" | "image-to-video");
  }

  private _processQueue(category: "image" | "video"): void {
    if (!this.canRun(category)) return;

    const idx = this.pendingQueue.findIndex((p) => {
      const t = p.task.type;
      const cat = t === "text-to-video" || t === "image-to-video" ? "video" : "image";
      return cat === category;
    });

    if (idx >= 0) {
      const [pending] = this.pendingQueue.splice(idx, 1);
      this._executeTask(pending, category);
    }
  }
}

// 全局单例
export const taskManager = new TaskManager();
