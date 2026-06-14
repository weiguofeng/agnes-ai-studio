"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Download, CheckCircle2, Loader2, Sparkles, Users, BookTemplate, FileJson, FileText, Archive, LayoutDashboard,
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
import { StatisticsPanel } from "@/components/pipeline/StatisticsPanel";
import { QueueCardView } from "@/components/pipeline/QueueCardView";
import { BatchOperations } from "@/components/pipeline/BatchOperations";
import { TimelineImport } from "@/components/pipeline/TimelineImport";
import { StorageMonitor } from "@/components/pipeline/StorageMonitor";
import { ProductionModeToggle } from "@/components/pipeline/ProductionModeToggle";
import { CurrentTasksWidget } from "@/components/pipeline/CurrentTasksWidget";

function isLikelyShortPrompt(prompt: string | undefined, shotTitle?: string): boolean {
  const value = (prompt || "").trim();
  if (!value) return true;
  if (shotTitle && value === shotTitle.trim()) return true;
  return value.length < 80 && /^(镜头|Shot)\s*\d*[:：]/i.test(value) && value.endsWith("...");
}

function CharacterDnaPanel({ project, characters }: { project: any; characters: Character[] }) {
  const { t } = useTranslation();
  const { lockCharacter, unlockCharacter } = useProjectStore();
  const { setLocked } = useCharacterStore();
  const lockedChars = project.lockedCharacterIds || [];

  const handleToggleLock = (charId: string) => {
    const isLocked = lockedChars.includes(charId);
    if (isLocked) {
      unlockCharacter(project.id, charId);
      setLocked(charId, false);
    } else {
      lockCharacter(project.id, charId);
      setLocked(charId, true);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          {t("pipeline.characterDna")}
        </CardTitle>
        <CardDescription>{t("pipeline.characterDnaDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lockedChars.length > 0 && (
          <div className="space-y-3">
            <Label>{t("pipeline.lockedCharacters")}</Label>
            {lockedChars.map((charId: string) => {
              const char = characters.find((c) => c.id === charId);
              if (!char) return null;
              return (
                <div key={charId} className="rounded-lg border bg-white/[0.03] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />{t("pipeline.locked")}
                      </Badge>
                      <span className="font-semibold">{char.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleToggleLock(charId)}>
                      {t("pipeline.unlock")}
                    </Button>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Character DNA</span>
                      <span className="text-xs text-muted-foreground">auto-injected</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{char.dnaBlock}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-3">
          <Label>{t("pipeline.availableCharacters")}</Label>
          {lockedChars.length === characters.length ? (
            <p className="text-sm text-muted-foreground">{t("pipeline.allLocked")}</p>
          ) : characters.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pipeline.noCharacters")}</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {characters.filter((c) => !lockedChars.includes(c.id)).map((char) => (
                <div key={char.id} className="flex items-center justify-between rounded-lg border p-2">
                  <span className="text-sm font-medium">{char.name}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleToggleLock(char.id)}>
                    {t("pipeline.lockCharacter")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StoryboardGenerator({ project, characters }: { project: any; characters: Character[] }) {
  const { t } = useTranslation();
  const { updateProject } = useProjectStore();
  const { initFromShots } = useProductionQueue();
  const [story, setStory] = useState(project.storyScript || "");
  const [styleDna, setStyleDna] = useState(project.styleDna || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
  const [generatedPacks, setGeneratedPacks] = useState<PromptPack[]>([]);
  const lockedChars = (project.lockedCharacterIds || []).map((id: string) => characters.find((c) => c.id === id)).filter(Boolean);

  useEffect(() => {
    setStory(project.storyScript || "");
    setStyleDna(project.styleDna || "");
  }, [project.id, project.storyScript, project.styleDna]);

  const handleStoryChange = (value: string) => {
    setStory(value);
    updateProject(project.id, { storyScript: value });
    markDirty();
  };

  const handleStyleDnaChange = (value: string) => {
    setStyleDna(value);
    updateProject(project.id, { styleDna: value });
    markDirty();
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const rawScenes = await parseStoryToScenes(story, "zh-CN");
      updateProject(project.id, { storyScript: story, styleDna });
      const now = Date.now();
      const scenes: Scene[] = rawScenes.map((rs, i) => {
        const sceneId = `scene-${now}-${i}`;
        return {
          id: sceneId,
          projectId: project.id,
          title: rs.title,
          description: rs.description,
          order: i,
          shots: rs.shots.map((sh, j) => ({
            id: `shot-${now}-${i}-${j}`,
            sceneId,
            title: sh.title,
            description: sh.description,
            order: j,
            type: "image" as ShotType,
            prompt: sh.description || sh.title || "",
            renderedPrompt: "",
            negativePrompt: "",
            characterIds: [],
            assetIds: [],
            duration: 5,
            createdAt: now,
            updatedAt: now,
          })),
          characterIds: [],
          assetIds: [],
          createdAt: now,
          updatedAt: now,
        };
      });
      setGeneratedScenes(scenes);
      if (scenes.length > 0) {
        const packs = await generateAllPromptPacks(scenes, lockedChars, styleDna);
        setGeneratedPacks(packs);
        updateProject(project.id, { scenes });
        initFromShots(project.id, scenes.map((s) => ({
          id: s.id, title: s.title,
          shots: s.shots.map((sh) => {
            const pack = packs.find((p) => p.shotId === sh.id);
            return {
              id: sh.id,
              title: sh.title,
              order: sh.order,
              imagePrompt: pack?.imagePrompt || sh.renderedPrompt || sh.prompt || sh.description || sh.title,
              videoPrompt: pack?.videoPrompt || sh.renderedPrompt || sh.prompt || sh.description || sh.title,
              negativePrompt: pack?.negativePrompt || sh.negativePrompt,
            };
          }),
        })));
      }
    } catch (err) {
      logger.error("StoryboardGenerator", "生成失败", { error: String(err) });
    }
    setIsGenerating(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookTemplate className="h-5 w-5" />
          {t("pipeline.storyToStoryboard")}
        </CardTitle>
        <CardDescription>{t("pipeline.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("pipeline.yourStory")}</Label>
          <Textarea value={story} onChange={(e) => handleStoryChange(e.target.value)} placeholder={t("pipeline.enterStory")} className="min-h-[100px]" />
        </div>
        <div className="space-y-2">
          <Label>{t("pipeline.styleDna")}</Label>
          <Input value={styleDna} onChange={(e) => handleStyleDnaChange(e.target.value)} placeholder={t("pipeline.styleDnaPlaceholder")} />
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating || !story.trim()}>
          {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {t("pipeline.generateStoryboard")}
        </Button>
        {generatedScenes.length > 0 && (
          <div className="space-y-3">
            <Separator />
            <Label>{t("pipeline.scenes")} ({generatedScenes.length})</Label>
            {generatedScenes.map((scene, si) => (
              <div key={scene.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Sc{si + 1}</Badge>
                  <span className="font-medium text-sm">{scene.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{scene.description}</p>
                {scene.shots.length > 0 && (
                  <div className="space-y-1.5 pl-4 border-l-2 border-muted">
                    {scene.shots.map((shot, shi) => (
                      <div key={shot.id} className="text-xs">
                        <span className="font-mono text-muted-foreground">Sh{shi + 1}: </span>
                        <span>{shot.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {generatedPacks.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <Label>{t("pipeline.prompts")} ({generatedPacks.length})</Label>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {generatedPacks.map((pack) => (
                <div key={pack.shotId} className="rounded bg-muted/50 p-2">
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{pack.imagePrompt}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductionQueuePanel({ project, characters }: { project: any; characters: Character[] }) {
  const { t } = useTranslation();
  const queue = useProductionQueue();
  const config = useConfigStore();
  const editorStore = useEditorStore();
  const [processingImages, setProcessingImages] = useState<Set<string>>(new Set());
  const [processingVideos, setProcessingVideos] = useState<Set<string>>(new Set());
  const videoAbortControllers = useRef<Map<string, AbortController>>(new Map());
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  const projectScenes = useMemo(() => project.scenes || [], [project.scenes]);
  const projectItems = useMemo(() => queue.getProjectItems(project.id), [queue, project.id]);
  const lockedCharacters = useMemo(() => {
    const lockedIds = project.lockedCharacterIds || [];
    return characters.filter((character) => lockedIds.includes(character.id));
  }, [characters, project.lockedCharacterIds]);
  const selectedIds = queue.selectedShotIds;

  useEffect(() => {
    const imgMap: Record<string, string> = {};
    const vidMap: Record<string, string> = {};
    for (const item of projectItems) {
      if (item.imageResultUrl) imgMap[item.shotId] = item.imageResultUrl;
      if (item.videoResultUrl) vidMap[item.shotId] = item.videoResultUrl;
    }
    setImageUrls((prev) => {
      const prevKeys = JSON.stringify(prev);
      const newKeys = JSON.stringify(imgMap);
      return prevKeys === newKeys ? prev : imgMap;
    });
    setVideoUrls((prev) => {
      const prevKeys = JSON.stringify(prev);
      const newKeys = JSON.stringify(vidMap);
      return prevKeys === newKeys ? prev : vidMap;
    });
  }, [projectItems]);

  const getShotTitle = useCallback((shotId: string): string => {
    for (const scene of projectScenes) {
      const shot = scene.shots.find((s: Shot) => s.id === shotId);
      if (shot) return shot.renderedPrompt || shot.prompt || shot.description || shot.title || "";
    }
    return "";
  }, [projectScenes]);

  const getPromptPackForShot = useCallback((shotId: string): PromptPack | null => {
    for (const scene of projectScenes) {
      const shot = scene.shots.find((candidate: Shot) => candidate.id === shotId);
      if (shot) return generatePromptPack(shot, scene, lockedCharacters, project.styleDna || "");
    }
    return null;
  }, [projectScenes, lockedCharacters, project.styleDna]);

  useEffect(() => {
    for (const item of projectItems) {
      const pack = getPromptPackForShot(item.shotId);
      if (!pack) continue;
      const nextImagePrompt = isLikelyShortPrompt(item.imagePrompt, item.shotTitle) ? pack.imagePrompt : item.imagePrompt;
      const nextVideoPrompt = isLikelyShortPrompt(item.videoPrompt, item.shotTitle) ? pack.videoPrompt : item.videoPrompt;
      const nextCustomPrompt = isLikelyShortPrompt(item.customPrompt, item.shotTitle) ? undefined : item.customPrompt;
      const nextNegativePrompt = item.negativePrompt || pack.negativePrompt;
      if (nextImagePrompt !== item.imagePrompt || nextVideoPrompt !== item.videoPrompt || nextCustomPrompt !== item.customPrompt || nextNegativePrompt !== item.negativePrompt) {
        queue.updateItem(item.shotId, {
          imagePrompt: nextImagePrompt,
          videoPrompt: nextVideoPrompt,
          customPrompt: nextCustomPrompt,
          negativePrompt: nextNegativePrompt,
        });
      }
    }
  }, [projectItems, getPromptPackForShot, queue]);

  const getImagePrompt = useCallback((item: any): string => item.customPrompt || item.imagePrompt || getShotTitle(item.shotId) || item.shotTitle || "", [getShotTitle]);
  const getVideoPrompt = useCallback((item: any): string => item.customPrompt || item.videoPrompt || item.imagePrompt || getShotTitle(item.shotId) || item.shotTitle || "", [getShotTitle]);

  const getImageUrl = useCallback((shotId: string): string | undefined => imageUrls[shotId], [imageUrls]);
  const getVideoUrl = useCallback((shotId: string): string | undefined => videoUrls[shotId], [videoUrls]);

  const handleGenerateImage = useCallback(async (shotId: string) => {
    if (processingImages.has(shotId)) return;
    setProcessingImages((prev) => new Set(prev).add(shotId));
    try {
      const item = projectItems.find((i) => i.shotId === shotId);
      if (!item || item.imageLocked) return;
      const prompt = getImagePrompt(item);
      if (!prompt.trim()) {
        queue.updateImageStatus(shotId, "failed", undefined, undefined, t("pipeline.promptRequired"));
        return;
      }
      queue.updateImageStatus(shotId, "generating");
      const images = await agnes.image.generate({
        prompt: prompt.trim(),
        size: "1024x1024",
        n: 1,
        model: config.textToImageModel || config.model || "agnes-image-2.1-flash",
      });
      const imageUrl = images[0]?.url;
      if (!imageUrl) throw new Error(t("pipeline.noImageResult"));
      queue.updateImageStatus(shotId, "completed", undefined, imageUrl);
      markDirty();
      setImageUrls((prev) => ({ ...prev, [shotId]: imageUrl }));
      try { await StorageService.saveAssetFromUrl({ url: imageUrl, type: "image", projectId: project.id, shotId }); } catch { /* non-critical */ }
    } catch (err) {
      const classified = ErrorClassifier.classify(err);
      queue.updateImageStatus(shotId, "failed", undefined, undefined, `${classified.type}: ${classified.userMessage}`);
    } finally {
      setProcessingImages((prev) => { const n = new Set(prev); n.delete(shotId); return n; });
    }
  }, [processingImages, projectItems, queue, project.id, getImagePrompt, config.textToImageModel, config.model, t]);

  const handleGenerateVideo = useCallback(async (shotId: string) => {
    if (processingVideos.has(shotId)) return;
    setProcessingVideos((prev) => new Set(prev).add(shotId));
    const abortController = new AbortController();
    videoAbortControllers.current.set(shotId, abortController);
    let localTaskId = "";
    try {
      const item = projectItems.find((i) => i.shotId === shotId);
      if (!item || item.videoLocked) return;
      if (!item.imageResultUrl) {
        queue.updateVideoStatus(shotId, "failed", undefined, undefined, t("pipeline.videoRequiresImage"));
        return;
      }
      queue.updateVideoStatus(shotId, "generating");
      const prompt = getVideoPrompt(item);
      localTaskId = useTaskStore.getState().addTask({
        id: `pipeline-video-${shotId}-${Date.now()}`,
        taskId: "",
        type: "image-to-video",
        model: config.imageToVideoModel || "agnes-video-v2.0",
        prompt,
        status: "uploading",
        progress: 0,
        resultUrl: "",
        thumbnail: item.imageResultUrl,
        errorMessage: "",
        params: { projectId: project.id, shotId },
      });
      const imageFetch = await downloadImageWithRetry(item.imageResultUrl, { shotId, maxRetries: 2 });
      if (abortController.signal.aborted) {
        queue.updateVideoStatus(shotId, "cancelled", undefined, undefined, t("pipeline.taskCancelled"));
        useTaskStore.getState().updateTask(localTaskId, { status: "cancelled", errorMessage: t("pipeline.taskCancelled") });
        return;
      }
      if (!imageFetch.success || !imageFetch.dataUrl) {
        const status = mapErrorToProductionStatus(imageFetch.errorType);
        queue.updateVideoStatus(shotId, status, undefined, undefined, imageFetch.errorMessage);
        useTaskStore.getState().updateTask(localTaskId, { status: "failed", errorMessage: imageFetch.errorMessage });
        return;
      }
      useTaskStore.getState().updateTask(localTaskId, { status: "submitted" });
      const imgResp = await fetch(imageFetch.dataUrl);
      const imgBlob = await imgResp.blob();
      const videoTask = await agnes.video.createFromImage({
        image: imgBlob,
        prompt,
        model: config.imageToVideoModel || "agnes-video-v2.0",
      });
      if (videoTask?.taskId) {
        const pollId = videoTask.videoId || videoTask.taskId;
        queue.updateVideoStatus(shotId, "generating", pollId);
        useTaskStore.getState().updateTask(localTaskId, { taskId: pollId, status: "processing", params: { projectId: project.id, shotId, taskId: videoTask.taskId, videoId: videoTask.videoId } });
        const videoResult = await agnes.video.poll(pollId, {
          signal: abortController.signal,
          onProgress: (progress) => {
            queue.updateVideoStatus(shotId, "generating", pollId);
            useTaskStore.getState().updateTask(localTaskId, { status: "processing", progress: progress.progress });
          },
        });
        queue.updateVideoStatus(shotId, "completed", pollId, videoResult.url);
        useTaskStore.getState().updateTask(localTaskId, { status: "completed", progress: 100, resultUrl: videoResult.url });
        markDirty();
        setVideoUrls((prev) => ({ ...prev, [shotId]: videoResult.url }));
        try { await StorageService.saveAssetFromUrl({ url: videoResult.url, type: "video", projectId: project.id, shotId }); } catch { /* non-critical */ }
      } else {
        queue.updateVideoStatus(shotId, "failed", undefined, undefined, t("pipeline.noVideoTaskCreated"));
        useTaskStore.getState().updateTask(localTaskId, { status: "failed", errorMessage: t("pipeline.noVideoTaskCreated") });
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        queue.updateVideoStatus(shotId, "cancelled", undefined, undefined, t("pipeline.taskCancelled"));
        if (localTaskId) useTaskStore.getState().updateTask(localTaskId, { status: "cancelled", errorMessage: t("pipeline.taskCancelled") });
        return;
      }
      const classified = ErrorClassifier.classify(err);
      queue.updateVideoStatus(shotId, "failed", undefined, undefined, `${classified.type}: ${classified.userMessage}`);
      if (localTaskId) useTaskStore.getState().updateTask(localTaskId, { status: "failed", errorMessage: `${classified.type}: ${classified.userMessage}` });
    } finally {
      videoAbortControllers.current.delete(shotId);
      setProcessingVideos((prev) => { const n = new Set(prev); n.delete(shotId); return n; });
    }
  }, [processingVideos, projectItems, queue, config.imageToVideoModel, project.id, getVideoPrompt, t]);

  const handleSavePrompt = useCallback((shotId: string, prompt: string) => {
    queue.updatePrompt(shotId, prompt);
    usePromptHistoryStore.getState().saveVersion(shotId, prompt);
    markDirty();
  }, [queue]);

  const handleBatchGenerateImages = useCallback(() => { for (const sid of selectedIds) handleGenerateImage(sid); queue.deselectAllShots(); }, [selectedIds, handleGenerateImage, queue]);
  const handleBatchGenerateVideos = useCallback(() => {
    const runnableIds = selectedIds.filter((sid) => {
      const item = projectItems.find((i) => i.shotId === sid);
      if (!item || item.videoLocked) return false;
      if (!item.imageResultUrl) {
        queue.updateVideoStatus(sid, "failed", undefined, undefined, t("pipeline.videoRequiresImage"));
        return false;
      }
      return true;
    });
    for (const sid of runnableIds) handleGenerateVideo(sid);
    queue.deselectAllShots();
  }, [selectedIds, projectItems, handleGenerateVideo, queue, t]);
  const handleBatchPause = useCallback(() => {
    for (const shotId of selectedIds) {
      videoAbortControllers.current.get(shotId)?.abort();
      const activeTasks = useTaskStore.getState().tasks.filter((task) => task.params?.shotId === shotId && !["completed", "failed", "timeout", "cancelled"].includes(task.status));
      for (const task of activeTasks) useTaskStore.getState().updateTask(task.id, { status: "cancelled", errorMessage: t("pipeline.taskCancelled") });
      const item = projectItems.find((candidate) => candidate.shotId === shotId);
      if (item?.imageStatus === "generating" || item?.imageStatus === "regenerating_image") {
        queue.updateImageStatus(shotId, "cancelled", undefined, undefined, t("pipeline.taskCancelled"));
      }
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
            onBatchGenerateImages={handleBatchGenerateImages}
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
            onGenerateImage={handleGenerateImage}
            onGenerateVideo={handleGenerateVideo}
            onRegenImage={(sid) => { queue.regenImageOnly(sid); handleGenerateImage(sid); }}
            onRegenVideo={(sid) => { queue.regenVideoOnly(sid); handleGenerateVideo(sid); }}
            onLockImage={(sid) => queue.lockImage(sid)}
            onUnlockImage={(sid) => queue.unlockImage(sid)}
            onLockVideo={(sid) => queue.lockVideo(sid)}
            onUnlockVideo={(sid) => queue.unlockVideo(sid)}
            onDeleteImage={(sid) => queue.deleteImageAsset(sid)}
            onDeleteVideo={(sid) => queue.deleteVideoAsset(sid)}
            onSavePrompt={handleSavePrompt}
            getImageUrl={getImageUrl}
            getVideoUrl={getVideoUrl}
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
      {t("common.lastSaved") || "最后保存"}: {new Date(savedAt).toLocaleTimeString()}
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
              <CharacterDnaPanel project={project} characters={characters} />
              <StoryboardGenerator project={project} characters={characters} />
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

