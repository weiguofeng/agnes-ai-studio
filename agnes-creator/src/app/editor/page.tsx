"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { useEditorStore } from "@/stores/editorStore";
import { useStoryboardStore } from "@/stores/storyboardStore";
import { Play, Pause, Plus, Trash2, Film, Download, Import, SkipBack, SkipForward, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { StorageService } from "@/services/StorageService";

type TimelineMatch = {
  clip: any;
  clipStart: number;
  clipOffset: number;
};

function TimelineClip({ clip, totalDuration, isSelected, onClick, onDelete, onDragStart, onDragOver, onDrop, index }: any) {
  const pct = totalDuration > 0 ? (clip.duration / totalDuration) * 100 : 10;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/clip-index", String(index));
        onDragStart?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(index);
      }}
      className={cn(
        "relative shrink-0 h-full rounded-md border cursor-grab active:cursor-grabbing group transition-all",
        isSelected ? "border-purple-400 bg-purple-500/20" : "border-white/10 bg-white/[0.06] hover:bg-white/[0.1]"
      )}
      style={{ width: Math.max(pct, 8) + "%", minWidth: "60px" }}
      onClick={onClick}
    >
      <div className="h-full flex flex-col items-center justify-center p-1">
        {clip.src ? (
          clip.type === "video" ? (
            <video src={clip.src} className="h-8 w-12 object-cover rounded" preload="metadata" />
          ) : (
            <img src={clip.src} alt="" className="h-8 w-12 object-cover rounded" />
          )
        ) : (
          <div className="h-8 w-12 rounded bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Film className="h-4 w-4 text-purple-400" />
          </div>
        )}
        <p className="text-[9px] text-muted-foreground truncate w-full text-center mt-1">{clip.title}</p>
        <span className="text-[8px] text-muted-foreground">{clip.duration.toFixed(1)}s</span>
      </div>
      <button
        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export default function EditorPage() {
  const { t } = useTranslation();
  const { activeTimelineId, createTimeline, addClip, removeClip, getActiveTimeline, reorderClips } = useEditorStore();
  const scenes = useStoryboardStore().scenes;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [dragClipIndex, setDragClipIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const playbackClipRef = useRef<TimelineMatch | null>(null);

  const activeTimeline = getActiveTimeline();
  const totalDuration = activeTimeline?.clips.reduce((sum, clip) => sum + clip.duration, 0) || 0;

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const getClipAtTime = useCallback((time: number): TimelineMatch | null => {
    if (!activeTimeline) return null;
    let accumulated = 0;

    for (const clip of activeTimeline.clips) {
      if (time >= accumulated && time < accumulated + clip.duration) {
        return { clip, clipStart: accumulated, clipOffset: time - accumulated };
      }
      accumulated += clip.duration;
    }

    const last = activeTimeline.clips[activeTimeline.clips.length - 1];
    return last ? { clip: last, clipStart: accumulated - last.duration, clipOffset: last.duration } : null;
  }, [activeTimeline]);

  const displayClip = isPlaying && playbackClipRef.current
    ? playbackClipRef.current.clip
    : selectedClipId
      ? activeTimeline?.clips.find((clip) => clip.id === selectedClipId)
      : getClipAtTime(currentTime)?.clip || null;

  const effectiveVideoSrc = displayClip?.src || null;
  const effectiveVideoType = displayClip?.type || "video";

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    playbackClipRef.current = null;
    setIsPlaying(false);
    cancelAnimationFrame(animRef.current);
    if (videoRef.current) videoRef.current.pause();
  }, []);

  const fallbackPlay = useCallback((fromTime: number) => {
    cancelAnimationFrame(animRef.current);
    startTimeRef.current = performance.now() - fromTime * 1000;

    const loop = (now: number) => {
      if (!isPlayingRef.current) return;
      const elapsed = (now - startTimeRef.current) / 1000;

      if (elapsed >= totalDuration) {
        currentTimeRef.current = totalDuration;
        setCurrentTime(totalDuration);
        isPlayingRef.current = false;
        playbackClipRef.current = null;
        setIsPlaying(false);
        return;
      }

      currentTimeRef.current = elapsed;
      setCurrentTime(elapsed);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
  }, [totalDuration]);

  const advanceToNextClip = useCallback((fromTime: number) => {
    if (!isPlayingRef.current) return;

    if (fromTime >= totalDuration - 0.01) {
      currentTimeRef.current = totalDuration;
      setCurrentTime(totalDuration);
      isPlayingRef.current = false;
      playbackClipRef.current = null;
      setIsPlaying(false);
      return;
    }

    const nextMatch = getClipAtTime(fromTime);
    if (!nextMatch?.clip.src) {
      stopPlayback();
      return;
    }

    playbackClipRef.current = { ...nextMatch, clipOffset: 0 };
    currentTimeRef.current = fromTime;
    setSelectedClipId(null);
    setCurrentTime(fromTime);

    if (nextMatch.clip.type !== "video") {
      fallbackPlay(fromTime);
    }
  }, [fallbackPlay, getClipAtTime, stopPlayback, totalDuration]);

  useEffect(() => {
    if (!videoRef.current || effectiveVideoType !== "video") return;

    const match = isPlayingRef.current
      ? playbackClipRef.current
      : getClipAtTime(currentTimeRef.current);

    if (!match || match.clip.src !== effectiveVideoSrc) return;

    videoRef.current.currentTime = Math.min(match.clipOffset || 0, Math.max(match.clip.duration - 0.05, 0));

    if (isPlayingRef.current) {
      videoRef.current.play().catch((err: unknown) => {
        console.warn("[Editor] play current clip failed:", err?.constructor?.name || err);
        stopPlayback();
      });
    }
  }, [effectiveVideoSrc, effectiveVideoType, getClipAtTime, stopPlayback]);

  const handlePlayPause = () => {
    if (!activeTimeline || activeTimeline.clips.length === 0) return;

    if (isPlayingRef.current) {
      stopPlayback();
      return;
    }

    const match = getClipAtTime(currentTimeRef.current);
    if (!match?.clip.src) return;

    isPlayingRef.current = true;
    playbackClipRef.current = match;
    setSelectedClipId(null);
    setIsPlaying(true);

    if (match.clip.type !== "video") {
      fallbackPlay(currentTimeRef.current);
      return;
    }

    if (videoRef.current && videoRef.current.currentSrc === match.clip.src) {
      videoRef.current.currentTime = match.clipOffset || 0;
      videoRef.current.play().catch((err: unknown) => {
        console.warn("[Editor] Initial play() failed:", err?.constructor?.name || err);
        stopPlayback();
      });
    }
  };

  const handleTimeUpdate = useCallback(() => {
    if (!isPlayingRef.current || !videoRef.current) return;
    const match = playbackClipRef.current;
    if (!match) return;

    const videoTime = videoRef.current.currentTime;
    const nextTimelineTime = Math.min(match.clipStart + videoTime, totalDuration);
    currentTimeRef.current = nextTimelineTime;
    setCurrentTime(nextTimelineTime);

    if (videoTime >= match.clip.duration - 0.05 || nextTimelineTime >= totalDuration - 0.01) {
      advanceToNextClip(match.clipStart + match.clip.duration);
    }
  }, [advanceToNextClip, totalDuration]);

  const handleVideoEnded = useCallback(() => {
    const match = playbackClipRef.current;
    if (match) advanceToNextClip(match.clipStart + match.clip.duration);
  }, [advanceToNextClip]);

  const handleVideoError = useCallback(() => {
    const videoError = videoRef.current?.error;
    if (!videoError && !videoRef.current?.src) return;
    console.warn("[Editor] Video error:", {
      code: videoError?.code,
      message: videoError?.message,
      src: videoRef.current?.currentSrc || videoRef.current?.src,
    });
  }, []);

  const seekTo = (time: number) => {
    const targetTime = Math.max(0, Math.min(time, totalDuration));
    if (isPlayingRef.current) stopPlayback();

    currentTimeRef.current = targetTime;
    setCurrentTime(targetTime);

    const match = getClipAtTime(targetTime);
    if (videoRef.current && match?.clip.type === "video") {
      videoRef.current.currentTime = Math.min(match.clipOffset || 0, Math.max(match.clip.duration - 0.05, 0));
    }
  };

  const handleClipClick = (clipId: string) => {
    setSelectedClipId(clipId);
    if (!activeTimeline) return;

    let accumulated = 0;
    for (const clip of activeTimeline.clips) {
      if (clip.id === clipId) {
        seekTo(accumulated);
        return;
      }
      accumulated += clip.duration;
    }
  };

  const handleTimelineDragStart = useCallback((index: number) => {
    setDragClipIndex(index);
  }, []);

  const handleTimelineDragOver = useCallback((index: number) => {
    setDropTargetIndex(index);
  }, []);

  const handleTimelineDrop = useCallback((targetIndex: number) => {
    if (dragClipIndex === null || !activeTimeline) return;
    if (dragClipIndex === targetIndex) {
      setDragClipIndex(null);
      setDropTargetIndex(null);
      return;
    }

    const clips = [...activeTimeline.clips];
    const [moved] = clips.splice(dragClipIndex, 1);
    clips.splice(targetIndex, 0, moved);
    reorderClips(activeTimeline.id, clips.map((clip) => clip.id));
    setDragClipIndex(null);
    setDropTargetIndex(null);
  }, [activeTimeline, dragClipIndex, reorderClips]);

  const handleImportScene = (sceneId: string) => {
    const scene = scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) return;

    const timelineId = createTimeline({
      name: scene.title,
      projectId: scene.projectId || "",
      fps: 24,
      width: 1152,
      height: 768,
      duration: scene.shots.reduce((sum: number, shot: any) => sum + (shot.duration || 3), 0),
    });

    let currentStart = 0;
    for (const shot of scene.shots) {
      const duration = shot.duration || 3;
      addClip(timelineId, {
        timelineId,
        source: { type: "shot", id: shot.id },
        type: shot.resultUrl ? "video" : "image",
        title: shot.title || "Shot",
        startTime: currentStart,
        endTime: currentStart + duration,
        duration,
        src: shot.resultUrl || undefined,
        properties: {},
      });
      currentStart += duration;
    }

    setSelectedClipId(null);
    setShowImport(false);
  };

  const handleFileImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const timelineId = activeTimelineId || createTimeline({
      name: "Import " + new Date().toLocaleTimeString(),
      projectId: "",
      fps: 24,
      width: 1152,
      height: 768,
      duration: 0,
    });

    let currentStart = 0;
    for (const file of Array.from(files)) {
      try {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) continue;

        const type = isVideo ? "video" : "image";
        const blob = new Blob([file], { type: file.type });
        const result = await StorageService.saveAssetFromBlob({ blob, type, projectId: "" });
        if (!result.success) continue;

        const url = URL.createObjectURL(blob);
        const duration = isVideo ? 5 : 3;
        addClip(timelineId, {
          timelineId,
          source: { type: "asset", id: result.data?.id || "" },
          type,
          title: file.name,
          startTime: currentStart,
          endTime: currentStart + duration,
          duration,
          src: url,
          properties: {},
        });
        currentStart += duration;
      } catch (error) {
        console.error("Import error:", error);
      }
    }

    setSelectedClipId(null);
    setShowImport(false);
  }, [activeTimelineId, addClip, createTimeline]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    handleFileImport(event.dataTransfer.files);
  }, [handleFileImport]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <AppShell>
      <div className="p-6 space-y-4 h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold">{t("editor.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("editor.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Import className="h-4 w-4 mr-1" />
              {t("editor.import")}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              {t("editor.export")}
            </Button>
          </div>
        </div>

        {!activeTimeline ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="p-8 text-center bg-white/[0.03] border-white/10 max-w-md">
              <Film className="h-16 w-16 mx-auto mb-4 text-purple-400/60" />
              <h2 className="text-lg font-semibold mb-2">{t("editor.noTimeline")}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t("editor.noTimelineDesc")}</p>
              <Button onClick={() => setShowImport(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t("editor.createTimeline")}
              </Button>
            </Card>
          </div>
        ) : (
          <>
            <Card className="flex-1 relative overflow-hidden bg-black/40 border-white/5 flex items-center justify-center">
              {effectiveVideoSrc ? (
                effectiveVideoType === "video" ? (
                  <video
                    ref={videoRef}
                    src={effectiveVideoSrc}
                    className="max-h-full max-w-full object-contain"
                    preload="auto"
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                    onError={handleVideoError}
                  />
                ) : (
                  <img src={effectiveVideoSrc} alt="" className="max-h-full max-w-full object-contain" />
                )
              ) : (
                <div className="text-center text-muted-foreground">
                  <Film className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t("editor.selectClip")}</p>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-xs text-white/80">
                {activeTimeline.width}x{activeTimeline.height} @ {activeTimeline.fps}fps
                {isPlaying && <span className="ml-2 text-green-400">{t("editor.playing")}</span>}
              </div>
            </Card>

            <div className="flex items-center gap-3 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => seekTo(0)}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-8 w-8"
                onClick={handlePlayPause}
                disabled={!activeTimeline || activeTimeline.clips.length === 0}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => seekTo(totalDuration)}>
                <SkipForward className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-20 tabular-nums">
                {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
              </span>
              <div className="flex-1">
                <Slider
                  value={[currentTime]}
                  max={Math.max(totalDuration, 1)}
                  step={0.1}
                  onValueChange={([value]) => seekTo(value)}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="h-32 shrink-0">
              {activeTimeline.clips.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground rounded-lg border border-dashed border-white/10 text-sm">
                  {t("editor.noClips")}
                </div>
              ) : (
                <div className="h-full flex gap-1 overflow-x-auto pb-2">
                  {activeTimeline.clips.map((clip: any, index: number) => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      totalDuration={totalDuration}
                      isSelected={selectedClipId === clip.id}
                      index={index}
                      onClick={() => handleClipClick(clip.id)}
                      onDelete={() => {
                        removeClip(activeTimeline.id, clip.id);
                        setSelectedClipId(null);
                      }}
                      onDragStart={() => handleTimelineDragStart(index)}
                      onDragOver={() => handleTimelineDragOver(index)}
                      onDrop={() => handleTimelineDrop(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Dialog open={showImport} onOpenChange={setShowImport}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("editor.sceneImport")}</DialogTitle>
            </DialogHeader>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => handleFileImport(event.target.files)}
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{t("editor.importLabel")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("editor.fileImportHint")}</p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t("editor.sceneImportSeparator")}</span>
              </div>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {scenes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("editor.noScenes")}</p>
              ) : (
                scenes.map((scene) => (
                  <Card
                    key={scene.id}
                    className="p-3 bg-white/[0.03] border-white/5 cursor-pointer hover:bg-white/[0.06]"
                    onClick={() => handleImportScene(scene.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{scene.title}</p>
                        <p className="text-xs text-muted-foreground">{scene.shots.length} {t("storyboard.shots")}</p>
                      </div>
                      <span className="text-xs">{t("editor.importLabel")}</span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
