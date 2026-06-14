"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { Image, Video, Lock, Trash2, Eye, RefreshCw, Clock, Play } from "lucide-react";
import type { ProductionQueueItem } from "@/types";
import { PromptInlineEditor } from "./PromptInlineEditor";
import { AssetPreview } from "./AssetPreview";

interface QueueCardViewProps {
  items: ProductionQueueItem[];
  selectedIds: string[];
  onToggleSelect: (shotId: string) => void;
  onGenerateImage: (shotId: string) => void;
  onGenerateVideo: (shotId: string) => void;
  onRegenImage: (shotId: string) => void;
  onRegenVideo: (shotId: string) => void;
  onLockImage: (shotId: string) => void;
  onUnlockImage: (shotId: string) => void;
  onLockVideo: (shotId: string) => void;
  onUnlockVideo: (shotId: string) => void;
  onDeleteImage: (shotId: string) => void;
  onDeleteVideo: (shotId: string) => void;
  onSavePrompt: (shotId: string, prompt: string) => void;
  getImageUrl: (shotId: string) => string | undefined;
  getVideoUrl: (shotId: string) => string | undefined;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30", label: t("pipeline.statusPending") },
    generating: { color: "bg-blue-500/20 text-blue-600 border-blue-500/30", label: t("pipeline.statusGenerating") },
    regenerating_image: { color: "bg-blue-500/20 text-blue-600 border-blue-500/30", label: t("pipeline.statusGenerating") },
    regenerating_video: { color: "bg-blue-500/20 text-blue-600 border-blue-500/30", label: t("pipeline.statusGenerating") },
    completed: { color: "bg-green-500/20 text-green-600 border-green-500/30", label: t("pipeline.statusCompleted") },
    failed: { color: "bg-red-500/20 text-red-600 border-red-500/30", label: t("pipeline.statusFailed") },
    cancelled: { color: "bg-gray-500/20 text-gray-600 border-gray-500/30", label: t("pipeline.statusCancelled") },
    image_locked: { color: "bg-purple-500/20 text-purple-600 border-purple-500/30", label: t("pipeline.statusLocked") },
    video_locked: { color: "bg-purple-500/20 text-purple-600 border-purple-500/30", label: t("pipeline.statusLocked") },
  };
  const c = config[status] || { color: "bg-gray-500/20 text-gray-600 border-gray-500/30", label: status };
  return <Badge variant="outline" className={`text-[10px] ${c.color}`}>{c.label}</Badge>;
}

export function QueueCardView({
  items, selectedIds, onToggleSelect, onGenerateImage, onGenerateVideo,
  onRegenImage, onRegenVideo, onLockImage, onUnlockImage, onLockVideo, onUnlockVideo,
  onDeleteImage, onDeleteVideo, onSavePrompt, getImageUrl, getVideoUrl,
}: QueueCardViewProps) {
  const { t } = useTranslation();
  const [previewType, setPreviewType] = useState<"image" | "video" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const renderActions = (item: ProductionQueueItem) => {
    const isImageLocked = item.imageLocked || item.imageStatus === "image_locked";
    const isVideoLocked = item.videoLocked || item.videoStatus === "video_locked";
    const hasImage = item.imageResultUrl || item.imageStatus === "completed";
    const hasVideo = item.videoResultUrl || item.videoStatus === "completed";
    const isImageGenerating = item.imageStatus === "generating" || item.imageStatus === "regenerating_image";
    const isVideoGenerating = item.videoStatus === "generating" || item.videoStatus === "regenerating_video";

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {hasImage && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => {
            const url = getImageUrl(item.shotId);
            if (url) { setPreviewType("image"); setPreviewUrl(url); }
          }}>
            <Eye className="h-3 w-3 mr-0.5" />{t("pipeline.viewImage")}
          </Button>
        )}
        {hasVideo && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => {
            const url = getVideoUrl(item.shotId);
            if (url) { setPreviewType("video"); setPreviewUrl(url); }
          }}>
            <Play className="h-3 w-3 mr-0.5" />{t("pipeline.viewVideo")}
          </Button>
        )}
        {!hasImage && !isImageGenerating && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onGenerateImage(item.shotId)}>
            <Image className="h-3 w-3 mr-0.5" />{t("pipeline.generateImage")}
          </Button>
        )}
        {hasImage && !isImageGenerating && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onRegenImage(item.shotId)}>
            <RefreshCw className="h-3 w-3 mr-0.5" />{t("pipeline.regenImage")}
          </Button>
        )}
        {hasImage && !hasVideo && !isVideoGenerating && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onGenerateVideo(item.shotId)}>
            <Video className="h-3 w-3 mr-0.5" />{t("pipeline.generateVideo")}
          </Button>
        )}
        {hasVideo && !isVideoGenerating && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onRegenVideo(item.shotId)}>
            <RefreshCw className="h-3 w-3 mr-0.5" />{t("pipeline.regenVideo")}
          </Button>
        )}
        {isImageLocked ? (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onUnlockImage(item.shotId)}>
            <Lock className="h-3 w-3 mr-0.5" />{t("pipeline.unlockImage")}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onLockImage(item.shotId)}>
            <Lock className="h-3 w-3 mr-0.5" />{t("pipeline.lockImage")}
          </Button>
        )}
        {hasVideo && (isVideoLocked ? (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onUnlockVideo(item.shotId)}>
            <Lock className="h-3 w-3 mr-0.5" />{t("pipeline.unlockVideo")}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onLockVideo(item.shotId)}>
            <Lock className="h-3 w-3 mr-0.5" />{t("pipeline.lockVideo")}
          </Button>
        ))}
        {hasImage && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-red-500" onClick={() => onDeleteImage(item.shotId)}>
            <Trash2 className="h-3 w-3 mr-0.5" />{t("pipeline.deleteImage")}
          </Button>
        )}
        {hasVideo && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-red-500" onClick={() => onDeleteVideo(item.shotId)}>
            <Trash2 className="h-3 w-3 mr-0.5" />{t("pipeline.deleteVideo")}
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const imgUrl = getImageUrl(item.shotId);
          const vidUrl = getVideoUrl(item.shotId);
          const fullPrompt = item.customPrompt || item.videoPrompt || item.imagePrompt || item.shotTitle || item.sceneTitle;
          return (
            <Card key={item.shotId} className={`relative ${selectedIds.includes(item.shotId) ? "ring-2 ring-primary" : ""}`}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.shotId)}
                      onChange={() => onToggleSelect(item.shotId)}
                      className="h-3.5 w-3.5 mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-mono text-muted-foreground">
                        Sc{item.sceneOrder}-Sh{item.shotOrder}
                      </span>
                      <div className="text-xs font-medium truncate max-w-[120px]">{item.shotTitle || item.sceneTitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={item.imageStatus} />
                    <StatusBadge status={item.videoStatus} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 aspect-video rounded-md border bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => { if (imgUrl) { setPreviewType("image"); setPreviewUrl(imgUrl); } }}>
                    {imgUrl ? (
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Image className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 aspect-video rounded-md border bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => { if (vidUrl) { setPreviewType("video"); setPreviewUrl(vidUrl); } }}>
                    {vidUrl ? (
                      <video src={vidUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <Video className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                </div>

                <PromptInlineEditor
                  shotId={item.shotId}
                  initialPrompt={fullPrompt || ""}
                  defaultPrompt={fullPrompt || item.shotTitle || ""}
                  onSave={(prompt) => onSavePrompt(item.shotId, prompt)}
                />

                {(item.imageStartedAt || item.videoStartedAt) && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t("pipeline.duration")}:
                    {item.imageCompletedAt && item.imageStartedAt
                      ? `${Math.round((item.imageCompletedAt - item.imageStartedAt) / 1000)}s`
                      : item.imageStartedAt ? `${Math.round((Date.now() - item.imageStartedAt) / 1000)}s` : ""}
                  </div>
                )}

                {renderActions(item)}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {previewType && previewUrl && (
        <AssetPreview
          type={previewType}
          url={previewUrl}
          onClose={() => { setPreviewType(null); setPreviewUrl(""); }}
        />
      )}
    </>
  );
}
