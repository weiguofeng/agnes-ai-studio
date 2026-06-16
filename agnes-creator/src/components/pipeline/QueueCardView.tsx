"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { Video, Lock, Trash2, Eye, RefreshCw, Clock, Play, Users, Image } from "lucide-react";
import type { ProductionQueueItem } from "@/types";
import { PromptInlineEditor } from "./PromptInlineEditor";
import { AssetPreview } from "./AssetPreview";
import { VideoDurationSelector } from "./VideoDurationSelector";

interface QueueCardViewProps {
  items: ProductionQueueItem[];
  selectedIds: string[];
  onToggleSelect: (shotId: string) => void;
  onGenerateVideo: (shotId: string) => void;
  onRegenVideo: (shotId: string) => void;
  onLockVideo: (shotId: string) => void;
  onUnlockVideo: (shotId: string) => void;
  onDeleteVideo: (shotId: string) => void;
  onSavePrompt: (shotId: string, prompt: string) => void;
  getVideoUrl: (shotId: string) => string | undefined;
  onUpdateVideoDuration?: (shotId: string, frames: number) => void;
  /** V3.0: Map of shotId -> array of character image URLs */
  shotCharacterImages?: Record<string, string[]>;
  /** V3.0: Map of characterId -> character name */
  characterNames?: Record<string, string>;
  /** V3.0: Get character IDs for a shot */
  getShotCharacterIds?: (shotId: string) => string[];
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30", label: t("pipeline.statusPending") },
    generating: { color: "bg-blue-500/20 text-blue-600 border-blue-500/30", label: t("pipeline.statusGenerating") },
    regenerating_video: { color: "bg-blue-500/20 text-blue-600 border-blue-500/30", label: t("pipeline.statusGenerating") },
    completed: { color: "bg-green-500/20 text-green-600 border-green-500/30", label: t("pipeline.statusCompleted") },
    failed: { color: "bg-red-500/20 text-red-600 border-red-500/30", label: t("pipeline.statusFailed") },
    cancelled: { color: "bg-gray-500/20 text-gray-600 border-gray-500/30", label: t("pipeline.statusCancelled") },
    video_locked: { color: "bg-purple-500/20 text-purple-600 border-purple-500/30", label: t("pipeline.statusLocked") },
  };
  const c = config[status] || { color: "bg-gray-500/20 text-gray-600 border-gray-500/30", label: status };
  return <Badge variant="outline" className={`text-[10px] ${c.color}`}>{c.label}</Badge>;
}

function CharImageRow({
  images, charIds, characterNames, onPreview,
}: {
  images: string[];
  charIds: string[];
  characterNames?: Record<string, string>;
  onPreview: (url: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>{t("pipeline.charImagesInQueue")}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {images.map((url, idx) => {
          const charId = charIds[idx];
          const name = charId && characterNames?.[charId] ? characterNames[charId] : `#${idx + 1}`;
          return (
            <div
              key={`${charId || idx}`}
              className="group relative w-12 h-12 rounded-md border bg-muted overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => onPreview(url)}
              title={name}
            >
              <img
                src={url}
                alt={name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-0.5">
                <span className="text-[8px] text-white truncate block text-center leading-tight">
                  {name}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function QueueCardView({
  items, selectedIds, onToggleSelect, onGenerateVideo,
  onRegenVideo, onLockVideo, onUnlockVideo,
  onDeleteVideo, onSavePrompt, getVideoUrl,
  onUpdateVideoDuration, shotCharacterImages,
  characterNames, getShotCharacterIds,
}: QueueCardViewProps) {
  const { t } = useTranslation();
  const [previewType, setPreviewType] = useState<"video" | "image" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const renderActions = (item: ProductionQueueItem) => {
    const isVideoLocked = item.videoLocked || item.videoStatus === "video_locked";
    const hasVideo = item.videoResultUrl || item.videoStatus === "completed";
    const isVideoGenerating = item.videoStatus === "generating" || item.videoStatus === "regenerating_video";

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {hasVideo && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => {
            const url = getVideoUrl(item.shotId);
            if (url) { setPreviewType("video"); setPreviewUrl(url); }
          }}>
            <Eye className="h-3 w-3 mr-0.5" />{t("pipeline.viewVideo")}
          </Button>
        )}
        {!hasVideo && !isVideoGenerating && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onGenerateVideo(item.shotId)} disabled={isVideoGenerating}>
            <Video className="h-3 w-3 mr-0.5" />{t("pipeline.generateVideo")}
          </Button>
        )}
        {hasVideo && isVideoLocked && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onUnlockVideo(item.shotId)}>
            <Lock className="h-3 w-3 mr-0.5" />{t("pipeline.unlock")}
          </Button>
        )}
        {hasVideo && !isVideoLocked && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onLockVideo(item.shotId)}>
            <Lock className="h-3 w-3 mr-0.5" />{t("pipeline.lock")}
          </Button>
        )}
        {hasVideo && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => onRegenVideo(item.shotId)}>
            <RefreshCw className="h-3 w-3 mr-0.5" />{t("pipeline.regenerate")}
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
          const vidUrl = getVideoUrl(item.shotId);
          const fullPrompt = item.customPrompt || item.videoPrompt || item.imagePrompt || item.shotTitle || item.sceneTitle;
          const charImages = shotCharacterImages?.[item.shotId] || [];
          const charIds = getShotCharacterIds?.(item.shotId) || [];
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
                  <StatusBadge status={item.videoStatus} />
                </div>

                {/* Video preview - single full-width */}
                <div className="aspect-video rounded-md border bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => { if (vidUrl) { setPreviewType("video"); setPreviewUrl(vidUrl); } }}>
                  {vidUrl ? (
                    <video src={vidUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    <Video className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>

                {/* Character image thumbnails */}
                {charImages.length > 0 && (
                  <CharImageRow
                    images={charImages}
                    charIds={charIds}
                    characterNames={characterNames}
                    onPreview={(url) => { setPreviewType("image"); setPreviewUrl(url); }}
                  />
                )}

                <PromptInlineEditor
                  shotId={item.shotId}
                  initialPrompt={fullPrompt || ""}
                  defaultPrompt={fullPrompt || item.shotTitle || ""}
                  onSave={(prompt) => onSavePrompt(item.shotId, prompt)}
                />

                {/* Video duration selector */}
                {onUpdateVideoDuration && (
                  <VideoDurationSelector
                    currentFrames={item.videoDurationFrames}
                    onChange={(frames) => onUpdateVideoDuration(item.shotId, frames)}
                  />
                )}

                {(item.imageStartedAt || item.videoStartedAt) && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t("pipeline.duration")}:
                    {item.videoCompletedAt && item.videoStartedAt
                      ? `${Math.round((item.videoCompletedAt - item.videoStartedAt) / 1000)}s`
                      : item.videoStartedAt ? `${Math.round((Date.now() - item.videoStartedAt) / 1000)}s` : ""}
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
