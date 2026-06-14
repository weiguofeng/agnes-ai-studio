"use client";
import { useEffect, useCallback } from "react";
import { X, Maximize2 } from "lucide-react";

interface AssetPreviewProps {
  type: "image" | "video";
  url: string;
  onClose: () => void;
}

export function AssetPreview({ type, url, onClose }: AssetPreviewProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleFullscreen = () => {
    const el = document.getElementById("asset-preview-media");
    if (el) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div className="relative max-w-[80vw] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        {/* Controls */}
        <div className="absolute -top-10 right-0 flex items-center gap-2">
          <button
            onClick={handleFullscreen}
            className="text-white/70 hover:text-white transition-colors p-1"
            title="Fullscreen"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Media */}
        {type === "image" ? (
          <img
            id="asset-preview-media"
            src={url}
            alt="Preview"
            className="max-w-full max-h-[80vh] rounded-lg object-contain"
          />
        ) : (
          <video
            id="asset-preview-media"
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] rounded-lg"
          />
        )}
      </div>
    </div>
  );
}
