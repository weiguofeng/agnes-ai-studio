// ========== PromptHistoryStore — V2.8 ==========
// 持久化保存 Prompt 历史版本，每镜头最多 50 版本
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "@/services/IndexedDBStorage";
import { logger } from "@/lib/logger";

export interface PromptVersion {
  prompt: string;
  savedAt: number;
}

interface PromptHistoryState {
  /** key: shotId, value: versions array */
  history: Record<string, PromptVersion[]>;

  /** 保存一个版本 */
  saveVersion: (shotId: string, prompt: string) => void;

  /** 获取某个镜头的所有版本 */
  getVersions: (shotId: string) => PromptVersion[];

  /** 恢复某个版本（返回该版本的 prompt） */
  getVersion: (shotId: string, index: number) => string | null;

  /** 删除某个版本 */
  deleteVersion: (shotId: string, index: number) => void;

  /** 删除某个镜头的所有版本 */
  clearShotHistory: (shotId: string) => void;

  /** 获取历史统计 */
  getStats: () => { totalShots: number; totalVersions: number; };
}

const MAX_VERSIONS_PER_SHOT = 50;

export const usePromptHistoryStore = create<PromptHistoryState>()(
  persist(
    (set, get) => ({
      history: {},

      saveVersion: (shotId, prompt) => set((s) => {
        const history = s.history || {};
        const existing = history[shotId] || [];
        // 避免重复保存相同 prompt
        if (existing.length > 0 && existing[0].prompt === prompt) return s;
        const versions = [{ prompt, savedAt: Date.now() }, ...existing];
        // 超出限制，删除最旧版本
        if (versions.length > MAX_VERSIONS_PER_SHOT) {
          versions.pop();
        }
        logger.info("PromptHistory", `保存版本: shot=${shotId.slice(-8)}, 版本数=${versions.length}`);
        return { history: { ...history, [shotId]: versions } };
      }),

      getVersions: (shotId) => (get().history || {})[shotId] || [],

      getVersion: (shotId, index) => {
        const versions = (get().history || {})[shotId];
        if (!versions || index < 0 || index >= versions.length) return null;
        return versions[index].prompt;
      },

      deleteVersion: (shotId, index) => set((s) => {
        const history = s.history || {};
        const versions = (history[shotId] || []).filter((_, i) => i !== index);
        return { history: { ...history, [shotId]: versions } };
      }),

      clearShotHistory: (shotId) => set((s) => {
        const { [shotId]: _removed, ...rest } = s.history || {};
        return { history: rest };
      }),

      getStats: () => {
        const h = get().history || {};
        const totalShots = Object.keys(h).length;
        const totalVersions = Object.values(h).reduce((sum, v) => sum + v.length, 0);
        return { totalShots, totalVersions };
      },
    }),
    {
      name: "agnes-prompt-history",
      version: 1,
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
);
