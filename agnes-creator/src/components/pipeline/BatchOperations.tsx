"use client";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { Video, Pause, Play, Trash2, Lock, Film } from "lucide-react";

interface BatchOperationsProps {
  selectedCount: number;
  onBatchGenerateVideos: () => void;
  onBatchPause: () => void;
  onBatchResume: () => void;
  onBatchDelete: () => void;
  onBatchLock: () => void;
  onBatchImportTimeline: () => void;
}

export function BatchOperations({
  selectedCount, onBatchGenerateVideos,
  onBatchPause, onBatchResume, onBatchDelete, onBatchLock,
  onBatchImportTimeline,
}: BatchOperationsProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  const buttons = [
    { label: t("pipeline.batchGenerateVideos"), icon: Video, onClick: onBatchGenerateVideos, disabled: !hasSelection },
    { label: t("pipeline.batchPause"), icon: Pause, onClick: onBatchPause, disabled: !hasSelection },
    { label: t("pipeline.batchResume"), icon: Play, onClick: onBatchResume, disabled: !hasSelection },
    { label: t("pipeline.batchDelete"), icon: Trash2, onClick: onBatchDelete, disabled: !hasSelection },
    { label: t("pipeline.batchLock"), icon: Lock, onClick: onBatchLock, disabled: !hasSelection },
    { label: t("pipeline.batchImportTimeline"), icon: Film, onClick: onBatchImportTimeline, disabled: !hasSelection },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasSelection && (
        <span className="text-xs text-muted-foreground mr-1">
          {t("pipeline.selected")} {selectedCount} {t("pipeline.items")}
        </span>
      )}
      {buttons.map((btn) => {
        const Icon = btn.icon;
        return (
          <Button
            key={btn.label}
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            disabled={btn.disabled}
            onClick={btn.onClick}
          >
            <Icon className="h-3.5 w-3.5 mr-1" />
            {btn.label}
          </Button>
        );
      })}
    </div>
  );
}
