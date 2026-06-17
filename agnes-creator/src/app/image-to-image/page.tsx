"use client";
import { useState, useRef, useCallback } from "react";
import { GenerationLayout } from "@/components/shared/GenerationLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { useConfig } from "@/hooks/useConfig";
import { StorageService } from "@/services/StorageService";
import { cn } from "@/lib/utils";
import {
  Shuffle, Sparkles, Download, Loader2, AlertCircle,
  ImageIcon, Save, CheckCircle2, X, Upload, ZoomIn, Plus
} from "lucide-react";
import { TaskMonitorPanel } from "@/components/shared/TaskMonitorPanel";
import Link from "next/link";

const SIZE_OPTIONS = [
  { value: "1792x1024", label: "16:9 HD (1792x1024)" },
  { value: "1344x768",  label: "16:9 (1344x768)" },
  { value: "1024x1792", label: "9:16 HD (1024x1792)" },
  { value: "768x1344",  label: "9:16 (768x1344)" },
  { value: "1024x1024", label: "1:1 Square (1024x1024)" },
  { value: "512x512",   label: "1:1 (512x512)" },
  { value: "256x256",   label: "1:1 (256x256)" },
];

const REQUEST_DELAY_MS = 1500;

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch { window.open(url, "_blank"); }
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface FileItem {
  file: File;
  previewUrl: string;
  id: string;
}

export default function ImageToImagePage() {
  const { isConfigured } = useConfig();
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1792x1024");
  const [strength, setStrength] = useState(0.75);
  const [results, setResults] = useState<{ inputPreview: string; url: string; revisedPrompt?: string }[]>([]);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, error: "" });
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const canGenerate = fileItems.length > 0 && prompt.trim().length > 0 && !isBatchLoading;

  const addFiles = useCallback((files: FileList | File[]) => {
    const currentCount = fileItems.length;
    const newItems: FileItem[] = [];
    const maxToAdd = 10 - currentCount;
    for (let i = 0; i < files.length && newItems.length < maxToAdd; i++) {
      const f = files[i];
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 10 * 1024 * 1024) continue;
      const id = "file-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      newItems.push({ file: f, previewUrl: URL.createObjectURL(f), id });
    }
    setFileItems(prev => [...prev, ...newItems]);
    setError(null);
  }, [fileItems.length]);

  const removeFile = useCallback((id: string) => {
    setFileItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    e.target.value = "";
  }, [addFiles]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsBatchLoading(true);
    setError(null);
    setResults([]);
    setBatchProgress({ current: 0, total: fileItems.length, error: "" });

    const { agnes } = await import("@/services/agnes");
    const allResults: { inputPreview: string; url: string; revisedPrompt?: string }[] = [];

    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setBatchProgress({ current: i + 1, total: fileItems.length, error: "" });
      try {
        const images = await agnes.image.edit({
          image: item.file,
          prompt: prompt.trim(),
          strength,
          size: size as any,
        });
        if (images && images.length > 0) {
          allResults.push({ inputPreview: item.previewUrl, url: images[0].url, revisedPrompt: images[0].revisedPrompt });
          setResults([...allResults]);
        }
      } catch (err: any) {
        const msg = err?.message || "生成失败";
        setBatchProgress(prev => ({ ...prev, error: msg }));
        allResults.push({ inputPreview: item.previewUrl, url: "", revisedPrompt: undefined });
        setResults([...allResults]);
      }
      if (i < fileItems.length - 1) await delay(REQUEST_DELAY_MS);
    }
    setIsBatchLoading(false);
  };

  const handleReset = () => {
    fileItems.forEach(i => URL.revokeObjectURL(i.previewUrl));
    setFileItems([]);
    setPrompt("");
    setResults([]);
    setError(null);
    setBatchProgress({ current: 0, total: 0, error: "" });
    setPreviewImage(null);
    setSavedIds(new Set());
  };

  const handleSaveResult = async (url: string, index: number) => {
    if (!url) return;
    setSavingIndex(index);
    try {
      const saveResult = await StorageService.saveAssetFromUrl({ url, type: "image" });
      if (saveResult.success) {
        setSavedIds(prev => new Set(prev).add("saved-" + index));
        const { useUnifiedAssetStore } = await import("@/stores/unifiedAssetStore");
        useUnifiedAssetStore.getState().addIndex({
          id: saveResult.data!.id,
          name: "图生图 - " + prompt.slice(0, 40),
          type: "image",
          tags: ["image-to-image", prompt.slice(0, 20)],
          category: "generated",
          isFavorite: false,
          fileSize: saveResult.data!.fileSize || 0,
        });
      }
    } catch (err) { console.error("Save failed:", err); }
    setSavingIndex(null);
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < results.length; i++) {
      if (results[i].url && !savedIds.has("saved-" + i)) {
        await handleSaveResult(results[i].url, i);
      }
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
                请先在 <Link href="/settings" className="underline underline-offset-2 hover:text-amber-900">API 配置</Link> 页面填写密钥和端点。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>上传原始图片（可多选）</Label>
            <div
              onDrop={handleDrop}
              onDragOver={(e: any) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={
                "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all " +
                (dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30") +
                (isBatchLoading ? " cursor-not-allowed opacity-50" : "")
              }
            >
              <div className="rounded-full bg-muted p-2.5 mb-2"><Upload className="h-5 w-5 text-muted-foreground" /></div>
              <p className="text-sm font-medium">拖拽图片到此处，或点击选择</p>
              <p className="text-xs text-muted-foreground mt-0.5">支持 PNG / JPG / WebP，单张最大 10MB，最多 10 张</p>
              <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileSelect} className="hidden" disabled={isBatchLoading} />
            </div>

            {fileItems.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {fileItems.map(item => (
                  <div key={item.id} className="relative group rounded-lg overflow-hidden border bg-black/10 aspect-square">
                    <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                    <button onClick={(e: any) => { e.stopPropagation(); removeFile(item.id); }}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                      {(item.file.size / 1024).toFixed(0)}KB
                    </span>
                  </div>
                ))}
                {fileItems.length < 10 && (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground/50 hover:border-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>描述 Prompt</Label>
            <textarea value={prompt} onChange={(e: any) => setPrompt(e.target.value)}
              placeholder="描述你想要的画面风格和内容，比如：把照片变成水彩画风格..."
              rows={3} disabled={isBatchLoading}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none" />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>重绘强度</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{strength.toFixed(2)}</span>
            </div>
            <Slider value={[strength]} onValueChange={([v]) => setStrength(v)} min={0} max={1} step={0.05} disabled={isBatchLoading} />
            <div className="flex justify-between text-[10px] text-muted-foreground/60">
              <span>严格保留</span><span>大幅改动</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>尺寸</Label>
            <Select value={size} onValueChange={setSize} disabled={isBatchLoading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {isBatchLoading && (
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>正在处理 {batchProgress.current}/{batchProgress.total}...</span>
            </div>
          )}

          {batchProgress.error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{batchProgress.error}</span>
            </div>
          )}

          <Button size="lg" className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            onClick={handleGenerate} disabled={!canGenerate}>
            {isBatchLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> 生成中 {batchProgress.current}/{batchProgress.total}</>
            ) : (
              <><Sparkles className="h-4 w-4" />{fileItems.length > 1 ? "生成 " + fileItems.length + " 张图片" : "生成图片"}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div><p className="font-medium text-red-800">生成失败</p><p className="text-red-700">{error}</p></div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const rightPanel = (
    <div className="space-y-4">
      {results.length === 0 && !isBatchLoading && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4 text-muted-foreground">
            <Shuffle className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="font-medium">生成结果将显示在这里</p>
              <p className="text-sm mt-1">上传一张或多张图片，输入 Prompt，点击「生成」</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isBatchLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-medium">AI 正在创作...</p>
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
                <ImageIcon className="h-4 w-4 text-blue-400" />
                <span className="font-medium">生成结果</span>
                <span className="text-xs text-muted-foreground">({completedCount}/{results.length})</span>
              </div>
              {completedCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleSaveAll} disabled={allSaved}>
                  {allSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Save className="h-3.5 w-3.5" />}
                  {allSaved ? "已全部保存" : "全部保存"}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {results.map((r, idx) => (
                <div key={idx} className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">图片 {idx + 1}</p>
                  <div className={"aspect-square rounded-lg overflow-hidden border bg-black/10 relative group " + (!r.url ? "opacity-40" : "")}>
                    {r.url ? (
                      <>
                        <img src={r.url} alt={"结果 " + (idx + 1)} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewImage(r.url)} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/20 hover:bg-white/30 text-white" onClick={() => setPreviewImage(r.url)}>
                            <ZoomIn className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/20 hover:bg-white/30 text-white"
                            onClick={() => downloadImage(r.url, "agnes-img2img-" + Date.now() + "-" + idx + ".png")}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
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
                      {savedIds.has("saved-" + idx) ? "已保存" : "保存"}
                    </Button>
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
        icon={<Shuffle className="h-6 w-6 text-white" />}
        title="图生图"
        description="上传一张或多张图片，用同一 Prompt 批量转换风格和内容"
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        bgGradient="via-blue-50/20"
      />
      <TaskMonitorPanel />
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-0">
          {previewImage && <img src={previewImage} alt="大图预览" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
