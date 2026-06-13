import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, Scene, ProjectStatus } from "@/types";

interface ProjectStoreState {
  projects: Project[];
  addProject: (proj: Partial<Project> & { name: string }) => string;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  getProjectById: (id: string) => Project | undefined;
  searchProjects: (query: string) => Project[];
  addSceneToProject: (projectId: string, scene: Scene) => void;
  removeSceneFromProject: (projectId: string, sceneId: string) => void;
  reorderScenes: (projectId: string, sceneIds: string[]) => void;
  /** V2.4: Lock a character to project */
  lockCharacter: (projectId: string, characterId: string) => void;
  /** V2.4: Unlock a character */
  unlockCharacter: (projectId: string, characterId: string) => void;
  /** V2.4: Set style DNA */
  setStyleDna: (projectId: string, dna: string) => void;
}

let _prjCounter = 0;
function genProjectId(): string {
  _prjCounter++; return `proj-${Date.now()}-${_prjCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      projects: [],
      addProject: (data) => {
        const id = genProjectId();
        const now = Date.now();
        set((s) => ({
          projects: [{
            ...data, id, scenes: [], characters: [], assets: [],
            styleDna: data.styleDna || "",
            lockedCharacterIds: data.lockedCharacterIds || [],
            createdAt: now, updatedAt: now,
          } as Project, ...s.projects],
        }));
        return id;
      },
      updateProject: (id, patch) => set((s) => ({
        projects: s.projects.map((p) => p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p),
      })),
      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      getProjectById: (id) => get().projects.find((p) => p.id === id),
      searchProjects: (query) => {
        let results = get().projects;
        if (query) { const q = query.toLowerCase(); results = results.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))); }
        return results.sort((a, b) => b.updatedAt - a.updatedAt);
      },
      addSceneToProject: (projectId, scene) => set((s) => ({
        projects: s.projects.map((p) => p.id === projectId ? { ...p, scenes: [...p.scenes, scene], updatedAt: Date.now() } : p),
      })),
      removeSceneFromProject: (projectId, sceneId) => set((s) => ({
        projects: s.projects.map((p) => p.id === projectId ? { ...p, scenes: p.scenes.filter((s) => s.id !== sceneId), updatedAt: Date.now() } : p),
      })),
      reorderScenes: (projectId, sceneIds) => set((s) => ({
        projects: s.projects.map((p) => p.id === projectId ? {
          ...p, scenes: sceneIds.map((id) => p.scenes.find((s) => s.id === id)).filter(Boolean) as Scene[],
          updatedAt: Date.now(),
        } : p),
      })),
      lockCharacter: (projectId, characterId) => set((s) => ({
        projects: s.projects.map((p) => p.id === projectId ? {
          ...p, lockedCharacterIds: [...new Set([...p.lockedCharacterIds, characterId])],
          updatedAt: Date.now(),
        } : p),
      })),
      unlockCharacter: (projectId, characterId) => set((s) => ({
        projects: s.projects.map((p) => p.id === projectId ? {
          ...p, lockedCharacterIds: p.lockedCharacterIds.filter((c) => c !== characterId),
          updatedAt: Date.now(),
        } : p),
      })),
      setStyleDna: (projectId, dna) => set((s) => ({
        projects: s.projects.map((p) => p.id === projectId ? { ...p, styleDna: dna, updatedAt: Date.now() } : p),
      })),
    }),
    { name: "agnes-project-store", version: 2 }
  )
);
