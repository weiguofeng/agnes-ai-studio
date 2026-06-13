import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Character, CharacterProfile, CharacterReference } from "@/types";

/** Generate Character DNA block from profile */
export function generateCharacterDna(char: Partial<Character>): string {
  const parts: string[] = [];
  if (char.name) parts.push(char.name);
  if (char.profile?.appearance) parts.push(char.profile.appearance);
  if (char.profile?.hair) parts.push(char.profile.hair);
  if (char.profile?.clothing) parts.push(char.profile.clothing);
  if (char.profile?.age) parts.push(char.profile.age);
  if (char.profile?.gender) parts.push(char.profile.gender);
  return parts.join(", ");
}

const DEFAULT_PROFILE: CharacterProfile = {
  age: "", gender: "", appearance: "", hair: "", clothing: "", personality: "", background: "",
};



interface CharacterStoreState {
  characters: Character[];
  addCharacter: (char: Partial<Character> & { name: string }) => string;
  updateCharacter: (id: string, patch: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addReferenceImage: (id: string, url: string, type?: CharacterReference["type"]) => void;
  removeReferenceImage: (id: string, url: string) => void;
  getCharacterById: (id: string) => Character | undefined;
  searchCharacters: (query: string, tagFilter?: string[]) => Character[];
  /** Regenerate DNA block for a character */
  regenerateDna: (id: string) => void;
  /** Lock a character to a project */
  setLocked: (id: string, locked: boolean) => void;
}

let _cCounter = 0;
function genCharId(): string {
  _cCounter++; return `char-${Date.now()}-${_cCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useCharacterStore = create<CharacterStoreState>()(
  persist(
    (set, get) => ({
      characters: [],
      addCharacter: (data) => {
        const id = genCharId();
        const now = Date.now();
        const fullProfile: CharacterProfile = {
          ...DEFAULT_PROFILE,
          ...(data.profile || {}),
        };
        const char: Character = {
          id,
          name: data.name,
          description: data.description || "",
          prompt: data.prompt || "",
          tags: data.tags || [],
          referenceImages: data.referenceImages || [],
          references: data.references || [],
          profile: fullProfile,
          dnaBlock: data.dnaBlock || "",
          isFavorite: data.isFavorite || false,
          projectId: data.projectId,
          isLocked: data.isLocked || false,
          createdAt: now,
          updatedAt: now,
        };
        if (!char.dnaBlock) char.dnaBlock = generateCharacterDna(char);
        set((s) => ({ characters: [char, ...s.characters] }));
        return id;
      },
      updateCharacter: (id, patch) => set((s) => ({
        characters: s.characters.map((c) => {
          if (c.id !== id) return c;
          const updated = { ...c, ...patch, updatedAt: Date.now() };
          // Auto-regenerate DNA if profile fields changed
          if (patch.profile || patch.name) updated.dnaBlock = generateCharacterDna(updated);
          return updated;
        }),
      })),
      removeCharacter: (id) => set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),
      toggleFavorite: (id) => set((s) => ({
        characters: s.characters.map((c) => c.id === id ? { ...c, isFavorite: !c.isFavorite, updatedAt: Date.now() } : c),
      })),
      addReferenceImage: (id, url, type = "main") => set((s) => ({
        characters: s.characters.map((c) => c.id === id ? {
          ...c,
          referenceImages: [...c.referenceImages, url],
          references: [...c.references, { type, url }],
          updatedAt: Date.now(),
        } : c),
      })),
      removeReferenceImage: (id, url) => set((s) => ({
        characters: s.characters.map((c) => c.id === id ? {
          ...c,
          referenceImages: c.referenceImages.filter((u) => u !== url),
          references: c.references.filter((r) => r.url !== url),
          updatedAt: Date.now(),
        } : c),
      })),
      getCharacterById: (id) => get().characters.find((c) => c.id === id),
      searchCharacters: (query, tagFilter) => {
        let results = get().characters;
        if (query) { const q = query.toLowerCase(); results = results.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q))); }
        if (tagFilter && tagFilter.length > 0) results = results.filter((c) => tagFilter.some((t) => c.tags.includes(t)));
        return results.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) || b.updatedAt - a.updatedAt);
      },
      regenerateDna: (id) => set((s) => ({
        characters: s.characters.map((c) => c.id === id ? { ...c, dnaBlock: generateCharacterDna(c), updatedAt: Date.now() } : c),
      })),
      setLocked: (id, locked) => set((s) => ({
        characters: s.characters.map((c) => c.id === id ? { ...c, isLocked: locked, updatedAt: Date.now() } : c),
      })),
    }),
    { name: "agnes-character-store", version: 2 }
  )
);
