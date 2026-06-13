// ============================================================
// Task Polling Service — 后台轮询管理器
// ============================================================
// 统一管理所有任务的轮询，避免每个页面自己轮询
// ============================================================

import { agnes } from "@/services/agnes";
import { useTaskStore, type UnifiedTask } from "@/stores/taskStore";

interface PollEntry {
  taskId: string;
  localId: string;
  type: "text-to-video" | "image-to-video";
  controller: AbortController;
  lastProgress: number;
  isRunning: boolean;
}

class TaskPollingService {
  private pollMap = new Map<string, PollEntry>();
  private callbacks = new Map<string, (progress: number) => void>();

  /**
   * 开始轮询一个视频任务
   */
  startPolling(
    localId: string,
    apiTaskId: string,
    taskType: "text-to-video" | "image-to-video",
    onProgress?: (progress: number) => void
  ): void {
    // 如果已经在轮询，不做重复启动
    if (this.pollMap.has(localId) && this.pollMap.get(localId)!.isRunning) {
      return;
    }

    const controller = new AbortController();
    const entry: PollEntry = {
      taskId: apiTaskId,
      localId,
      type: taskType,
      controller,
      lastProgress: -1,
      isRunning: true,
    };
    this.pollMap.set(localId, entry);
    if (onProgress) this.callbacks.set(localId, onProgress);

    // 开始轮询
    this._poll(entry).finally(() => {
      entry.isRunning = false;
    });
  }

  /**
   * 停止轮询
   */
  stopPolling(localId: string): void {
    const entry = this.pollMap.get(localId);
    if (entry) {
      entry.controller.abort();
      this.pollMap.delete(localId);
      this.callbacks.delete(localId);
    }
  }

  /**
   * 停止所有轮询
   */
  stopAll(): void {
    for (const [id, entry] of this.pollMap) {
      entry.controller.abort();
    }
    this.pollMap.clear();
    this.callbacks.clear();
  }

  /**
   * 是否正在轮询
   */
  isPolling(localId: string): boolean {
    return this.pollMap.has(localId) && this.pollMap.get(localId)!.isRunning;
  }

  /**
   * 获取当前轮询数
   */
  getActivePollCount(): number {
    let count = 0;
    for (const entry of this.pollMap.values()) {
      if (entry.isRunning) count++;
    }
    return count;
  }

  // ---------------------------------------------------------
  // 内部轮询逻辑
  // ---------------------------------------------------------
  private async _poll(entry: PollEntry): Promise<void> {
    const store = useTaskStore.getState();
    try {
      const result = await agnes.video.poll(entry.taskId, {
        interval: 3000,
        maxInterval: 15000,
        timeout: 600000,
        signal: entry.controller.signal,
        onProgress: (p) => {
          const cb = this.callbacks.get(entry.localId);
          if (cb) cb(p.progress);
          // 更新 store
          useTaskStore.getState().updateTask(entry.localId, {
            progress: p.progress,
            status: p.status === "completed" ? "completed" : "processing",
          });
        },
      });

      // 完成
      useTaskStore.getState().updateTask(entry.localId, {
        status: "completed",
        progress: 100,
        resultUrl: result.url,
        duration: result.duration,
        updateTime: Date.now(),
      });
    } catch (err: unknown) {
      const isCancelled = err instanceof Error && err.message.includes("取消");
      useTaskStore.getState().updateTask(entry.localId, {
        status: isCancelled ? "cancelled" : "failed",
        errorMessage: err instanceof Error ? err.message : "生成失败",
        updateTime: Date.now(),
      });
    } finally {
      this.pollMap.delete(entry.localId);
      this.callbacks.delete(entry.localId);
    }
  }
}

// 全局单例
export const taskPollingService = new TaskPollingService();
