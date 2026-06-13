// ============================================================
// DownloadButton — 统一下载组件
// ============================================================

"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { ButtonProps } from "@/components/ui/button";

interface DownloadButtonProps extends Partial<ButtonProps> {
  url: string;
  filename?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
}

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

function getFilename(type: "image" | "video"): string {
  const ts = Date.now();
  if (type === "video") return `agnes-video-${ts}.mp4`;
  return `agnes-image-${ts}.png`;
}

export function DownloadButton({
  url,
  filename,
  label = "下载",
  variant = "outline",
  size = "sm",
  ...props
}: DownloadButtonProps) {
  const ext = url.match(/\.(mp4|webm|mov)$/i) ? "video" : "image";
  const finalName = filename || getFilename(ext as "image" | "video");

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => downloadFile(url, finalName)}
      {...props}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
