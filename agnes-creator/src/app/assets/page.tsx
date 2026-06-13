"use client";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/i18n";
import { useAssetStore } from "@/stores/assetStore";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, Star, Trash2, Image, Video, Files, Upload, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types";

const typeIcons: Record<string, typeof Image> = { image: Image, video: Video, audio: Files, document: Files, prompt: Files };

export default function AssetsPage() {
  const { t } = useTranslation();
  const { assets, addAsset, removeAssets, toggleFavorite } = useAssetStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(searchQuery, 300);
  const allTags = useMemo(() => { const tags = new Set<string>(); assets.forEach((a) => a.tags.forEach((t) => tags.add(t))); return Array.from(tags); }, [assets]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = assets;
    if (debouncedSearch) { const q = debouncedSearch.toLowerCase(); r = r.filter((a) => a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q))); }
    if (typeFilter !== "all") r = r.filter((a) => a.type === typeFilter);
    if (selectedTag) r = r.filter((a) => a.tags.includes(selectedTag));
    return r.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) || b.updatedAt - a.updatedAt);
  }, [assets, debouncedSearch, typeFilter, selectedTag]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  };

  const handleBatchDelete = () => { removeAssets(Array.from(selectedIds)); setSelectedIds(new Set()); };

  const handleAddAsset = () => {
    const url = prompt(t("common.upload") + " URL:");
    if (!url) return;
    const name = prompt(t("common.name") + ":", url.split("/").pop() || t("common.add"));
    if (!name) return;
    const ext = url.split(".").pop()?.toLowerCase() || "";
    const type: AssetType = ["mp4", "webm", "mov"].includes(ext) ? "video" : ["mp3", "wav"].includes(ext) ? "audio" : "image";
    addAsset({ name, url, type, tags: [], category: "uploaded", isFavorite: false });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">{t("assets.title")}</h1><p className="text-sm text-muted-foreground mt-1">{t("assets.subtitle")}</p></div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && <Button variant="destructive" size="sm" className="gap-2" onClick={handleBatchDelete}><Trash2 className="h-4 w-4" />{t("assets.deleteItems", { count: selectedIds.size })}</Button>}
            <Button className="gap-2" onClick={handleAddAsset}><Upload className="h-4 w-4" />{t("assets.add")}</Button>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("assets.search")} className="pl-9 h-10" /></div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as AssetType | "all")}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("assets.all")}</SelectItem><SelectItem value="image">{t("assets.image")}</SelectItem><SelectItem value="video">{t("assets.video")}</SelectItem><SelectItem value="audio">{t("assets.audio")}</SelectItem></SelectContent></Select>
        </div>
        {allTags.length > 0 && (<div className="flex flex-wrap gap-2"><Badge variant={!selectedTag ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedTag(null)}>{t("common.all")}</Badge>{allTags.map((tag) => (<Badge key={tag} variant={selectedTag === tag ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedTag(tag)}>{tag}</Badge>))}</div>)}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground rounded-lg border border-dashed border-white/10"><FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>{t("assets.noAssets")}</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((asset) => {
              const Icon = typeIcons[asset.type] || Files;
              const isSelected = selectedIds.has(asset.id);
              return (
                <Card key={asset.id} className={cn("group relative overflow-hidden border-white/5 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.06] cursor-pointer", isSelected && "ring-2 ring-primary")} onClick={() => toggleSelect(asset.id)}>
                  <div className="aspect-square relative overflow-hidden">
                    {asset.type === "image" ? <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" /> : asset.type === "video" ? <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20"><Video className="h-8 w-8 text-blue-400" /></div> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-500/20 to-gray-600/20"><Icon className="h-8 w-8 text-gray-400" /></div>}
                    <div className="absolute top-2 left-2"><Checkbox checked={isSelected} className={cn("opacity-0 group-hover:opacity-100", isSelected && "opacity-100")} /></div>
                    <div className="absolute top-2 right-2"><button onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id); }}><Star className={cn("h-4 w-4 drop-shadow-lg", asset.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-white opacity-0 group-hover:opacity-100")} /></button></div>
                  </div>
                  <div className="p-2.5"><p className="text-xs font-medium truncate">{asset.name}</p><Badge className="text-[9px] h-4 px-1 mt-1" variant="outline">{asset.type}</Badge></div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
