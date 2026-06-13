"use client";

import { useState, useRef, useEffect } from "react";
import { GenerationLayout } from "@/components/shared/GenerationLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useGenerateImage } from "@/hooks/useGenerateImage";
import { useConfig } from "@/hooks/useConfig";
import { cn } from "@/lib/utils";
import type { ImageSize } from "@/services/agnes";
import { ImageIcon, Sparkles, Download, Loader2, AlertCircle } from "lucide-react";
import { TaskMonitorPanel } from "@/components/shared/TaskMonitorPanel";
import Link from "next/link";
import { PromptAdvancedPanel, DEFAULT_ADVANCED_PARAMS } from "@/components/shared/PromptAdvancedPanel";
import { DynamicParamsPanel } from "@/components/shared/DynamicParamsPanel";
import { useTaskStore } from "@/stores/taskStore";

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "1:1 方形", badge: "推荐" },
  { value: "768x1344",  label: "9:16 竖屏" },
  { value: "1344x768",  label: "16:9 横屏" },
  { value: "512x512",   label: "512x512" },
  { value: "1024x1792", label: "9:16 高清" },
  { value: "1792x1024", label: "16:9 高清" },
  { value: "256x256",   label: "256x256" },
];

const SUGGESTED_PROMPTS = [
  "一只毛茸茸的橘猫在阳光下打盹，柔和的暖色调，摄影级画质",
  "赛博朋克风格的未来城市夜景，霓虹灯光，雨中倒影",
  "水墨画风格的山间云雾，飞鸟掠过，留白意境",
  "一位宇航员在粉色花海中漫步，超现实，梦幻风格",
];

function generateId() { return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export default function GenerateImagePage() {
  const { isConfigured, textToImageModel } = useConfig();
  const { generate, result, isLoading, error, reset } = useGenerateImage();

  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [dynamicParams, setDynamicParams] = useState<Record<string, unknown>>({});
  const [advParams, setAdvParams] = useState({ ...DEFAULT_ADVANCED_PARAMS });
  const resultRef = useRef<HTMLDivElement>(null);
  const addTask = useTaskStore((s) => s.addTask);

  useEffect(() => {
    if (result && result.length > 0 && !isLoading) {
      addTask({
        id: generateId(), taskId: "", type: "text-to-image",
        model: textToImageModel || "agnes-image-2.1-flash",
        prompt: prompt.trim(), status: "completed", progress: 100,
        resultUrl: result[0].url, thumbnail: "", errorMessage: "",
        params: { size, ...dynamicParams, ...advParams },
      });
    }
  }, [result]);

  const hasResult = result && result.length > 0;
  const isPromptEmpty = prompt.trim().length === 0;

  const handleGenerate = async () => {
    if (isPromptEmpty || isLoading) return;
    await generate({
      prompt: prompt.trim(),
      size: size as ImageSize,
      seed: advParams.seed,
      steps: advParams.steps,
      guidance_scale: advParams.cfgScale,
      negative_prompt: advParams.negativePrompt,
      n: (dynamicParams.n as number) || 1,
    });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleGenerate(); }
  };

  const handleDownload = async (url: string, i: number) => {
    try {
      const r = await fetch(url); const b = await r.blob();
      const u = URL.createObjectURL(b); const a = document.createElement("a");
      a.href = u; a.download = `agnes-${Date.now()}-${i+1}.png`; a.click(); URL.revokeObjectURL(u);
    } catch { window.open(url, "_blank"); }
  };

  const leftPanel = (
    <div className="space-y-6">
      {!isConfigured && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">尚未配置 API</p>
              <p className="text-amber-700">请先在 <Link href="/settings" className="underline underline-offset-2">API 配置</Link> 页面填写密钥。</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label>描述 Prompt</Label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你想要的画面描述，越详细效果越好..."
              rows={4}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none"
              disabled={isLoading} />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground/60"><kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl+Enter</kbd> 快速生成</p>
              <span className="text-xs text-muted-foreground/60">{prompt.length}/1000</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((s, i) => (
              <button key={i} onClick={() => setPrompt(s)}
                className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors truncate max-w-[200px]">
                {s}
              </button>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>图片尺寸</Label>
            <div className="grid grid-cols-2 gap-2">
              {SIZE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setSize(opt.value)}
                  className={cn("relative rounded-lg border px-3 py-2 text-left text-xs transition-all",
                    size === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-muted-foreground/30"
                  )}>
                  <span className="font-medium">{opt.label}</span>
                  {opt.badge && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">{opt.badge}</span>}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{opt.value}</p>
                </button>
              ))}
            </div>
          </div>

          <DynamicParamsPanel modelId={textToImageModel || "agnes-image-2.1-flash"}
            values={dynamicParams} onChange={(k, v) => setDynamicParams(p => ({ ...p, [k]: v }))} />

          <PromptAdvancedPanel value={advParams} onChange={setAdvParams} />

          <Button size="lg" className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-base h-12 gap-2"
            onClick={handleGenerate} disabled={isPromptEmpty || isLoading}>
            {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> 生成中...</>
              : <><Sparkles className="h-5 w-5" /> 生成</>}
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
        <Card className="min-h-[400px]">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="rounded-full bg-gradient-to-br from-violet-100 to-purple-100 p-4"><ImageIcon className="h-10 w-10 text-violet-400" /></div>
            <div className="text-center space-y-1">
              <p className="font-medium text-muted-foreground">等待创作</p>
              <p className="text-sm text-muted-foreground/60 max-w-xs">输入描述，AI 将会为您生成惊艳的图像作品</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center"><p className="font-medium">AI 正在创作...</p><p className="text-sm text-muted-foreground/60">这可能需要几秒钟</p></div>
        </CardContent></Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div><p className="font-medium text-red-800">生成失败</p><p className="text-red-700">{error}</p></div>
          </CardContent>
        </Card>
      )}

      {hasResult && result!.map((img, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="rounded-xl overflow-hidden bg-gradient-to-br from-violet-50 to-purple-50 group relative">
              <img src={img.url} alt={`结果 ${i+1}`} className="w-full h-auto object-contain max-h-[400px]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="secondary" className="backdrop-blur-sm bg-white/90 w-full"
                  onClick={() => handleDownload(img.url, i)}><Download className="mr-1.5 h-3.5 w-3.5" />下载图片</Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">生成完成</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleDownload(img.url, i)}>
                <Download className="mr-1.5 h-3.5 w-3.5" />下载
              </Button>
            </div>
            {img.revisedPrompt && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">优化 Prompt：</span>{img.revisedPrompt}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (<>
    
    <GenerationLayout
      icon={<ImageIcon className="h-6 w-6 text-white" />}
      title="文生图"
      description="用文字描述生成惊艳的图像作品"
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      bgGradient="via-violet-50/20"
    />
    <TaskMonitorPanel />
    </>
  );
}
