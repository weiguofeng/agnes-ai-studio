"use client";
import { useTranslation } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Copy, Play, MoreHorizontal, Clock } from "lucide-react";
import type { PromptTemplate } from "@/types";
import { cn } from "@/lib/utils";

interface PromptCardProps {
  prompt: PromptTemplate;
  onSelect?: (prompt: PromptTemplate) => void;
  onFavorite?: (id: string) => void;
  onClone?: (id: string) => void;
  className?: string;
}

export function PromptCard({ prompt, onSelect, onFavorite, onClone, className }: PromptCardProps) {
  const { t } = useTranslation();
  return (
    <Card className={cn("group relative overflow-hidden border-white/5 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.06] transition-all duration-300", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{prompt.name}</h3>
              {prompt.isFavorite && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
            </div>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{t("prompt.categories." + prompt.category) || prompt.category}</Badge>
          </div>
          <div className="flex gap-1 shrink-0">
            {onFavorite && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onFavorite(prompt.id); }}>
                <Star className={cn("h-3.5 w-3.5", prompt.isFavorite && "fill-yellow-400 text-yellow-400")} />
              </Button>
            )}
            {onClone && (
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onClone(prompt.id); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{prompt.content}</p>
        <div className="flex flex-wrap gap-1.5">
          {prompt.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground">{tag}</span>
          ))}
          {prompt.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{prompt.tags.length - 3}</span>}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{prompt.usageCount} {t("prompt.usageCount")}</span>
          </div>
          {onSelect && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onSelect(prompt)}>
              <Play className="h-3 w-3" /> {t("prompt.use")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
