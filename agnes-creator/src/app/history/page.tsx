"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/i18n";
import { useTaskStore } from "@/stores/taskStore";
import { TaskListItem, TaskStats } from "@/components/shared/TaskList";
import {
  History, Search, Trash2,
} from "lucide-react";

export default function HistoryPage() {
  const { t } = useTranslation();
  const tasks = useTaskStore((s) => s.tasks);
  const removeTask = useTaskStore((s) => s.removeTask);
  const clearAll = useTaskStore((s) => s.clearAll);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (search && !t.prompt.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [tasks, typeFilter, search]
  );

  const toggle = (id: string) => {
    const n = new Set(selectedIds);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelectedIds(n);
  };

  const handleBatchDelete = () => {
    selectedIds.forEach((id) => removeTask(id));
    setSelectedIds(new Set());
  };

  const selectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-2.5 text-white shadow-lg">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("history.title")}</h1>
              <TaskStats tasks={tasks} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-muted-foreground">已选 {selectedIds.size} 项</span>
                <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                  <Trash2 className="mr-1.5 h-4 w-4" />删除选中
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={selectAll}>
              全选
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="mr-1.5 h-4 w-4" />全部清除
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 Prompt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="text-to-image">文生图</TabsTrigger>
              <TabsTrigger value="image-to-image">图生图</TabsTrigger>
              <TabsTrigger value="text-to-video">文生视频</TabsTrigger>
              <TabsTrigger value="image-to-video">图生视频</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-4 mb-4">
                <History className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">暂无历史记录</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggle(task.id)}
                className={`relative rounded-xl border transition-all cursor-pointer ${
                  selectedIds.has(task.id) ? "ring-2 ring-primary" : ""
                }`}
              >
                {selectedIds.has(task.id) && (
                  <div className="absolute top-2 right-2 z-10 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold">✓</span>
                  </div>
                )}
                <TaskListItem
                  task={task}
                  onDelete={removeTask}
                  onDownload={(url) => window.open(url, "_blank")}
                  showThumbnail={false}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
