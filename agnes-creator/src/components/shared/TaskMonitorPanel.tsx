"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useVideoTaskQueue } from "@/hooks/useVideoTaskQueue";
import { ChevronDown, ChevronUp, Bug, Clock, RotateCcw, AlertCircle } from "lucide-react";

export function TaskMonitorPanel() {
  const [open, setOpen] = useState(false);
  const { tasks, activeTask } = useVideoTaskQueue();

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="fixed bottom-4 right-4 z-50 h-8 text-[10px] opacity-30 hover:opacity-100"
        onClick={() => setOpen(true)}>
        <Bug className="h-3 w-3 mr-1" />Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 shadow-xl border-muted-foreground/20 max-h-[500px] overflow-auto">
      <CardHeader className="py-2 px-3 flex-row items-center justify-between">
        <CardTitle className="text-xs flex items-center gap-1">
          <Bug className="h-3 w-3" /> 任务监控面板
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setOpen(false)}>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2 text-[11px]">
        {tasks.length === 0 ? (
          <p className="text-muted-foreground/60">暂无任务</p>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="rounded border p-2 space-y-1 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">#{t.id.slice(-8)}</span>
                <span className={`text-[10px] font-medium ${
                  t.status === "completed" ? "text-green-600" :
                  t.status === "failed" ? "text-red-600" :
                  t.status === "processing" ? "text-blue-600" :
                  "text-yellow-600"
                }`}>{t.status}</span>
              </div>
              {t.prompt && <p className="text-[10px] text-muted-foreground truncate">{t.prompt}</p>}
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60">
                <Clock className="h-2.5 w-2.5" />
                <span>{new Date(t.createdAt).toLocaleTimeString()}</span>
                {t.numFrames && <><span>|</span><span>帧: {t.numFrames}</span></>}
              </div>
              {t.error && (
                <div className="flex items-start gap-1 text-[10px] text-red-500">
                  <AlertCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{t.error}</span>
                </div>
              )}
              {t.status === "completed" && t.result?.url && (
                <a href={t.result.url} target="_blank" className="block text-[10px] text-blue-500 truncate hover:underline">
                  {t.result.url.slice(0, 60)}...
                </a>
              )}
            </div>
          ))
        )}
        <div className="flex justify-between text-[9px] text-muted-foreground/40 pt-1 border-t">
          <span>总计: {tasks.length} | 活跃: {activeTask ? 1 : 0}</span>
          <span>支持: queued→uploading→submitted→processing→completed/failed/timeout/cancelled</span>
        </div>
      </CardContent>
    </Card>
  );
}
