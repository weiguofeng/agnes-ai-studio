"use client";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { useProjectStore } from "@/stores/projectStore";
import { useDebounce } from "@/hooks/useDebounce";
import type { Project } from "@/types";
import { useTranslation } from "@/i18n";
import { Plus, Search, FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  const { projects, addProject, removeProject, updateProject } = useProjectStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | undefined>(undefined);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filtered = useMemo(() => {
    let r = projects;
    if (debouncedSearch) { const q = debouncedSearch.toLowerCase(); r = r.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))); }
    if (statusFilter !== "all") r = r.filter((p) => p.status === statusFilter);
    return r.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects, debouncedSearch, statusFilter]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">{t("project.title")}</h1><p className="text-sm text-muted-foreground mt-1">{t("project.subtitle")}</p></div>
          <Button onClick={() => { setEditProject(undefined); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" />{t("project.new")}</Button>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("project.search")} className="pl-9 h-10" /></div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("project.allStatuses")}</SelectItem><SelectItem value="draft">{t("project.statuses.draft")}</SelectItem><SelectItem value="active">{t("project.statuses.active")}</SelectItem><SelectItem value="completed">{t("project.statuses.completed")}</SelectItem><SelectItem value="archived">{t("project.statuses.archived")}</SelectItem></SelectContent></Select>
        </div>
        {filtered.length === 0 ? (<div className="text-center py-16 text-muted-foreground"><FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>{t("project.noProjects")}</p><p className="text-sm">{t("project.clickCreate")}</p></div>) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map((proj) => (<ProjectCard key={proj.id} project={proj} onDelete={removeProject} onEdit={(p) => { setEditProject(p); setShowForm(true); }} onStatusChange={(id, s) => updateProject(id, { status: s })} />))}</div>
        )}
      </div>
      <ProjectForm open={showForm} onOpenChange={setShowForm} onSubmit={addProject} initial={editProject} />
    </AppShell>
  );
}