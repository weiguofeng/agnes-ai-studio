"use client";
import { useState } from "react";
import { GenerationLayout } from "@/components/shared/GenerationLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FileUploader } from "@/components/shared/FileUploader";
import { useConfig } from "@/hooks/useConfig";
import { StorageService } from "@/services/StorageService";
import { ImageValidator } from "@/services/imageValidator";
import { runLimitedConcurrency } from "@/lib/runLimitedConcurrency";
import { useTaskStore } from "@/stores/taskStore";
import { useUnifiedAssetStore } from "@/stores/unifiedAssetStore";
import { agnes } from "@/services/agnes";
import {
  Sparkles, Loader2, AlertCircle, Film, Download, Save, CheckCircle2,
  X, Plus, ZoomIn, ImageIcon
} from "lucide-react";
import { TaskMonitorPanel } from "@/components/shared/TaskMonitorPanel";
import Link from "next/link";
import { useEffect } from "react";

const SIZE_OPTIONS = [
  { value: "1920x1080", label: "1920x1080 (16:9 Full HD)" },
  { value: "1280x720",  label: "1280x720 (16:9 HD)" },
  { value: "1080x1920", label: "1080x1920 (9:16)" },
  { value: "720x1280",  label: "720x1280 (9:16 HD)" },
  { value: "1024x1024", label: "1024x1024 (1:1)" },
  { value: "768x768",   label: "768x768 (1:1)" },
];

const DURATION_OPTIONS = [
  { value: "81",  label: "约 3 秒 (81帧, 24fps)" },
  { value: "121", label: "约 5 秒 (121帧, 24fps)" },
  { value: "241", label: "约 10 秒 (241帧, 24fps)" },
  { value: "441", label: "约 18 秒 (441帧, 24fps)" },
];

const MAX_CONCURRENT_VIDEOS = 2;

// ============================================================
// Asset Picker Dialog — browse and select images from asset library
// ============================================================
interface AssetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assetId: string) => void;
}

function AssetPickerDialog({ open, onOpenChange, onSelect }: AssetPickerProps) {
  const indexes = useUnifiedAssetStore((s) => s.indexes);
  const syncFromStorage = useUnifiedAssetStore((s) => s.syncFromStorage);
  const [localImages, setLocalImages] = useState<{id: string; name: string; blobUrl: string}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    syncFromStorage().then(async () => {
      const imageIndexes = useUnifiedAssetStore.getState().indexes.filter(i => i.type === "image");
      const items = [];
      for (const idx of imageIndexes) {
        try {
          const r = await StorageService.loadAsset(idx.id, "image");
          if (r.success && r.data) {
            items.push({ id: idx.id, name: idx.name, blobUrl: URL.createObjectURL(r.data) });
          }
        } catch {}
      }
      setLocalImages(items);
      setLoading(false);
    });
  }, [open, syncFromStorage]);

  // Cleanup blob URLs on close
  useEffect(() => {
    if (!open) {
      localImages.forEach(i => URL.revokeObjectURL(i.blobUrl));
      setLocalImages([]);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">从素材库选择图片</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : localImages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="font-medium">素材库中没有图片</p>
              <p className="text-sm mt-1">请先在其他页面生成图片并保存到素材库</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {localImages.map(item => (
                <div key={item.id}
                  className="group relative aspect-square rounded-lg overflow-hidden border bg-black/5 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => onSelect(item.id)}>
                  <img src={item.blobUrl} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2
                    opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">{item.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}




async function downloadVideo(url: string, filename: string) {
  try {
    const res = await fetch("/api/pipeline/download-image", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const j = await res.json();
    if (j.success && j.data) {
      const a = document.createElement("a");
      a.href = j.data; a.download = filename; a.click();
    } else { window.open(url, "_blank"); }
  } catch { window.open(url, "_blank"); }
}

export default function ImageToVideoPage() {
  const { isConfigured, imageToVideoModel } = useConfig();
  const addTask = useTaskStore((s) => s.addTask);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageWarnings, setImageWarnings] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [duration, setDuration] = useState("121");
  const [size, setSize] = useState("1280x720");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ url: string; prompt: string }[]>([]);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, error: "" });
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  const model = imageToVideoModel || "agnes-video-v2.0";
  const canGenerate = !!file && prompts.some(p => p.trim().length > 0) && !isBatchLoading;

  const handleFileChange = async (f: File | null, url: string | null) => {
    setFile(f); setPreviewUrl(url); setError(null);
    if (!f) { setImageWarnings([]); return; }
    const result = await ImageValidator.validate(f);
    setImageWarnings(result.warnings);
  };

  const addPrompt = () => { if (prompts.length < 10) setPrompts(prev => [...prev, ""]); };
  const removePrompt = (idx: number) => { setPrompts(prev => prev.filter((_, i) => i !== idx)); };
  const updatePrompt = (idx: number, val: string) => {
    setPrompts(prev => { const next = [...prev]; next[idx] = val; return next; });
  };

  const handleSelectFromAsset = async (assetId: string) => {
    try {
      const blobResult = await StorageService.loadAsset(assetId, "image");
      if (blobResult.success && blobResult.data) {
        const blob = blobResult.data;
        const assetFile = new File([blob], "asset-" + assetId.slice(-8) + ".png", { type: blob.type || "image/png" });
        const url = URL.createObjectURL(blob);
        handleFileChange(assetFile, url);
        setShowAssetPicker(false);
      }
    } catch (err) {
      console.error("Failed to load asset:", err);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate || !file) return;
    setIsBatchLoading(true); setError(null); setResults([]);
    const activePrompts = prompts.filter(p => p.trim().length > 0);
    const orderedResults: { url: string; prompt: string }[] = activePrompts.map((prompt) => ({ url: "", prompt }));
    const completed = { count: 0 };
    setResults(orderedResults);
    setBatchProgress({ current: 0, total: activePrompts.length, error: "" });
    const [widthStr, heightStr] = size.split("x");
    const updateResult = (index: number, url: string) => {
      orderedResults[index] = { url, prompt: activePrompts[index] };
      setResults([...orderedResults]);
    };
    const tasks = activePrompts.map((p, index) => async () => {
      let taskId = "";
      try {
        taskId = addTask({
          taskId: "", type: "image-to-video",
          model, prompt: p,
          status: "uploading", progress: 0,
          resultUrl: "", thumbnail: previewUrl || "",
          sourcePreview: previewUrl || undefined,
          errorMessage: "",
          params: { duration, size, negativePrompt, concurrency: MAX_CONCURRENT_VIDEOS },
        });
        const videoTask = await agnes.video.createFromImage({
          image: file,
          prompt: p,
          model,
          width: parseInt(widthStr),
          height: parseInt(heightStr),
          numFrames: parseInt(duration),
          frameRate: 24,
          negativePrompt: negativePrompt.trim() || undefined,
        });
        if (videoTask && videoTask.taskId) {
          const pollId = videoTask.videoId || videoTask.taskId;
          useTaskStore.getState().updateTask(taskId, { taskId: pollId, status: "processing", submitTime: Date.now() });
          const videoResult = await agnes.video.poll(pollId, {
            timeout: 600000,
            onProgress(progress) {
              useTaskStore.getState().updateTask(taskId, { status: "processing", progress: progress.progress });
            }
          });
          if (videoResult && videoResult.url) {
            updateResult(index, videoResult.url);
            useTaskStore.getState().updateTask(taskId, { status: "completed", progress: 100, resultUrl: videoResult.url });
          }
        }
        if (!videoTask?.taskId) throw new Error("视频任务创建失败");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "生成失败";
        setBatchProgress(prev => ({ ...prev, error: msg }));
        if (taskId) {
          useTaskStore.getState().updateTask(taskId, { status: "failed", errorMessage: msg });
        }
        updateResult(index, "");
      } finally {
        completed.count += 1;
        setBatchProgress(prev => ({ ...prev, current: completed.count }));
      }
    });
    await runLimitedConcurrency(tasks, MAX_CONCURRENT_VIDEOS);
    setIsBatchLoading(false);
  };

  const handleSaveResult = async (url: string, index: number) => {
    if (!url) return;
    setSavingIndex(index);
    try {
      const r = await StorageService.saveAssetFromUrl({ url, type: "video" });
      if (r.success && r.data) {
        setSavedIds(prev => new Set(prev).add("saved-" + index));
        const { useUnifiedAssetStore } = await import("@/stores/unifiedAssetStore");
        useUnifiedAssetStore.getState().addIndex({
          id: r.data.id,
          name: "图生视频 - " + (results[index]?.prompt || "").slice(0, 40),
          type: "video", tags: ["image-to-video"], category: "generated",
          isFavorite: false, fileSize: r.data.fileSize || 0,
        });
      }
    } catch (err) { console.error("Save failed:", err); }
    setSavingIndex(null);
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < results.length; i++) {
      if (results[i].url && !savedIds.has("saved-" + i)) await handleSaveResult(results[i].url, i);
    }
  };

  const completedCount = results.filter(r => !!r.url).length;
  const allSaved = results.length > 0 && results.every((_, i) => !results[i].url || savedIds.has("saved-" + i));

  const leftPanel = (
    <div className="space-y-6">
      {!isConfigured && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">尚未配置 API</p>
              <p className="text-amber-700 dark:text-amber-400">
                请先在 <Link href="/settings" className="underline underline-offset-2 hover:text-amber-900">API 配置</Link> 页面填写密钥。</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <FileUploader file={file} previewUrl={previewUrl} onFileChange={handleFileChange}
            label="上传首帧图片" hint="上传一张图片，AI 将其变成动态视频" />
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground/60">或</span>
            <Separator className="flex-1" />
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowAssetPicker(true)} disabled={isBatchLoading}>
            <ImageIcon className="h-4 w-4" /> 从素材库选择图片
          </Button>

          {imageWarnings.length > 0 && (
            <div className="space-y-1">
              {imageWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>动态描述（可添加多个 Prompt）</Label>
              {prompts.length < 10 && (
                <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={addPrompt} disabled={isBatchLoading}>
                  <Plus className="h-3 w-3" /> 添加 Prompt</Button>
              )}
            </div>
            {prompts.map((p, idx) => (
              <div key={idx} className="flex gap-2">
                <div className="flex-1 relative">
                  <textarea value={p} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePrompt(idx, e.target.value)}
                    placeholder={"描述 #" + (idx + 1) + " 中物体的运动方式"}
                    rows={2} disabled={isBatchLoading}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none" />
                </div>
                {prompts.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 self-start mt-0.5"
                    onClick={() => removePrompt(idx)} disabled={isBatchLoading}>
                    <X className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground/60">{prompts.filter(p => p.trim()).length} 个 Prompt 将生成 {prompts.filter(p => p.trim()).length} 个视频</p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>视频时长</Label>
            <Select value={duration} onValueChange={setDuration} disabled={isBatchLoading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>视频尺寸</Label>
            <Select value={size} onValueChange={setSize} disabled={isBatchLoading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>负面提示词（可选）</Label>
            <textarea value={negativePrompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNegativePrompt(e.target.value)}
              placeholder="描述不想要的画面元素，比如：模糊、变形..."
              rows={2} disabled={isBatchLoading}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none" />
          </div>

          <Separator />

          {isBatchLoading && (
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>正在生成视频 {batchProgress.current}/{batchProgress.total}...</span>
            </div>
          )}

          {batchProgress.error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>{batchProgress.error}</span>
            </div>
          )}

          <Button size="lg" className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 text-base h-12 gap-2"
            onClick={handleGenerate} disabled={!canGenerate}>
            {isBatchLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> 生成中 {batchProgress.current}/{batchProgress.total}</>
            ) : (
              <><Sparkles className="h-5 w-5" /> 生成 {prompts.filter(p => p.trim()).length} 个视频</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );


  const rightPanel = (
    <div className="space-y-4">
      {results.length === 0 && !isBatchLoading && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4 text-muted-foreground">
            <div className="rounded-full bg-gradient-to-br from-orange-100 to-pink-100 p-4">
              <Film className="h-10 w-10 text-orange-400" />
            </div>
            <div className="text-center">
              <p className="font-medium">视频生成结果将显示在这里</p>
              <p className="text-sm mt-1">上传一张图片，输入一个或多个 Prompt，点击生成</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isBatchLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-medium">AI 正在创作视频...</p>
              <p className="text-sm text-muted-foreground/60">处理中 {batchProgress.current}/{batchProgress.total}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && !isBatchLoading && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Film className="h-4 w-4 text-orange-400" />
                <span className="font-medium">生成结果</span>
                <span className="text-xs text-muted-foreground">({completedCount}/{results.length})</span>
              </div>
              {completedCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleSaveAll} disabled={allSaved}>
                  {allSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Save className="h-3.5 w-3.5" />}
                  {allSaved ? "已全部保存" : "全部保存"}</Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {results.map((r, idx) => (
                <div key={idx} className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground truncate" title={r.prompt}>
                    Prompt {idx + 1}: {(r.prompt || "").slice(0, 30)}...</p>
                  <div className={"aspect-video rounded-lg overflow-hidden border bg-black/10 relative group " + (!r.url ? "opacity-40" : "")}>
                    {r.url ? (
                      <>
                        <video src={r.url} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewVideo(r.url)} muted />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/20 hover:bg-white/30 text-white" onClick={() => setPreviewVideo(r.url)}>
                            <ZoomIn className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/20 hover:bg-white/30 text-white"
                            onClick={() => downloadVideo(r.url, "agnes-img2vid-" + Date.now() + "-" + idx + ".mp4")}>
                            <Download className="h-3.5 w-3.5" /></Button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-xs">失败</div>
                    )}
                  </div>
                  {r.url && (
                    <Button size="sm" variant={savedIds.has("saved-" + idx) ? "ghost" : "outline"}
                      className={"w-full h-7 text-xs gap-1 " + (savedIds.has("saved-" + idx) ? "text-green-400" : "")}
                      onClick={() => handleSaveResult(r.url, idx)}
                      disabled={savingIndex === idx || savedIds.has("saved-" + idx)}>
                      {savingIndex === idx ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       savedIds.has("saved-" + idx) ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                      {savedIds.has("saved-" + idx) ? "已保存" : "保存"}</Button>
                  )}
                </div>
              ))}
            </div>
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
        description="让静态图片动起来，支持多个 Prompt 批量生成不同视频"
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        bgGradient="via-orange-50/20"
      />
      <AssetPickerDialog open={showAssetPicker} onOpenChange={setShowAssetPicker} onSelect={handleSelectFromAsset} />
      <TaskMonitorPanel />
      <Dialog open={!!previewVideo} onOpenChange={(open: boolean) => { if (!open) setPreviewVideo(null); }}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-0">
          {previewVideo && <video src={previewVideo} controls autoPlay className="w-full h-auto max-h-[80vh] rounded-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
