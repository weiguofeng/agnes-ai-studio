"use client";

import { useState, useCallback } from "react";
import { GenerationLayout } from "@/components/shared/GenerationLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTaskStore, taskManager } from "@/stores/taskStore";
import { TaskListItem, TaskStats } from "@/components/shared/TaskList";
import { useConfig } from "@/hooks/useConfig";
import { cn } from "@/lib/utils";
import { agnes } from "@/services/agnes";
import {
  Video, Sparkles, Loader2, AlertCircle, RotateCcw, Trash2,
  Film, List, CheckCircle2, XCircle,
} from "lucide-react";
import { TaskMonitorPanel } from "@/components/shared/TaskMonitorPanel";
import Link from "next/link";
import { DynamicParamsPanel } from "@/components/shared/DynamicParamsPanel";

const DURATION_OPTIONS = [
  { value: 3, label: "3 秒" },
  { value: 5, label: "5 秒", badge: "推荐" },
  { value: 10, label: "10 秒" },
  { value: 15, label: "15 秒" },
];
const ASPECT_OPTIONS = [
  { value: "16:9", label: "横屏 16:9" },
  { value: "9:16", label: "竖屏 9:16" },
  { value: "1:1", label: "方形 1:1" },
];
const SUGGESTED_PROMPTS = [
  "夕阳下的海滩，海浪轻轻拍打着沙滩，慢动作",
  "赛博朋克城市夜景，霓虹灯光，雨滴坠落",
  "一只蝴蝶在花丛中翩翩起舞，微距摄影",
  "延时摄影：云海在山间流动，日出时刻",
];

async function downloadVideo(url: string, filename: string) {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = filename; a.click();
    URL.revokeObjectURL(u);
  } catch { window.open(url, "_blank"); }
}

export default function TextToVideoPage() {
  const { isConfigured, textToVideoModel } = useConfig();
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const removeTask = useTaskStore((s) => s.removeTask);

  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [dynamicParams, setDynamicParams] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const isPromptEmpty = prompt.trim().length === 0;
  const model = textToVideoModel || "agnes-video-v2.0";

  const videoTasks = tasks.filter((t) => t.type === "text-to-video");
  const completedTasks = videoTasks.filter((t) => t.status === "completed");
  const failedTasks = videoTasks.filter((t) => t.status === "failed" || t.status === "timeout");
  const activeTask = videoTasks.find((t) => ["queued", "processing", "uploading", "submitted"].includes(t.status));

  const getFrameParams = useCallback(() => {
    const [w, h] = aspectRatio === "16:9" ? [1152, 768] : aspectRatio === "9:16" ? [768, 1152] : [1024, 1024];
    const numFrames = Math.min(Math.max(Math.round(duration * 24), 9), 441);
    const adjustedFrames = Math.max(1, Math.round((numFrames - 1) / 8)) * 8 + 1;
    return { width: w, height: h, numFrames: adjustedFrames, frameRate: 24 };
  }, [duration, aspectRatio]);

  const handleGenerate = async () => {
    if (isPromptEmpty || isGenerating) return;
    setError(null);
    setIsGenerating(true);

    const frameParams = getFrameParams();
    const taskId = addTask({
      taskId: "", type: "text-to-video",
      model, prompt: prompt.trim(),
      status: "queued", progress: 0,
      resultUrl: "", thumbnail: "", errorMessage: "",
      params: { duration, aspectRatio, ...frameParams, ...dynamicParams },
    });

    try {
      await taskManager.execute(taskId, "text-to-video", () =>
        agnes.video.create({
          prompt: prompt.trim(),
          model,
          ...frameParams,
          ...dynamicParams,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleGenerate(); }
  };

  const leftPanel = (
    <div className="space-y-6">
      {!isConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">尚未配置 API</p>
              <p className="text-amber-700">请先在 <Link href="/settings" className="underline">API 配置</Link> 页面填写密钥。</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label>视频描述 Prompt</Label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入视频场景描述，比如：一只蝴蝶在花丛中飞翔..."
              rows={4}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none"
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground/60">
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl+Enter</kbd> 快速生成
            </p>
            {!prompt && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED_PROMPTS.map((sp, i) => (
                  <button key={i} type="button" onClick={() => setPrompt(sp)}
                    className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted transition-colors">
                    {sp.slice(0, 20)}...
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>视频时长</Label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setDuration(opt.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-center text-xs transition-all",
                    duration === opt.value
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                      : "hover:border-muted-foreground/30"
                  )}>
                  <span className="font-medium">{opt.label}</span>
                  {opt.badge && <span className="block text-[9px] text-emerald-600 mt-0.5">{opt.badge}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>画面比例</Label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setAspectRatio(opt.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-center text-xs transition-all",
                    aspectRatio === opt.value
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                      : "hover:border-muted-foreground/30"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <DynamicParamsPanel
            modelId={model}
            values={dynamicParams}
            onChange={(k, v) => setDynamicParams((p) => ({ ...p, [k]: v }))}
          />

          <Button size="lg" className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-base h-12 gap-2"
            onClick={handleGenerate} disabled={isPromptEmpty || isGenerating}>
            {isGenerating
              ? <><Loader2 className="h-5 w-5 animate-spin" /> 生成中...</>
              : <><Sparkles className="h-5 w-5" /> 生成视频</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const rightPanel = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">视频任务</h2>
          {videoTasks.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{videoTasks.length}</span>}
        </div>
        <TaskStats tasks={videoTasks} />
      </div>

      {videoTasks.length === 0 ? (
        <Card className="min-h-[400px]">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 p-4">
              <Film className="h-10 w-10 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="font-medium text-muted-foreground">暂无任务</p>
              <p className="text-sm text-muted-foreground/60">输入描述后点击生成，任务会显示在这里</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {videoTasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              onDelete={removeTask}
              onDownload={(url) => downloadVideo(url, `agnes-video-${Date.now()}.mp4`)}
            />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div><p className="font-medium text-red-800">生成失败</p><p className="text-red-700">{error}</p></div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <>
      <GenerationLayout
        icon={<Video className="h-6 w-6 text-white" />}
        title="文生视频"
        description="输入文字描述，AI 将为您生成动态视频"
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        bgGradient="via-emerald-50/20"
      />
      <TaskMonitorPanel />
    </>
  );
}
