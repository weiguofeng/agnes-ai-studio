"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { useStoryboardStore } from "@/stores/storyboardStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { ArrowLeft, Plus, Trash2, Image, Film, Play } from "lucide-react";
import type { Scene, ShotType } from "@/types";

export default function StoryboardPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string | undefined;
  const store = useStoryboardStore();
  const scenes = store.scenes;
  const addScene = store.addScene;
  const removeScene = store.removeScene;
  const addShot = store.addShot;
  const projects = useProjectStore().projects;
  const editorStore = useEditorStore();
  const createTimeline = editorStore.createTimeline;
  const addClip = editorStore.addClip;

  const project = projectId ? projects.find((p) => p.id === projectId) : null;
  const projectScenes = scenes.filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order);

  const [showAddScene, setShowAddScene] = useState(false);
  const [showAddShot, setShowAddShot] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneDesc, setNewSceneDesc] = useState("");
  const [newShotTitle, setNewShotTitle] = useState("");
  const [newShotDesc, setNewShotDesc] = useState("");
  const [newShotType, setNewShotType] = useState<ShotType>("image");

  const handleAddScene = () => {
    if (!newSceneTitle.trim()) return;
    addScene({ title: newSceneTitle.trim(), description: newSceneDesc.trim(), order: projectScenes.length, projectId: projectId || "", prompt: "", renderedPrompt: "", characterIds: [], assetIds: [] });
    setNewSceneTitle("");
    setNewSceneDesc("");
    setShowAddScene(false);
  };

  const handleAddShot = () => {
    if (!showAddShot || !newShotTitle.trim()) return;
    addShot(showAddShot, {
      sceneId: showAddShot,
      title: newShotTitle.trim(),
      description: newShotDesc.trim(),
      order: 0,
      type: newShotType,
      prompt: "",
      renderedPrompt: "",
      characterIds: [],
      assetIds: [],
      duration: 3,
      transition: "cut",
      negativePrompt: "",
    });
    setNewShotTitle("");
    setNewShotDesc("");
    setNewShotType("image");
    setShowAddShot(null);
  };

  const handleSendToEditor = () => {
    if (projectScenes.length === 0) return;
    const tlId = createTimeline({
      name: project ? project.name : "Storyboard",
      projectId: projectId,
      fps: 24,
      width: 1920,
      height: 1080,
      duration: 0,
    });
    projectScenes.forEach((scene) => {
      scene.shots.forEach((shot) => {
        addClip(tlId, {
          timelineId: tlId,
          source: { type: "shot", id: shot.id },
          type: shot.type === "video" ? "video" : "image",
          title: shot.title,
          startTime: 0,
          endTime: shot.duration,
          duration: shot.duration,
          src: shot.resultUrl,
          thumbnailUrl: shot.thumbnailUrl,
          transition: shot.transition || "cut",
          transitionDuration: 0.5,
          properties: {},
        });
      });
    });
    router.push("/editor");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => (projectId ? router.push("/projects/" + projectId) : router.push("/projects"))}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{t("storyboard.title")}{project ? " - " + project.name : ""}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t("storyboard.subtitle")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {projectScenes.length > 0 && (
              <Button className="gap-2" onClick={handleSendToEditor}>
                <Play className="h-4 w-4" />{t("storyboard.sendToEditor")}
              </Button>
            )}
            <Button className="gap-2" onClick={() => setShowAddScene(true)}>
              <Plus className="h-4 w-4" />{t("storyboard.addScene")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">{t("storyboard.scenes")}</h2>
            {projectScenes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground rounded-lg border border-dashed border-white/10">
                <Film className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("storyboard.noScenes")}</p>
                <p className="text-xs mt-1">{t("storyboard.clickAdd")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projectScenes.map((scene, idx) => (
                  <Card
                    key={scene.id}
                    className={"p-3 cursor-pointer transition-all border-white/5 bg-white/[0.03] hover:bg-white/[0.06] " + (selectedScene?.id === scene.id ? "ring-2 ring-purple-500/50" : "")}
                    onClick={() => setSelectedScene(scene)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{scene.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{scene.shots.length} {t("storyboard.shots")}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeScene(scene.id); }}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">{t("storyboard.shots")}</h2>
              {selectedScene && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAddShot(selectedScene.id)}>
                  <Plus className="h-3 w-3" />{t("storyboard.addShot")}
                </Button>
              )}
            </div>
            {selectedScene ? (
              <div className="space-y-2">
                <div className="mb-3">
                  <h3 className="font-semibold text-sm">{selectedScene.title}</h3>
                  <p className="text-xs text-muted-foreground">{selectedScene.description}</p>
                </div>
                {selectedScene.shots.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">{t("storyboard.noShots")}</p>
                ) : (
                  selectedScene.shots.map((shot, idx) => (
                    <div key={shot.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.05] border border-white/5">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{shot.title}</span>
                          <Badge className="text-[9px] h-4" variant="outline">
                            {shot.type === "image" ? t("storyboard.image") : t("storyboard.video")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{shot.prompt || shot.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{shot.duration}s</span>
                      {shot.resultUrl && (
                        <img src={shot.resultUrl} alt="" className="h-10 w-14 object-cover rounded shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground rounded-lg border border-dashed border-white/10">
                <Image className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("storyboard.selectScene")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showAddScene} onOpenChange={setShowAddScene}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("storyboard.addScene")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("storyboard.sceneTitle")}</Label>
              <Input value={newSceneTitle} onChange={(e) => setNewSceneTitle(e.target.value)} placeholder={t("storyboard.sceneTitle")} />
            </div>
            <div className="space-y-2">
              <Label>{t("storyboard.sceneDesc")}</Label>
              <Textarea value={newSceneDesc} onChange={(e) => setNewSceneDesc(e.target.value)} placeholder={t("storyboard.sceneDesc")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddScene(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleAddScene}>{t("common.create")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAddShot} onOpenChange={(o) => { if (!o) setShowAddShot(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("storyboard.addShot")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("storyboard.shotTitle")}</Label>
              <Input value={newShotTitle} onChange={(e) => setNewShotTitle(e.target.value)} placeholder={t("storyboard.shotTitle")} />
            </div>
            <div className="space-y-2">
              <Label>{t("storyboard.shotDesc")}</Label>
              <Textarea value={newShotDesc} onChange={(e) => setNewShotDesc(e.target.value)} placeholder={t("storyboard.shotDesc")} />
            </div>
            <div className="space-y-2">
              <Label>{t("storyboard.shotType")}</Label>
              <Select value={newShotType} onValueChange={(v) => setNewShotType(v as ShotType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">{t("storyboard.image")}</SelectItem>
                  <SelectItem value="video">{t("storyboard.video")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddShot(null)}>{t("common.cancel")}</Button>
              <Button onClick={handleAddShot}>{t("common.create")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}