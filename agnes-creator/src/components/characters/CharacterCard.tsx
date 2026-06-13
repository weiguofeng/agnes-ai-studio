"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, User, Edit3, Trash2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { Character } from "@/types";
import { cn } from "@/lib/utils";

interface CharacterCardProps {
  character: Character;
  onSelect?: (char: Character) => void;
  onEdit?: (char: Character) => void;
  onDelete?: (id: string) => void;
  onFavorite?: (id: string) => void;
  className?: string;
}

export function CharacterCard({ character, onSelect, onEdit, onDelete, onFavorite, className }: CharacterCardProps) {
  const { t } = useTranslation();
  return (
    <Card className={cn("group relative overflow-hidden border-white/5 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.06] transition-all duration-300", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5 space-y-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 rounded-xl border border-white/10">
            {character.referenceImages[0] ? <AvatarImage src={character.referenceImages[0]} className="object-cover" /> : null}
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <User className="h-6 w-6 text-blue-400" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{character.name}</h3>
              {character.isFavorite && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{character.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {character.tags.map((tag) => (<span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground">{tag}</span>))}
        </div>
        {character.prompt && (
          <div className="rounded-md bg-white/5 p-2.5">
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{character.prompt}</p>
          </div>
        )}
        <div className="flex items-center justify-end gap-1 pt-1">
          {onFavorite && (
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onFavorite(character.id)}>
              <Star className={cn("h-3.5 w-3.5", character.isFavorite && "fill-yellow-400 text-yellow-400")} />
            </Button>
          )}
          {onEdit && <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(character)}><Edit3 className="h-3.5 w-3.5" /></Button>}
          {onDelete && <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity" onClick={() => onDelete(character.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
          {onSelect && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onSelect(character)}>{t("character.select")}</Button>
          )}
        </div>
      </div>
    </Card>
  );
}
