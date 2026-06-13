"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { Project, ProjectStatus } from "@/types";

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Project, "id" | "scenes" | "characters" | "assets" | "createdAt" | "updatedAt">) => void;
  initial?: Project;
}

export function ProjectForm({ open, onOpenChange, onSubmit, initial }: ProjectFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status || "draft");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags || []);

  const addTag = () => { const tVal = tagInput.trim(); if (tVal && !tags.includes(tVal)) { setTags([...tags, tVal]); setTagInput(""); } };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), status, tags, thumbnail: initial?.thumbnail, styleDna: initial?.styleDna || "", lockedCharacterIds: initial?.lockedCharacterIds || [] });
    if (!initial) { setName(""); setDescription(""); setStatus("draft"); setTags([]); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? t("project.edit") : t("project.new")}</DialogTitle>
          <DialogDescription>{t("project.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("project.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("project.name")} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("common.description")} className="min-h-[60px]" />
          </div>
          <div className="space-y-2">
            <Label>{t("project.status")}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("project.statuses.draft")}</SelectItem>
                <SelectItem value="active">{t("project.statuses.active")}</SelectItem>
                <SelectItem value="completed">{t("project.statuses.completed")}</SelectItem>
                <SelectItem value="archived">{t("project.statuses.archived")}</SelectItem>
              </SelectContent>
            </Select>
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
            <Button onClick={handleSubmit} disabled={!name.trim()}>{initial ? t("common.save") : t("common.create")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
