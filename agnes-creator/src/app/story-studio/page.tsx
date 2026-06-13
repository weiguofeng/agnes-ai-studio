"use client";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { useProjectStore } from "@/stores/projectStore";
import { useStoryboardStore } from "@/stores/storyboardStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useEditorStore } from "@/stores/editorStore";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, Film, Layout, User, BookTemplate, Clapperboard, Play, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

function parseStoryIntoScenes(story: string) {
  const sentences = story.split(/[.?!\n]+/).filter(Boolean);
  if (sentences.length === 0) return [{ title: "Scene 1", description: story, prompt: story }];
  return sentences.map((s: string, i: number) => { const t = s.trim(); return { title: "Scene " + (i + 1), description: t, prompt: t }; });
}

function extractCharacterNames(story: string) {
  const names: string[] = [];
  const parts = story.split(/\s+/);
  parts.forEach((w: string) => {
    const clean = w.replace(/[^a-zA-Z\u00C0-\u024F]/g, "");
    if (clean && clean.length >= 2 && /^[A-Z]/.test(clean)) names.push(clean);
  });
  return [...new Set(names)].slice(0, 5);
}

export default function StoryStudioPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const addProject = useProjectStore().addProject;
  const addScene = useStoryboardStore().addScene;
  const addShot = useStoryboardStore().addShot;
  const addCharacter = useCharacterStore().addCharacter;
  const createTimeline = useEditorStore().createTimeline;

  const [storyInput, setStoryInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [result, setResult] = useState<{projectId: string; sceneIds: string[]; characterIds: string[]; timelineId: string} | null>(null);

  const sceneSuggestions = useMemo(() => parseStoryIntoScenes(storyInput), [storyInput]);
  const characterNames = useMemo(() => extractCharacterNames(storyInput), [storyInput]);

  const addProgress = (msg: string) => setProgress((prev) => [...prev, msg]);

  const handleGenerate = async () => {
    if (!storyInput.trim() || isGenerating) return;
    setIsGenerating(true); setProgress([]); setResult(null);
    try {
      addProgress(t("storyStudio.progress.project"));
      const projectId = addProject({ name: storyInput.slice(0, 40) + (storyInput.length > 40 ? "..." : ""), description: storyInput, status: "active", tags: ["story-studio"], thumbnail: undefined });
      addProgress(t("storyStudio.progress.projectDone") + ": " + projectId.slice(-8));

      const characterIds: string[] = [];
      characterNames.forEach((name) => {
        addProgress(t("storyStudio.progress.character") + ": " + name);
        const charId = addCharacter({ name, description: name + " - from story", prompt: "Portrait of " + name + ", cinematic lighting, high quality", tags: ["auto-generated"], referenceImages: [], isFavorite: false, projectId });
        characterIds.push(charId);
      });

      addProgress(t("storyStudio.progress.scene"));
      const sceneIds: string[] = [];
      for (let i = 0; i < sceneSuggestions.length; i++) {
        const sd = sceneSuggestions[i];
        const sceneId = addScene({ title: sd.title, description: sd.description, order: i, projectId, prompt: sd.prompt, renderedPrompt: sd.prompt, characterIds, assetIds: [] });
        sceneIds.push(sceneId);
        addShot(sceneId, { sceneId, title: sd.title + " - Shot 1", description: sd.description, order: 0, type: "image", prompt: sd.prompt, renderedPrompt: sd.prompt, negativePrompt: "", characterIds, assetIds: [], duration: 5, transition: "dissolve" });
      }
      addProgress(sceneIds.length + " " + t("storyStudio.progress.sceneDone"));

      addProgress(t("storyStudio.progress.timeline"));
      const timelineId = createTimeline({ name: "Story: " + storyInput.slice(0, 30), projectId, fps: 24, width: 1920, height: 1080, duration: 0 });
      setResult({ projectId, sceneIds, characterIds, timelineId });
      addProgress(t("storyStudio.progress.complete"));
    } catch (err: any) {
      addProgress(t("storyStudio.error") + ": " + (err.message || t("error.general")));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="text-center space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-4 py-1.5 text-sm text-purple-400 border border-purple-500/20"><Sparkles className="h-4 w-4" /> {t("storyStudio.badge")}</div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">{t("storyStudio.heading")}</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("storyStudio.subtitle")}</p>
        </div>

        <Card className="p-6 bg-white/[0.03] backdrop-blur-xl border-white/5">
          <div className="space-y-4">
            <p className="text-base font-medium">{t("storyStudio.input")}</p>
            <Textarea value={storyInput} onChange={(e) => setStoryInput(e.target.value)} placeholder={t("storyStudio.placeholder")} className="min-h-[120px] text-sm" disabled={isGenerating} />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">{storyInput.trim().split(/[.?!\n]+/).filter(Boolean).length > 0 && <Badge variant="outline" className="text-xs">{sceneSuggestions.length} {t("storyStudio.scenes")}, {characterNames.length} {t("storyStudio.characters")}</Badge>}</div>
              <Button size="lg" className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600" onClick={handleGenerate} disabled={!storyInput.trim() || isGenerating}>
                {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("storyStudio.generating")}</> : <><Wand2 className="h-4 w-4" /> {t("storyStudio.generate")}</>}
              </Button>
            </div>
          </div>
        </Card>

        {progress.length > 0 && (
          <Card className="p-4 bg-white/[0.03] backdrop-blur-xl border-white/5">
            <div className="space-y-1.5">{progress.map((msg, i) => <div key={i} className="flex items-center gap-2 text-sm">{msg.includes("Error") ? <span className="text-red-400 shrink-0">{"\u2716"}</span> : msg.includes(t("storyStudio.progress.complete").slice(0, 4)) ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> : isGenerating && i === progress.length - 1 ? <Loader2 className="h-4 w-4 animate-spin text-purple-400 shrink-0" /> : <span className="text-muted-foreground shrink-0">{"\u00B7"}</span>}<span>{msg}</span></div>)}</div>
          </Card>
        )}

        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t("storyStudio.actions.openProject"), icon: Layout, href: "/projects/" + result.projectId, color: "from-emerald-500/20 to-teal-500/20 text-emerald-400" },
              { label: t("storyStudio.actions.storyboard"), icon: Clapperboard, href: "/storyboard/" + result.projectId, color: "from-blue-500/20 to-cyan-500/20 text-blue-400" },
              { label: t("storyStudio.actions.editor"), icon: Play, href: "/editor", color: "from-purple-500/20 to-pink-500/20 text-purple-400" },
              { label: t("storyStudio.actions.characters"), icon: User, href: "/characters", color: "from-orange-500/20 to-red-500/20 text-orange-400" },
            ].map((action) => <Card key={action.label} className="p-4 bg-white/[0.03] backdrop-blur-xl border-white/5 cursor-pointer hover:bg-white/[0.06] transition-all group" onClick={() => router.push(action.href)}><div className="flex flex-col items-center gap-2 text-center"><div className={"h-10 w-10 rounded-xl bg-gradient-to-br " + action.color + " flex items-center justify-center"}><action.icon className="h-5 w-5" /></div><span className="text-sm font-medium">{action.label}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /></div></Card>)}
        </div>
        )}

        <Card className="p-6 bg-white/[0.03] backdrop-blur-xl border-white/5">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">{t("storyStudio.pipeline")}</h2>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {[{ icon: BookTemplate, label: t("storyStudio.story") }, { icon: Layout, label: t("storyStudio.project") }, { icon: User, label: t("storyStudio.characters") }, { icon: Clapperboard, label: t("storyStudio.scene") }, { icon: Film, label: t("storyStudio.shot") }, { icon: Play, label: t("storyStudio.timeline") }].map((step, i) => <div key={step.label} className="flex items-center gap-2"><div className="flex flex-col items-center"><div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center"><step.icon className="h-5 w-5 text-purple-400" /></div><span className="text-xs font-medium mt-1">{step.label}</span></div>{i < 5 && <ArrowRight className="h-4 w-4 text-muted-foreground/30 mb-6" />}</div>)}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
