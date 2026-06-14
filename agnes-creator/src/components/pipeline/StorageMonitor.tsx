"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";
import { HardDrive, Image, Video, Trash2, RefreshCw } from "lucide-react";
import { StorageService, formatFileSize } from "@/services/StorageService";

interface StorageInfo {
  imageCount: number;
  videoCount: number;
  cacheSize: string;
  lastCleanup: string;
}

interface CleanupPreviewState {
  totalAssets: number;
  totalSize: string;
  imageCount: number;
  videoCount: number;
  projects: string[];
}

interface StorageMonitorProps {
  projectId?: string;
  imageUrls?: string[];
  videoUrls?: string[];
}

export function StorageMonitor({ projectId, imageUrls = [], videoUrls = [] }: StorageMonitorProps) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<StorageInfo>({ imageCount: 0, videoCount: 0, cacheSize: "0 B", lastCleanup: t("pipeline.neverCleaned") });
  const [cleaning, setCleaning] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupStep, setCleanupStep] = useState<"preview" | "confirm" | "executing">("preview");
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreviewState | null>(null);
  const [cleanupConfirmInput, setCleanupConfirmInput] = useState("");
  const [cleanupProgress, setCleanupProgress] = useState("");
  const [cleanupError, setCleanupError] = useState("");

  const refresh = async () => {
    try {
      const assets = await StorageService.listAssets();
      const scopedAssets = assets.filter((asset) => asset.status === "active" && (!projectId || asset.projectId === projectId));
      const imageKeys = new Set(imageUrls.filter(Boolean));
      const videoKeys = new Set(videoUrls.filter(Boolean));
      for (const asset of scopedAssets) {
        const key = asset.originalUrl || asset.url || asset.id;
        if (asset.type === "image") imageKeys.add(key);
        if (asset.type === "video") videoKeys.add(key);
      }
      const storageInfo = await StorageService.getStorageInfo();

      setInfo({
        imageCount: imageKeys.size,
        videoCount: videoKeys.size,
        cacheSize: formatFileSize(storageInfo.used),
        lastCleanup: t("pipeline.neverCleaned"),
      });
    } catch {
      // Ignore refresh errors so the dashboard remains usable.
    }
  };

  useEffect(() => { refresh(); }, [projectId, imageUrls.join("|"), videoUrls.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClean = async () => {
    setShowCleanupConfirm(true);
    setCleanupStep("preview");
    setCleanupConfirmInput("");
    setCleanupProgress("");
    setCleanupError("");
    try {
      const preview = await StorageService.getCleanupPreview();
      setCleanupPreview({
        totalAssets: preview.totalAssets,
        totalSize: formatFileSize(preview.totalSize),
        imageCount: preview.imageCount,
        videoCount: preview.videoCount,
        projects: preview.projects,
      });
    } catch (err) {
      setCleanupError(t("storage.cleanupFailed", { error: String(err) }));
    }
  };

  const handleCleanupConfirm = async () => {
    const check = await StorageService.confirmCleanup(cleanupConfirmInput);
    if (!check.success) {
      setCleanupError(check.error || t("storage.cleanupInvalidConfirm"));
      return;
    }

    setCleanupStep("executing");
    setCleaning(true);
    setCleanupError("");
    setCleanupProgress(t("storage.cleanupRunning"));
    try {
      const result = await StorageService.executeSafeCleanup();
      if (!result.success) {
        setCleanupError(t("storage.cleanupFailed", { error: result.error || "" }));
        setCleanupStep("confirm");
        return;
      }
      await refresh();
      setCleanupProgress(t("storage.cleanupSuccess"));
      setShowCleanupConfirm(false);
    } catch (err) {
      setCleanupError(t("storage.cleanupFailed", { error: String(err) }));
      setCleanupStep("confirm");
    } finally {
      setCleaning(false);
    }
  };

  const items = [
    { label: t("pipeline.imageCount"), value: info.imageCount, icon: Image, color: "text-green-500" },
    { label: t("pipeline.videoCount"), value: info.videoCount, icon: Video, color: "text-blue-500" },
    { label: t("pipeline.cacheSize"), value: info.cacheSize, icon: HardDrive, color: "text-cyan-500" },
    { label: t("pipeline.lastCleanup"), value: info.lastCleanup, icon: RefreshCw, color: "text-muted-foreground" },
  ];

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            {t("pipeline.storageMonitor")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border bg-card p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="text-sm font-bold truncate">{item.value}</div>
                </div>
              );
            })}
          </div>
          <Button variant="destructive" size="sm" className="w-full h-7 text-xs" onClick={handleClean} disabled={cleaning}>
            {cleaning ? (
              <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />{t("pipeline.cleaning")}</>
            ) : (
              <><Trash2 className="h-3.5 w-3.5 mr-1" />{t("pipeline.cleanCache")}</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showCleanupConfirm} onOpenChange={setShowCleanupConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("storage.cleanupTitle")}</DialogTitle>
            <DialogDescription>{t("storage.cleanupDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {cleanupPreview && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <p className="font-medium">{t("storage.cleanupPreview", { total: cleanupPreview.totalAssets, size: cleanupPreview.totalSize })}</p>
                <p className="text-muted-foreground">{t("storage.cleanupBreakdown", { images: cleanupPreview.imageCount, videos: cleanupPreview.videoCount })}</p>
                <p className="text-muted-foreground">{t("storage.cleanupProjects", { count: cleanupPreview.projects.length })}</p>
              </div>
            )}

            {cleanupStep === "preview" && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCleanupConfirm(false)}>{t("storage.cleanupCancel")}</Button>
                <Button variant="destructive" onClick={() => setCleanupStep("confirm")}>{t("common.next")}</Button>
              </div>
            )}

            {cleanupStep !== "preview" && (
              <>
                <div className="space-y-2">
                  <Label>{t("storage.cleanupTypeDelete")}</Label>
                  <Input
                    value={cleanupConfirmInput}
                    onChange={(event) => setCleanupConfirmInput(event.target.value)}
                    placeholder={t("storage.cleanupConfirmPlaceholder")}
                    disabled={cleanupStep === "executing"}
                  />
                </div>
                {cleanupProgress && <p className="text-sm text-muted-foreground">{cleanupProgress}</p>}
                {cleanupError && <p className="text-sm text-destructive">{cleanupError}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCleanupConfirm(false)} disabled={cleanupStep === "executing"}>{t("storage.cleanupCancel")}</Button>
                  <Button variant="destructive" onClick={handleCleanupConfirm} disabled={cleanupStep === "executing" || cleanupConfirmInput !== "DELETE"}>
                    {cleanupStep === "executing" ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                    {cleanupStep === "executing" ? t("storage.cleanupRunning") : t("storage.cleanupExecute")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
