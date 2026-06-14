"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { useEditorStore } from "@/stores/editorStore";
import { useStoryboardStore } from "@/stores/storyboardStore";
import { Play, Pause, Plus, Trash2, Film, Download, Import, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { StorageService } from "@/services/StorageService";
import { Upload, FileUp } from "lucide-react";

function TimelineClip({ clip, totalDuration, isSelected, onClick, onDelete }: any) {
  const pct = totalDuration > 0 ? (clip.duration / totalDuration) * 100 : 10;
  return (
    <div
      className={cn(
        "relative shrink-0 h-full rounded-md border cursor-pointer group transition-all",
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
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export default function EditorPage() {
  const { t } = useTranslation();
  const store = useEditorStore();
  const { timelines, activeTimelineId, setActiveTimeline, createTimeline, addClip, removeClip, getActiveTimeline } = store;
  const scenes = useStoryboardStore().scenes;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef(0);
  const startTimeRef = useRef(0);
  // Use refs so async callbacks always see up-to-date values
  const isPlayingRef = useRef(false);
  const playingLockedSrcRef = useRef<string | null>(null);
  const playingClipRef = useRef<{ clip: any; clipStart: number; clipOffset: number } | null>(null);

  const activeTimeline = getActiveTimeline();
  const totalDuration = activeTimeline?.clips.reduce((s, c) => s + c.duration, 0) || 0;

  // ---- Determine clip at a given time ----
  const getClipAtTime = useCallback((time: number) => {
    if (!activeTimeline) return null;
    let acc = 0;
    for (const clip of activeTimeline.clips) {
      if (time >= acc && time < acc + clip.duration) {
        return { clip, clipStart: acc, clipOffset: time - acc };
      }
      acc += clip.duration;
    }
    const last = activeTimeline.clips[activeTimeline.clips.length - 1];
    return last ? { clip: last, clipStart: acc - last.duration, clipOffset: last.duration } : null;
  }, [activeTimeline]);

  // ---- Currently displayed clip (preview / seek target) ----
  const displayClip = selectedClipId
    ? activeTimeline?.clips.find((c) => c.id === selectedClipId)
    : getClipAtTime(currentTime)?.clip || null;

  // ---- Effective video source: locked during playback, follows displayClip otherwise ----
  const effectiveVideoSrc = isPlaying && playingLockedSrcRef.current
    ? playingLockedSrcRef.current
    : (displayClip?.src || null);

  const effectiveVideoType = (isPlaying && playingClipRef.current)
    ? playingClipRef.current.clip.type
    : (displayClip?.type || "video");

  // ---- Play / Pause ----
  const handlePlayPause = () => {
    if (!activeTimeline || activeTimeline.clips.length === 0) return;

    if (isPlayingRef.current) {
      // Pause
      isPlayingRef.current = false;
      setIsPlaying(false);
      playingLockedSrcRef.current = null;
      playingClipRef.current = null;
      cancelAnimationFrame(animRef.current);
      if (videoRef.current) videoRef.current.pause();
      return;
    }

    // Start playing
    const match = getClipAtTime(currentTime);
    if (!match || !match.clip.src) return;

    isPlayingRef.current = true;
    playingLockedSrcRef.current = match.clip.src;
    playingClipRef.current = { clip: match.clip, clipStart: match.clipStart, clipOffset: match.clipOffset };
    setIsPlaying(true);

    if (match.clip.type !== "video") {
      fallbackPlay(currentTime);
      return;
    }

    // Video clip: the src is already set by React (effectiveVideoSrc = playingLockedSrcRef.current)
    const v = videoRef.current;
    if (!v) return;

    // Attempt to play. If the video hasn't loaded, the canplay handler will retry.
    v.currentTime = match.clipOffset || 0;
    v.play().catch((err: unknown) => {
      // Common reasons: video not loaded yet, or browser needs user gesture
      console.warn("[Editor] Initial play() failed:", err?.constructor?.name || err);
      // If it's a loading issue (NotSupportedError, AbortError), canplay will handle it
    });
  };

  // ---- Animation fallback for image clips ----
  const fallbackPlay = (fromTime: number) => {
    startTimeRef.current = performance.now() - fromTime * 1000;
    const loop = (now: number) => {
      if (!isPlayingRef.current) return;
      const e = (now - startTimeRef.current) / 1000;
      if (e >= totalDuration) {
        setCurrentTime(totalDuration);
        isPlayingRef.current = false;
        setIsPlaying(false);
        playingLockedSrcRef.current = null;
        playingClipRef.current = null;
        return;
      }
      setCurrentTime(e);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  };

  // ---- Video event: loaded & ready to play ----
  const handleVideoCanPlay = useCallback(() => {
    if (!isPlayingRef.current || !videoRef.current || !playingClipRef.current) return;
    // Ensure the video is at the correct position and playing
    videoRef.current.currentTime = playingClipRef.current.clipOffset || 0;
    videoRef.current.play().catch((err: unknown) => {
      console.warn("[Editor] canplay play() failed:", err?.constructor?.name || err);
    });
  }, []);

  // ---- Video event: timeupdate ----
  const handleTimeUpdate = useCallback(() => {
    if (!isPlayingRef.current || !videoRef.current || !playingClipRef.current) return;
    const pc = playingClipRef.current;
    const ct = videoRef.current.currentTime;
    const newTime = pc.clipStart + ct;
    setCurrentTime(Math.min(newTime, totalDuration));

    if (ct >= pc.clip.duration - 0.05 || newTime >= totalDuration - 0.01) {
      advanceToNextClip(pc.clipStart + pc.clip.duration);
    }
  }, [totalDuration]);

  // ---- Video event: ended ----
  const handleVideoEnded = useCallback(() => {
    if (!playingClipRef.current) return;
    advanceToNextClip(playingClipRef.current.clipStart + playingClipRef.current.clip.duration);
  }, []);

  // ---- Video event: error ----
  const handleVideoError = useCallback(() => {
    const ve = videoRef.current?.error;
    console.error("[Editor] Video error:", {
      code: ve?.code,
      message: ve?.message,
      src: videoRef.current?.currentSrc || videoRef.current?.src,
    });
  }, []);

  // ---- Advance to next clip ----
  const advanceToNextClip = useCallback((fromTime: number) => {
    if (!isPlayingRef.current) return;

    if (fromTime >= totalDuration - 0.01) {
      setCurrentTime(totalDuration);
      isPlayingRef.current = false;
      setIsPlaying(false);
      playingLockedSrcRef.current = null;
      playingClipRef.current = null;
      return;
    }
    const nextMatch = getClipAtTime(fromTime);
    if (!nextMatch || !nextMatch.clip.src) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      playingLockedSrcRef.current = null;
      playingClipRef.current = null;
      return;
    }
    playingClipRef.current = { clip: nextMatch.clip, clipStart: nextMatch.clipStart, clipOffset: 0 };
    playingLockedSrcRef.current = nextMatch.clip.src;
    setCurrentTime(fromTime);

    if (nextMatch.clip.type === "video" && videoRef.current) {
      videoRef.current.src = nextMatch.clip.src;
      videoRef.current.load();
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch((err: unknown) => {
        console.warn("[Editor] Next clip play():", err?.constructor?.name || err);
        isPlayingRef.current = false;
        setIsPlaying(false);
        playingLockedSrcRef.current = null;
        playingClipRef.current = null;
      });
    } else {
      isPlayingRef.current = false;
      setIsPlaying(false);
      playingLockedSrcRef.current = null;
      playingClipRef.current = null;
    }
  }, [totalDuration, getClipAtTime]);

  // ---- Seek ----
  const seekTo = (time: number) => {
    const t = Math.max(0, Math.min(time, totalDuration));
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      playingLockedSrcRef.current = null;
      playingClipRef.current = null;
      cancelAnimationFrame(animRef.current);
      if (videoRef.current) videoRef.current.pause();
    }
    setCurrentTime(t);
    if (videoRef.current) {
      const match = getClipAtTime(t);
      if (match && match.clip.type === "video" && match.clip.src) {
        videoRef.current.src = match.clip.src;
        videoRef.current.currentTime = match.clipOffset;
        videoRef.current.load();
      }
    }
  };

  // ---- Click clip ----
  const handleClipClick = (clipId: string) => {
    setSelectedClipId(clipId);
    if (!activeTimeline) return;
    let acc = 0;
    for (const clip of activeTimeline.clips) {
      if (clip.id === clipId) {
        seekTo(acc);
        return;
      }
      acc += clip.duration;
    }
  };

  // ---- Import scene ----
  const handleImportScene = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const timelineId = createTimeline({
      name: scene.title,
      projectId: scene.projectId || "",
      fps: 24, width: 1152, height: 768,
      duration: scene.shots.reduce((s: number, shot: any) => s + (shot.duration || 3), 0),
    });
    let currentStart = 0;
    for (const shot of scene.shots) {
      const dur = shot.duration || 3;
      addClip(timelineId, {
        timelineId,
        source: { type: "shot", id: shot.id },
        type: shot.resultUrl ? "video" : "image",
        title: shot.title || "Shot",
        startTime: currentStart,
        endTime: currentStart + dur,
        duration: dur,
        src: shot.resultUrl || undefined,
        properties: {},
      });
      currentStart += dur;
    }
    setSelectedClipId(null);
    setShowImport(false);
  };


  // ---- Batch import from files (drag & drop + multi-select) ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  
  const handleFileImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let tlId = activeTimelineId || createTimeline({
      name: "Import " + new Date().toLocaleTimeString(),
      projectId: "",
      fps: 24, width: 1152, height: 768,
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
        const result = await StorageService.saveAssetFromBlob({
          blob, type, projectId: "",
        });
        if (!result.success) continue;
        const url = URL.createObjectURL(blob);
        const dur = isVideo ? 5 : 3;
        addClip(tlId, {
          timelineId: tlId,
          source: { type: "asset", id: result.data?.id || "" },
          type,
          title: file.name,
          startTime: currentStart,
          endTime: currentStart + dur,
          duration: dur,
          src: url,
          properties: {},
        });
        currentStart += dur;
      } catch (e) {
        console.error("Import error:", e);
      }
    }
    setSelectedClipId(null);
    setShowImport(false);
  }, [activeTimelineId, createTimeline, addClip]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    handleFileImport(e.dataTransfer.files);
  }, [handleFileImport]);

  // ---- Cleanup ----
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
                    crossOrigin="anonymous"
                    onCanPlay={handleVideoCanPlay}
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
                {isPlaying && <span className="ml-2 text-green-400">▶ Playing</span>}
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
                  onValueChange={([v]) => seekTo(v)}
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
                  {activeTimeline.clips.map((clip: any) => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      totalDuration={totalDuration}
                      isSelected={selectedClipId === clip.id}
                      onClick={() => handleClipClick(clip.id)}
                      onDelete={() => { removeClip(activeTimeline.id, clip.id); setSelectedClipId(null); }}
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
            {/* File import zone */}
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"}`}
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={(e) => handleFileImport(e.target.files)}
                              />
                              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm font-medium">{t("editor.importLabel")}</p>
                              <p className="text-xs text-muted-foreground mt-1">Click or drag & drop images/videos</p>
                            </div>
                
                            {/* Separator */}
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or import from scenes</span></div>
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

