// ============================================================
// useTaskManager — 统一任务管理 Hook
// ============================================================
// 供各个页面使用，封装了 TaskStore + TaskManager 的操作
// ============================================================

"use client";

import { useCallback, useRef } from "react";
import { useTaskStore, type UnifiedTask, type TaskType } from "@/stores/taskStore";
import { taskManager } from "@/services/taskManager";
import { useConfig } from "./useConfig";

export function useTaskManager() {
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const clearCompleted = useTaskStore((s) => s.clearCompleted);
  const clearAll = useTaskStore((s) => s.clearAll);

  const { textToImageModel, imageToImageModel, textToVideoModel, imageToVideoModel } = useConfig();

  const activeTasks = tasks.filter(
    (t) => t.status === "processing" || t.status === "queued"
  );
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const failedTasks = tasks.filter((t) => t.status === "failed" || t.status === "cancelled");

  /**
   * 创建图片生成任务（文生图）
   */
  const createImageTask = useCallback(
    async (params: {
      prompt: string;
      size?: string;
      n?: number;
      model?: string;
      params?: Record<string, unknown>;
    }): Promise<UnifiedTask> => {
      return taskManager.createTask({
        type: "text-to-image",
        model: params.model || textToImageModel || "agnes-image-2.1-flash",
        prompt: params.prompt,
        params: { ...params.params, size: params.size, n: params.n },
      });
    },
    [textToImageModel]
  );

  /**
   * 创建视频生成任务（文生视频）
   */
  const createVideoTask = useCallback(
    async (params: {
      prompt: string;
      duration?: number;
      fps?: number;
      aspectRatio?: string;
      model?: string;
      extraParams?: Record<string, unknown>;
    }): Promise<UnifiedTask> => {
      return taskManager.createTask({
        type: "text-to-video",
        model: params.model || textToVideoModel || "agnes-video-v2.0",
        prompt: params.prompt,
        params: {
          duration: params.duration,
          fps: params.fps,
          aspect_ratio: params.aspectRatio,
          ...params.extraParams,
        },
      });
    },
    [textToVideoModel]
  );

  /**
   * 取消任务
   */
  const cancelTask = useCallback((id: string) => {
    taskManager.cancelTask(id);
  }, []);

  /**
   * 重试任务
   */
  const retryTask = useCallback(
    async (id: string): Promise<UnifiedTask | null> => {
      return taskManager.retryTask(id);
    },
    []
  );

  /**
   * 删除任务记录
   */
  const deleteTask = useCallback(
    (id: string) => {
      taskManager.cancelTask(id);
      removeTask(id);
    },
    [removeTask]
  );

  return {
    tasks,
    activeTasks,
    completedTasks,
    failedTasks,
    activeCount: activeTasks.length,
    createImageTask,
    createVideoTask,
    cancelTask,
    retryTask,
    deleteTask,
    clearCompleted,
    clearAll,
    updateTask,
  };
}
