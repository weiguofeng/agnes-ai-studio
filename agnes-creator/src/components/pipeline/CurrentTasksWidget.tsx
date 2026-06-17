"use client";
import { useMemo, useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { useTaskStore } from "@/stores/taskStore";
import { Loader2, Video } from "lucide-react";

export function CurrentTasksWidget({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const tasks = useTaskStore((s) => s.tasks);
  const [animTick, setAnimTick] = useState(0);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate every 800ms
  useEffect(() => {
    const timer = setInterval(() => setAnimTick((n) => n + 1), 800);
    return () => clearInterval(timer);
  }, []);

  // Clean up stale tasks from other projects on mount
  useEffect(() => {
    if (!projectId) return;
    const store = useTaskStore.getState();
    const staleTasks = store.tasks.filter(t =>
      t.id && t.id.startsWith("pipeline-video-") &&
      t.params?.projectId !== projectId
    );
    for (const t of staleTasks) store.removeTask(t.id);
  }, [projectId]);
  const activeTasks = useMemo(() => {
    // Only show pipeline-related tasks (id starts with "pipeline-video-")
    const pipelineTasks = tasks.filter((t) => t.id && t.id.startsWith("pipeline-video-") && (!projectId || t.params?.projectId === projectId));
    const active = pipelineTasks.filter((t) =>
      ["uploading", "processing", "queued", "submitted", "rate_limited", "awaiting_asset"].includes(t.status)
    );
    const failed = pipelineTasks.filter((t) => t.status === "failed");
    return {
      video: active.filter((t) => t.type === "text-to-video" || t.type === "image-to-video"),
      total: active.length,
      failed: failed.slice(0, 5),
    };
  }, [tasks]);

  // Auto-cleanup: clear old failed tasks and done tasks
  useEffect(() => {
    const pipelineTasks = tasks.filter((t) => t.id && t.id.startsWith("pipeline-video-") && (!projectId || t.params?.projectId === projectId));
    const now = Date.now();
    // Remove failed tasks older than 60s
    for (const t of pipelineTasks) {
      if (t.status === "failed" && now - t.updateTime > 60000) {
        useTaskStore.getState().removeTask(t.id);
      }
    }
    const store = useTaskStore.getState();
    const remaining = store.tasks.filter(tt => tt.id && tt.id.startsWith("pipeline-video-") && (!projectId || tt.params?.projectId === projectId));
    // Immediately remove completed/cancelled/timeout tasks
    for (const t of remaining) {
      if (["completed", "cancelled", "timeout"].includes(t.status)) {
        useTaskStore.getState().removeTask(t.id);
      }
    }
    const allDone = remaining.length > 0 && remaining.every((t) =>
      ["completed", "failed", "cancelled", "timeout"].includes(t.status)
    );
    if (allDone && !cleanupTimer.current) {
      cleanupTimer.current = setTimeout(() => {
        const store2 = useTaskStore.getState();
        const remaining2 = store2.tasks.filter(tt => tt.id && tt.id.startsWith("pipeline-video-") && (!projectId || tt.params?.projectId === projectId));
        for (const task of remaining2) store2.removeTask(task.id);
        cleanupTimer.current = null;
      }, 3000);
    }
    if (!allDone && cleanupTimer.current) {
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }
    return () => {
      if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    };
  }, [tasks, projectId]);

  // No active tasks & no failed tasks -> hide
  if (activeTasks.total === 0 && activeTasks.failed.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Loader2 className={`h-4 w-4 ${activeTasks.total > 0 ? "animate-spin" : ""}`} />
          {t("pipeline.currentTasks")}
          {activeTasks.total > 0 && (
            <Badge variant="default" className="ml-1 text-[10px] h-4 animate-pulse">
              {activeTasks.total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Video tasks with progress bars */}
          {activeTasks.video.length > 0 && (
            <div className="rounded-lg border bg-card p-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-medium">{t("pipeline.videoTasks")}</span>
                </div>
                <Badge variant="outline" className="text-[10px] h-4">{activeTasks.video.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {activeTasks.video.slice(0, 5).map((task) => {
                  const progress = task.status === "completed" ? 100 : (task.progress >= 0 ? task.progress : 0);
                  const isIndeterminate = (task.progress < 0 || task.status === "queued" || task.status === "submitted") && task.status !== "completed";
                  const statusLabel = task.status === "processing" ? `${progress}%` :
                    task.status === "rate_limited" ? t("pipeline.rateLimited") :
                    task.status === "awaiting_asset" ? t("pipeline.syncing") :
                    task.status;
                  return (
                    <div key={task.id} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="truncate max-w-[160px] text-muted-foreground">
                          {task.prompt.slice(0, 28)}...
                        </span>
                        <span className={`shrink-0 ml-1 font-mono ${
                          task.status === "processing" ? "text-emerald-500" :
                          task.status === "rate_limited" ? "text-yellow-500" :
                          "text-muted-foreground"
                        }`}>
                          {statusLabel}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isIndeterminate
                              ? "bg-emerald-400 animate-pulse"
                              : task.status === "rate_limited"
                                ? "bg-yellow-400"
                                : "bg-emerald-500"
                          }`}
                          style={{
                            width: isIndeterminate ? `${30 + (animTick % 5) * 10}%` : `${Math.max(2, progress)}%`,
                            ...(isIndeterminate ? {
                              marginLeft: `${(animTick % 7) * 10}%`,
                              transition: "margin-left 0.8s ease-in-out, width 0.8s ease-in-out"
                            } : {}),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Failed tasks */}
          {activeTasks.failed.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">{t("pipeline.failedTasks")}</span>
                </div>
                <Badge variant="outline" className="text-[10px] h-4 border-red-300 text-red-600">
                  {activeTasks.failed.length}
                </Badge>
              </div>
              {activeTasks.failed.slice(0, 3).map((task) => (
                <div key={task.id} className="text-[10px] text-red-500 truncate">
                  {task.errorMessage || task.prompt.slice(0, 24)}...
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}