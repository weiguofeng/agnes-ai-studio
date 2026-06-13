"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";
import { useProjectStore } from "@/stores/projectStore";
import { useStoryboardStore } from "@/stores/storyboardStore";
import { usePromptStore } from "@/stores/promptStore";
import { useCharacterStore } from "@/stores/characterStore";
import { ArrowLeft, Plus, Film, Image, FileText, User, Trash2 } from "lucide-react";

export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getProjectById, addSceneToProject, removeSceneFromProject } = useProjectStore();
  const { scenes, addScene, removeScene } = useStoryboardStore();
  const { prompts } = usePromptStore();
  const { characters } = useCharacterStore();
  const project = getProjectById(id);
  const projectScenes = scenes.filter((s) => s.projectId === id).sort((a, b) => a.order - b.order);
  const [showAddScene, setShowAddScene] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneDesc, setNewSceneDesc] = useState("");

  if (!project) return (
    <AppShell>
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t("project.notFound")}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/projects")}>{t("common.back")}</Button>
      </div>
    </AppShell>
  );

  const handleAddScene = () => {
    if (!newSceneTitle.trim()) return;
    const sceneId = addScene({ title: newSceneTitle.trim(), description: newSceneDesc.trim(), order: projectScenes.length, projectId: id, prompt: "", renderedPrompt: "", characterIds: [], assetIds: [] });
    const scene = scenes.find((s) => s.id === sceneId);
    if (scene) addSceneToProject(id, scene);
    setNewSceneTitle(""); setNewSceneDesc(""); setShowAddScene(false);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/projects")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/storyboard/" + id)} className="gap-2">
            <Film className="h-4 w-4" />{t("project.storyboard")}
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: t("project.scenes"), value: projectScenes.length, icon: Film, color: "from-blue-500/20 to-cyan-500/20 text-blue-400" },
            { label: t("project.shots"), value: projectScenes.reduce((s, sc) => s + sc.shots.length, 0), icon: Image, color: "from-purple-500/20 to-pink-500/20 text-purple-400" },
            { label: t("project.prompts"), value: prompts.filter((p) => p.projectId === id).length, icon: FileText, color: "from-emerald-500/20 to-teal-500/20 text-emerald-400" },
            { label: t("project.characters"), value: characters.filter((c) => c.projectId === id).length, icon: User, color: "from-orange-500/20 to-red-500/20 text-orange-400" }
          ].map((stat) => (
            <Card key={stat.label} className="p-4 bg-white/[0.03] backdrop-blur-xl border-white/5">
              <div className="flex items-center gap-3">
                <div className={"h-10 w-10 rounded-xl bg-gradient-to-br " + stat.color + " flex items-center justify-center"}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("project.scenes")}</h2>
            <Button size="sm" className="gap-2" onClick={() => setShowAddScene(true)}>
              <Plus className="h-4 w-4" />{t("project.addScene")}
            </Button>
          </div>
          {projectScenes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground rounded-lg border border-dashed border-white/10">
              <Film className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{t("projectDetail.noScenes")}</p>
            </div>
          ) : projectScenes.map((scene, idx) => (
            <Card key={scene.id} className="p-4 bg-white/[0.03] backdrop-blur-xl border-white/5">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{scene.title}</h3>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { removeScene(scene.id); removeSceneFromProject(id, scene.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                  {scene.description && <p className="text-xs text-muted-foreground mt-1">{scene.description}</p>}
                </div>
              </div>
            </Card>
          ))}
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
    </AppShell>
  );
}
