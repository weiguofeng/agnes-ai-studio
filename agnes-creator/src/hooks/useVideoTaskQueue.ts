"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { agnes, AgnesApiError } from "@/services/agnes";
import { useTaskStore } from "@/stores/taskStore";
import { useConfigStore } from "@/stores/configStore";
import { ErrorClassifier, AgnesErrorType, MAX_RETRIES } from "@/services/errorClassifier";
import type { VideoResult, TextToVideoParams, ImageToVideoParams } from "@/services/agnes";

// ============================================================
// 类型定义
// ============================================================

export type VideoTaskStatus =
  | "queued"      // 等待中
  | "uploading"   // 上传中
  | "submitted"   // 已提交
  | "processing"  // 处理中
  | "completed"   // 已完成
  | "failed"      // 失败
  | "timeout"     // 超时
  | "cancelled";  // 已取消

export interface VideoTask {
  id: string;
  taskId: string;
  type: "text-to-video" | "image-to-video";
  prompt: string;
  sourcePreview?: string;
  numFrames?: number;
  frameRate?: number;
  status: VideoTaskStatus;
  progress: number;
  result?: VideoResult;
  error?: string;
  errorType?: AgnesErrorType;
  createdAt: number;
  updatedAt: number;
  cancelling?: boolean;
  retryCount: number;
  duration?: number;
}

// ============================================================
// 持久化
// ============================================================

const STORAGE_KEY = "agnes-video-tasks";
const TASK_TTL = 24 * 60 * 60 * 1000; // 24小时

function saveTasks(tasks: VideoTask[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch { /* quota exceeded */ }
}

function loadTasks(): VideoTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const tasks: VideoTask[] = JSON.parse(raw);
    const now = Date.now();
    return tasks.filter(t => now - t.createdAt < TASK_TTL);
  } catch { return []; }
}

// ============================================================
// Hook
// ============================================================

export function useVideoTaskQueue() {
  const [tasks, setTasks] = useState<VideoTask[]>(() => loadTasks());
  const abortMap = useRef<Map<string, AbortController>>(new Map());
  const tasksRef = useRef<VideoTask[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // 保持 ref 同步
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // 自动持久化
  useEffect(() => { saveTasks(tasks); }, [tasks]);

  // 页面关闭时自动保存
  useEffect(() => {
    const handle = () => saveTasks(tasksRef.current);
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<VideoTask>) => {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
      );
      tasksRef.current = next;
      return next;
    });
  }, []);

  const generateId = useCallback(
    () => `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  // ==========================================================
  // 智能轮询：每5秒一次，最长15分钟
  // ==========================================================
  const startPolling = useCallback((id: string, apiTaskId: string, taskType: "text-to-video" | "image-to-video") => {
    // 停止已有轮询
    const existing = pollTimers.current.get(id);
    if (existing) clearInterval(existing);

    const startTime = Date.now();
    const MAX_POLL_TIME = 15 * 60 * 1000; // 15分钟
    const POLL_INTERVAL = 5000; // 5秒

    const poll = async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_POLL_TIME) {
        clearInterval(pollTimers.current.get(id));
        pollTimers.current.delete(id);
        updateTask(id, { status: "timeout", error: "生成超时，请重新尝试", progress: 0 });
        abortMap.current.get(id)?.abort();
        return;
      }

      try {
        const progress = await agnes.video.getProgress(apiTaskId);
        updateTask(id, { status: progress.status as VideoTaskStatus, progress: progress.progress });

        if (progress.status === "completed") {
          clearInterval(pollTimers.current.get(id));
          pollTimers.current.delete(id);
          if (progress.result?.url) {
            updateTask(id, { status: "completed", progress: 100, result: progress.result });
            const t = tasksRef.current.find(x => x.id === id);
            if (t) {
              useTaskStore.getState().addTask({
                id: t.id, taskId: apiTaskId, type: t.type,
                model: useConfigStore.getState().model || "agnes-video-v2.0",
                prompt: t.prompt, status: "completed", progress: 100,
                resultUrl: progress.result.url, thumbnail: t.sourcePreview || "",
                errorMessage: "", params: {}, duration: progress.result.duration,
              });
            }
          } else {
            // status completed but no URL, keep polling
            updateTask(id, { status: "processing" });
          }
        } else if (progress.status === "failed") {
          clearInterval(pollTimers.current.get(id));
          pollTimers.current.delete(id);
          updateTask(id, { status: "failed", error: "视频生成失败" });
        }
      } catch (err) {
        const classified = ErrorClassifier.classify(err);
        // 连续错误不停止轮询，只是记录
        console.debug("[Poll] 查询失败:", classified.message);
      }
    };

    // 立即执行一次，然后每5秒执行
    poll();
    const timer = setInterval(poll, POLL_INTERVAL);
    pollTimers.current.set(id, timer);
  }, [updateTask]);

  const stopPolling = useCallback((id: string) => {
    const timer = pollTimers.current.get(id);
    if (timer) { clearInterval(timer); pollTimers.current.delete(id); }
  }, []);

  // ==========================================================
  // 安全重试逻辑
  // ==========================================================
  const executeWithRetry = useCallback(async (
    id: string,
    action: () => Promise<{ taskId: string; videoId: string }>,
    taskType: "text-to-video" | "image-to-video"
  ): Promise<{ taskId: string; videoId: string }> => {
    let lastError: unknown;
    let retryCount = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = ErrorClassifier.getRetryDelay(attempt - 1);
          console.debug(`[Retry] 第 ${attempt} 次重试，等待 ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
        return await action();
      } catch (err) {
        lastError = err;
        const classified = ErrorClassifier.classify(err);
        retryCount = attempt + 1;
        updateTask(id, { retryCount });

        if (!classified.retryable || attempt >= MAX_RETRIES) {
          throw err;
        }
        console.debug(`[Retry] 可重试错误 (${classified.type})，第 ${attempt + 1}/${MAX_RETRIES} 次`);
      }
    }
    throw lastError;
  }, [updateTask]);

  // ==========================================================
  // 通用任务执行
  // ==========================================================
  const executeTask = useCallback(async (
    id: string,
    creator: () => Promise<{ taskId: string; videoId: string; numericId: string; syncUrl: string }>,
    taskType: "text-to-video" | "image-to-video"
  ) => {
    const controller = new AbortController();
    abortMap.current.set(id, controller);

    try {
      // Step 1: 立即显示提交中
      updateTask(id, { status: "submitted" });

      // Step 2: 提交到 API（带60秒超时，支持重试）
      const result = await executeWithRetry(id, async () => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`TIMEOUT: 创建任务超时 (60s)`)), 60000)
        );
        const r = await Promise.race([creator(), timeoutPromise]);
        if (!r.taskId) throw new Error("API未返回任务ID");
        return { taskId: r.taskId, videoId: r.videoId || r.taskId };
      }, taskType);

      const { taskId, videoId } = result;

      // Step 3: 同步结果（如果有）
      if (result.taskId === "sync") {
        updateTask(id, { status: "completed", progress: 100 });
        return;
      }

      // Step 4: 开始轮询
      updateTask(id, { taskId: videoId, status: "processing" });
      startPolling(id, videoId, taskType);

      // 等待轮询完成或失败
      await new Promise<void>((resolve) => {
        const checkStatus = setInterval(() => {
          const t = tasksRef.current.find(x => x.id === id);
          if (!t || ["completed", "failed", "timeout", "cancelled"].includes(t.status)) {
            clearInterval(checkStatus);
            resolve();
          }
        }, 1000);
      });

    } catch (err) {
      const classified = ErrorClassifier.classify(err);
      updateTask(id, {
        status: classified.type === AgnesErrorType.TIMEOUT ? "timeout" : "failed",
        error: classified.userMessage,
        errorType: classified.type,
        progress: 0,
      });

      // 保存失败到 TaskStore
      const t = tasksRef.current.find(x => x.id === id);
      if (t) {
        useTaskStore.getState().addTask({
          id: t.id, taskId: t.taskId || "", type: t.type,
          model: useConfigStore.getState().model || "agnes-video-v2.0",
          prompt: t.prompt, status: "failed", progress: 0,
          resultUrl: "", thumbnail: t.sourcePreview || "",
          errorMessage: classified.userMessage, params: {},
        });
      }
    } finally {
      stopPolling(id);
      abortMap.current.delete(id);
    }
  }, [updateTask, executeWithRetry, startPolling, stopPolling]);

  // ==========================================================
  // 文生视频
  // ==========================================================
  const addTask = useCallback(async (params: TextToVideoParams) => {
    const id = generateId();
    const task: VideoTask = {
      id, taskId: "", type: "text-to-video",
      prompt: params.prompt, numFrames: params.numFrames ?? 121,
      frameRate: params.frameRate ?? 24, status: "queued", progress: 0,
      createdAt: Date.now(), updatedAt: Date.now(), retryCount: 0,
    };
    setTasks((prev) => [task, ...prev]);

    await executeTask(
      id,
      () => agnes.video.create(params),
      "text-to-video"
    );
  }, [generateId, executeTask]);

  // ==========================================================
  // 图生视频
  // ==========================================================
  const addImageTask = useCallback(async (
    params: ImageToVideoParams & { sourcePreview?: string }
  ) => {
    const id = generateId();
    const task: VideoTask = {
      id, taskId: "", type: "image-to-video",
      prompt: params.prompt ?? "", sourcePreview: params.sourcePreview,
      status: "uploading", progress: 0,
      createdAt: Date.now(), updatedAt: Date.now(), retryCount: 0,
    };
    setTasks((prev) => [task, ...prev]);

    await executeTask(
      id,
      () => agnes.video.createFromImage({ image: params.image, prompt: params.prompt }),
      "image-to-video"
    );
  }, [generateId, executeTask]);

  // ==========================================================
  // 取消 / 删除 / 清除
  // ==========================================================
  const cancelTask = useCallback((id: string) => {
    stopPolling(id);
    abortMap.current.get(id)?.abort();
    updateTask(id, { status: "cancelled", cancelling: false });
  }, [updateTask, stopPolling]);

  const removeTask = useCallback((id: string) => {
    stopPolling(id);
    abortMap.current.get(id)?.abort();
    abortMap.current.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, [stopPolling]);

  const clearCompleted = useCallback(() => {
    setTasks((prev) =>
      prev.filter((t) =>
        ["queued", "uploading", "submitted", "processing"].includes(t.status)
      )
    );
  }, []);

  const clearAll = useCallback(() => {
    abortMap.current.forEach((c) => c.abort());
    abortMap.current.clear();
    pollTimers.current.forEach((t) => clearInterval(t));
    pollTimers.current.clear();
    setTasks([]);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      pollTimers.current.forEach((t) => clearInterval(t));
      pollTimers.current.clear();
    };
  }, []);

  const activeTask = tasks.find(
    (t) => ["queued", "uploading", "submitted", "processing"].includes(t.status)
  ) ?? null;

  return {
    tasks,
    activeTask,
    addTask,
    addImageTask,
    cancelTask,
    removeTask,
    clearCompleted,
    clearAll,
  };
}
