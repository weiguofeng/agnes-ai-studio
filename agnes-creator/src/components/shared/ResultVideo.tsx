"use client";

import { Button } from "@/components/ui/button";
import { Download, Play, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

// -----------------------------------------------------------
// Props
// -----------------------------------------------------------

interface ResultVideoProps {
  /** 视频 URL */
  url: string;
  /** 是否自动显示（true 则直接显示播放器，false 显示播放按钮） */
  autoShow?: boolean;
  /** 导出文件名前缀 */
  filenamePrefix?: string;
  /** 类名 */
  className?: string;
}

// -----------------------------------------------------------
// Component
// -----------------------------------------------------------

export function ResultVideo({
  url,
  autoShow = true,
  filenamePrefix = "agnes-video",
  className = "",
}: ResultVideoProps) {
  const [showPlayer, setShowPlayer] = useState(autoShow);

  useEffect(() => {
    if (autoShow) setShowPlayer(true);
  }, [autoShow, url]);

  const handleDownload = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${filenamePrefix}-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {showPlayer ? (
        <div className="rounded-lg overflow-hidden bg-black">
          <video
            src={url}
            controls
            autoPlay
            className="w-full max-h-[400px]"
          >
            您的浏览器不支持视频播放
          </video>
        </div>
      ) : (
        <div
          onClick={() => setShowPlayer(true)}
          className="relative flex cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 h-40 group"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-white/90 p-4 shadow-lg transition-transform duration-200 group-hover:scale-110">
              <Play className="h-6 w-6 text-emerald-600 fill-emerald-600" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground absolute bottom-3">
            点击播放
          </span>
        </div>
      )}

      <Button size="sm" variant="outline" onClick={handleDownload}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        下载 MP4
      </Button>
    </div>
  );
}
