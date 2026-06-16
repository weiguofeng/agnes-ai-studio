"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Download, CheckCircle2, Loader2, Sparkles, Users, FileJson, FileText, Archive, LayoutDashboard,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { useProjectStore } from "@/stores/projectStore";
import { useProductionQueue } from "@/stores/productionQueueStore";
import { agnes } from "@/services/agnes";
import { useConfigStore } from "@/stores/configStore";
import { logger } from "@/lib/logger";
import { useCharacterStore } from "@/stores/characterStore";
import { useEditorStore } from "@/stores/editorStore";
import { StorageService } from "@/services/StorageService";
import { parseStoryToScenes, generateAllPromptPacks, generatePromptPack } from "@/lib/promptPackGenerator";
import { downloadImageWithRetry, mapErrorToProductionStatus } from "@/services/pipelineImageDownloader";
import { ErrorClassifier } from "@/services/errorClassifier";
import type { Scene, Shot, Character, PromptPack, ProjectExport, ShotType } from "@/types";
import { startAutoSave, stopAutoSave, getLastSavedAt, markDirty } from "@/services/ProjectAutoSaveService";
import { usePromptHistoryStore } from "@/stores/promptHistoryStore";
import { useTaskStore } from "@/stores/taskStore";
import { StoryboardPreview } from "@/components/pipeline/StoryboardPreview";
import { CharacterImageSection } from "@/components/pipeline/CharacterImageSection";
import { compositeImages } from "@/lib/imageCompositor";
import { StatisticsPanel } from "@/components/pipeline/StatisticsPanel";
import { QueueCardView } from "@/components/pipeline/QueueCardView";
import { BatchOperations } from "@/components/pipeline/BatchOperations";
import { TimelineImport } from "@/components/pipeline/TimelineImport";
import { StorageMonitor } from "@/components/pipeline/StorageMonitor";
import { ProductionModeToggle } from "@/components/pipeline/ProductionModeToggle";
import { CurrentTasksWidget } from "@/components/pipeline/CurrentTasksWidget";
import { VideoDurationSelector } from "@/components/pipeline/VideoDurationSelector";

function isLikelyShortPrompt(prompt: string | undefined, shotTitle?: string): boolean {
  const value = (prompt || "").trim();
  if (!value) return true;
  if (shotTitle && value === shotTitle.trim()) return true;
  return value.length < 80 && /^(Shot|Shot)\s*\d*[:]/i.test(value) && value.endsWith("...");
}

function ProductionQueuePanel({ project, characters }: { project: any; characters: Character[] }) {
  const { t } = useTranslation();
  const queue = useProductionQueue();
  const config = useConfigStore();
  const editorStore = useEditorStore();
  const [processingVideos, setProcessingVideos] = useState<Set<string>>(new Set());
  const videoAbortControllers = useRef<Map<string, AbortController>>(new Map());
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  const projectScenes = useMemo(() => project.scenes || [], [project.scenes]);
  const projectItems = useMemo(() => queue.getProjectItems(project.id), [queue, project.id]);

  // V3.0: Build shot -> character image URLs mapping
  const shotCharacterImages = useMemo(() => {
    const mapping: Record<string, string[]> = {};
    const charImages: Record<string, string> = (project as any).characterImages || {};
    for (const scene of projectScenes) {
      for (const shot of scene.shots) {
        const charIds: string[] = (shot as any).characterIds || [];
        const urls = charIds.map((cid: string) => charImages[cid]).filter((url: string | undefined): url is string => !!url);
        if (urls.length > 0) {
          mapping[shot.id] = urls;
        }
      }
    }
    return mapping;
  }, [projectScenes, project]);

  // V3.0: Build characterId -> character name mapping
  const characterNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const c of characters) {
      names[c.id] = c.name;
    }
    return names;
  }, [characters]);

  // V3.0: Get character IDs for a shot
  const getShotCharacterIds = useCallback((shotId: string): string[] => {
    for (const scene of projectScenes) {
      for (const shot of scene.shots) {
        if (shot.id === shotId) {
          return (shot as any).characterIds || [];
        }
      }
    }
    return [];
  }, [projectScenes]);

  const selectedIds = queue.selectedShotIds;

  useEffect(() => {
    const vidMap: Record<string, string> = {};
    for (const item of projectItems) {
      if (item.videoResultUrl) vidMap[item.shotId] = item.videoResultUrl;
    }
    setVideoUrls((prev) => {
      const prevKeys = JSON.stringify(prev);
      const newKeys = JSON.stringify(vidMap);
      return prevKeys === newKeys ? prev : vidMap;
    });
  }, [projectItems]);

  const getVideoUrl = useCallback((shotId: string): string | undefined => videoUrls[shotId], [videoUrls]);

  const getVideoPrompt = useCallback((item: any): string => item.customPrompt || item.videoPrompt || item.imagePrompt || item.shotTitle || item.sceneTitle || "", []);

  const handleGenerateVideo = useCallback(async (shotId: string) => {
    if (processingVideos.has(shotId)) return;
    setProcessingVideos((prev) => new Set(prev).add(shotId));
    const abortController = new AbortController();
    videoAbortControllers.current.set(shotId, abortController);
    let localTaskId = "";
    try {
      const item = projectItems.find((i) => i.shotId === shotId);
      if (!item || item.videoLocked) return;
      const shotScene = projectScenes.find((sc: any) => sc.shots.some((sh: any) => sh.id === shotId));
      const shotData = shotScene?.shots.find((sh: any) => sh.id === shotId);
      const charIds: string[] = shotData?.characterIds || [];
      const charImages: Record<string, string> = (project as any).characterImages || {};
      // Map char IDs to actual image URLs; filter out chars without images
      const charImageUrls = charIds
        .filter((cid: string) => charImages[cid])
        .map((cid: string) => charImages[cid]);
      const hasMultiCharImages = charImageUrls.length > 1;
      const hasSingleCharImage = charImageUrls.length === 1;
      let imageSource: string | string[] | undefined;
      // Determine source image(s) - pass URLs directly, API fetches them server-side
      if (hasMultiCharImages) {
        // Multi-character shot: pass all character image URLs as array
        imageSource = charImageUrls;
      } else if (hasSingleCharImage) {
        // Single character shot: use character image URL
        imageSource = charImageUrls[0];
      } else if (item.imageResultUrl) {
        // Legacy fallback: use existing image result URL
        imageSource = item.imageResultUrl;
      }
      if (!imageSource) { queue.updateVideoStatus(shotId, "failed", undefined, undefined, t("pipeline.videoRequiresImage")); return; }
      queue.updateVideoStatus(shotId, "generating");
      const prompt = getVideoPrompt(item);
      const numFrames = item.videoDurationFrames || 121;
      localTaskId = useTaskStore.getState().addTask({id: "pipeline-video-" + shotId + "-" + Date.now(),taskId: "",type: "image-to-video",model: config.imageToVideoModel || "agnes-video-v2.0",prompt,status: "uploading",progress: 0,resultUrl: "",thumbnail: typeof imageSource === "string" ? imageSource : (Array.isArray(imageSource) ? imageSource[0] || "" : ""),errorMessage: "",params: { projectId: project.id, shotId, numFrames }});
      useTaskStore.getState().updateTask(localTaskId, { status: "submitted" });      useTaskStore.getState().updateTask(localTaskId, { status: 'submitted' });
      const videoTask = await agnes.video.createFromImage({ image: imageSource, prompt, model: config.imageToVideoModel || 'agnes-video-v2.0', numFrames });
      if (videoTask && videoTask.taskId) {
        var pollId = videoTask.videoId || videoTask.taskId;
        queue.updateVideoStatus(shotId, 'generating', pollId);
        useTaskStore.getState().updateTask(localTaskId, { taskId: pollId, status: 'processing', params: { projectId: project.id, shotId, taskId: videoTask.taskId, videoId: videoTask.videoId, numFrames } });
        var videoResult = await agnes.video.poll(pollId, { signal: abortController.signal, onProgress: function(progress) { queue.updateVideoStatus(shotId, 'generating', pollId); useTaskStore.getState().updateTask(localTaskId, { status: 'processing', progress: progress.progress }); } });
        queue.updateVideoStatus(shotId, 'completed', pollId, videoResult.url);
        useTaskStore.getState().updateTask(localTaskId, { status: 'completed', progress: 100, resultUrl: videoResult.url });
        markDirty();
        setVideoUrls(function(prev) { var o: Record<string, string> = {}; for (var k in prev) o[k] = prev[k]; o[shotId] = videoResult.url; return o; });
        try { await StorageService.saveAssetFromUrl({ url: videoResult.url, type: 'video', projectId: project.id, shotId }); } catch (e) {}
      } else { queue.updateVideoStatus(shotId, 'failed', undefined, undefined, t('pipeline.noVideoTaskCreated')); useTaskStore.getState().updateTask(localTaskId, { status: 'failed', errorMessage: t('pipeline.noVideoTaskCreated') }); }
    } catch (err) {
      if (abortController.signal.aborted) { queue.updateVideoStatus(shotId, 'cancelled', undefined, undefined, t('pipeline.taskCancelled')); if (localTaskId) useTaskStore.getState().updateTask(localTaskId, { status: 'cancelled', errorMessage: t('pipeline.taskCancelled') }); return; }
      var classified = ErrorClassifier.classify(err);
      queue.updateVideoStatus(shotId, 'failed', undefined, undefined, classified.type + ': ' + classified.userMessage);
      if (localTaskId) useTaskStore.getState().updateTask(localTaskId, { status: 'failed', errorMessage: classified.type + ': ' + classified.userMessage });
    } finally { videoAbortControllers.current.delete(shotId); setProcessingVideos(function(prev) { var n = new Set(prev); n.delete(shotId); return n; }); }
  }, [processingVideos, projectItems, queue, config.imageToVideoModel, project.id, getVideoPrompt, t, projectScenes]);

  const handleSavePrompt = useCallback((shotId: string, prompt: string) => {
    queue.updatePrompt(shotId, prompt);
    usePromptHistoryStore.getState().saveVersion(shotId, prompt);
    markDirty();
  }, [queue]);

  const handleUpdateVideoDuration = useCallback((shotId: string, frames: number) => {
    queue.updateItem(shotId, { videoDurationFrames: frames });
  }, [queue]);

  /** Check if a shot has a usable source image (character image or legacy result) */
  const hasVideoSourceImage = useCallback((shotId: string): boolean => {
    const item = projectItems.find((i) => i.shotId === shotId);
    if (!item) return false;
    if (item.imageResultUrl) return true;
    // Check character images
    const shotScene = projectScenes.find((sc: any) => sc.shots.some((sh: any) => sh.id === shotId));
    if (!shotScene) return false;
    const shotData = shotScene.shots.find((sh: any) => sh.id === shotId);
    if (!shotData) return false;
    const charIds: string[] = shotData.characterIds || [];
    const charImages: Record<string, string> = (project as any).characterImages || {};
    return charIds.some((cid: string) => charImages[cid]);
  }, [projectItems, projectScenes, project]);

  const handleBatchGenerateVideos = useCallback(() => {
    const runnableIds = selectedIds.filter((sid) => {
      const item = projectItems.find((i) => i.shotId === sid);
      if (!item || item.videoLocked) return false;
      if (!hasVideoSourceImage(sid)) {
        queue.updateVideoStatus(sid, "failed", undefined, undefined, t("pipeline.videoRequiresImage"));
        return false;
      }
      return true;
    });
    for (const sid of runnableIds) handleGenerateVideo(sid);
    queue.deselectAllShots();
  }, [selectedIds, projectItems, handleGenerateVideo, queue, t, hasVideoSourceImage]);
  const handleBatchPause = useCallback(() => {
    for (const shotId of selectedIds) {
      videoAbortControllers.current.get(shotId)?.abort();
      const activeTasks = useTaskStore.getState().tasks.filter((task) => task.params?.shotId === shotId && !["completed", "failed", "timeout", "cancelled"].includes(task.status));
      for (const task of activeTasks) useTaskStore.getState().updateTask(task.id, { status: "cancelled", errorMessage: t("pipeline.taskCancelled") });
      const item = projectItems.find((candidate) => candidate.shotId === shotId);
      if (item?.videoStatus === "generating" || item?.videoStatus === "regenerating_video") {
        queue.updateVideoStatus(shotId, "cancelled", undefined, undefined, t("pipeline.taskCancelled"));
      }
    }
    queue.batchPause(selectedIds);
    queue.deselectAllShots();
  }, [selectedIds, projectItems, queue, t]);
  const handleBatchResume = useCallback(() => { queue.batchResume(selectedIds); queue.deselectAllShots(); }, [selectedIds, queue]);
  const handleBatchDelete = useCallback(() => { queue.batchDelete(selectedIds); queue.deselectAllShots(); }, [selectedIds, queue]);
  const handleBatchLock = useCallback(() => { queue.batchLock(selectedIds); queue.deselectAllShots(); }, [selectedIds, queue]);

  const handleBatchImportTimeline = useCallback(() => {
    const timelineId = editorStore.activeTimelineId;
    if (!timelineId) return;
    for (const sid of selectedIds) {
      const item = projectItems.find((i) => i.shotId === sid);
      if (item?.videoResultUrl) {
        editorStore.addClip(timelineId, {
          timelineId, source: { type: "shot", id: sid }, type: "video",
          title: item.shotTitle || `Shot ${item.shotOrder}`, startTime: 0, endTime: 5, duration: 5,
          src: item.videoResultUrl, thumbnailUrl: item.imageResultUrl, properties: {},
        });
      }
    }
    queue.deselectAllShots();
  }, [selectedIds, projectItems, editorStore, queue]);

  const handleImportAll = useCallback(() => {
    const timelineId = editorStore.activeTimelineId;
    if (!timelineId) return;
    for (const item of projectItems) {
      if (item.videoResultUrl) {
        editorStore.addClip(timelineId, {
          timelineId, source: { type: "shot", id: item.shotId }, type: "video",
          title: item.shotTitle || `Shot ${item.shotOrder}`, startTime: 0, endTime: 5, duration: 5,
          src: item.videoResultUrl, thumbnailUrl: item.imageResultUrl, properties: {},
        });
      }
    }
  }, [projectItems, editorStore]);

  const handleImportLocked = useCallback(() => {
    const timelineId = editorStore.activeTimelineId;
    if (!timelineId) return;
    for (const item of projectItems) {
      if (item.videoResultUrl && item.videoLocked) {
        editorStore.addClip(timelineId, {
          timelineId, source: { type: "shot", id: item.shotId }, type: "video",
          title: item.shotTitle || `Shot ${item.shotOrder}`, startTime: 0, endTime: 5, duration: 5,
          src: item.videoResultUrl, thumbnailUrl: item.imageResultUrl, properties: {},
        });
      }
    }
  }, [projectItems, editorStore]);

  const handleImportScene = useCallback((sceneId: string) => {
    const timelineId = editorStore.activeTimelineId;
    if (!timelineId) return;
    for (const item of projectItems) {
      if (item.sceneId === sceneId && item.videoResultUrl) {
        editorStore.addClip(timelineId, {
          timelineId, source: { type: "shot", id: item.shotId }, type: "video",
          title: item.shotTitle || `Shot ${item.shotOrder}`, startTime: 0, endTime: 5, duration: 5,
          src: item.videoResultUrl, thumbnailUrl: item.imageResultUrl, properties: {},
        });
      }
    }
  }, [projectItems, editorStore]);

  const handleImportShot = useCallback((shotId: string) => {
    const timelineId = editorStore.activeTimelineId;
    if (!timelineId) return;
    const item = projectItems.find((i) => i.shotId === shotId);
    if (item?.videoResultUrl) {
      editorStore.addClip(timelineId, {
        timelineId, source: { type: "shot", id: item.shotId }, type: "video",
        title: item.shotTitle || `Shot ${item.shotOrder}`, startTime: 0, endTime: 5, duration: 5,
        src: item.videoResultUrl, thumbnailUrl: item.imageResultUrl, properties: {},
      });
    }
  }, [projectItems, editorStore]);

  const videoCount = projectItems.filter((i) => i.videoResultUrl).length;
  const lockedCount = projectItems.filter((i) => i.videoLocked).length;
  const sceneIds = [...new Set(projectItems.map((i) => i.sceneId))];
  const shotIds = projectItems.filter((i) => i.videoResultUrl).map((i) => i.shotId);

  if (projectItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LayoutDashboard className="h-5 w-5" />
            {t("pipeline.productionQueue")}
          </CardTitle>
          <CardDescription>{t("pipeline.productionQueueDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">{t("pipeline.noItems")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutDashboard className="h-4 w-4" />
            {t("pipeline.productionQueue")}
            <Badge variant="secondary" className="ml-auto text-xs">{projectItems.length} {t("pipeline.shots")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => queue.selectAllShots(projectItems.map(i => i.shotId))}>
              {t("pipeline.selectAll")}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => queue.deselectAllShots()}>
              {t("pipeline.deselectAll")}
            </Button>
            {selectedIds.length > 0 && (
              <span className="text-xs text-muted-foreground">{t("pipeline.selected")} {selectedIds.length} {t("pipeline.items")}</span>
            )}
          </div>
          <BatchOperations
            selectedCount={selectedIds.length}
            onBatchGenerateVideos={handleBatchGenerateVideos}
            onBatchPause={handleBatchPause}
            onBatchResume={handleBatchResume}
            onBatchDelete={handleBatchDelete}
            onBatchLock={handleBatchLock}
            onBatchImportTimeline={handleBatchImportTimeline}
          />
          <Separator />
          <QueueCardView
            items={projectItems}
            selectedIds={selectedIds}
            onToggleSelect={(sid) => queue.toggleSelectShot(sid)}
            onGenerateVideo={handleGenerateVideo}
            onRegenVideo={(sid) => { queue.regenVideoOnly(sid); handleGenerateVideo(sid); }}
            onLockVideo={(sid) => queue.lockVideo(sid)}
            onUnlockVideo={(sid) => queue.unlockVideo(sid)}
            onDeleteVideo={(sid) => queue.deleteVideoAsset(sid)}
            onSavePrompt={handleSavePrompt}
            getVideoUrl={getVideoUrl}
            onUpdateVideoDuration={handleUpdateVideoDuration}
            shotCharacterImages={shotCharacterImages}
            characterNames={characterNames}
            getShotCharacterIds={getShotCharacterIds}
          />
        </CardContent>
      </Card>
      <TimelineImport
        videoCount={videoCount}
        lockedCount={lockedCount}
        selectedCount={selectedIds.length}
        onImportAll={handleImportAll}
        onImportSelected={handleBatchImportTimeline}
        onImportLocked={handleImportLocked}
        onImportScene={handleImportScene}
        onImportShot={handleImportShot}
        sceneIds={sceneIds}
        shotIds={shotIds}
      />
    </div>
  );
}


function ProjectExportPanel({ project, characters, generatedScenes }: { project: any; characters: Character[]; generatedScenes: any[] }) {
  const { t } = useTranslation();
  const queue = useProductionQueue();
  const projectItems = queue.getProjectItems(project.id);

  const buildExport = (format: "json" | "md"): string => {
    const data: ProjectExport = {
      version: "2.4",
      exportedAt: Date.now(),
      project: { name: project.name, description: project.description, tags: project.tags || [], styleDna: project.styleDna || "" },
      characters: (project.lockedCharacterIds || []).map((id: string) => {
        const c = characters.find((ch: Character) => ch.id === id);
        return c ? { name: c.name, profile: c.profile, dnaBlock: c.dnaBlock, references: c.references || [] } : null;
      }).filter(Boolean),
      storyScenes: (project.scenes || generatedScenes || []).map((scene: any) => ({
        title: scene.title, description: scene.description, cameraAngle: scene.cameraAngle,
        shots: (scene.shots || []).map((shot: any) => {
          const qi = projectItems.find((i: any) => i.shotId === shot.id);
          return { title: shot.title, description: shot.description, prompt: shot.prompt || "", negativePrompt: shot.negativePrompt || "", imageUrl: qi?.imageResultUrl || "", videoUrl: qi?.videoResultUrl || "" };
        }),
      })),
    };
    if (format === "json") return JSON.stringify(data, null, 2);
    let md = `# Pipeline Export: ${project.name}\n\n**Exported:** ${new Date(data.exportedAt).toISOString()}\n\n## Characters\n\n`;
    for (const c of data.characters) md += `- **${c.name}**\n  - DNA: ${c.dnaBlock.slice(0, 100)}...\n`;
    md += `\n## Scenes\n\n`;
    for (const s of data.storyScenes) {
      md += `### ${s.title}\n${s.description}\n\n`;
      for (const shot of s.shots) md += `- **${shot.title}**\n  - Prompt: ${shot.prompt}\n${shot.imageUrl ? `  - Image: ${shot.imageUrl}\n` : ""}${shot.videoUrl ? `  - Video: ${shot.videoUrl}\n` : ""}`;
      md += `\n`;
    }
    return md;
  };

  const handleExport = (format: "json" | "md") => {
    const content = buildExport(format);
    const ext = format === "json" ? "json" : "md";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_pipeline.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Download className="h-5 w-5" />
          {t("pipeline.exportProject")}
        </CardTitle>
        <CardDescription>{t("pipeline.exportDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport("json")}>
          <FileJson className="h-3.5 w-3.5" /> {t("pipeline.exportJson")}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport("md")}>
          <FileText className="h-3.5 w-3.5" /> {t("pipeline.exportMarkdown")}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          <Archive className="h-3.5 w-3.5" /> {t("pipeline.exportZip")}
        </Button>
      </CardContent>
    </Card>
  );
}

function LastSavedIndicator() {
  const { t } = useTranslation();
  const [savedAt, setSavedAt] = useState(getLastSavedAt());

  useEffect(() => {
    const timer = setInterval(() => {
      setSavedAt(getLastSavedAt());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!savedAt) return null;
  return (
    <span className="text-[10px] text-muted-foreground ml-2">
      {t("common.lastSaved")}: {new Date(savedAt).toLocaleTimeString()}
    </span>
  );
}

export default function PipelinePage() {
  useEffect(() => {
    startAutoSave();
    return () => { stopAutoSave(); };
  }, []);
  const { t } = useTranslation();
  const { projects } = useProjectStore();
  const { characters } = useCharacterStore();
  const queue = useProductionQueue();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const project = projects.find((p) => p.id === selectedProjectId);
  const stats = selectedProjectId ? queue.getBatchStats(selectedProjectId) : null;
  const selectedProjectItems = selectedProjectId ? queue.getProjectItems(selectedProjectId) : [];
  const storageImageUrls = selectedProjectItems.map((item) => item.imageResultUrl).filter(Boolean) as string[];
  const storageVideoUrls = selectedProjectItems.map((item) => item.videoResultUrl).filter(Boolean) as string[];

  const handleLeftScroll = useCallback(() => {
    if (leftRef.current && rightRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop;
  }, []);
  const handleRightScroll = useCallback(() => {
    if (rightRef.current && leftRef.current) leftRef.current.scrollTop = rightRef.current.scrollTop;
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              {t("pipeline.dashboard")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{t("pipeline.dashboardDesc")}</p>
          <LastSavedIndicator />
          </div>
          <ProductionModeToggle mode={queue.productionMode} onChange={(mode) => queue.setProductionMode(mode)} />
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Label className="shrink-0">{t("pipeline.project")}</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("pipeline.selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!project && (
          <div className="text-center py-16 text-muted-foreground">
            <LayoutDashboard className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t("pipeline.selectProjectHint")}</p>
            <p className="text-sm mt-1">{t("pipeline.noProject")}</p>
          </div>
        )}

        {project && (
          <div className="flex flex-col gap-4 lg:flex-row">
            <div ref={leftRef} onScroll={handleLeftScroll} className="min-w-0 flex-1 space-y-4 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto lg:pr-1">
              <StoryboardPreview project={project} characters={characters} />
              <CharacterImageSection project={project} />
            </div>
            <div ref={rightRef} onScroll={handleRightScroll} className="min-w-0 space-y-4 lg:max-h-[calc(100vh-280px)] lg:w-[480px] lg:shrink-0 lg:overflow-y-auto lg:pl-1">
              {stats && <StatisticsPanel stats={stats} />}
              <CurrentTasksWidget />
              <ProductionQueuePanel project={project} characters={characters} />
              <StorageMonitor projectId={project.id} imageUrls={storageImageUrls} videoUrls={storageVideoUrls} />
              <ProjectExportPanel project={project} characters={characters} generatedScenes={[]} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}











