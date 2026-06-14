"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { BarChart3, Camera, Image, Video, AlertTriangle, Clock, Timer, TrendingUp } from "lucide-react";

interface StatsData {
  totalShots: number;
  totalScenes: number;
  imagesCompleted: number;
  videosCompleted: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  avgDuration: number;
  estimatedRemaining: number;
}

export function StatisticsPanel({ stats }: { stats: StatsData }) {
  const { t } = useTranslation();

  const items = [
    { label: t("pipeline.totalShots"), value: stats.totalShots, icon: Camera, color: "text-blue-500" },
    { label: t("pipeline.totalScenes"), value: stats.totalScenes, icon: BarChart3, color: "text-indigo-500" },
    { label: t("pipeline.imagesCompleted"), value: stats.imagesCompleted, icon: Image, color: "text-green-500" },
    { label: t("pipeline.videosCompleted"), value: stats.videosCompleted, icon: Video, color: "text-emerald-500" },
    { label: t("pipeline.failedCount"), value: stats.failedCount, icon: AlertTriangle, color: "text-red-500" },
    { label: t("pipeline.pendingCount"), value: stats.pendingCount, icon: Clock, color: "text-yellow-500" },
    { label: t("pipeline.successRate"), value: `${stats.successRate}%`, icon: TrendingUp, color: "text-purple-500" },
    { label: t("pipeline.avgDuration"), value: `${stats.avgDuration}${t("pipeline.seconds")}`, icon: Timer, color: "text-cyan-500" },
    { label: t("pipeline.estimatedRemaining"), value: `${stats.estimatedRemaining}${t("pipeline.minutes")}`, icon: Clock, color: "text-orange-500" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          {t("pipeline.statistics")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats.totalShots === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("pipeline.noCacheData")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border bg-card p-2 text-center">
                  <Icon className={`h-4 w-4 mx-auto mb-1 ${item.color}`} />
                  <div className="text-lg font-bold">{item.value}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{item.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
