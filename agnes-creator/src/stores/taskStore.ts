// ============================================================
// Task Store — 全局任务持久化存储 (V2)
// 状态机: QUEUED → SUBMITTED → PROCESSING → COMPLETED
//                        ↓            ↓
//                   RATE_LIMITED ← 429     AWAITING_ASSET (等待视频文件就绪)
//                   (自动恢复)
// ============================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TaskType = "text-to-image" | "image-to-image" | "text-to-video" | "image-to-video";

export type TaskStatus =
  | "queued"
  | "uploading"
  | "submitted"
  | "processing"
  | "rate_limited"
  | "awaiting_asset"
  | "completed"
  | "failed"
  | "timeout"
  | "cancelled";

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued:         ["submitted", "cancelled", "failed"],
  uploading:      ["submitted", "failed", "cancelled"],
  submitted:      ["processing", "failed", "timeout", "cancelled"],
  processing:     ["completed", "awaiting_asset", "rate_limited", "failed", "timeout", "cancelled"],
  rate_limited:   ["processing", "completed", "awaiting_asset", "failed", "timeout", "cancelled"],
  awaiting_asset: ["completed", "failed", "timeout", "cancelled"],
  completed:      [],
  failed:         ["queued"],
  timeout:        ["queued"],
  cancelled:      [],
};

export interface UnifiedTask {
  id: string; taskId: string; type: TaskType; model: string; prompt: string;
  status: TaskStatus; progress: number; createTime: number; updateTime: number;
  resultUrl: string; thumbnail: string; errorMessage: string;
  params?: Record<string, unknown>; duration?: number; sourcePreview?: string;
  retryCount?: number; cancelling?: boolean; submitTime?: number; pollCount?: number;
  lastApiRawStatus?: string; lastApiRawProgress?: number; lastApiResponse?: string;
  rateLimitCount?: number; lastPollTime?: number; nextPollTime?: number;
  rateLimitResetTime?: number;
}

interface TaskStoreState {
  tasks: UnifiedTask[];
  addTask: (task: Omit<UnifiedTask, "id" | "createTime" | "updateTime"> & { id?: string }) => string;
  updateTask: (id: string, patch: Partial<UnifiedTask>) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  getActiveTasks: () => UnifiedTask[];
  getTaskById: (id: string) => UnifiedTask | undefined;
}

let _counter = 0;
function generateId(): string {
  _counter++; return `task-${Date.now()}-${_counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set, get) => ({
      tasks: [],
      addTask: (task) => {
        const now = Date.now(); const id = task.id || generateId();
        const newTask: UnifiedTask = { ...task, id, createTime: now, updateTime: now, progress: -1 };
        set((state) => ({ tasks: [newTask, ...state.tasks] })); return id;
      },
      updateTask: (id, patch) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            const oldStatus = t.status;
            if (patch.status && patch.status !== oldStatus) {
              const allowed = VALID_TRANSITIONS[oldStatus];
              if (allowed && !allowed.includes(patch.status)) {
                console.warn(`[TaskStore] 非法状态转换: ${oldStatus} → ${patch.status} (task: ${id.slice(-8)})`);
              }
              console.log(`[TaskStore] 状态变更: ${oldStatus} → ${patch.status} (task: ${id.slice(-8)})`);
            }
            return { ...t, ...patch, updateTime: Date.now() };
          }),
        }));
      },
      removeTask: (id) => { set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })); },
      clearCompleted: () => { set((state) => ({ tasks: state.tasks.filter((t) => ["processing","queued","submitted","rate_limited","awaiting_asset"].includes(t.status)) })); },
      clearAll: () => set({ tasks: [] }),
      getActiveTasks: () => get().tasks.filter((t) => ["processing","queued","submitted","rate_limited","awaiting_asset"].includes(t.status)),
      getTaskById: (id) => get().tasks.find((t) => t.id === id),
    }),
    { name: "agnes-task-store", version: 2 }
  )
);

// ============================================================
// Task Manager
// ============================================================
export type TaskCategory = "image" | "video";
const TASK_CATEGORY: Record<TaskType, TaskCategory> = {
  "text-to-image": "image", "image-to-image": "image",
  "text-to-video": "video", "image-to-video": "video",
};
const RATE_LIMIT_BACKOFF = [15000, 30000, 60000, 120000, 300000];

function getPollInterval(task: UnifiedTask | undefined, elapsedSec: number): number {
  if (!task) return 20000;
  if (task.status === "queued" || task.status === "submitted") return 15000;
  if (task.status === "rate_limited") return 30000;
  if (task.status === "awaiting_asset") return 10000;
  if (elapsedSec > 600) return 60000;
  if (elapsedSec > 300) return 30000;
  return 20000;
}

function mapRawStatus(raw: string): { status: TaskStatus } {
  const s = (raw || "").toLowerCase().trim();
  if (["completed","succeeded","succeed","done","finished","success","complete"].includes(s)) return { status: "completed" };
  if (["failed","error","failure","fail"].includes(s)) return { status: "failed" };
  if (["processing","running","in_progress","inprogress","active"].includes(s)) return { status: "processing" };
  return { status: "queued" };
}

/** 深度搜索所有字段名，含 remixed_from_video_id */
function extractUrlFromResponse(data: unknown, visited?: Set<unknown>): { url: string; source: string } {
  if (!data || typeof data !== "object") return { url: "", source: "" };
  if (!visited) visited = new Set();
  if (visited.has(data)) return { url: "", source: "" };
  visited.add(data);
  const obj = data as Record<string, unknown>;

  // 优先检查 remixed_from_video_id（Agnes API 视频地址字段）
  const remixed = obj.remixed_from_video_id;
  if (typeof remixed === "string" && (remixed.startsWith("http://") || remixed.startsWith("https://"))) {
    return { url: remixed as string, source: "remixed_from_video_id" };
  }

  // 其他字段
  for (const field of ["url","video_url","download_url","result_url","output_url","thumbnail_url","file_url"]) {
    const val = obj[field];
    if (typeof val === "string" && (val as string).startsWith("http")) {
      return { url: val as string, source: field };
    }
  }

  // 递归搜索嵌套对象
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      const result = extractUrlFromResponse(val, visited);
      if (result.url) return result;
    }
  }
  return { url: "", source: "" };
}

class TaskManagerService {
  private runningCount = { image: 0, video: 0 };
  private pendingQueue: Array<{ taskId: string; category: TaskCategory; start: () => Promise<void> }> = [];
  private abortControllers = new Map<string, AbortController>();
  private maxConcurrency = { image: 5, video: 3 };

  // 统一轮询调度器
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private pollTasks = new Map<string, {
    apiTaskId: string;
    isPolling: boolean;  // 并发锁
    startTime: number;
    lastMappedStatus: string;
    consecutiveErrors: number;
    consecutive429: number;
    totalPolls: number;
  }>();

  // ============================================================
  // 直接查询 Agnes API 原始响应
  // ============================================================
  private async _queryRawProgress(apiTaskId: string): Promise<{
    rawStatus: string; rawProgress: number; resultUrl: string; sourceField: string;
    error: string; rawResponse: string; statusCode: number;
  }> {
    const { useConfigStore } = await import("@/stores/configStore");
    const config = useConfigStore.getState();
    const baseDomain = config.baseUrl.replace(/\/v1$/, "");
    const url = `${baseDomain}/agnesapi?video_id=${encodeURIComponent(apiTaskId)}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${config.apiKey}` } });
    const statusCode = res.status;

    if (statusCode === 429) {
      return { rawStatus: "rate_limited", rawProgress: 0, resultUrl: "", sourceField: "",
        error: `HTTP 429`, rawResponse: "429", statusCode };
    }

    const rawText = await res.text();
    if (!res.ok) {
      return { rawStatus: "error", rawProgress: 0, resultUrl: "", sourceField: "",
        error: `HTTP ${res.status}`, rawResponse: rawText.slice(0, 500), statusCode };
    }

    // 完整 JSON 日志（禁止截断）
    console.log(`[RawAPI] 完整响应 body:\n${rawText}`);

    let data: Record<string, unknown>;
    try { data = JSON.parse(rawText); } catch { data = {}; }

    const outerData = (data as any)?.data || {};
    const innerData = outerData?.data || {};
    const rawStatus = String(outerData.status || innerData.status || data.status || "").toLowerCase();

    const rawProgressVal = outerData.progress ?? innerData.progress ?? "0";
    let rawProgress = typeof rawProgressVal === "number" ? rawProgressVal : (parseInt(String(rawProgressVal), 10) || 0);
    if (rawProgress === 0 && ["completed","succeeded","done","success"].some(s => rawStatus.includes(s))) rawProgress = 100;

    // 深度搜索 URL（含 remixed_from_video_id）
    const { url: resultUrl, source: sourceField } = extractUrlFromResponse(data);

    const error = String(outerData.fail_reason || innerData.error || data.message || "");
    return { rawStatus, rawProgress, resultUrl, sourceField, error, rawResponse: rawText, statusCode };
  }

  // ============================================================
  // 执行任务
  // ============================================================
  async execute(taskId: string, type: TaskType, executor: () => Promise<unknown>): Promise<void> {
    const category = TASK_CATEGORY[type];
    const store = useTaskStore.getState();

    const run = async () => {
      this.runningCount[category]++;
      const controller = new AbortController();
      this.abortControllers.set(taskId, controller);
      try {
        store.updateTask(taskId, { status: "submitted", progress: -1 });
        const result = await executor() as Record<string, unknown>;
        if (controller.signal.aborted) return;
        if (type.includes("video")) {
          const apiTaskId = String(result.videoId || result.video_id || result.taskId || result.task_id || "");
          if (apiTaskId) {
            store.updateTask(taskId, { taskId: apiTaskId, submitTime: Date.now(), pollCount: 0 });
            this._startScheduler();
            this.pollTasks.set(taskId, {
              apiTaskId, isPolling: false, startTime: Date.now(),
              lastMappedStatus: "submitted", consecutiveErrors: 0, consecutive429: 0, totalPolls: 0,
            });
            store.updateTask(taskId, { status: "processing" });
          }
        } else {
          const url = String(result.url || result.output_url || "");
          store.updateTask(taskId, { status: "completed", progress: 100, resultUrl: url });
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const isCancelled = err instanceof Error && err.name === "AbortError";
        store.updateTask(taskId, { status: isCancelled ? "cancelled" : "failed", errorMessage: err instanceof Error ? err.message : "生成失败" });
      } finally {
        this.runningCount[category]--;
        this.abortControllers.delete(taskId);
        this._processQueue(category);
      }
    };

    if (this.runningCount[category] < this.maxConcurrency[category]) { await run(); }
    else {
      await new Promise<void>((resolve, reject) => {
        this.pendingQueue.push({ taskId, category, start: async () => { try { await run(); resolve(); } catch (e) { reject(e); } } });
      });
    }
  }

  cancelTask(taskId: string): void {
    this.pollTasks.delete(taskId);
    this.abortControllers.get(taskId)?.abort();
    const idx = this.pendingQueue.findIndex((p) => p.taskId === taskId);
    if (idx >= 0) this.pendingQueue.splice(idx, 1);
    useTaskStore.getState().updateTask(taskId, { status: "cancelled" });
  }

  async retryTask(taskId: string): Promise<void> {
    const store = useTaskStore.getState();
    const task = store.getTaskById(taskId);
    if (!task) return;
    store.updateTask(taskId, { status: "queued", progress: -1, errorMessage: "", retryCount: (task.retryCount || 0) + 1 });
    if (task.type === "text-to-video") {
      const { agnes } = await import("@/services/agnes");
      await this.execute(taskId, task.type, () => agnes.video.create({ prompt: task.prompt, model: task.model }) as unknown as Promise<Record<string, unknown>>);
    } else {
      store.updateTask(taskId, { status: "failed", errorMessage: "图生视频重试需要重新上传图片" });
    }
  }

  // ============================================================
  // 统一轮询调度器
  // ============================================================
  private _startScheduler(): void {
    if (this.schedulerTimer) return;
    console.log("[PollScheduler] 启动统一轮询调度器 (tick=2s)");
    this.schedulerTimer = setInterval(() => this._schedulerTick(), 2000);
  }

  private _stopSchedulerIfIdle(): void {
    if (this.pollTasks.size === 0 && this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
      console.log("[PollScheduler] 无活跃任务，调度器已停止");
    }
  }

  private _schedulerTick(): void {
    const store = useTaskStore.getState();
    const now = Date.now();
    for (const [taskId, info] of this.pollTasks) {
      const task = store.getTaskById(taskId);
      if (!task) { this.pollTasks.delete(taskId); continue; }
      // 已完成/失败/超时/取消 → 从Scheduler移除
      if (["completed", "failed", "timeout", "cancelled"].includes(task.status)) {
        this.pollTasks.delete(taskId);
        continue;
      }
      if (task.nextPollTime && now < task.nextPollTime) continue;
      // 并发锁：同一任务同一时刻只允许一个请求
      if (info.isPolling) continue;
      info.isPolling = true;
      const elapsedSec = (now - info.startTime) / 1000;
      const interval = getPollInterval(task, elapsedSec);
      store.updateTask(taskId, { nextPollTime: now + interval, lastPollTime: now });
      this._pollOneTask(taskId, info).finally(() => { info.isPolling = false; });
    }
    this._stopSchedulerIfIdle();
  }

  private async _pollOneTask(
    taskId: string,
    info: { apiTaskId: string; isPolling: boolean; startTime: number; lastMappedStatus: string; consecutiveErrors: number; consecutive429: number; totalPolls: number }
  ): Promise<void> {
    const store = useTaskStore.getState();
    const now = Date.now();
    const elapsed = now - info.startTime;
    info.totalPolls++;

    const maxPollTime = 15 * 60 * 1000;
    if (elapsed > maxPollTime) {
      this.pollTasks.delete(taskId);
      store.updateTask(taskId, { status: "timeout", progress: -1, errorMessage: "任务生成超时，请重新尝试" });
      console.log(`[PollScheduler] 超时: task=${taskId.slice(-8)}, elapsed=${Math.round(elapsed/1000)}s`);
      return;
    }

    try {
      const raw = await this._queryRawProgress(info.apiTaskId);
      const timeStr = new Date().toLocaleTimeString("zh-CN", { hour12: false });

      // 429 限流
      if (raw.statusCode === 429) {
        info.consecutive429++;
        const idx = Math.min(info.consecutive429 - 1, RATE_LIMIT_BACKOFF.length - 1);
        const waitMs = RATE_LIMIT_BACKOFF[idx];
        store.updateTask(taskId, {
          status: "rate_limited", progress: -1,
          rateLimitCount: (store.getTaskById(taskId)?.rateLimitCount || 0) + 1,
          nextPollTime: now + waitMs,
          errorMessage: `服务器繁忙（429），${Math.round(waitMs/1000)}秒后自动重试`,
        });
        console.log(`[PollScheduler] [${timeStr}] 429限流 task=${taskId.slice(-8)} #${info.consecutive429} 等待${Math.round(waitMs/1000)}s`);
        return;
      }

      // 正常响应
      info.consecutive429 = 0;
      info.consecutiveErrors = 0;
      const mapped = mapRawStatus(raw.rawStatus);
      const currentTask = store.getTaskById(taskId);

      console.log(`[PollScheduler] [${timeStr}] Poll#${info.totalPolls} task=${taskId.slice(-8)} raw="${raw.rawStatus}" progress=${raw.rawProgress} HTTP=${raw.statusCode} url="${raw.resultUrl.slice(0,60)}" source="${raw.sourceField}"`);

      // === 状态回滚保护 ===
      if (currentTask && (currentTask.status === "completed" || currentTask.status === "awaiting_asset")) {
        if (mapped.status === "processing" || mapped.status === "queued") {
          console.log(`[PollScheduler] 忽略状态回退 task=${taskId.slice(-8)} ${currentTask.status} → ${mapped.status}`);
          return;
        }
      }

      // === 完成检测 ===
      if (mapped.status === "completed") {
        // 检查 remixed_from_video_id（Agnes API 的视频地址字段）
        let videoUrl = raw.resultUrl;
        let sourceField = raw.sourceField || "deepFindUrl";
        if (!videoUrl) {
          // 直接从原始JSON提取
          try {
            const rawData = JSON.parse(raw.rawResponse);
            const outerData = (rawData as any)?.data || {};
            const innerData = outerData?.data || {};
            const remixed = String(outerData.remixed_from_video_id || innerData.remixed_from_video_id || "");
            if (remixed && (remixed.startsWith("http://") || remixed.startsWith("https://"))) {
              videoUrl = remixed;
              sourceField = "remixed_from_video_id";
            }
          } catch { /* empty: continue polling */ }
        }

        const hasValidUrl = videoUrl.length > 0 && videoUrl.startsWith("http");

        if (hasValidUrl) {
          // 直接信任URL（GCS存在CORS限制，HEAD请求会失败）
          this.pollTasks.delete(taskId);
          store.updateTask(taskId, { status: "completed", progress: 100, resultUrl: videoUrl });
          console.log(`[PollScheduler] 完成 task=${taskId.slice(-8)} url=${videoUrl.slice(0,80)} source=${sourceField}`);
          return;
        }

        // 无URL → AWAITING_ASSET，继续轮询等待
        // 15分钟超时保护
        if (currentTask?.status === "awaiting_asset" && elapsed > 900000) {
          this.pollTasks.delete(taskId);
          store.updateTask(taskId, { status: "timeout", progress: -1, errorMessage: "视频文件同步超时（15分钟）" });
          console.log(`[PollScheduler] 超时 task=${taskId.slice(-8)} awaiting_asset 超过15分钟`);
          return;
        }
        if (currentTask?.status !== "awaiting_asset") {
          store.updateTask(taskId, { status: "awaiting_asset", progress: -1, errorMessage: "视频处理中，正在同步文件..." });
          console.log(`[PollScheduler] 进入 awaiting_asset task=${taskId.slice(-8)} elapsed=${Math.round(elapsed/1000)}s`);
        }
        return;
      }

      // 状态映射（不含 completed — 在上面处理了）
      const update: Record<string, unknown> = {
        pollCount: info.totalPolls, lastApiRawStatus: raw.rawStatus, lastApiRawProgress: raw.rawProgress,
        lastApiResponse: raw.rawResponse.slice(0, 300),
      };

      // rate_limited 恢复
      if (currentTask?.status === "rate_limited" && mapped.status !== "failed") {
        update.status = "processing";
        update.errorMessage = "限流已恢复";
        console.log(`[PollScheduler] 限流恢复 task=${taskId.slice(-8)}`);
      } else if (mapped.status !== info.lastMappedStatus && mapped.status !== "queued") {
        update.status = mapped.status;
        info.lastMappedStatus = mapped.status;
      }

      if (mapped.status === "queued" || mapped.status === "submitted") { update.progress = -1; }
      else if (mapped.status === "processing" && raw.rawProgress > 0) { update.progress = Math.min(raw.rawProgress, 99); }
      else if (mapped.status === "processing") { update.progress = -1; }

      if (raw.error && raw.statusCode !== 429) update.errorMessage = raw.error;
      store.updateTask(taskId, update as Partial<UnifiedTask>);

      // 失败
      if (mapped.status === "failed") {
        this.pollTasks.delete(taskId);
        store.updateTask(taskId, { status: "failed", progress: -1, errorMessage: raw.error || "生成失败" });
        console.log(`[PollScheduler] 失败 task=${taskId.slice(-8)} reason=${raw.error || "未知"}`);
        return;
      }

    } catch (err) {
      info.consecutiveErrors++;
      const msg = err instanceof Error ? err.message : "网络错误";
      console.log(`[PollScheduler] 查询失败 task=${taskId.slice(-8)} #${info.consecutiveErrors}: ${msg.slice(0,60)}`);
      if (info.consecutiveErrors >= 20) {
        this.pollTasks.delete(taskId);
        store.updateTask(taskId, { status: "failed", progress: -1, errorMessage: "网络连接中断" });
      }
    }
  }

  stopPolling(taskId: string): void { this.pollTasks.delete(taskId); this._stopSchedulerIfIdle(); }
  stopAllPolling(): void { this.pollTasks.clear(); if (this.schedulerTimer) { clearInterval(this.schedulerTimer); this.schedulerTimer = null; } }

  private _processQueue(category: TaskCategory): void {
    const max = this.maxConcurrency[category];
    while (this.runningCount[category] < max) {
      const idx = this.pendingQueue.findIndex((p) => p.category === category && !this.abortControllers.has(p.taskId));
      if (idx < 0) break;
      const [item] = this.pendingQueue.splice(idx, 1);
      item.start().catch(() => {});
    }
  }
}

export const taskManager = new TaskManagerService();
export { TaskManagerService };


