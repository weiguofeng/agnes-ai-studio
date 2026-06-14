"use client";
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { Film, Download, Upload, GripVertical } from "lucide-react";

interface TimelineImportProps {
  videoCount: number;
  lockedCount: number;
  selectedCount: number;
  onImportAll: () => void;
  onImportSelected: () => void;
  onImportLocked: () => void;
  onImportScene: (sceneId: string) => void;
  onImportShot: (shotId: string) => void;
  sceneIds: string[];
  shotIds: string[];
}

export function TimelineImport({
  videoCount, lockedCount, selectedCount,
  onImportAll, onImportSelected, onImportLocked,
  onImportScene, onImportShot,
  sceneIds, shotIds,
}: TimelineImportProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onImportAll();
  }, [onImportAll]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="h-4 w-4" />
          {t("pipeline.timelineImport")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop zone */}
        <div
          className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
            isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{t("pipeline.dragImport")}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {videoCount} {t("pipeline.videos")} / {lockedCount} {t("pipeline.statusLocked")}
          </p>
        </div>

        {/* Import buttons */}
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onImportAll} disabled={videoCount === 0}>
            <Download className="h-3.5 w-3.5 mr-1" />{t("pipeline.importAllVideos")}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onImportSelected} disabled={selectedCount === 0}>
            <Download className="h-3.5 w-3.5 mr-1" />{t("pipeline.importSelected")}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onImportLocked} disabled={lockedCount === 0}>
            <Download className="h-3.5 w-3.5 mr-1" />{t("pipeline.importLocked")}
          </Button>
        </div>

        {/* Scene/Shot quick import */}
        {sceneIds.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground">{t("pipeline.importCurrentScene")}</p>
            <div className="flex flex-wrap gap-1">
              {sceneIds.slice(0, 5).map((sid) => (
                <Button key={sid} variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => onImportScene(sid)}>
                  {sid.slice(-6)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
