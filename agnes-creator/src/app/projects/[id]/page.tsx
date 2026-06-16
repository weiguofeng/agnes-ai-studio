"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/i18n";
import { useProjectStore } from "@/stores/projectStore";
import { useCharacterStore } from "@/stores/characterStore";
import { ArrowLeft, Plus, Trash2, Users, Save, Factory, User, Film } from "lucide-react";
import type { Scene, Shot, ShotType, Character } from "@/types";

// ─── Character multi-select ───
function CharPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const { characters } = useCharacterStore();
  const [open, setOpen] = useState(false);
  const selected = characters.filter((c) => value.includes(c.id));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px] px-2">
          <Users className="h-2.5 w-2.5" />
          {selected.length === 0 ? "角色" : selected.map((c) => c.name).join(", ")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
          {characters.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{t("project.noCharacters")}</p>
          ) : (
            characters.map((ch) => (
              <label key={ch.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.05] cursor-pointer text-xs">
                <Checkbox checked={value.includes(ch.id)} onCheckedChange={() => toggle(ch.id)} className="h-3 w-3" />
                <span>{ch.name}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Shot card ───
function ShotRow({ shot, chars, onChange, onDelete }: {
  shot: Shot; chars: Character[];
  onChange: (patch: Partial<Shot>) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2">
      {/* Line 1: type + duration + delete */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] h-4 shrink-0">{t("project.shot")}</Badge>
        <select
          value={shot.type}
          onChange={(e) => onChange({ type: e.target.value as ShotType })}
          className="h-6 rounded border border-input bg-transparent px-1 text-[10px] shrink-0"
        >
          <option value="image">{t("project.imageShort")}</option>
          <option value="video">{t("project.videoShort")}</option>
        </select>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Input type="number" value={shot.duration}
            onChange={(e) => onChange({ duration: Math.max(1, Number(e.target.value)) })}
            className="h-5 w-12 text-[10px] text-center px-1" />s
        </span>
        <CharPicker value={shot.characterIds} onChange={(ids) => onChange({ characterIds: ids })} />
        {shot.characterIds.map((cid) => {
          const ch = chars.find((c) => c.id === cid);
          return ch ? <Badge key={cid} variant="secondary" className="text-[8px] h-3.5 px-1">{ch.name}</Badge> : null;
        })}
        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto shrink-0 text-red-400/60 hover:text-red-400" onClick={onDelete}>
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      </div>
      {/* Description */}
      <Textarea value={shot.description} onChange={(e) => onChange({ description: e.target.value })}
        placeholder={t("project.shotDesc")} className="h-[52px] text-xs" />
    </div>
  );
}

// ─── Scene group ───
function SceneGroup({ scene, index, chars, onRename, onDelete, onAddShot, onShotChange, onShotDelete }: {
  scene: Scene; index: number; chars: Character[];
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddShot: () => void;
  onShotChange: (shotId: string, patch: Partial<Shot>) => void;
  onShotDelete: (shotId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="p-4 bg-white/[0.03] backdrop-blur-xl border-white/5 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs shrink-0">Sc {index + 1}</Badge>
        <Input value={scene.title} onChange={(e) => onRename(e.target.value)}
          placeholder={t("project.sceneTitle")} className="h-8 text-sm flex-1 min-w-0" />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-400/60 hover:text-red-400" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {scene.shots.map((shot) => (
        <ShotRow key={shot.id} shot={shot} chars={chars}
          onChange={(patch) => onShotChange(shot.id, patch)}
          onDelete={() => onShotDelete(shot.id)} />
      ))}
      <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={onAddShot}>
        <Plus className="h-3 w-3" /> {t("project.addShot")}
      </Button>
    </Card>
  );
}

export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string | undefined;

  const { projects, updateProject } = useProjectStore();
  const { characters } = useCharacterStore();

  const project = projects.find((p) => p.id === projectId);
  const [activeTab, setActiveTab] = useState("storyboard");

  // ─── Local scenes state ───
  const [localScenes, setLocalScenes] = useState<Scene[]>([]);

  // Keep a ref always pointing to latest localScenes for save callback
  const localRef = useRef(localScenes);
  localRef.current = localScenes;

  // Load from project on mount / project change
  useEffect(() => {
    if (project) setLocalScenes(JSON.parse(JSON.stringify(project.scenes || [])));
  }, [project?.id]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (!project) return false;
    return JSON.stringify(project.scenes || []) !== JSON.stringify(localScenes);
  }, [project?.scenes, localScenes]);

  // ─── Handlers (no useCallback to avoid closure issues) ───
  const addScene = () => {
    const now = Date.now();
    const id = "scene-" + now + "-" + localScenes.length;
    setLocalScenes((prev) => [...prev, {
      id, projectId: projectId || "", title: "场景 " + (prev.length + 1), description: "",
      order: prev.length, shots: [], prompt: "", renderedPrompt: "",
      characterIds: [], assetIds: [], createdAt: now, updatedAt: now,
    }]);
  };

  const renameScene = (sceneId: string, title: string) => {
    setLocalScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, title, updatedAt: Date.now() } : s));
  };

  const deleteScene = (sceneId: string) => {
    setLocalScenes((prev) => prev.filter((s) => s.id !== sceneId).map((s, i) => ({ ...s, order: i })));
  };

  const addShot = (sceneId: string) => {
    const now = Date.now();
    setLocalScenes((prev) => {
      const sc = prev.find((s) => s.id === sceneId);
      if (!sc) return prev;
      const shotId = "shot-" + now + "-" + sc.shots.length;
      const ns: Shot = {
        id: shotId, sceneId, title: "", description: "", order: sc.shots.length,
        type: "image", prompt: "", renderedPrompt: "", negativePrompt: "",
        characterIds: [], assetIds: [], duration: 5, createdAt: now, updatedAt: now,
      };
      return prev.map((s) => s.id === sceneId ? { ...s, shots: [...s.shots, ns], updatedAt: now } : s);
    });
  };

  const changeShot = (sceneId: string, shotId: string, patch: Partial<Shot>) => {
    setLocalScenes((prev) => prev.map((s) => s.id === sceneId ? {
      ...s, shots: s.shots.map((sh) => sh.id === shotId ? { ...sh, ...patch, updatedAt: Date.now() } : sh),
      updatedAt: Date.now(),
    } : s));
  };

  const removeShot = (sceneId: string, shotId: string) => {
    setLocalScenes((prev) => prev.map((s) => s.id === sceneId ? {
      ...s, shots: s.shots.filter((sh) => sh.id !== shotId).map((sh, i) => ({ ...sh, order: i })),
      updatedAt: Date.now(),
    } : s));
  };

  // ─── Save: read from ref to avoid stale closure ───
  const handleSave = () => {
    if (!projectId) return;
    updateProject(projectId, { scenes: localRef.current });
  };

  const handleGoPipeline = () => {
    handleSave();
    router.push("/pipeline?projectId=" + projectId);
  };

  // ─── Guard ───
  if (!project || !projectId) {
    return (
      <AppShell>
        <div className="text-center py-16 text-muted-foreground">
          <p>{t("project.notFound")}</p>
          <Button variant="link" onClick={() => router.push("/projects")} className="mt-2">{t("project.backToList")}</Button>
        </div>
      </AppShell>
    );
  }

  const linkedChars = characters.filter((c) => project.lockedCharacterIds.includes(c.id) || c.projectId === project.id);
  const totalShots = localScenes.reduce((s, sc) => s + sc.shots.length, 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push("/projects")}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold truncate">{project.name}</h1>
                <Badge variant="outline" className="text-[10px]">{t("project.statuses." + project.status)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{project.description}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSave} disabled={!isDirty}>
              <Save className="h-3.5 w-3.5" /> {t("common.save")}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleGoPipeline}>
              <Factory className="h-3.5 w-3.5" /> {t("project.goToPipeline")}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">{t("project.overview")}</TabsTrigger>
            <TabsTrigger value="storyboard">{t("project.storyboard")}</TabsTrigger>
            <TabsTrigger value="settings">{t("project.settings")}</TabsTrigger>
          </TabsList>

          {/* ─── Overview ─── */}
          <TabsContent value="overview" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 bg-white/[0.03] backdrop-blur-xl border-white/5">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> {t("project.characters")}</h3>
                {linkedChars.length === 0 ? <p className="text-xs text-muted-foreground">{t("project.noCharactersLinked")}</p> : (
                  <div className="flex flex-wrap gap-2">{linkedChars.map((ch) => (<Badge key={ch.id} variant="secondary" className="text-xs gap-1"><User className="h-3 w-3" /> {ch.name}</Badge>))}</div>
                )}
              </Card>
              <Card className="p-4 bg-white/[0.03] backdrop-blur-xl border-white/5">
                <h3 className="text-sm font-medium mb-3">{t("project.stats")}</h3>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>{t("project.scenes")}: {localScenes.length}</p>
                  <p>{t("project.shots")}: {totalShots}</p>
                  <p>{t("project.totalDuration")}: {localScenes.reduce((s, sc) => s + sc.shots.reduce((ss, sh) => ss + sh.duration, 0), 0)}s</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Storyboard ─── */}
          <TabsContent value="storyboard" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("project.storyboardDesc")}</p>
              <Button size="sm" className="gap-1.5" onClick={addScene}>
                <Plus className="h-3.5 w-3.5" /> {t("project.addScene")}
              </Button>
            </div>

            {localScenes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground rounded-lg border border-dashed border-white/10">
                <Film className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("project.noScenes")}</p>
                <p className="text-xs mt-1">{t("project.addSceneHint")}</p>
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={addScene}><Plus className="h-3.5 w-3.5" /> {t("project.addScene")}</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {localScenes.map((scene, idx) => (
                  <SceneGroup key={scene.id} scene={scene} index={idx} chars={characters}
                    onRename={(title) => renameScene(scene.id, title)}
                    onDelete={() => deleteScene(scene.id)}
                    onAddShot={() => addShot(scene.id)}
                    onShotChange={(shotId, patch) => changeShot(scene.id, shotId, patch)}
                    onShotDelete={(shotId) => removeShot(scene.id, shotId)} />
                ))}
                <div className="flex justify-center gap-2 pt-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={addScene}>
                    <Plus className="h-3.5 w-3.5" /> {t("project.addScene")}
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={!isDirty}>
                    <Save className="h-3.5 w-3.5" /> {t("common.save")} ({totalShots} {t("project.shots")})
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Settings ─── */}
          <TabsContent value="settings" className="space-y-4 pt-4">
            <Card className="p-4 bg-white/[0.03] backdrop-blur-xl border-white/5 space-y-4">
              <div className="space-y-2"><Label>{t("project.name")}</Label><Input value={project.name} onChange={(e) => updateProject(project.id, { name: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t("common.description")}</Label><Textarea value={project.description} onChange={(e) => updateProject(project.id, { description: e.target.value })} className="min-h-[60px]" /></div>
              <div className="space-y-2"><Label>{t("project.status")}</Label>
                <select value={project.status} onChange={(e) => updateProject(project.id, { status: e.target.value as any })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  {["draft", "active", "completed", "archived"].map((s) => (<option key={s} value={s}>{t("project.statuses." + s)}</option>))}
                </select>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
