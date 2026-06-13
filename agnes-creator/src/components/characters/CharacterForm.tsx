"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { X, Plus, Upload } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { Character } from "@/types";

interface CharacterFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Character, "id" | "createdAt" | "updatedAt">) => void;
  initial?: Character;
}

export function CharacterForm({ open, onOpenChange, onSubmit, initial }: CharacterFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [prompt, setPrompt] = useState(initial?.prompt || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [refImages, setRefImages] = useState<string[]>(initial?.referenceImages || []);

  const addTag = () => { const tVal = tagInput.trim(); if (tVal && !tags.includes(tVal)) { setTags([...tags, tVal]); setTagInput(""); } };

  const handleAddImage = () => {
    const url = window.prompt(t("common.upload"));
    if (url) setRefImages([...refImages, url]);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), prompt: prompt.trim(), tags, referenceImages: refImages, isFavorite: initial?.isFavorite || false, projectId: initial?.projectId, references: initial?.references || [], profile: initial?.profile || { age: "", gender: "", appearance: "", hair: "", clothing: "", personality: "", background: "" }, dnaBlock: initial?.dnaBlock || `${name.trim()}, `, isLocked: initial?.isLocked || false });
    if (!initial) { setName(""); setDescription(""); setPrompt(""); setTags([]); setRefImages([]); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? t("character.edit") : t("character.new")}</DialogTitle>
          <DialogDescription>{t("character.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("character.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("character.name")} />
          </div>
          <div className="space-y-2">
            <Label>{t("character.prompt")}</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("character.prompt")} className="min-h-[100px]" />
          </div>
          <div className="space-y-2">
            <Label>{t("character.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("character.description")} className="min-h-[60px]" />
          </div>
          <div className="space-y-2">
            <Label>{t("common.tags")}</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder={t("common.tags")} className="flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={addTag}><Plus className="h-4 w-4" /></Button>
            </div>
            {tags.length > 0 && (<div className="flex flex-wrap gap-1.5">{tags.map((tVal) => (<Badge key={tVal} variant="secondary" className="text-xs gap-1">{tVal}<X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter((x) => x !== tVal))} /></Badge>))}</div>)}
          </div>
          <div className="space-y-2">
            <Label>{t("character.referenceImages")}</Label>
            <div className="flex flex-wrap gap-2">
              {refImages.map((url, i) => (
                <div key={i} className="relative group/img w-20 h-20 rounded-lg overflow-hidden border border-white/10">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center" onClick={() => setRefImages(refImages.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
              <Button variant="outline" className="w-20 h-20 rounded-lg" onClick={handleAddImage}>
                <Upload className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>{initial ? t("common.save") : t("common.create")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
