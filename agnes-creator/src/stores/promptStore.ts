import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PromptTemplate, PromptCategory, PromptVariable } from "@/types";

interface PromptStoreState {
  prompts: PromptTemplate[];
  addPrompt: (prompt: Omit<PromptTemplate, "id" | "createdAt" | "updatedAt" | "usageCount">) => string;
  updatePrompt: (id: string, patch: Partial<PromptTemplate>) => void;
  removePrompt: (id: string) => void;
  toggleFavorite: (id: string) => void;
  incrementUsage: (id: string) => void;
  clonePrompt: (id: string) => string | null;
  getPromptById: (id: string) => PromptTemplate | undefined;
  searchPrompts: (query: string, category?: PromptCategory) => PromptTemplate[];
}

let _pCounter = 0;
function genPromptId(): string {
  _pCounter++; return `prompt-${Date.now()}-${_pCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const usePromptStore = create<PromptStoreState>()(
  persist(
    (set, get) => ({
      prompts: [],
      addPrompt: (data) => {
        const id = genPromptId();
        const now = Date.now();
        const prompt: PromptTemplate = { ...data, id, usageCount: 0, createdAt: now, updatedAt: now };
        set((s) => ({ prompts: [prompt, ...s.prompts] }));
        return id;
      },
      updatePrompt: (id, patch) => set((s) => ({ prompts: s.prompts.map((p) => p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p) })),
      removePrompt: (id) => set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) })),
      toggleFavorite: (id) => set((s) => ({ prompts: s.prompts.map((p) => p.id === id ? { ...p, isFavorite: !p.isFavorite, updatedAt: Date.now() } : p) })),
      incrementUsage: (id) => set((s) => ({ prompts: s.prompts.map((p) => p.id === id ? { ...p, usageCount: p.usageCount + 1 } : p) })),
      clonePrompt: (id) => {
        const orig = get().prompts.find((p) => p.id === id);
        if (!orig) return null;
        const newId = genPromptId();
        const now = Date.now();
        const cloned: PromptTemplate = { ...orig, id: newId, name: `${orig.name} (Copy)`, usageCount: 0, isFavorite: false, createdAt: now, updatedAt: now };
        set((s) => ({ prompts: [cloned, ...s.prompts] }));
        return newId;
      },
      getPromptById: (id) => get().prompts.find((p) => p.id === id),
      searchPrompts: (query, category) => {
        let results = get().prompts;
        if (query) { const q = query.toLowerCase(); results = results.filter((p) => p.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))); }
        if (category && category !== "general") results = results.filter((p) => p.category === category);
        return results.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) || b.updatedAt - a.updatedAt);
      },
    }),
    { name: "agnes-prompt-store", version: 1 }
  )
);

export function extractVariables(content: string): string[] {
  const matches = content.match(/\{(\w+)\}/g);
  return matches ? [...new Set(matches.map((m) => m.slice(1, -1)))] : [];
}

export function renderPrompt(content: string, variables: Record<string, string>): string {
  return content.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`);
}
