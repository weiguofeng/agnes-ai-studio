"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/i18n";
import { useProjectStore } from "@/stores/projectStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useConfigStore } from "@/stores/configStore";
import { agnes } from "@/services/agnes";
import { logger } from "@/lib/logger";
import { Loader2, Sparkles, Users, CheckCircle2, AlertCircle, Download, Image as ImageIcon, Save } from "lucide-react";
import { StorageService } from '@/services/StorageService';
import { useAssetStore } from '@/stores/assetStore';
import type { Character } from '@/types';

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "1:1 Square" },
  { value: "768x1344",  label: "9:16 Portrait" },
  { value: "1344x768",  label: "16:9 Landscape" },
  { value: "512x512",   label: "512x512" },
  { value: "1024x1792", label: "9:16 HD" },
  { value: "1792x1024", label: "16:9 HD" },
];

interface CharacterImageSectionProps {
  project: any;
}

function usedCharacterIds(scenes: any[]): string[] {
  const ids = new Set<string>();
  for (const sc of scenes || []) {
    for (const cid of sc.characterIds || []) ids.add(cid);
    for (const sh of sc.shots || []) {
      for (const cid of sh.characterIds || []) ids.add(cid);
    }
  }
  return [...ids];
}

function buildDefaultPrompt(ch: Character): string {
  // Use character's prompt or auto-generated DNA block, avoid name duplication
  return ch.prompt || ch.dnaBlock || ch.description || ch.name;
}

function CharacterCard({ ch, imageUrl, isGenerating, onGenerate, onDownload, onSaveToLibrary }: {
  ch: Character;
  imageUrl?: string;
  isGenerating: boolean;
  onGenerate: (prompt: string, size: string) => void;
  onDownload: (url: string) => void;
  onSaveToLibrary: (url: string) => void;
}) {
  const { t } = useTranslation();
  const defaultPrompt = useMemo(() => buildDefaultPrompt(ch), [ch]);
  const [editPrompt, setEditPrompt] = useState(defaultPrompt);
  const [size, setSize] = useState("1024x1024");
  const [saving, setSaving] = useState(false);

  // Has reference images from character library?
  const hasRefImages = ch.referenceImages.length > 0 || ch.references.length > 0;
  const allRefUrls = [
    ...ch.referenceImages,
    ...ch.references.map((r) => r.url),
  ];

  const handleSaveToLibrary = async () => {
    if (!imageUrl) return;
    setSaving(true);
    await onSaveToLibrary(imageUrl);
    setSaving(false);
  };

  return (
    <div className="rounded-lg border border-white/5 p-3 space-y-3">
      {/* Header: name + status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {ch.name}
        </span>
        {imageUrl && (
          <Badge variant="outline" className="text-[9px] text-green-400 border-green-400/30 gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> {t("pipeline.imageGenerated")}
          </Badge>
        )}
      </div>

      {/* Reference images from character library */}
      {hasRefImages && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">{t("pipeline.charRefImages")}</Label>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {allRefUrls.slice(0, 5).map((url, i) => (
              <div key={i} className="relative w-12 h-12 rounded overflow-hidden border border-white/10 bg-black/20 shrink-0 group cursor-pointer"
                onClick={() => window.open(url, "_blank")}>
                <img src={url} alt="" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated image preview */}
      {imageUrl && (
        <div className="flex justify-center">
          <div className="relative aspect-square w-full max-w-[200px] rounded-lg overflow-hidden border border-white/10 bg-black/20">
            <img src={imageUrl} alt={ch.name} className="w-full h-full object-cover" />
            {/* Actions overlay on hover */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
                onClick={() => onDownload(imageUrl)}>
                <Download className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
                onClick={handleSaveToLibrary} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt editor */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">{t("pipeline.charImagePrompt")}</Label>
        <textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background/50 px-2.5 py-1.5 text-xs resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          placeholder={t("pipeline.charImagePromptPlaceholder")}
        />
      </div>

      {/* Size selector */}
      <div className="flex items-center gap-2">
        <Label className="text-[10px] text-muted-foreground shrink-0">{t("pipeline.charImageSize")}</Label>
        <Select value={size} onValueChange={setSize}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Generate button */}
      <Button
        size="sm"
        variant={imageUrl ? "outline" : "default"}
        className="gap-1.5 w-full h-8 text-xs"
        onClick={() => onGenerate(editPrompt, size)}
        disabled={isGenerating || !editPrompt.trim()}
      >
        {isGenerating ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("common.generating")}</>
        ) : imageUrl ? (
          <><Sparkles className="h-3.5 w-3.5" /> {t("pipeline.regenerateCharImage")}</>
        ) : (
          <><Sparkles className="h-3.5 w-3.5" /> {t("pipeline.generateCharImage")}</>
        )}
      </Button>
    </div>
  );
}

export function CharacterImageSection({ project }: CharacterImageSectionProps) {
  const { t } = useTranslation();
  const { characters, addReferenceImage } = useCharacterStore();
  const { updateProject } = useProjectStore();
  const config = useConfigStore();
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const projectCharIds = useMemo(() => usedCharacterIds(project?.scenes || []), [project?.scenes]);
  const usedChars = useMemo(() =>
    characters.filter((c) => projectCharIds.includes(c.id)),
    [characters, projectCharIds]
  );

  const charImages: Record<string, string> = (project as any).characterImages || {};

  const generateImage = async (ch: Character, prompt: string, size: string) => {
    setGenerating((prev) => ({ ...prev, [ch.id]: true }));
    setError(null);
    try {
      const images = await agnes.image.generate({
        prompt: prompt.trim(),
        size: size as any,
        n: 1,
        model: config.textToImageModel || config.model || "agnes-image-2.1-flash",
      });
      const url = images[0]?.url;
      if (!url) throw new Error(t("pipeline.noImageResult"));

      const current = (project as any).characterImages || {};
      updateProject(project.id, { characterImages: { ...current, [ch.id]: url } } as any);

      logger.info("CharacterImageSection", "Generated " + ch.name, { charId: ch.id, size });
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(t("pipeline.charImageError") + ": " + msg);
      logger.error("CharacterImageSection", "Failed", { charId: ch.id, error: msg });
    }
    setGenerating((prev) => ({ ...prev, [ch.id]: false }));
  };

  const handleDownload = async (url: string) => {
    try {
      const r = await fetch(url);
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = "character-" + Date.now() + ".png";
      a.click();
      URL.revokeObjectURL(u);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleSaveToLibrary = async (charId: string, url: string) => {
    try {
      addReferenceImage(charId, url, "main");
      setSavedMsg(t("pipeline.charImageSaved"));
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (err: any) {
      setError(t("pipeline.charImageSaveError") + ": " + (err?.message || ""));
    }
  };

  const allGenerated = usedChars.length > 0 && usedChars.every((c) => charImages[c.id]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          {t("pipeline.charImages")}
        </CardTitle>
        <CardDescription>{t("pipeline.charImagesDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usedChars.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("pipeline.noCharsInShots")}</p>
        ) : (
          <div className="space-y-3">
            {allGenerated && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("pipeline.allCharImagesDone")}
              </div>
            )}

            {savedMsg && (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/5 rounded p-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> {savedMsg}
              </div>
            )}

            {usedChars.map((ch) => (
              <CharacterCard
                key={ch.id}
                ch={ch}
                imageUrl={charImages[ch.id]}
                isGenerating={!!generating[ch.id]}
                onGenerate={(prompt, size) => generateImage(ch, prompt, size)}
                onDownload={handleDownload}
                onSaveToLibrary={(url) => handleSaveToLibrary(ch.id, url)}
              />
            ))}

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/5 rounded p-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
