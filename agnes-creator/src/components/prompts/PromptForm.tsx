"use client";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Plus, Eye } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { PromptTemplate, PromptCategory } from "@/types";
import { extractVariables, renderPrompt } from "@/stores/promptStore";

const categories: { value: PromptCategory; labelKey: string }[] = [
  { value: "general", labelKey: "prompt.categories.general" },
  { value: "character", labelKey: "prompt.categories.character" },
  { value: "scene", labelKey: "prompt.categories.scene" },
  { value: "style", labelKey: "prompt.categories.style" },
  { value: "action", labelKey: "prompt.categories.action" },
  { value: "environment", labelKey: "prompt.categories.environment" },
  { value: "custom", labelKey: "prompt.categories.custom" },
];

interface PromptFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<PromptTemplate, "id" | "createdAt" | "updatedAt">) => void;
  initial?: PromptTemplate;
}

export function PromptForm({ open, onOpenChange, onSubmit, initial }: PromptFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || "");
  const [content, setContent] = useState(initial?.content || "");
  const [category, setCategory] = useState<PromptCategory>(initial?.category || "general");
  const [description, setDescription] = useState(initial?.description || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [showPreview, setShowPreview] = useState(false);

  const variables = useMemo(() => extractVariables(content), [content]);
  const previewVariables = useMemo(() => Object.fromEntries(variables.map((v) => [v, "[" + v + "]"])), [variables]);
  const preview = useMemo(() => renderPrompt(content, previewVariables), [content, previewVariables]);

  const addTag = () => {
    const tVal = tagInput.trim();
    if (tVal && !tags.includes(tVal)) { setTags([...tags, tVal]); setTagInput(""); }
  };

  const handleSubmit = () => {
    if (!name.trim() || !content.trim()) return;
    onSubmit({ name: name.trim(), content: content.trim(), category, tags, variables, description: description.trim(), isFavorite: initial?.isFavorite || false, projectId: initial?.projectId, usageCount: 0 });
    if (!initial) { setName(""); setContent(""); setCategory("general"); setDescription(""); setTags([]); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? t("prompt.edit") : t("prompt.new")}</DialogTitle>
          <DialogDescription>{t("prompt.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("prompt.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("prompt.name")} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("prompt.content")}</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setShowPreview(!showPreview)}><Eye className="h-3 w-3" /> {showPreview ? t("prompt.edit") : t("prompt.preview")}</Button>
            </div>
            {showPreview ? (
              <div className="min-h-[100px] rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{preview}</div>
            ) : (
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("prompt.content") + " - " + t("prompt.variables") + ": {style}, {character}, ..."} className="min-h-[120px]" />
            )}
            {variables.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (<Badge key={v} variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">{"{" + v + "}"}</Badge>))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("prompt.category")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as PromptCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => (<SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("prompt.description")}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("prompt.description")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("common.tags")}</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder={t("common.tags")} className="flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={addTag}><Plus className="h-4 w-4" /></Button>
            </div>
            {tags.length > 0 && (<div className="flex flex-wrap gap-1.5">{tags.map((tVal) => (<Badge key={tVal} variant="secondary" className="text-xs gap-1">{tVal}<X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter((x) => x !== tVal))} /></Badge>))}</div>)}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || !content.trim()}>{initial ? t("common.save") : t("common.create")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
