"use client";

import { useState } from "react";
import { GenerationLayout } from "@/components/shared/GenerationLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileUploader } from "@/components/shared/FileUploader";
import { useTaskStore, taskManager } from "@/stores/taskStore";
import { TaskListItem, TaskStats } from "@/components/shared/TaskList";
import { useConfig } from "@/hooks/useConfig";
import { agnes } from "@/services/agnes";
import { ImageValidator, type ImageInfo } from "@/services/imageValidator";
import {
  Sparkles, Loader2, AlertCircle,
  Film, List,
} from "lucide-react";
import { TaskMonitorPanel } from "@/components/shared/TaskMonitorPanel";
import Link from "next/link";

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

export default function ImageToVideoPage() {
  const { isConfigured, imageToVideoModel } = useConfig();
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const removeTask = useTaskStore((s) => s.removeTask);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [imageWarnings, setImageWarnings] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const model = imageToVideoModel || "agnes-video-v2.0";
  const canGenerate = !!file && !isGenerating;

  const videoTasks = tasks.filter((t) => t.type === "image-to-video");

  const handleFileChange = async (f: File | null, url: string | null) => {
    setFile(f);
    setPreviewUrl(url);
    setError(null);
    if (!f) { setImageInfo(null); setImageWarnings([]); return; }
    const result = await ImageValidator.validate(f);
    setImageInfo(result.info);
    setImageWarnings(result.warnings);
  };

  const handleGenerate = async () => {
    if (!canGenerate || !file) return;
    setError(null);
    setIsGenerating(true);

    const taskId = addTask({
      taskId: "", type: "image-to-video",
      model, prompt: prompt.trim() || "animate this image",
      status: "uploading", progress: 0,
      resultUrl: "", thumbnail: previewUrl || "",
      sourcePreview: previewUrl || undefined,
      errorMessage: "",
      params: {},
    });

    try {
      await taskManager.execute(taskId, "image-to-video", () =>
        agnes.video.createFromImage({
          image: file,
          prompt: prompt.trim() || "animate this image",
          model,
        })
      );
      setFile(null);
      setPreviewUrl(null);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
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
          <FileUploader
            file={file}
            previewUrl={previewUrl}
            onFileChange={handleFileChange}
            label="上传首帧图片"
            hint="上传一张图片，AI 将其变成动态视频"
          />

          {imageInfo && (
            <div className="rounded-lg bg-muted/40 border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">图片信息</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>尺寸</span>
                <span className="text-right font-mono">{imageInfo.width} × {imageInfo.height}</span>
                <span>比例</span>
                <span className="text-right font-mono">{(imageInfo.aspectRatio).toFixed(2)}</span>
                <span>格式</span>
                <span className="text-right font-mono uppercase">{imageInfo.format}</span>
                <span>大小</span>
                <span className="text-right font-mono">{(imageInfo.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              {imageWarnings.length > 0 && (
                <div className="mt-1 space-y-1">
                  {imageWarnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-[10px] text-amber-700 dark:text-amber-400">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>动态描述 (可选)</Label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述图片中物体的运动方式，比如：海浪轻轻拍打..."
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none"
              disabled={isGenerating}
            />
          </div>

          <Button size="lg" className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 text-base h-12 gap-2"
            onClick={handleGenerate} disabled={!canGenerate}>
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
            <div className="rounded-full bg-gradient-to-br from-orange-100 to-pink-100 p-4">
              <Film className="h-10 w-10 text-orange-400" />
            </div>
            <div className="text-center">
              <p className="font-medium text-muted-foreground">等待创作</p>
              <p className="text-sm text-muted-foreground/60">上传一张图片，可输入动态描述，然后点击生成</p>
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
              onDownload={(url) => downloadVideo(url, `agnes-img2vid-${Date.now()}.mp4`)}
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
        icon={<Sparkles className="h-6 w-6 text-white" />}
        title="图生视频"
        description="让静态图片动起来，变成短视频"
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        bgGradient="via-orange-50/20"
      />
      <TaskMonitorPanel />
    </>
  );
}
