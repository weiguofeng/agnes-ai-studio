"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTaskStore, type UnifiedTask, taskManager } from "@/stores/taskStore";
import { StorageService } from "@/services/StorageService";
import { useUnifiedAssetStore } from "@/stores/unifiedAssetStore";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Sparkles, ImageIcon, Video, Download, RotateCcw, Trash2, AlertCircle, Play, X, Clock, Save, Check } from "lucide-react";

const TYPE_ICON: Record<string, typeof Sparkles> = {
  "text-to-image": Sparkles,
  "image-to-image": ImageIcon,
  "text-to-video": Video,
  "image-to-video": Video,
};
const TYPE_LABEL: Record<string, string> = {
  "text-to-image": "文生图",
  "image-to-image": "图生图",
  "text-to-video": "文生视频",
  "image-to-video": "图生视频",
};

async function downloadUrl(url: string, filename: string) {
  try { const r = await fetch(url); const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u); }
  catch { window.open(url, "_blank"); }
}

function isActiveStatus(s: string): boolean {
  return ["processing", "queued", "submitted", "uploading", "rate_limited"].includes(s);
}

function isProgressing(s: string): boolean {
  return ["processing", "queued", "submitted", "rate_limited"].includes(s);
}

interface TaskListItemProps {
  task: UnifiedTask;
  onRetry?: (id: string) => void;
  onDownload?: (url: string) => void;
  onDelete?: (id: string) => void;
  showThumbnail?: boolean;
}

export function TaskListItem({ task, onRetry, onDownload, onDelete, showThumbnail = true }: TaskListItemProps) {
  const [showVideo, setShowVideo] = useState(false);
  const store = useTaskStore.getState();



  const handleRetry = useCallback(() => {
    if (onRetry) onRetry(task.id);
    else taskManager.retryTask(task.id);
  }, [task.id, onRetry]);

  const handleDelete = useCallback(() => {
    if (onDelete) onDelete(task.id);
    else store.removeTask(task.id);
  }, [task.id, onDelete, store]);

  const assets = useUnifiedAssetStore((s) => s.indexes);
  const addIndex = useUnifiedAssetStore((s) => s.addIndex);
  const [saving, setSaving] = useState(false);
  const alreadySaved = !!assets.find(a => a.name === `task-${task.id}`);
  const handleSaveToLibrary = async () => {
    if (!task.resultUrl || saving) return;
    setSaving(true);
    try {
      const saveResult = await StorageService.saveAssetFromUrl({
        url: task.resultUrl,
        type: task.type.includes("video") ? "video" : "image",
      });
      if (saveResult.success && saveResult.data) {
        addIndex({
          id: saveResult.data.id,
          name: `task-${task.id}`,
          type: task.type.includes("video") ? "video" : "image",
          tags: ["history", task.type],
          category: "output",
          isFavorite: false,
          fileSize: saveResult.data.fileSize || 0,
        });
      }
    } catch (e) {
      console.warn("Failed to save to asset library", e);
    }
    setSaving(false);
  };


  const handleDownload = useCallback(() => {
    if (onDownload) onDownload(task.resultUrl);
    else downloadUrl(task.resultUrl, `agnes-${task.type}-${Date.now()}.mp4`);
  }, [task.resultUrl, task.type, onDownload]);

  const Icon = TYPE_ICON[task.type] || Sparkles;
  const label = TYPE_LABEL[task.type] || task.type;
  const timeStr = new Date(task.createTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  const statusLabel =
    task.status === "queued" ? "排队中" :
    task.status === "submitted" ? "已提交，等待处理" :
    task.status === "rate_limited" ? "服务器繁忙，等待中" :
    task.status === "processing" ? "处理中" :
    task.status === "uploading" ? "上传中" :
    task.status === "awaiting_asset" ? "同步文件中" : "";

  const showProgressBar = task.status === "processing" && task.progress > 0;

  const borderColor =
    task.status === "completed" ? "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20" :
    task.status === "failed" || task.status === "timeout" ? "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20" :
    task.status === "processing" ? "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20" :
    task.status === "queued" ? "border-yellow-200 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/20" :
    task.status === "rate_limited" ? "border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/20" :
    "border-muted bg-muted/30";

  return (
    <div className={cn("rounded-xl border p-4 transition-all duration-200", borderColor)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{timeStr}</span>
            <span className="text-[10px] text-muted-foreground/70 rounded-full border px-1.5 py-0">{label}</span>
            <StatusBadge status={task.status} />
          </div>
          {task.prompt && <p className="text-sm text-foreground/80 line-clamp-2">{task.prompt}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {isActiveStatus(task.status) && (
            <Button variant="ghost" size="sm" onClick={() => { taskManager.cancelTask(task.id); }}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDelete}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {showProgressBar && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-600 dark:text-blue-400">生成中</span>
            <span className="text-muted-foreground">{task.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 ease-out"
              style={{ width: task.progress + "%" }} />
          </div>
        </div>
      )}

      {isProgressing(task.status) && !showProgressBar && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 animate-pulse" />
          <span>{statusLabel}</span>
        </div>
      )}

      {showThumbnail && task.thumbnail && task.status !== "completed" && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/30 p-2">
          <div className="shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-muted">
            <img src={task.thumbnail} alt="source" className="h-full w-full object-cover" />
          </div>
          <span className="text-xs text-muted-foreground">源图片</span>
        </div>
      )}

      {task.status === "completed" && task.resultUrl && (
        <div className="mt-3 space-y-3">
          {task.type.includes("video") ? (
            <>
              {showVideo ? (
                <div className="rounded-lg overflow-hidden bg-black">
                  <video src={task.resultUrl} controls className="w-full max-h-[300px]">您的浏览器不支持视频播放</video>
                </div>
              ) : (
                <div onClick={() => setShowVideo(true)}
                  className="relative flex cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 h-32 group">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-white/90 p-3 shadow-lg transition-transform duration-200 group-hover:scale-110">
                      <Play className="h-5 w-5 text-emerald-600 fill-emerald-600" />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground absolute bottom-2">点击播放</span>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg overflow-hidden bg-muted/30">
              <img src={task.resultUrl} alt="result" className="w-full max-h-64 object-contain" />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="mr-1 h-3.5 w-3.5" />下载
            </Button>
            <Button size="sm" variant={alreadySaved ? "ghost" : "outline"} onClick={handleSaveToLibrary} disabled={alreadySaved || saving}>
              {alreadySaved ? <Check className="mr-1 h-3.5 w-3.5 text-green-500" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              {alreadySaved ? "已保存" : "保存到素材库"}
            </Button>
          </div>
        </div>
      )}

      {(task.status === "failed" || task.status === "timeout") && task.errorMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{task.errorMessage}</span>
        </div>
      )}

      {task.status === "rate_limited" && task.errorMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-orange-50 p-2.5 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{task.errorMessage}</span>
        </div>
      )}

      {(task.status === "failed" || task.status === "timeout") && (
        <div className="mt-2 flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleRetry}>
            <RotateCcw className="mr-1 h-3 w-3" />重试
          </Button>
        </div>
      )}
    </div>
  );
}

interface TaskListProps {
  tasks: UnifiedTask[];
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRetry?: (id: string) => void;
  onDownload?: (url: string) => void;
  onDelete?: (id: string) => void;
  showThumbnail?: boolean;
  className?: string;
}

export function TaskList({
  tasks, emptyMessage = "暂无任务", emptyIcon,
  onRetry, onDownload, onDelete, showThumbnail, className,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Card className={cn("min-h-[300px]", className)}>
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="rounded-full bg-muted p-4">
            {emptyIcon || <Sparkles className="h-10 w-10 text-muted-foreground" />}
          </div>
          <div className="text-center">
            <p className="font-medium text-muted-foreground">{emptyMessage}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">开始创作后任务将显示在这里</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {tasks.map((task) => (
        <TaskListItem
          key={task.id}
          task={task}
          onRetry={onRetry}
          onDownload={onDownload}
          onDelete={onDelete}
          showThumbnail={showThumbnail}
        />
      ))}
    </div>
  );
}

export function TaskStats({ tasks }: { tasks: UnifiedTask[] }) {
  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed" || t.status === "timeout").length;
  const active = tasks.filter((t) => isActiveStatus(t.status)).length;
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>总计 {tasks.length}</span>
      {active > 0 && <span className="text-blue-600">进行中 {active}</span>}
      {completed > 0 && <span className="text-green-600">完成 {completed}</span>}
      {failed > 0 && <span className="text-red-600">失败 {failed}</span>}
    </div>
  );
}
