"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VideoTask } from "@/hooks/useVideoTaskQueue";
import {
  Download, Loader2, AlertCircle, Trash2, Clock, Play,
  CheckCircle2, XCircle, X, ImageIcon,
} from "lucide-react";

function StatusBadge({ status }: { status: VideoTask["status"] }) {
  const config = {
    queued:     { label: "排队中", className: "bg-muted text-muted-foreground", icon: Loader2 },
    processing: { label: "生成中", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Loader2 },
    completed:  { label: "已完成", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
    failed:     { label: "失败",   className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: XCircle },
    cancelled:  { label: "已取消", className: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300", icon: XCircle },
    uploading:  { label: "上传中", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: Loader2 },
    submitted:  { label: "已提交", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", icon: Loader2 },
    timeout:    { label: "超时",   className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: XCircle },
  };
  const { label, className, icon: Icon } = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", className)}>
      <Icon className={cn("h-3 w-3", status === "processing" && "animate-spin")} />
      {label}
    </span>
  );
}

interface TaskCardProps {
  task: VideoTask;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (url: string) => void;
}

export function TaskCard({ task, onCancel, onRemove, onDownload }: TaskCardProps) {
  const [showVideo, setShowVideo] = useState(task.status === "completed");
  useEffect(() => {
    if (task.status === "completed" && task.result?.url) setShowVideo(true);
  }, [task.status, task.result?.url]);
  const timeStr = new Date(task.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("rounded-xl border p-4 transition-all duration-200",
      task.status === "completed"  && "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20",
      task.status === "failed"     && "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20",
      task.status === "processing" && "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20",
      task.status === "queued"     && "border-muted bg-muted/30",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{timeStr}</span>
            {task.type === "image-to-video" && <span className="text-[10px] text-muted-foreground/60 rounded-full border px-1.5 py-0">图生视频</span>}
            <StatusBadge status={task.status} />
          </div>
          {task.prompt && <p className="text-sm text-foreground/80 line-clamp-2">{task.prompt}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {task.status === "processing" && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(task.id)} disabled={task.cancelling}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
              {task.cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}取消
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onRemove(task.id)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {(task.status === "processing" || task.status === "queued") && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-600 dark:text-blue-400">{task.status === "queued" ? "等待处理" : "正在生成视频..."}</span>
            <span className="text-muted-foreground">{task.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
            <div className={cn("h-full rounded-full transition-all duration-500 ease-out",
              task.status === "queued" ? "w-full animate-pulse bg-muted-foreground/30" : "bg-gradient-to-r from-blue-500 to-cyan-500"
            )} style={{ width: task.progress + "%" }} />
          </div>
        </div>
      )}

      {task.type === "image-to-video" && task.sourcePreview && task.status !== "queued" && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/30 p-2">
          <div className="shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-muted">
            <img src={task.sourcePreview} alt="首帧" className="h-full w-full object-cover" />
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" />首帧图片</span>
          </div>
        </div>
      )}

      {task.status === "completed" && task.result && (
        <div className="mt-3 space-y-3">
          {showVideo ? (
            <div className="rounded-lg overflow-hidden bg-black">
              <video src={task.result.url} controls autoPlay muted className="w-full max-h-[300px]">您的浏览器不支持视频播放</video>
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
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onDownload(task.result!.url)}>
              <Download className="mr-1 h-3.5 w-3.5" />下载 MP4
            </Button>
            {!showVideo && <Button size="sm" variant="ghost" onClick={() => setShowVideo(true)}>
              <Play className="mr-1 h-3.5 w-3.5" />播放
            </Button>}
          </div>
        </div>
      )}

      {task.status === "failed" && task.error && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{task.error}</span>
        </div>
      )}
    </div>
  );
}
