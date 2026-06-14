import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorTimeline, EditorClip } from "@/types";

interface EditorStoreState {
  timelines: EditorTimeline[];
  activeTimelineId: string | null;
  // V2.5: Testing mode
  testingMode: boolean;
  setTestingMode: (on: boolean) => void;
  createTimeline: (data: Omit<EditorTimeline, "id" | "clips" | "createdAt" | "updatedAt">) => string;
  setActiveTimeline: (id: string | null) => void;
  addClip: (timelineId: string, clip: Omit<EditorClip, "id">) => string;
  updateClip: (timelineId: string, clipId: string, patch: Partial<EditorClip>) => void;
  removeClip: (timelineId: string, clipId: string) => void;
  reorderClips: (timelineId: string, clipIds: string[]) => void;
  getActiveTimeline: () => EditorTimeline | undefined;
  getTimelineById: (id: string) => EditorTimeline | undefined;
}

let _eCounter = 0;
function genTimelineId(): string {
  _eCounter++; return `tl-${Date.now()}-${_eCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
function genClipId(): string {
  _eCounter++; return `clip-${Date.now()}-${_eCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useEditorStore = create<EditorStoreState>()(
  persist(
    (set, get) => ({
      timelines: [],
      activeTimelineId: null,
      createTimeline: (data) => {
        const id = genTimelineId(); const now = Date.now();
        set((s) => ({ timelines: [...s.timelines, { ...data, id, clips: [], createdAt: now, updatedAt: now }], activeTimelineId: id }));
        return id;
      },
      setActiveTimeline: (id) => set({ activeTimelineId: id }),
      testingMode: false,
      setTestingMode: (on) => set({ testingMode: on }),
      addClip: (timelineId, data) => {
        const id = genClipId(); const now = Date.now();
        const clip: EditorClip = { ...data, id };
        set((s) => ({ timelines: s.timelines.map((t) => t.id === timelineId ? { ...t, clips: [...t.clips, clip], duration: t.clips.reduce((sum, c) => sum + c.duration, 0) + clip.duration, updatedAt: now } : t) }));
        return id;
      },
      updateClip: (timelineId, clipId, patch) => set((s) => ({ timelines: s.timelines.map((t) => t.id === timelineId ? { ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, ...patch } : c), updatedAt: Date.now() } : t) })),
      removeClip: (timelineId, clipId) => set((s) => ({ timelines: s.timelines.map((t) => t.id === timelineId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId), duration: t.clips.filter((c) => c.id !== clipId).reduce((sum, c) => sum + c.duration, 0), updatedAt: Date.now() } : t) })),
      reorderClips: (timelineId, clipIds) => set((s) => ({ timelines: s.timelines.map((t) => t.id === timelineId ? { ...t, clips: clipIds.map((id) => t.clips.find((c) => c.id === id)).filter(Boolean) as EditorClip[] } : t) })),
      getActiveTimeline: () => { const state = get(); return state.activeTimelineId ? state.timelines.find((t) => t.id === state.activeTimelineId) : undefined; },
      getTimelineById: (id) => get().timelines.find((t) => t.id === id),
    }),
    { name: "agnes-editor-store", version: 1 }
  )
);
