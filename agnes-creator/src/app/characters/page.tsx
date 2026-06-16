"use client";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CharacterCard } from "@/components/characters/CharacterCard";
import { CharacterForm } from "@/components/characters/CharacterForm";
import type { Character } from "@/types";
import { useCharacterStore } from "@/stores/characterStore";
import { useDebounce } from "@/hooks/useDebounce";
import { useTranslation } from "@/i18n";
import { Plus, Search, Users } from "lucide-react";

export default function CharactersPage() {
  const { characters, addCharacter, updateCharacter, removeCharacter, toggleFavorite } = useCharacterStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editChar, setEditChar] = useState<Character | undefined>(undefined);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const allTags = useMemo(() => { const tags = new Set<string>(); characters.forEach((c) => c.tags.forEach((tg) => tags.add(tg))); return [...tags]; }, [characters]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = characters;
    if (debouncedSearch) { const q = debouncedSearch.toLowerCase(); r = r.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some((tg) => tg.toLowerCase().includes(q))); }
    if (selectedTag) r = r.filter((c) => c.tags.includes(selectedTag));
    return r.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) || b.updatedAt - a.updatedAt);
  }, [characters, debouncedSearch, selectedTag]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">{t("character.title")}</h1><p className="text-sm text-muted-foreground mt-1">{t("character.subtitle")}</p></div>
          <Button onClick={() => { setEditChar(undefined); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" />{t("character.new")}</Button>
        </div>
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("character.search")} className="pl-9 h-10" /></div>
        {allTags.length > 0 && (<div className="flex flex-wrap gap-2"><Badge variant={!selectedTag ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedTag(null)}>{t("common.all")}</Badge>{allTags.map((tag) => (<Badge key={tag} variant={selectedTag === tag ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedTag(tag)}>{tag}</Badge>))}</div>)}
        {filtered.length === 0 ? (<div className="text-center py-16 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>{t("character.noCharacters")}</p><p className="text-sm">{t("character.clickCreate")}</p></div>) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map((char) => (<CharacterCard key={char.id} character={char} onSelect={(c) => { navigator.clipboard?.writeText("@" + c.name); }} onEdit={(c) => { setEditChar(c); setShowForm(true); }} onDelete={removeCharacter} onFavorite={toggleFavorite} />))}</div>
        )}
      </div>
      <CharacterForm key={editChar?.id || "new"} open={showForm} onOpenChange={setShowForm} onSubmit={(data: any) => editChar ? updateCharacter(editChar.id, data) : addCharacter(data)} initial={editChar} />
      <Dialog open={!!selectedChar} onOpenChange={(o) => { if (!o) setSelectedChar(null); }}>
        <DialogContent className="sm:max-w-lg">{selectedChar && (<><DialogHeader><DialogTitle>{selectedChar.name}</DialogTitle></DialogHeader><div className="space-y-4">{selectedChar.referenceImages.length > 0 && (<div className="flex gap-2 overflow-x-auto">{selectedChar.referenceImages.map((url, i) => (<img key={i} src={url} alt="" className="h-32 w-32 object-cover rounded-lg shrink-0" />))}</div>)}<div><p className="text-sm font-medium mb-1">{t("character.prompt")}</p><div className="rounded-md bg-muted/30 p-3 text-sm">{selectedChar.prompt || t("common.noData")}</div></div></div></>)}</DialogContent>
      </Dialog>
    </AppShell>
  );
}