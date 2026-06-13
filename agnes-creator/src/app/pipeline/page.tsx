"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  Wand2, ImageIcon, Video, Film, Download, Play, Pause,
  CheckCircle2, XCircle, Loader2, Clock, RefreshCw, ArrowRight,
  Sparkles, Users, BookTemplate, FolderKanban, FileJson, FileText, Archive,
  Share2, Eye, EyeOff,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { useProjectStore } from "@/stores/projectStore";
import { useProductionQueue } from "@/stores/productionQueueStore";
import { taskManager as servicesTaskManager } from "@/services/taskManager";
import { agnes } from "@/services/agnes";
import { useConfigStore } from "@/stores/configStore";
import { useTaskStore, taskManager as storeTaskManager } from "@/stores/taskStore";
import { logger } from "@/lib/logger";
import { classifyError, withRetry } from "@/lib/errorHandler";
import { asyncMapThrottled, DEFAULT_CONCURRENCY, DEFAULT_THROTTLE_MS } from "@/lib/concurrency";
import { useCharacterStore, generateCharacterDna } from "@/stores/characterStore";
import { useEditorStore } from "@/stores/editorStore";
import { parseStoryToScenes, generateAllPromptPacks } from "@/lib/promptPackGenerator";
import { downloadImageWithRetry, mapErrorToProductionStatus, getImageFetchErrorLabel } from "@/services/pipelineImageDownloader";
import type { Scene, Shot, Character, ProductionStatus, PromptPack, ProjectExport } from "@/types";

// ============================================================
// Sub-component: {t("pipeline.characterDna")} Panel (Phase 1)
// ============================================================
function CharacterDnaPanel({ project, characters }: { project: any; characters: Character[] }) {
  const { t } = useTranslation();
  
  const { lockCharacter, unlockCharacter } = useProjectStore();
  const { setLocked } = useCharacterStore();
  const lockedChars = project.lockedCharacterIds || [];
  const projectChars = characters.filter((c) => !c.projectId || c.projectId === project.id || lockedChars.includes(c.id));
  const [selectedChar, setSelectedChar] = useState<string>("");

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
        {/* Locked Characters */}
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
                  {/* DNA Block */}
                  <div className="rounded bg-muted/50 p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Character DNA</span>
                      <span className="text-xs text-muted-foreground">auto-injected</span>
                    </div>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">{char.dnaBlock || generateCharacterDna(char)}</p>
                  </div>
                  {/* Profile */}
                  {char.profile && (char.profile.age || char.profile.gender) && (
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      {char.profile.age && <div>Age: <span className="text-foreground">{char.profile.age}</span></div>}
                      {char.profile.gender && <div>Gender: <span className="text-foreground">{char.profile.gender}</span></div>}
                      {char.profile.appearance && <div className="col-span-3">Appearance: <span className="text-foreground">{char.profile.appearance}</span></div>}
                      {char.profile.clothing && <div className="col-span-2">Clothing: <span className="text-foreground">{char.profile.clothing}</span></div>}
                    </div>
                  )}
                  {/* Reference images */}
                  {char.references.length > 0 && (
                    <div className="flex gap-2">
                      {char.references.map((ref, i) => (
                        <div key={i} className="relative group">
                          <img src={ref.url} alt={ref.label || ref.type} className="w-12 h-12 rounded object-cover border" />
                          <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-background px-1 rounded border">{ref.type[0]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* {t("pipeline.availableCharacters")} */}
        <div className="space-y-2">
          <Label>Available Characters</Label>
          <div className="flex flex-wrap gap-2">
            {projectChars.filter((c) => !lockedChars.includes(c.id)).length === 0 && lockedChars.length > 0 && (
              <span className="text-xs text-muted-foreground">{t("pipeline.allLocked")}</span>
            )}
            {projectChars.filter((c) => !lockedChars.includes(c.id)).map((char) => (
              <Badge key={char.id} variant="outline" className="cursor-pointer hover:bg-primary/10 gap-1 py-1.5" onClick={() => handleToggleLock(char.id)}>
                <Users className="h-3 w-3" />
                {char.name}
                <span className="text-[9px] text-muted-foreground ml-1">+Lock</span>
              </Badge>
            ))}
            {projectChars.length === 0 && (
              <span className="text-xs text-muted-foreground">{t("pipeline.noCharacters")}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sub-component: {t("pipeline.storyToStoryboard")} (Phase 2+3)
// ============================================================
function StoryboardGenerator({ project, characters }: { project: any; characters: Character[] }) {
  const { t, language } = useTranslation();
  const [story, setStory] = useState("");
  const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
  const [promptPacks, setPromptPacks] = useState<PromptPack[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { addSceneToProject, setStyleDna } = useProjectStore();
  const { initFromShots } = useProductionQueue();
  const [styleDnaInput, setStyleDnaInput] = useState(project.styleDna || "");

  const handleGenerate = useCallback(() => {
    if (!story.trim()) return;
    setIsGenerating(true);
    
    // Parse story into scenes (simulated via promptPackGenerator)
    const parsed = parseStoryToScenes(story, language);
    
    // Convert to Scene objects
    let sceneCounter = 0;
    let shotCounter = 0;
    const scenes: Scene[] = parsed.map((s, si) => {
      sceneCounter++;
      const sceneId = `scene-${Date.now()}-${sceneCounter}`;
      const shots: Shot[] = s.shots.map((sh, ji) => {
        shotCounter++;
        return {
          id: `shot-${Date.now()}-${sceneCounter}-${ji + 1}`,
          sceneId,
          title: sh.title,
          description: sh.description,
          order: sh.order,
          type: "video",
          prompt: sh.description,
          renderedPrompt: sh.description,
          negativePrompt: "",
          characterIds: project.lockedCharacterIds || [],
          assetIds: [],
          duration: 3,
          transition: "cut",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      });
      return {
        id: sceneId,
        projectId: project.id,
        title: s.title,
        description: s.description,
        order: si + 1,
        shots,
        characterIds: project.lockedCharacterIds || [],
        assetIds: [],
        cameraAngle: s.cameraAngle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    // Add scenes to project
    for (const scene of scenes) {
      addSceneToProject(project.id, scene);
    }

    // Generate prompt packs
    const packs = generateAllPromptPacks(scenes, characters, styleDnaInput);
    
    // Init production queue
    initFromShots(project.id, scenes.map((s) => ({
      id: s.id, title: s.title,
      shots: s.shots.map((sh) => ({ id: sh.id, title: sh.title, order: sh.order })),
    })));

    // Save style DNA
    if (styleDnaInput) setStyleDna(project.id, styleDnaInput);

    setGeneratedScenes(scenes);
    setPromptPacks(packs);
    setIsGenerating(false);
  }, [story, project.id, project.lockedCharacterIds, characters, styleDnaInput, addSceneToProject, setStyleDna, initFromShots]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookTemplate className="h-5 w-5" />
          Story → Storyboard Pipeline
        </CardTitle>
        <CardDescription>Enter a story, auto-generate storyboard, prompts, and production queue</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Story Input */}
        <div className="space-y-2">
          <Label>Story Text</Label>
          <Textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Enter your story here... e.g. Harry discovers a mysterious magic book in Hogwarts..."
            className="min-h-[100px]"
          />
        </div>

        {/* Style DNA */}
        <div className="space-y-2">
          <Label>{t("pipeline.styleDna")}</Label>
          <Input value={styleDnaInput} onChange={(e) => setStyleDnaInput(e.target.value)} placeholder="e.g. cinematic, fantasy, dark moody, pixar style" />
        </div>

        <Button onClick={handleGenerate} disabled={!story.trim() || isGenerating} className="gap-2">
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {t("pipeline.generateStoryboard")} & Prompts
        </Button>

        {/* Generated Scenes Preview */}
        {generatedScenes.length > 0 && (
          <div className="space-y-3 mt-4">
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Generated: {generatedScenes.length} Scenes, {generatedScenes.reduce((a, s) => a + s.shots.length, 0)} Shots</Label>
            </div>
            {generatedScenes.map((scene) => (
              <div key={scene.id} className="rounded-lg border bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{scene.title}</span>
                  <Badge variant="outline" className="text-[10px]">{scene.cameraAngle}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{scene.description.substring(0, 120)}...</p>
                <div className="space-y-1">
                  {scene.shots.map((shot) => {
                    const pack = promptPacks.find((p) => p.shotId === shot.id);
                    return (
                      <div key={shot.id} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded p-1.5">
                        <span className="font-medium text-foreground shrink-0 w-14">Shot {shot.order}:</span>
                        <span className="truncate flex-1">{shot.description}</span>
                        {pack && <Badge variant="outline" className="text-[9px] shrink-0">Prompt ready</Badge>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sub-component: {t("pipeline.productionQueue")} (Phase 4+5+6)
// ============================================================
function ProductionQueuePanel({ project }: { project: any }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"all" | "images" | "videos">("all");
  const { items, isPaused, setPaused, updateImageStatus, updateVideoStatus, resetShot, resetVideoOnly, resetImageOnly } = useProductionQueue();
  const projectItems = items.filter((i) => i.projectId === project.id);

  const generateImages = useCallback(async () => {
    if (isPaused) return;
    const pending = projectItems.filter((i) => i.imageStatus === "pending");
    if (pending.length === 0) return;
    logger.info("Pipeline", `批量生成图片: ${pending.length} 个`);
    
    await asyncMapThrottled(pending, DEFAULT_CONCURRENCY, DEFAULT_THROTTLE_MS, async (item) => {
      // Check pause before each item
      if (useProductionQueue.getState().isPaused) {
        logger.info("Pipeline", "批量图片生成已暂停");
        return;
      }
      
      updateImageStatus(item.shotId, "generating");
      
      const { data, error } = await withRetry(
        async () => {
          const config = useConfigStore.getState();
          const result = await servicesTaskManager.createTask({
            type: "text-to-image",
            model: config.textToImageModel || "black-forest-labs/FLUX.1.1-pro",
            prompt: item.shotTitle || "a scene",
            params: { size: "1024x1024" },
          });
          return result;
        },
        { maxRetries: 2 },
        "Pipeline-Image"
      );
      
      if (error) {
        useProductionQueue.getState().incrementImageRetry(item.shotId);
        logger.error("Pipeline", `图片生成失败: ${item.shotTitle}`, { error: error.message });
      } else if (data) {
        updateImageStatus(item.shotId, "completed", data.taskId, data.resultUrl || data.thumbnail);
        logger.info("Pipeline", `图片生成成功: ${item.shotTitle}`);
      }
    });
    
    logger.info("Pipeline", "批量图片生成完成");
  }, [projectItems, updateImageStatus, isPaused]);

  const generateVideos = useCallback(async () => {
    if (isPaused) return;
    const pending = projectItems.filter((i) => i.imageStatus === "completed" && i.videoStatus === "pending");
    if (pending.length === 0) return;
    logger.info("Pipeline", "批量生成视频: " + pending.length + " 个");

    await asyncMapThrottled(pending, 1, 1000, async (item) => {
      if (useProductionQueue.getState().isPaused) {
        logger.info("Pipeline", "批量视频生成已暂停");
        return;
      }

      const config = useConfigStore.getState();
      const model = config.imageToVideoModel || "agnes-video-v2.0";

      updateVideoStatus(item.shotId, "generating");

      // ========== 第一阶段：图片诊断与下载 ==========
      if (!item.imageResultUrl) {
        logger.error("Pipeline", "镜头 " + (item.shotTitle || "") + " 没有图片结果URL，无法生成图生视频");
        useProductionQueue.getState().updateVideoStatus(
          item.shotId, "image_fetch_failed", "", "",
          "缺少图片结果URL，请先完成图片生成"
        );
        return;
      }

      // 下载图片（含重试 3 次：10s / 30s / 60s）
      const downloadResult = await downloadImageWithRetry(item.imageResultUrl, {
        shotId: item.shotId,
        maxRetries: 3,
      });

      if (!downloadResult.success) {
        // 图片不可用 → 标记精确错误 → 禁止文生视频降级
        const productionStatus = mapErrorToProductionStatus(downloadResult.errorType);
        const errorLabel = getImageFetchErrorLabel(downloadResult.errorType);
        const errorMessage = "图生视频失败 - " + errorLabel + ": " + downloadResult.errorMessage;

        logger.error("Pipeline", errorMessage);
        useProductionQueue.getState().updateVideoStatus(item.shotId, productionStatus, "", "", errorMessage);
        return;
      }

      // ========== 第二阶段：图片验证 ==========
      if (!downloadResult.dataUrl) {
        logger.error("Pipeline", "图片下载成功但数据为空");
        useProductionQueue.getState().updateVideoStatus(item.shotId, "image_fetch_failed", "", "", "图片下载成功但数据为空");
        return;
      }

      const imageFile = dataUrlToFile(downloadResult.dataUrl, "shot-" + item.shotId + ".png", downloadResult.mimeType || "image/png");

      if (!imageFile || imageFile.size === 0) {
        logger.error("Pipeline", "图片转换失败或内容为空");
        useProductionQueue.getState().updateVideoStatus(item.shotId, "image_fetch_failed", "", "", "图片文件转换失败");
        return;
      }

      logger.info("Pipeline", "图片下载成功: " + (downloadResult.fileSize ? (downloadResult.fileSize / 1024).toFixed(1) + " KB" : "? KB"));

      // ========== 第三阶段：执行图生视频 API 调用 ==========
      const store = useTaskStore.getState();
      const taskId = store.addTask({
        taskId: "", type: "image-to-video",
        model: model,
        prompt: item.shotTitle || "animate this scene",
        status: "uploading", progress: 0,
        resultUrl: "", thumbnail: item.imageResultUrl || "",
        sourcePreview: item.imageResultUrl || undefined,
        errorMessage: "", params: {},
      });

      // ========== 第三阶段（续）：提交视频到 Agnes API ==========
      // 分开提交和等待，避免 withRetry 在等待失败时重复提交视频（重复视频 → 轮询堆积 → 页面卡死）
      const submitResult = await withRetry(
        async () => {
          await storeTaskManager.execute(taskId, "image-to-video", function() {
            return agnes.video.createFromImage({
              image: imageFile,
              prompt: item.shotTitle || "animate this scene",
              model: model,
            });
          });
          return true;
        },
        { maxRetries: 1 },
        "Pipeline-Video-Submit"
      );

      if (submitResult.error) {
        useProductionQueue.getState().updateVideoStatus(item.shotId, "video_api_failed", "", "", submitResult.error.message);
        logger.error("Pipeline", "图生视频提交失败: " + (item.shotTitle || "") + " - " + submitResult.error.message);
        return;
      }

      // ========== 第四阶段：等待视频生成完成 ==========
      // 不在 withRetry 中等待：
      //   1) 重试时不会重复提交视频 → 不会产生多个并发轮询任务
      //   2) 轮询任务不堆积 → 浏览器网络连接池不耗尽 → 页面不卡死
      //   3) 用 await 让出事件循环 → 保持页面 JS 线程响应
      let videoResultUrl = "";
      const pollStartTime = Date.now();
      const pollTimeout = 600000;
      let lastState = "";

      while (Date.now() - pollStartTime < pollTimeout) {
        const current = useTaskStore.getState().getTaskById(taskId);
        if (current) {
          if (current.status === "completed" && current.resultUrl) {
            videoResultUrl = current.resultUrl;
            break;
          }
          const s = current.status;
          if (s !== lastState) lastState = s;
          if (s === "failed" || s === "timeout" || s === "cancelled") break;
        }
        await new Promise(function(r) { setTimeout(r, 3000); });
      }

      // ========== 第五阶段：更新队列状态 ==========
      if (videoResultUrl) {
        updateVideoStatus(item.shotId, "completed", taskId, videoResultUrl);
        logger.info("Pipeline", "图生视频成功: " + (item.shotTitle || ""));
      } else {
        var emsg;
        if (lastState === "failed" || lastState === "timeout" || lastState === "cancelled") {
          emsg = "视频" + lastState;
        } else {
          emsg = "视频生成超时（10分钟）";
        }
        useProductionQueue.getState().updateVideoStatus(item.shotId, "video_timeout", "", "", emsg);
        logger.error("Pipeline", "图生视频失败: " + (item.shotTitle || "") + " - " + emsg);
    });

    logger.info("Pipeline", "批量视频生成完成");
  }, [projectItems, updateVideoStatus, isPaused]);

  const regenerateSingleVideo = useCallback(async (shotId: string) => {
    if (isPaused) return;
    const item = projectItems.find((i) => i.shotId === shotId);
    if (!item) return;
    
    resetVideoOnly(shotId);
    await new Promise((r) => setTimeout(r, 100));
    
    const config = useConfigStore.getState();
    const model = config.imageToVideoModel || "agnes-video-v2.0";
    
    if (!item.imageResultUrl) {
      logger.error("Pipeline", "镜头 " + (item.shotTitle || "") + " 没有图片URL，无法重新生成视频");
      return;
    }
    
    const downloadResult = await downloadImageWithRetry(item.imageResultUrl, { shotId, maxRetries: 2 });
    if (!downloadResult.success || !downloadResult.dataUrl) {
      logger.error("Pipeline", "图片下载失败，无法重新生成视频");
      return;
    }
    
    const imageFile = dataUrlToFile(downloadResult.dataUrl, "shot-" + shotId + ".png", downloadResult.mimeType || "image/png");
    if (!imageFile || imageFile.size === 0) return;
    
    const store = useTaskStore.getState();
    const taskId = store.addTask({
      taskId: "", type: "image-to-video", model,
      prompt: item.shotTitle || "animate this scene",
      status: "uploading", progress: 0,
      resultUrl: "", thumbnail: item.imageResultUrl || "",
      sourcePreview: item.imageResultUrl || undefined,
      errorMessage: "", params: {},
    });
    
    updateVideoStatus(item.shotId, "generating");
    await storeTaskManager.execute(taskId, "image-to-video", function() {
      return agnes.video.createFromImage({
        image: imageFile,
        prompt: item.shotTitle || "animate this scene",
        model: model,
      });
    });
    
    let videoResultUrl = "";
    const pollStartTime = Date.now();
    while (Date.now() - pollStartTime < 600000) {
      const current = useTaskStore.getState().getTaskById(taskId);
      if (current) {
        if (current.status === "completed" && current.resultUrl) {
          videoResultUrl = current.resultUrl;
          break;
        }
        if (current.status === "failed" || current.status === "timeout" || current.status === "cancelled") break;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    
    if (videoResultUrl) {
      updateVideoStatus(item.shotId, "completed", taskId, videoResultUrl);
      logger.info("Pipeline", "单镜头视频重新生成成功: " + (item.shotTitle || ""));
    } else {
      useProductionQueue.getState().updateVideoStatus(item.shotId, "video_timeout", "", "", "视频重新生成失败");
      logger.error("Pipeline", "单镜头视频重新生成失败: " + (item.shotTitle || ""));
    }
  }, [projectItems, isPaused, resetVideoOnly, updateVideoStatus]);

  const displayItems = useMemo(() => {
    if (activeTab === "images") return projectItems;
    if (activeTab === "videos") return projectItems.filter((i) => i.imageStatus === "completed");
    return projectItems;
  }, [projectItems, activeTab]);

  // V2.4: 断点恢复 - 页面加载时恢复中断的任务
  useEffect(() => {
    const pending = useProductionQueue.getState().recoverPendingTasks();
    if (pending.length > 0) {
      logger.info("Pipeline", `断点恢复: ${pending.length} 个待完成任务`);
    }
  }, []);

  // V2.4: 生成中暂停检查
  const pauseCheck = useRef(false);

  const statusIcon = (status: ProductionStatus) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "generating": return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
      case "pending": return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
      // V2.4 Granular error states - no text-to-video fallback
      case "image_fetch_failed":
      case "image_expired":
      case "image_not_found":
        return <XCircle className="h-3.5 w-3.5 text-orange-500" />;
      case "image_cors_blocked":
        return <XCircle className="h-3.5 w-3.5 text-purple-500" />;
      case "image_rate_limited":
        return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      case "video_api_failed":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "video_timeout":
        return <Clock className="h-3.5 w-3.5 text-red-400" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  // 辅助函数：将 base64 dataURL 转为 File 对象
  const dataUrlToFile = useCallback((dataUrl: string, fileName: string, mimeType: string): File | null => {
    try {
      const arr = dataUrl.split(",");
      if (arr.length < 2) return null;
      const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], fileName, { type: mime });
    } catch (err) {
      logger.error("dataUrlToFile", String(err));
      return null;
    }
  }, []);

  const countBy = (status: ProductionStatus, field: "imageStatus" | "videoStatus") =>
    projectItems.filter((i) => i[field] === status).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Film className="h-5 w-5" />
            Production Queue
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{projectItems.length} shots</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPaused(!isPaused)}>
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <CardDescription>{t("pipeline.productionQueueDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="rounded bg-muted/30 p-2 text-center">
            <div className="font-semibold text-green-500">{countBy("completed", "imageStatus")}</div>
            <div className="text-muted-foreground">Images</div>
          </div>
          <div className="rounded bg-muted/30 p-2 text-center">
            <div className="font-semibold text-green-500">{countBy("completed", "videoStatus")}</div>
            <div className="text-muted-foreground">Videos</div>
          </div>
          <div className="rounded bg-muted/30 p-2 text-center">
            <div className="font-semibold text-blue-500">{countBy("generating", "imageStatus") + countBy("generating", "videoStatus")}</div>
            <div className="text-muted-foreground">Active</div>
          </div>
          <div className="rounded bg-muted/30 p-2 text-center">
            <div className="font-semibold text-red-500">{countBy("failed", "imageStatus") + countBy("failed", "videoStatus")}</div>
            <div className="text-muted-foreground">{t("pipeline.failed")}</div>
          </div>
        </div>

        {/* Batch Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={generateImages} disabled={isPaused}>
            <ImageIcon className="h-3.5 w-3.5" />
            {t("pipeline.generateImages")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={generateVideos} disabled={isPaused}>
            <Video className="h-3.5 w-3.5" />
            {t("pipeline.generateVideos")}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 text-xs">
          {(["all", "images", "videos"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md ${activeTab === tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
            >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
          ))}
        </div>

        {/* Queue Items */}
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {displayItems.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">{t("pipeline.noItems")}</p>
          )}
          {displayItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded border bg-white/[0.02] px-3 py-2 text-xs">
              <span className="font-medium text-foreground w-16 shrink-0">#{item.order}</span>
              <span className="truncate flex-1">{item.shotTitle}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {statusIcon(item.imageStatus)}
                {statusIcon(item.videoStatus)}
              </div>
              {item.imageError && <span className="text-red-500 text-[9px] truncate max-w-[100px]" title={item.imageError}>{item.imageError}</span>}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => resetShot(item.shotId)} title="Regenerate">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sub-component: {t("pipeline.timelineImport")} (Phase 7)
// ============================================================
function TimelineImportPanel({ project }: { project: any }) {
  const { t } = useTranslation();
  const { createTimeline, addClip } = useEditorStore();
  const { items } = useProductionQueue();
  const projectItems = items.filter((i) => i.projectId === project.id && i.videoStatus === "completed");
  const [imported, setImported] = useState(false);

  const handleImport = () => {
    const timelineId = createTimeline({
      name: `Pipeline - ${project.name}`,
      projectId: project.id,
      fps: 24, width: 1152, height: 768,
      duration: projectItems.length * 3,
    });
    let currentTime = 0;
    for (const item of projectItems.sort((a, b) => a.order - b.order)) {
      addClip(timelineId, {
        timelineId,
        source: { type: "shot", id: item.shotId },
        type: "video",
        title: item.shotTitle,
        startTime: currentTime,
        endTime: currentTime + 3,
        duration: 3,
        src: item.videoResultUrl || undefined,
        properties: {},
      });
      currentTime += 3;
    }
    setImported(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Film className="h-5 w-5" />
          Timeline Auto-Import
        </CardTitle>
        <CardDescription>{t("pipeline.timelineImportDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {projectItems.length} {t("pipeline.videosReady")}
          </span>
          <Button onClick={handleImport} disabled={projectItems.length === 0 || imported} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            {imported ? "Imported ✓" : t("pipeline.importToTimeline")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sub-component: Project Export (Phase 8)
// ============================================================
function ProjectExportPanel({ project, characters, generatedScenes }: { project: any; characters: Character[]; generatedScenes: Scene[] }) {
  const { t } = useTranslation();
  const { items } = useProductionQueue();
  const projectItems = items.filter((i) => i.projectId === project.id);

  const buildExport = useCallback((format: "json" | "md"): string => {
    const exportData: ProjectExport = {
      version: "2.4",
      exportedAt: Date.now(),
      project: {
        name: project.name,
        description: project.description,
        tags: project.tags || [],
        styleDna: project.styleDna || "",
      },
      characters: (project.lockedCharacterIds || []).map((cid: string) => {
        const c = characters.find((ch) => ch.id === cid);
        return {
          name: c?.name || "Unknown",
          profile: c?.profile || { age: "", gender: "", appearance: "", hair: "", clothing: "", personality: "", background: "" },
          dnaBlock: c?.dnaBlock || "",
          references: c?.references || [],
        };
      }),
      storyScenes: generatedScenes.map((scene) => ({
        title: scene.title,
        description: scene.description,
        cameraAngle: scene.cameraAngle,
        shots: scene.shots.map((shot) => {
          const qItem = projectItems.find((i) => i.shotId === shot.id);
          return {
            title: shot.title,
            description: shot.description,
            prompt: shot.prompt,
            negativePrompt: shot.negativePrompt,
            imageUrl: qItem?.imageResultUrl,
            videoUrl: qItem?.videoResultUrl,
          };
        }),
      })),
    };

    if (format === "md") {
      let md = `# ${project.name}\n\n`;
      md += `> ${project.description}\n\n`;
      if (exportData.project.styleDna) md += `**Style DNA:** ${exportData.project.styleDna}\n\n`;
      md += `---\n\n`;
      for (const ch of exportData.characters) {
        md += `## 🧑 ${ch.name}\n`;
        md += `- DNA: ${ch.dnaBlock}\n`;
        if (ch.profile.age) md += `- Age: ${ch.profile.age}\n`;
        md += `\n`;
      }
      for (const sc of exportData.storyScenes) {
        md += `## 🎬 ${sc.title}\n`;
        md += `${sc.description}\n\n`;
        for (const sh of sc.shots) {
          md += `### 🎥 ${sh.title}\n`;
          md += `Prompt: ${sh.prompt}\n`;
          md += sh.videoUrl ? `[Video](${sh.videoUrl})\n` : "";
          md += `\n`;
        }
      }
      return md;
    }
    return JSON.stringify(exportData, null, 2);
  }, [project, characters, generatedScenes, projectItems]);

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

// ============================================================
// Main Pipeline Page
// ============================================================
export default function PipelinePage() {
  const { t } = useTranslation();
  const { projects } = useProjectStore();
  const { characters } = useCharacterStore();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showDna, setShowDna] = useState(true);
  const [showStoryboard, setShowStoryboard] = useState(true);
  const [showQueue, setShowQueue] = useState(true);

  const project = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Wand2 className="h-6 w-6 text-primary" />
            AI Production Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("pipeline.subtitle")}
          </p>
        </div>

        {/* Project Selector */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Label className="shrink-0">{t("pipeline.project")}</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("pipeline.selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!project && (
          <div className="text-center py-16 text-muted-foreground">
            <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t("pipeline.selectProjectHint")}</p>
            <p className="text-sm mt-1">{t("pipeline.noProject")}</p>
          </div>
        )}

        {project && (
          <>
            {/* Collapsible sections */}
            <div className="flex gap-2">
              {[
                { key: "dna", label: t("pipeline.characterDna"), state: showDna, set: setShowDna },
                { key: "storyboard", label: t("pipeline.storyToStoryboard"), state: showStoryboard, set: setShowStoryboard },
                { key: "queue", label: t("pipeline.productionQueue"), state: showQueue, set: setShowQueue },
              ].map((s) => (
                <button key={s.key} onClick={() => s.set(!s.state)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    s.state ? "bg-primary/10 border-primary text-primary" : "bg-muted border-border text-muted-foreground"
                  }`}
                >{s.state ? "✓ " : ""}{s.label}</button>
              ))}
            </div>

            {showDna && <CharacterDnaPanel project={project} characters={characters} />}
            {showStoryboard && <StoryboardGenerator project={project} characters={characters} />}
            {showQueue && <ProductionQueuePanel project={project} />}
            <TimelineImportPanel project={project} />
            <ProjectExportPanel project={project} characters={characters} generatedScenes={[]} />
          </>
        )}
      </div>
    </AppShell>
  );
}




