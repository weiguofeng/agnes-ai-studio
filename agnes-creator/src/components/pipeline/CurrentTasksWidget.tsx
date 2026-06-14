"use client";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { useTaskStore } from "@/stores/taskStore";
import { Image, Video, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

export function CurrentTasksWidget() {
  const { t } = useTranslation();
  const tasks = useTaskStore((s) => s.tasks);

  const activeTasks = useMemo(() => {
    const active = tasks.filter((t) =>
      ["uploading", "processing", "queued", "submitted", "rate_limited", "awaiting_asset"].includes(t.status)
    );
    const failed = tasks.filter((t) => t.status === "failed");
    return {
      image: active.filter((t) => t.type === "text-to-image" || t.type === "image-to-image"),
      video: active.filter((t) => t.type === "text-to-video" || t.type === "image-to-video"),
      retry: active.filter((t) => t.status === "rate_limited"),
      failed: failed.slice(0, 5),
      total: active.length,
    };
  }, [tasks]);

  const sections = [
    { label: t("pipeline.imageTasks"), count: activeTasks.image.length, icon: Image, color: "text-blue-500", items: activeTasks.image },
    { label: t("pipeline.videoTasks"), count: activeTasks.video.length, icon: Video, color: "text-emerald-500", items: activeTasks.video },
    { label: t("pipeline.retryTasks"), count: activeTasks.retry.length, icon: RefreshCw, color: "text-yellow-500", items: activeTasks.retry },
    { label: t("pipeline.failedTasks"), count: activeTasks.failed.length, icon: AlertTriangle, color: "text-red-500", items: activeTasks.failed },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Loader2 className="h-4 w-4" />
          {t("pipeline.currentTasks")}
          {activeTasks.total > 0 && (
            <Badge variant="default" className="ml-1 text-[10px] h-4">
              {activeTasks.total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeTasks.total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("pipeline.noTasks")}</p>
        ) : (
          <div className="space-y-2">
            {sections.map((section) => {
              if (section.count === 0) return null;
              const Icon = section.icon;
              return (
                <div key={section.label} className="rounded-lg border bg-card p-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${section.color}`} />
                      <span className="text-xs font-medium">{section.label}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4">{section.count}</Badge>
                  </div>
                  <div className="space-y-0.5">
                    {section.items.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="truncate max-w-[140px]">{task.prompt.slice(0, 30)}...</span>
                        <Badge variant="outline" className="text-[9px] h-3.5 ml-1 shrink-0">
                          {task.status === "processing" ? "..." : task.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
