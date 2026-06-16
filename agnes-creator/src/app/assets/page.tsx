"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { useUnifiedAssetStore } from "@/stores/unifiedAssetStore";
import { StorageService } from "@/services/StorageService";
import { AssetsDB } from "@/services/AssetsDB";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Search, Star, Trash2, Image, Video, Download, FolderOpen, Eye, RefreshCw, LayoutGrid, List,
  Film, User, Folder, Clock, HardDrive, Sparkles, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetIndex, AssetFilter } from "@/types/asset";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, index)).toFixed(1)) + " " + sizes[index];
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  if (diff < 604800000) return Math.floor(diff / 86400000) + "天前";
  return d.toLocaleDateString("zh-CN");
}

function getCategoryColor(cat: string): string {
  const m: Record<string, string> = {
    generated: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    uploaded: "bg-green-500/10 text-green-400 border-green-500/20",
    reference: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    output: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return m[cat] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
}

function getCategoryLabel(cat: string): string {
  const m: Record<string, string> = { generated: "生成", uploaded: "上传", reference: "参考", output: "输出" };
  return m[cat] || cat;
}

function AssetCard({ asset, isSelected, onSelect, onToggleFavorite, onPreview, onDelete }: {
  asset: AssetIndex; isSelected: boolean;
  onSelect: () => void; onToggleFavorite: () => void; onPreview: () => void;
  onDelete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const blobUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const storeName = asset.type === "video" ? "videos" : "images";
        const blob = await AssetsDB.load(storeName, asset.id);
        if (cancelled) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          if (!cancelled) setBlobUrl(url);
        } else { if (!cancelled) setImgError(true); }
      } catch { if (!cancelled) setImgError(true); }
    })();
    return () => { cancelled = true; if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = undefined; } };
  }, [visible, asset.id, asset.type]);

  return (
    <Card ref={containerRef} onClick={onPreview}
      className={cn("group relative overflow-hidden border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-all duration-200 hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/10",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-black border-primary/50")}>
      <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-950">
        {visible && blobUrl && !imgError && asset.type === "image" ? (
          <img src={blobUrl} alt={asset.name}
            className={cn("w-full h-full object-cover transition-all duration-500", imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105")}
            onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} />
                ) : visible && blobUrl && !imgError && asset.type === "video" ? (
          <video src={blobUrl} className="w-full h-full object-cover" muted loop
            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
            onMouseLeave={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
            onLoadedData={() => setImgLoaded(true)} onError={() => setImgError(true)} />
        ) : visible && !blobUrl && !imgError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
          </div>
        ) : asset.type === "video" ? (
          <div className="w-full h-full flex items-center justify-center relative">
            <Video className="h-10 w-10 text-purple-400/30" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-12 w-12 rounded-full bg-purple-500/30 flex items-center justify-center backdrop-blur-sm">
                <div className="h-0 w-0 border-y-[8px] border-y-transparent border-l-[14px] border-l-white ml-1" />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="h-10 w-10 text-white/15" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm",
            asset.type === "image" ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300")}>
            {asset.type === "image" ? "图片" : "视频"}
          </span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded bg-black/40 hover:bg-red-500/40 text-white/60 hover:text-red-300 transition-colors backdrop-blur-sm"
            title="删除">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm border", getCategoryColor(asset.category))}>
            {getCategoryLabel(asset.category)}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-2">
          <div className="flex items-center gap-1">
            <Checkbox checked={isSelected}
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="bg-white/10 data-[state=checked]:bg-primary" />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/10 hover:bg-white/20 text-white"
              onClick={(e) => { e.stopPropagation(); onPreview(); }}><Eye className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/10 hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
              <Star className={cn("h-3.5 w-3.5", asset.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-white")} />
            </Button>
          </div>
        </div>

      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-xs font-medium leading-tight line-clamp-2 min-h-[2em]">
          {asset.characterName ? (
            <><span className="text-blue-400">{asset.characterName}</span>
              {asset.name !== asset.characterName && <span className="text-white/70"> - {asset.name}</span>}</>
          ) : asset.name}
        </p>
        <div className="flex flex-wrap gap-1">
          {asset.projectName && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-white/40">
              <Folder className="h-2.5 w-2.5" />{asset.projectName}
            </span>
          )}
          {asset.characterName && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-300/60">
              <User className="h-2.5 w-2.5" />{asset.characterName}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-[9px] text-white/30">
          <span className="inline-flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{formatDate(asset.createdAt)}</span>
          <div className="flex items-center gap-1">
            {asset.fileSize > 0 && <span className="inline-flex items-center gap-0.5"><HardDrive className="h-2.5 w-2.5" />{formatBytes(asset.fileSize)}</span>}

          </div>
        </div>
      </div>
    </Card>
  );
}

function PreviewDialog({ asset, open, onClose }: { asset: AssetIndex | null; open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !asset) return;
    setLoading(true); setError(null); setBlobUrl(undefined);
    let cancelled = false;
    (async () => {
      try {
        const result = await StorageService.loadAsset(asset.id, asset.type);
        if (cancelled) return;
        if (result.success && result.data) {
          const url = URL.createObjectURL(result.data);
          if (!cancelled) setBlobUrl(url);
        } else { if (!cancelled) setError(result.error || "加载失败"); }
      } catch (err: unknown) { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [asset, open]);

  useEffect(() => { return () => { if (blobUrl?.startsWith("blob:")) URL.revokeObjectURL(blobUrl); }; }, [blobUrl]);

  const handleDownload = () => {
    if (!asset || !blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = asset.name || ("asset-" + asset.id);
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-auto bg-gray-950/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {asset?.type === "image" ? <Image className="h-4 w-4 text-blue-400" /> : <Video className="h-4 w-4 text-purple-400" />}
            <span className="truncate">{asset?.name || "预览"}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded ml-1",
              asset?.type === "image" ? "bg-blue-500/10 text-blue-300" : "bg-purple-500/10 text-purple-300")}>
              {asset?.type === "image" ? "图片" : "视频"}
            </span>
            <Button variant="outline" size="sm" className="ml-auto gap-2 h-8" onClick={handleDownload} disabled={!blobUrl}>
              <Download className="h-3.5 w-3.5" /> 下载
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          {loading && (<div className="flex items-center gap-2 text-muted-foreground text-sm"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" /> 加载中...</div>)}
          {error && <div className="text-red-400 text-sm bg-red-500/5 px-4 py-2 rounded-lg">{error}</div>}
          {blobUrl && !loading && asset?.type === "image" && <img src={blobUrl} alt={asset.name} className="max-w-full max-h-[70vh] object-contain rounded-lg" />}
          {blobUrl && !loading && asset?.type === "video" && <video src={blobUrl} controls className="max-w-full max-h-[70vh] rounded-lg" />}
        </div>
        {asset && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-white/50 mt-3 p-3 rounded-lg bg-white/[0.03]">
            <div><Image className="h-3 w-3 inline mr-1" />类型: {asset.type === "image" ? "图片" : "视频"}</div>
            <div><HardDrive className="h-3 w-3 inline mr-1" />大小: {formatBytes(asset.fileSize)}</div>
            {asset.projectName && <div><Folder className="h-3 w-3 inline mr-1" />项目: {asset.projectName}</div>}
            {asset.characterName && <div><User className="h-3 w-3 inline mr-1" />角色: {asset.characterName}</div>}
            <div><Clock className="h-3 w-3 inline mr-1" />创建: {new Date(asset.createdAt).toLocaleString("zh-CN")}</div>
            <div><Badge className={cn("text-[9px] h-4", getCategoryColor(asset.category))}>{getCategoryLabel(asset.category)}</Badge></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AssetsPage() {
  const { t } = useTranslation();
  const { indexes, loading, error, syncFromStorage, removeIndex, removeIndexes, toggleFavorite, search, getProjectNames, getCharacterNames, getAllTags } = useUnifiedAssetStore();

  useEffect(() => { syncFromStorage(); }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [characterFilter, setCharacterFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const projectNames = useMemo(() => getProjectNames(), [indexes]);
  const characterNames = useMemo(() => getCharacterNames(), [indexes]);
  const allTags = useMemo(() => getAllTags(), [indexes]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewAsset, setPreviewAsset] = useState<AssetIndex | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    const filter: AssetFilter = {};
    if (debouncedSearch) filter.search = debouncedSearch;
    if (typeFilter !== "all") filter.type = typeFilter;
    if (projectFilter !== "all") filter.projectId = projectFilter;
    if (characterFilter !== "all") filter.characterId = characterFilter;
    if (tagFilter) filter.tag = tagFilter;
    if (categoryFilter !== "all") filter.category = categoryFilter as any;
    return search(filter);
  }, [indexes, debouncedSearch, typeFilter, projectFilter, characterFilter, tagFilter, categoryFilter, search]);

  const stats = useMemo(() => {
    const total = indexes.length;
    const images = indexes.filter((a) => a.type === "image").length;
    const videos = indexes.filter((a) => a.type === "video").length;
    const totalSize = indexes.reduce((s, a) => s + (a.fileSize || 0), 0);
    return { total, images, videos, totalSize };
  }, [indexes]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const handleSingleDelete = async (id: string) => {
    await StorageService.deleteAsset(id);
    removeIndex(id);
  };

  const handleBatchDelete = async () => {
    for (const id of Array.from(selectedIds)) await StorageService.deleteAsset(id);
    removeIndexes(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">素材资源库</h1>
              <p className="text-xs text-muted-foreground mt-0.5">统一管理所有生成的图片和视频资源</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => syncFromStorage()}>
              <RefreshCw className="h-3.5 w-3.5" /> 刷新
            </Button>
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleBatchDelete}>
                <Trash2 className="h-3.5 w-3.5" /> 删除 {selectedIds.size} 项
              </Button>
            )}
            <div className="flex border border-white/10 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode("grid")}
                className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("list")}
                className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[{ label: "全部资源", value: stats.total, icon: "Sparkles", color: "from-blue-500/10 to-purple-500/10 text-blue-400" },
            { label: "图片", value: stats.images, icon: "Image", color: "from-green-500/10 to-emerald-500/10 text-green-400" },
            { label: "视频", value: stats.videos, icon: "Film", color: "from-purple-500/10 to-pink-500/10 text-purple-400" },
            { label: "总大小", value: formatBytes(stats.totalSize), icon: "HardDrive", color: "from-amber-500/10 to-orange-500/10 text-amber-400" },
          ].map((stat) => {
            const IconMap: Record<string, any> = { Sparkles, Image, Film, HardDrive };
            const Icon = IconMap[stat.icon];
            return (
              <div key={stat.label} className={cn("rounded-xl border border-white/[0.06] bg-gradient-to-br p-3", stat.color)}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 opacity-70" />
                  <span className="text-[10px] text-white/50">{stat.label}</span>
                </div>
                <p className="text-lg font-semibold mt-1">{stat.value}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索资源名称、项目、角色..." className="pl-9 h-9 text-xs border-white/10 bg-white/[0.03]" />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="w-[90px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="image">图片</SelectItem>
              <SelectItem value="video">视频</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              <SelectItem value="generated">生成</SelectItem>
              <SelectItem value="uploaded">上传</SelectItem>
              <SelectItem value="reference">参考</SelectItem>
              <SelectItem value="output">输出</SelectItem>
            </SelectContent>
          </Select>
          {projectNames.length > 0 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[110px] h-9 text-xs"><SelectValue placeholder="项目" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部项目</SelectItem>
                {projectNames.map((n: string) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {characterNames.length > 0 && (
            <Select value={characterFilter} onValueChange={setCharacterFilter}>
              <SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue placeholder="角色" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                {characterNames.map((n: string) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={!tagFilter ? "default" : "outline"} className="cursor-pointer text-[10px] h-5" onClick={() => setTagFilter(null)}>全部</Badge>
            {allTags.map((tag: string) => (
              <Badge key={tag} variant={tagFilter === tag ? "default" : "outline"} className="cursor-pointer text-[10px] h-5"
                onClick={() => setTagFilter(tag === tagFilter ? null : tag)}>{tag}</Badge>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />正在同步资源...
          </div>
        )}

        {error && (
          <div className="text-center py-16 text-red-400 rounded-xl border border-red-500/20 bg-red-500/5">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">加载出错：{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => syncFromStorage()}>重试</Button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground rounded-xl border border-dashed border-white/[0.06]">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
              <FolderOpen className="h-8 w-8 opacity-30" />
            </div>
            <p className="text-sm">{indexes.length === 0 ? "暂无资源" : "无匹配结果"}</p>
            <p className="text-xs mt-1 opacity-50">{indexes.length === 0 ? "在流水线中生成图片或视频后将自动出现在这里" : "尝试调整筛选条件"}</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && viewMode === "grid" && (
          <>
            <div className="text-xs text-white/40">共 {filtered.length} 个资源</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map((asset: AssetIndex) => (
                <AssetCard key={asset.id} asset={asset} isSelected={selectedIds.has(asset.id)}
                  onSelect={() => toggleSelect(asset.id)} onToggleFavorite={() => toggleFavorite(asset.id)}
                  onPreview={() => { setPreviewAsset(asset); setPreviewOpen(true); }}
                  onDelete={() => handleSingleDelete(asset.id)} />
              ))}
            </div>
          </>
        )}

        {!loading && !error && filtered.length > 0 && viewMode === "list" && (
          <>
            <div className="text-xs text-white/40 mb-2">共 {filtered.length} 个资源</div>
            <div className="space-y-1">
              {filtered.map((asset: AssetIndex) => (
                <div key={asset.id} onClick={() => toggleSelect(asset.id)}
                  className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors",
                    selectedIds.has(asset.id) && "bg-white/[0.06] border-primary/30")}>
                  <Checkbox checked={selectedIds.has(asset.id)} className="shrink-0" />
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    asset.type === "image" ? "bg-blue-500/10" : "bg-purple-500/10")}>
                    {asset.type === "image" ? <Image className="h-4 w-4 text-blue-400" /> : <Video className="h-4 w-4 text-purple-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {asset.characterName ? <span className="text-blue-400">{asset.characterName}</span> : asset.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {asset.projectName && <span className="text-[10px] text-white/40">{asset.projectName}</span>}
                      <span className={cn("text-[9px] px-1 py-0.5 rounded", getCategoryColor(asset.category))}>{getCategoryLabel(asset.category)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/30 shrink-0">{formatDate(asset.createdAt)}</span>
                  <span className="text-[10px] text-white/30 shrink-0">{formatBytes(asset.fileSize)}</span>
                  <button onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id); }}
                    className="shrink-0 p-1 hover:bg-white/10 rounded"><Star className={cn("h-3.5 w-3.5", asset.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-white/30")} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); setPreviewOpen(true); }}
                    className="shrink-0 p-1 hover:bg-white/10 rounded text-white/30 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </>
        )}

        <PreviewDialog asset={previewAsset} open={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewAsset(null); }} />
      </div>
    </AppShell>
  );
}