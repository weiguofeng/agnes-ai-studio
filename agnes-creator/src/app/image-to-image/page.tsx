"use client";

import { useState, useRef } from "react";
import { GenerationLayout } from "@/components/shared/GenerationLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { FileUploader } from "@/components/shared/FileUploader";
import { useGenerateImageToImage } from "@/hooks/useGenerateImageToImage";
import { useConfig } from "@/hooks/useConfig";
import { cn } from "@/lib/utils";
import {
  Shuffle, Sparkles, Download, Loader2, AlertCircle,
  RotateCcw, ImageIcon, ArrowRight,
} from "lucide-react";
import { TaskMonitorPanel } from "@/components/shared/TaskMonitorPanel";
import Link from "next/link";

const STRENGTH_LABELS = [
  { value: 0,   label: "严格保留" },
  { value: 0.5, label: "平衡"    },
  { value: 1,   label: "自由发挥" },
];

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

export default function ImageToImagePage() {
  const { isConfigured } = useConfig();
  const { generate, result, isLoading, error, reset } = useGenerateImageToImage();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState(0.75);
  const [fileError, setFileError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const hasResult = result && result.length > 0;
  const canGenerate = !!file && prompt.trim().length > 0 && !isLoading;

  const handleFileChange = (f: File | null, url: string | null) => {
    setFile(f);
    setPreviewUrl(url);
    setFileError(null);
    reset();
  };

  const handleGenerate = async () => {
    if (!canGenerate || !file) return;
    await generate({ image: file, prompt: prompt.trim(), strength });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleGenerate(); }
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setPrompt(""); setStrength(0.75); reset();
  };

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
          <FileUploader
            file={file}
            previewUrl={previewUrl}
            onFileChange={handleFileChange}
            error={fileError}
            label="上传原始图片"
            hint="选择一张图片作为 AI 改写的起点"
          />

          <div className="space-y-1.5">
            <Label>描述 Prompt</Label>
            <textarea
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想要的画面风格和内容，比如：把照片变成水彩画风格..."
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground/60">
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl+Enter</kbd> 快速生成
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">重绘强度 (Strength): <span className="font-mono font-bold text-primary">{strength.toFixed(2)}</span></Label>
            </div>
            <Slider
              value={[strength]}
              onValueChange={([v]) => setStrength(v)}
              min={0}
              max={1}
              step={0.05}
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              {STRENGTH_LABELS.map((s) => (
                <span key={s.value}
                  onClick={() => setStrength(s.value)}
                  className={cn("cursor-pointer transition-colors hover:text-foreground",
                    Math.abs(strength - s.value) < 0.05 && "font-medium text-foreground")}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-base h-12 gap-2"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> 生成中...</>
            ) : (
              <><Sparkles className="h-5 w-5" /> 生成</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const rightPanel = (
    <div className="space-y-4" ref={resultRef}>
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-semibold">结果</h2>
        {hasResult && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">生成完成</span>}
      </div>

      {!hasResult && !isLoading && !error && (
        <Card className="min-h-[300px]">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 p-4 dark:from-blue-900/30 dark:to-cyan-900/30">
              <Shuffle className="h-10 w-10 text-blue-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium text-muted-foreground">等待创作</p>
              <p className="text-sm text-muted-foreground/60 max-w-xs">上传图片，输入描述，AI 将根据您的图片进行创作</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-medium">AI 正在创作...</p>
              <p className="text-sm text-muted-foreground/60">这可能需要几秒钟</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">生成失败</p>
              <p className="text-red-700 dark:text-red-400">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={handleReset}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />重新设置
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasResult && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-4">
              {previewUrl && (
                <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={previewUrl} alt="原图" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {result![0].revisedPrompt && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{result![0].revisedPrompt}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>强度 {strength.toFixed(2)}</span>
                  {previewUrl && <><span>|</span><span>原图 {(file!.size / 1024).toFixed(0)}KB</span></>}
                </div>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 group relative">
              <img src={result![0].url} alt="生成结果" className="w-full h-auto object-contain max-h-[350px]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="secondary" className="backdrop-blur-sm bg-white/90 hover:bg-white w-full"
                  onClick={() => downloadImage(result![0].url, `agnes-img2img-${Date.now()}.png`)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />下载结果
                </Button>
              </div>
            </div>

            <div className="flex justify-center -mt-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                <span className="text-muted-foreground/60">原图</span>
                <ArrowRight className="h-3.5 w-3.5" />
                <span>强度 {strength.toFixed(2)}</span>
                <ArrowRight className="h-3.5 w-3.5" />
                <span>生成</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1"
                onClick={() => downloadImage(result![0].url, `agnes-img2img-${Date.now()}.png`)}>
                <Download className="mr-1.5 h-3.5 w-3.5" />下载结果
              </Button>
              <Button size="sm" className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                onClick={handleGenerate} disabled={!canGenerate}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />重新生成
              </Button>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground/70">Prompt：</span>{prompt}</p>
              <p><span className="font-medium text-foreground/70">重绘强度：</span>{strength.toFixed(2)}</p>
              {result![0].revisedPrompt && <p><span className="font-medium text-foreground/70">优化提示：</span>{result![0].revisedPrompt}</p>}
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
      description="上传图片，用文字改造它的风格和内容"
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      bgGradient="via-blue-50/20"
    />
    <TaskMonitorPanel />
    </>
  );
}
