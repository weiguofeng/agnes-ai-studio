"use client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Folder, Image, Video, MoreHorizontal, Trash2, Edit3 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { Project } from "@/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const statusColors: Record<string, string> = { draft: "bg-gray-500/20 text-gray-400", active: "bg-blue-500/20 text-blue-400", completed: "bg-green-500/20 text-green-400", archived: "bg-yellow-500/20 text-yellow-400" };

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
  onEdit?: (project: Project) => void;
  onStatusChange?: (id: string, status: Project["status"]) => void;
  className?: string;
}

export function ProjectCard({ project, onDelete, onEdit, onStatusChange, className }: ProjectCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Card className={cn("group relative overflow-hidden border-white/5 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.06] transition-all duration-300 cursor-pointer", className)} onClick={() => router.push("/projects/" + project.id)}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center shrink-0">
              <Folder className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{project.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {onEdit && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(project); }}><Edit3 className="h-3.5 w-3.5 mr-2" />{t("common.edit")}</DropdownMenuItem>}
              {["draft", "active", "completed", "archived"].filter((s) => s !== project.status).map((s) => (
                <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); onStatusChange?.(project.id, s as Project["status"]); }}>{t("project.statuses." + s)}</DropdownMenuItem>
              ))}
              {onDelete && <DropdownMenuItem className="text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}><Trash2 className="h-3.5 w-3.5 mr-2" />{t("common.delete")}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Badge className={cn("text-[10px] h-5", statusColors[project.status])}>{t("project.statuses." + project.status)}</Badge>
          <span className="flex items-center gap-1"><Image className="h-3 w-3" />{project.scenes.length} {t("project.scenes")}</span>
          <span className="flex items-center gap-1"><Video className="h-3 w-3" />{project.scenes.reduce((s, sc) => s + sc.shots.length, 0)} {t("project.shots")}</span>
        </div>

        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (<span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground">{tag}</span>))}
          </div>
        )}
      </div>
    </Card>
  );
}
