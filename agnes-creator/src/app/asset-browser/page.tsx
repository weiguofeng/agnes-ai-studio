"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StorageService } from "@/services/StorageService";
import type { AssetRecord } from "@/services/AssetsDB";
import { Search, Image, Video, Trash2, Copy, ExternalLink, AlertCircle } from "lucide-react";

export default function AssetBrowserPage() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all");
  const [error, setError] = useState("");

  const loadAssets = async () => {
    setLoading(true);
    setError("");
    try {
      const all = await StorageService.listAssets();
      setAssets(all);
    } catch (e) {
      setError("Failed to load assets: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  };

  useEffect(() => { loadAssets(); }, []);

  const filtered = assets.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false;
    if (search && !a.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    const r = await StorageService.deleteAsset(id);
    if (r.success) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "?";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Asset Browser</h1>
            <p className="text-muted-foreground text-sm mt-1">Browse and manage all stored assets</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAssets} disabled={loading}>
            Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "image", "video"] as const).map((t) => (
                  <button key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-md text-xs ${filterType === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
                  >
                    {t === "all" ? "All" : t === "image" ? "Images" : "Videos"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/5 rounded-lg p-3">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center text-muted-foreground py-12">Loading assets...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12">No assets found</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                {asset.type === "image" ? (
                  <img src={asset.url} alt={""} className="object-cover w-full h-full" />
                ) : (
                  <video src={asset.url} className="object-cover w-full h-full" controls />
                )}
              </div>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    {asset.type === "image" ? <Image className="h-3 w-3 mr-1" /> : <Video className="h-3 w-3 mr-1" />}
                    {asset.type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{formatSize(asset.fileSize)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate" title={asset.id}>
                  {asset.id.slice(0, 24)}...
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(asset.createdAt).toLocaleDateString()}
                </p>
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopyUrl(asset.url)} title="Copy URL">
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(asset.url, "_blank")} title="Open">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => handleDelete(asset.id)} title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
