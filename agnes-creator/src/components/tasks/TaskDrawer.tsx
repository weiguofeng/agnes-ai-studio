"use client";

import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTaskStore } from "@/stores/taskStore";
import { TaskListItem, TaskStats } from "@/components/shared/TaskList";
import { List, Sparkles } from "lucide-react";

export function TaskCenter() {
  const [open, setOpen] = useState(false);
  const tasks = useTaskStore((s) => s.tasks);
  const removeTask = useTaskStore((s) => s.removeTask);

  // 活跃任务：排队中、处理中、已提交、上传中
  const activeCount = tasks.filter(
    (t) => ["queued", "processing", "submitted", "uploading", "rate_limited", "awaiting_asset"].includes(t.status)
  ).length;
  // 失败+超时
  const failedCount = tasks.filter(
    (t) => t.status === "failed" || t.status === "timeout"
  ).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative gap-2 text-sm">
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">任务中心</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white min-w-[18px]">
              {activeCount}
            </span>
          )}
          {failedCount > 0 && activeCount === 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white min-w-[18px]">
              {failedCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md p-0">
        <SheetHeader className="px-6 pt-6 pb-3 border-b">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List className="h-5 w-5" />
              <span>任务中心</span>
            </div>
            <TaskStats tasks={tasks} />
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 h-[calc(100vh-5rem)] p-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">暂无任务</p>
              <p className="text-xs text-muted-foreground/60 mt-1">开始创作后任务将显示在这里</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  onDelete={removeTask}
                  onDownload={(url) => window.open(url, "_blank")}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
