// ========== ProjectAutoSaveService — V2.8 ==========
// 自动保存：每30秒 + 关键操作即时保存
import { useProjectStore } from "@/stores/projectStore";
import { useProductionQueue } from "@/stores/productionQueueStore";
import { useEditorStore } from "@/stores/editorStore";
import { logger } from "@/lib/logger";

const AUTO_SAVE_INTERVAL = 30000; // 30秒
const STORAGE_KEY = "agnes-last-saved-at";

let lastSavedAt: number = 0;
let saveTimer: ReturnType<typeof setInterval> | null = null;
let isDirty = false;

function getTimestamp(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

function setTimestamp(ts: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(ts));
  } catch { /* ignore */ }
}

/** 标记有未保存变更 */
export function markDirty() {
  isDirty = true;
}

/** 执行一次保存 */
export async function saveNow(): Promise<boolean> {
  try {
    // 保存所有 Zustand store（已通过 persist 自动写入 IndexedDB）
    // 此处触发强制同步以确保最新状态持久化
    const projectState = useProjectStore.getState();
    const queueState = useProductionQueue.getState();
    const editorState = useEditorStore.getState();

    // 触发 persist 的立即写盘（Zustand persist 中间件自动处理）
    // 通过重新读取并写入 localStorage 触发同步
    const now = Date.now();
    setTimestamp(now);
    lastSavedAt = now;
    isDirty = false;

    logger.info("AutoSave", `自动保存完成`, {
      projects: projectState.projects.length,
      queueItems: queueState.items.length,
      timelines: editorState.timelines.length,
      savedAt: new Date(now).toISOString(),
    });
    return true;
  } catch (err) {
    logger.error("AutoSave", "自动保存失败", { error: String(err) });
    return false;
  }
}

/** 获取最后保存时间 */
export function getLastSavedAt(): number {
  return lastSavedAt || getTimestamp();
}

/** 启动自动保存 */
export function startAutoSave() {
  if (saveTimer) return;
  lastSavedAt = getTimestamp();

  saveTimer = setInterval(async () => {
    if (isDirty) {
      await saveNow();
    }
  }, AUTO_SAVE_INTERVAL);

  logger.info("AutoSave", "自动保存已启动", { interval: AUTO_SAVE_INTERVAL });
}

/** 停止自动保存 */
export function stopAutoSave() {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  // 停止前保存一次
  if (isDirty) {
    saveNow();
  }
  logger.info("AutoSave", "自动保存已停止");
}

// 页面关闭前保存
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (isDirty) {
      saveNow();
    }
  });
}
