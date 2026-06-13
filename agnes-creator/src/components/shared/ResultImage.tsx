"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ExternalLink, Sparkles, ImageIcon } from "lucide-react";

// -----------------------------------------------------------
// Props
// -----------------------------------------------------------

interface ResultImageProps {
  /** 图片 URL */
  url: string;
  /** Prompt 文字 */
  prompt?: string;
  /** 修订后的 Prompt */
  revisedPrompt?: string;
  /** 图片尺寸描述 */
  sizeLabel?: string;
  /** 是否显示操作栏 */
  showActions?: boolean;
  /** 导出文件名前缀 */
  filenamePrefix?: string;
  /** 额外信息 */
  extraInfo?: Record<string, string>;
  /** 最大高度 */
  maxHeight?: number;
  /** 类名 */
  className?: string;
}

// -----------------------------------------------------------
// Component
// -----------------------------------------------------------

export function ResultImage({
  url,
  prompt,
  revisedPrompt,
  sizeLabel,
  showActions = true,
  filenamePrefix = "agnes",
  extraInfo,
  maxHeight = 600,
  className = "",
}: ResultImageProps) {
  const [expanded, setExpanded] = useState(false);

  const handleDownload = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${filenamePrefix}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 图片展示 */}
      <div className="relative group rounded-xl overflow-hidden bg-gradient-to-br from-muted/50 to-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={prompt || "生成的图像"}
          className={`w-full h-auto object-contain mx-auto transition-all duration-300 group-hover:scale-[1.01] ${
            expanded ? "" : `max-h-[${maxHeight}px]`
          }`}
          style={expanded ? {} : { maxHeight: `${maxHeight}px` }}
        />

        {/* 悬浮操作栏 */}
        {showActions && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="backdrop-blur-sm bg-white/90 hover:bg-white text-foreground"
                onClick={handleDownload}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                下载图片
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="backdrop-blur-sm bg-white/90 hover:bg-white text-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                <ZoomIn className="mr-1.5 h-3.5 w-3.5" />
                {expanded ? "缩小" : "放大"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="backdrop-blur-sm bg-white/90 hover:bg-white text-foreground"
                onClick={() => window.open(url, "_blank")}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                新标签页
              </Button>
              {revisedPrompt && (
                <span className="text-xs text-white/80 truncate ml-auto max-w-[300px] hidden md:block">
                  {revisedPrompt}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 底部信息栏 */}
      {showActions && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">生成完成</span>
            {sizeLabel && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-xs text-muted-foreground">{sizeLabel}</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              下载
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              打开
            </Button>
          </div>
        </div>
      )}

      {/* 详细信息 */}
      {(revisedPrompt || extraInfo) && (
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          {revisedPrompt && (
            <p>
              <span className="font-medium text-foreground/70">优化 Prompt：</span>
              {revisedPrompt}
            </p>
          )}
          {extraInfo &&
            Object.entries(extraInfo).map(([key, val]) => (
              <p key={key}>
                <span className="font-medium text-foreground/70">{key}：</span>
                {val}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
