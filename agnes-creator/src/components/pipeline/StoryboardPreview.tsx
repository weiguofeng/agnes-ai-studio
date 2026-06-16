"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/i18n";
import { useProductionQueue } from "@/stores/productionQueueStore";
import { generateAllPromptPacks } from "@/lib/promptPackGenerator";
import { markDirty } from "@/services/ProjectAutoSaveService";
import { logger } from "@/lib/logger";
import { Loader2, Sparkles, Users, BookTemplate, CheckCircle2, AlertCircle, Film } from "lucide-react";
import type { Character } from "@/types";

interface StoryboardPreviewProps {
  project: any;
  characters: Character[];
}

export function StoryboardPreview({ project, characters }: StoryboardPreviewProps) {
  const { t } = useTranslation();
  const { initFromShots, getProjectItems } = useProductionQueue();
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Safely read scenes
  const rawScenes: any[] = useMemo(() => {
    const s = project?.scenes;
    if (!s || !Array.isArray(s)) return [];
    // Validate each scene has required fields
    return s.map((sc: any, i: number) => ({
      id: sc?.id || "scene-" + i,
      title: sc?.title || "",
      shots: Array.isArray(sc?.shots) ? sc.shots : [],
      characterIds: Array.isArray(sc?.characterIds) ? sc.characterIds : [],
      description: sc?.description || "",
    }));
  }, [project?.scenes]);

  const totalShots = useMemo(() =>
    rawScenes.reduce((s: number, sc: any) => s + sc.shots.length, 0),
    [rawScenes]
  );

  const existingItems = getProjectItems(project?.id || "");
  const hasQueueItems = existingItems.length > 0;

  const getCharacterName = (charId: string) => {
    const ch = characters.find((c) => c.id === charId);
    return ch ? ch.name : charId.slice(0, 8);
  };

  const handleLoadToQueue = async () => {
    if (rawScenes.length === 0 || isLoading) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const lockedChars: Character[] = (project.lockedCharacterIds || [])
        .map((id: string) => characters.find((c) => c.id === id))
        .filter(Boolean);

      const packs = await generateAllPromptPacks(rawScenes, lockedChars, project.styleDna || "");

      initFromShots(project.id, rawScenes.map((s: any) => ({
        id: s.id,
        title: s.title,
        shots: s.shots.map((sh: any) => {
          const pack = packs.find((p) => p.shotId === sh.id);
          return {
            id: sh.id,
            title: sh.title,
            order: sh.order || 0,
            imagePrompt: pack?.imagePrompt || sh.renderedPrompt || sh.prompt || sh.description || sh.title || "",
            videoPrompt: pack?.videoPrompt || sh.renderedPrompt || sh.prompt || sh.description || sh.title || "",
            negativePrompt: pack?.negativePrompt || sh.negativePrompt || "",
          };
        }),
      })));

      setLoaded(true);
      markDirty();
      logger.info("StoryboardPreview", "Loaded to queue", { scenes: rawScenes.length, shots: totalShots });
    } catch (err: any) {
      const msg = err?.message || String(err);
      setLoadError(msg);
      logger.error("StoryboardPreview", "Load failed", { error: msg });
    }
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookTemplate className="h-5 w-5" />
          {t("pipeline.storyboardPreview")}
        </CardTitle>
        <CardDescription>{t("pipeline.storyboardPreviewDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rawScenes.length === 0 ? (
          <div className="text-center py-6">
            <Film className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm text-muted-foreground">{t("pipeline.noStoryboard")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("pipeline.noStoryboardHint")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("project.scenes")}: {rawScenes.length}</span>
              <span>{t("project.shots")}: {totalShots}</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {rawScenes.map((scene: any, si: number) => {
                const hasShots = scene.shots.length > 0;
                return (
                  <div key={scene.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] h-4 shrink-0">Sc {si + 1}</Badge>
                      <span className="text-sm font-medium truncate">{scene.title || t("project.untitled")}</span>
                      {scene.characterIds.length > 0 && (
                        <div className="flex gap-0.5 flex-wrap ml-auto">
                          {scene.characterIds.map((cid: string) => (
                            <Badge key={cid} variant="outline" className="text-[9px] h-4 gap-0.5">
                              <Users className="h-2.5 w-2.5" />{getCharacterName(cid)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground shrink-0">{scene.shots.length} 镜头</span>
                    </div>
                    {hasShots ? (
                      <div className="space-y-1">
                        {scene.shots.map((shot: any, shi: number) => (
                          <div key={shot.id || shi} className="flex items-start gap-2 pl-3 border-l-2 border-muted py-0.5">
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">Sh{shi + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs line-clamp-2">{shot.description || shot.title || t("project.untitled")}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {shot.characterIds && shot.characterIds.length > 0 && shot.characterIds.map((cid: string) => {
                                const ch = characters.find((c) => c.id === cid);
                                return ch ? <Badge key={cid} variant="outline" className="text-[8px] h-3.5 px-1">{ch.name}</Badge> : null;
                              })}
                              <span className="text-[10px] text-muted-foreground">{shot.duration || "?"}s</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground pl-3 italic">{t("pipeline.noShotsInScene")}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Separator />

            {loadError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/5 rounded p-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {loadError}
              </div>
            )}

            <Button onClick={handleLoadToQueue} disabled={isLoading || totalShots === 0} className="w-full gap-2">
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}</>
              ) : hasQueueItems ? (
                <><Sparkles className="h-4 w-4" /> {t("pipeline.reloadToQueue")}</>
              ) : (
                <><Sparkles className="h-4 w-4" /> {t("pipeline.loadToQueue")}</>
              )}
            </Button>

            {loaded && (
              <div className="flex items-center gap-2 text-xs text-green-400 justify-center">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("pipeline.loadedToQueue")}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
