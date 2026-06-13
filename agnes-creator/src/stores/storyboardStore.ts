import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Scene, Shot, ShotType, TransitionType } from "@/types";

interface StoryboardStoreState {
  scenes: Scene[];
  addScene: (scene: Omit<Scene, "id" | "shots" | "createdAt" | "updatedAt">) => string;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  removeScene: (id: string) => void;
  reorderScenes: (sceneIds: string[]) => void;
  addShot: (sceneId: string, shot: Omit<Shot, "id" | "createdAt" | "updatedAt">) => string;
  updateShot: (sceneId: string, shotId: string, patch: Partial<Shot>) => void;
  removeShot: (sceneId: string, shotId: string) => void;
  reorderShots: (sceneId: string, shotIds: string[]) => void;
  getSceneById: (id: string) => Scene | undefined;
  getScenesByProjectId: (projectId: string) => Scene[];
}

let _sCounter = 0;
function genSceneId(): string {
  _sCounter++; return `scene-${Date.now()}-${_sCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
function genShotId(): string {
  _sCounter++; return `shot-${Date.now()}-${_sCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useStoryboardStore = create<StoryboardStoreState>()(
  persist(
    (set, get) => ({
      scenes: [],
      addScene: (data) => {
        const id = genSceneId(); const now = Date.now();
        set((s) => ({ scenes: [...s.scenes, { ...data, id, shots: [], createdAt: now, updatedAt: now }] }));
        return id;
      },
      updateScene: (id, patch) => set((s) => ({ scenes: s.scenes.map((sc) => sc.id === id ? { ...sc, ...patch, updatedAt: Date.now() } : sc) })),
      removeScene: (id) => set((s) => ({ scenes: s.scenes.filter((sc) => sc.id !== id) })),
      reorderScenes: (sceneIds) => set((s) => ({ scenes: sceneIds.map((id) => s.scenes.find((sc) => sc.id === id)).filter(Boolean) as Scene[] })),
      addShot: (sceneId, data) => {
        const id = genShotId(); const now = Date.now();
        const shot: Shot = { ...data, id, createdAt: now, updatedAt: now };
        set((s) => ({ scenes: s.scenes.map((sc) => sc.id === sceneId ? { ...sc, shots: [...sc.shots, shot], updatedAt: now } : sc) }));
        return id;
      },
      updateShot: (sceneId, shotId, patch) => set((s) => ({ scenes: s.scenes.map((sc) => sc.id === sceneId ? { ...sc, shots: sc.shots.map((sh) => sh.id === shotId ? { ...sh, ...patch, updatedAt: Date.now() } : sh), updatedAt: Date.now() } : sc) })),
      removeShot: (sceneId, shotId) => set((s) => ({ scenes: s.scenes.map((sc) => sc.id === sceneId ? { ...sc, shots: sc.shots.filter((sh) => sh.id !== shotId), updatedAt: Date.now() } : sc) })),
      reorderShots: (sceneId, shotIds) => set((s) => ({ scenes: s.scenes.map((sc) => sc.id === sceneId ? { ...sc, shots: shotIds.map((id) => sc.shots.find((sh) => sh.id === id)).filter(Boolean) as Shot[] } : sc) })),
      getSceneById: (id) => get().scenes.find((sc) => sc.id === id),
      getScenesByProjectId: (projectId) => get().scenes.filter((sc) => sc.projectId === projectId).sort((a, b) => a.order - b.order),
    }),
    { name: "agnes-storyboard-store", version: 1 }
  )
);
