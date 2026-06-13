"use client";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PromptCard } from "@/components/prompts/PromptCard";
import { PromptForm } from "@/components/prompts/PromptForm";
import { PromptPreview } from "@/components/prompts/PromptPreview";
import { usePromptStore } from "@/stores/promptStore";
import { useDebounce } from "@/hooks/useDebounce";
import { useTranslation } from "@/i18n";
import { Plus, Search, BookTemplate, Star, LayoutGrid } from "lucide-react";
import type { PromptTemplate } from "@/types";

export default function PromptsPage() {
  const { prompts, addPrompt, toggleFavorite, clonePrompt } = usePromptStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editPrompt, setEditPrompt] = useState<PromptTemplate | undefined>(undefined);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("browse");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filtered = useMemo(() => {
    let r = prompts;
    if (debouncedSearch) { const q = debouncedSearch.toLowerCase(); r = r.filter((p) => p.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))); }
    if (categoryFilter !== "all") r = r.filter((p) => p.category === categoryFilter);
    return r.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) || b.updatedAt - a.updatedAt);
  }, [prompts, debouncedSearch, categoryFilter]);

  const favorites = prompts.filter((p) => p.isFavorite);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("prompt.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("prompt.subtitle")}</p>
          </div>
          <Button onClick={() => { setEditPrompt(undefined); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" />{t("prompt.new")}</Button>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("common.search") + "..."} className="pl-9 h-10" /></div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder={t("prompt.allCategories")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("prompt.allCategories")}</SelectItem>
              {["general","character","scene","style","action","environment","custom"].map((c) => (
                <SelectItem key={c} value={c}>{t("prompt.categories." + c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="browse" className="gap-2"><LayoutGrid className="h-4 w-4" />{t("prompt.browse")}</TabsTrigger>
                <TabsTrigger value="favorites" className="gap-2"><Star className="h-4 w-4" />{t("prompt.favorites")}</TabsTrigger>
              </TabsList>
              <TabsContent value="browse" className="mt-4">
                {filtered.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground"><BookTemplate className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>{t("prompt.noPrompts")}</p><p className="text-sm">{t("prompt.clickCreate")}</p></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{filtered.map((prompt) => (<PromptCard key={prompt.id} prompt={prompt} onSelect={setSelectedPrompt} onFavorite={toggleFavorite} onClone={clonePrompt} />))}</div>
                )}
              </TabsContent>
              <TabsContent value="favorites" className="mt-4">
                {favorites.length === 0 ? (<div className="text-center py-16 text-muted-foreground"><Star className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>{t("prompt.noFavorites")}</p></div>) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{favorites.map((prompt) => (<PromptCard key={prompt.id} prompt={prompt} onSelect={setSelectedPrompt} onFavorite={toggleFavorite} onClone={clonePrompt} />))}</div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">{t("prompt.preview")}</h2>
            {selectedPrompt ? <PromptPreview key={selectedPrompt.id} template={selectedPrompt} /> : (
              <div className="text-center py-16 text-muted-foreground rounded-lg border border-dashed border-white/10"><BookTemplate className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">{t("prompt.selectPrompt")}</p><p className="text-xs">{t("prompt.viewPreview")}</p></div>
            )}
          </div>
        </div>
      </div>
      <PromptForm open={showForm} onOpenChange={setShowForm} onSubmit={addPrompt} initial={editPrompt} />
    </AppShell>
  );
}