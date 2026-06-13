// ============================================================
// Agnes SDK — 视频生成服务
// ============================================================
// API (文档: https://agnes-ai.com/doc/agnes-video-v20):
//   POST /v1/videos                    -> 创建视频任务
//   GET  /agnesapi?video_id=<TASK_ID>  -> 查询视频结果（推荐）
// ============================================================

import type { AgnesClient } from "./client";
import type {
  TaskProgress,
  TextToVideoParams,
  ImageToVideoParams,
  VideoResult,
  TaskStatus,
} from "./types";

export interface PollOptions {
  interval?: number;
  maxInterval?: number;
  timeout?: number;
  onProgress?: (progress: TaskProgress) => void;
  signal?: AbortSignal;
}

export function createVideoService(client: AgnesClient) {

  function fileToDataUri(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.readAsDataURL(file);
    });
  }

  // -----------------------------------------------------------
  // 图片压缩 - 确保发送给 API 的 payload 足够小
  // -----------------------------------------------------------
  async function compressImageForUpload(file: File | Blob, maxDimension = 1536, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not available")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("压缩图片失败"));
        }, "image/jpeg", quality);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error("加载图片失败")); };
      img.src = URL.createObjectURL(file);
    });
  }

  // -----------------------------------------------------------
  // 用 fetch 直接调用 /agnesapi 端点（不在 /v1 下）
  // 注意：video_id 参数实际传入的是 task_id（短格式）
  // -----------------------------------------------------------
  async function queryAgnesApi(taskId: string): Promise<Record<string, unknown>> {
    const config = client.getConfig();
    const baseDomain = config.baseUrl.replace(/\/v1$/, "");
    const url = `${baseDomain}/agnesapi?video_id=${encodeURIComponent(taskId)}`;
    console.debug("[Agnes SDK] 查询 /agnesapi:", url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`/agnesapi 查询失败 (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    console.debug("[Agnes SDK] /agnesapi 响应:", JSON.stringify(data).slice(0, 600));
    return data as Record<string, unknown>;
  }

  // -----------------------------------------------------------
  // 文生视频 - 提交任务 (POST /v1/videos)
  // 使用 task_id（短格式）作为 videoId，/agnesapi 需要此格式
  // -----------------------------------------------------------
  async function create(params: TextToVideoParams): Promise<{
    taskId: string; videoId: string; numericId: string; syncUrl: string;
  }> {
    const config = client.getConfig();
    const model = params.model || config.textToVideoModel || config.model;
    const payload: Record<string, unknown> = {
      model, prompt: params.prompt,
      height: params.height ?? 768, width: params.width ?? 1152,
      num_frames: params.numFrames ?? 121, frame_rate: params.frameRate ?? 24,
    };
    const res = await client.post<unknown>("/videos", payload);
    console.debug("[Agnes SDK] POST /videos 响应:", JSON.stringify(res).slice(0, 800));
    let taskId = "";
    let videoId = "";
    if (res && typeof res === "object") {
      const obj = res as Record<string, unknown>;
      taskId = String(obj.task_id ?? obj.taskId ?? obj.id ?? "");
      videoId = String(obj.video_id ?? obj.videoId ?? obj.id ?? "");
    }
    if (!taskId) throw new Error("创建视频任务失败：" + JSON.stringify(res).slice(0, 300));
    console.debug("[Agnes SDK] 创建结果 - taskId:", taskId, "videoId:", videoId);
    return { taskId, videoId: videoId || taskId, numericId: "", syncUrl: "" };
  }

  // -----------------------------------------------------------
  // 图生视频 - 提交任务 (POST /v1/videos)
  // 自动压缩图片再发送，避免 payload 过大导致 ERR_CONNECTION_CLOSED
  // -----------------------------------------------------------
  async function createFromImage(params: ImageToVideoParams): Promise<{
    taskId: string; videoId: string; numericId: string; syncUrl: string;
  }> {
    const config = client.getConfig();
    // 1. 图片检测：>5MB才压缩，否则直接上传原图
    const rawSize = params.image.size || 0;
    console.debug("[Agnes SDK] 图生视频: 原始大小", (rawSize / 1024).toFixed(1), "KB");
    let processBlob: Blob;
    if (rawSize > 5 * 1024 * 1024) {
      console.debug("[Agnes SDK] 图片 >5MB，压缩至 1536px max, 85% quality");
      processBlob = await compressImageForUpload(params.image, 1536, 0.85);
      console.debug("[Agnes SDK] 压缩后大小:", (processBlob.size / 1024).toFixed(1), "KB");
    } else {
      processBlob = params.image;
    }
    // 2. 转为 base64
    const dataUri = await fileToDataUri(processBlob);
    const rawBase64 = dataUri.replace(/^data:image\/\w+;base64,/, "");
    // 3. 构建 payload
    const payload: Record<string, unknown> = {
      model: params.model || config.imageToVideoModel || config.model,
      prompt: params.prompt ?? "",
      image: rawBase64,
      height: params.height ?? 768,
      width: params.width ?? 1152,
      num_frames: params.numFrames ?? 121,
      frame_rate: params.frameRate ?? 24,
    };
    const payloadSize = JSON.stringify(payload).length;
    console.debug("[Agnes SDK] 图生视频 POST payload 大小:", (payloadSize / 1024).toFixed(1), "KB");
    // 4. 发送请求
    const res = await client.post<unknown>("/videos", payload);
    console.debug("[Agnes SDK] POST /videos 图生视频响应:", JSON.stringify(res).slice(0, 800));
    let taskId = "";
    let videoId = "";
    if (res && typeof res === "object") {
      const obj = res as Record<string, unknown>;
      taskId = String(obj.task_id ?? obj.taskId ?? obj.id ?? "");
      videoId = String(obj.video_id ?? obj.videoId ?? obj.id ?? "");
    }
    if (!taskId) throw new Error("创建图生视频任务失败：" + JSON.stringify(res).slice(0, 300));
    console.debug("[Agnes SDK] 图生视频结果 - taskId:", taskId, "videoId:", videoId);
    return { taskId, videoId: videoId || taskId, numericId: "", syncUrl: "" };
  }
  async function getProgress(taskId: string): Promise<TaskProgress> {
    console.debug("[Agnes SDK] 查询进度: taskId=", taskId);
    let data: Record<string, unknown>;
    try { data = await queryAgnesApi(taskId); }
    catch (err) { console.error("[Agnes SDK] 查询失败:", err); throw err; }
    let body: Record<string, unknown> = data;
    if (data && typeof data === "object") {
      if (data.code === "success" && data.data && typeof data.data === "object") {
        body = data.data as Record<string, unknown>;
      }
    }
    const progress = normalizeTaskProgress(body);
    console.debug("[Agnes SDK] 进度 - status:", progress.status, "progress:", progress.progress, "%");
    return progress;
  }

  // -----------------------------------------------------------
  // 轮询任务直到完成
  // -----------------------------------------------------------
  async function poll(taskId: string, options: PollOptions = {}): Promise<VideoResult> {
    const {
      interval: initialInterval = 3000,
      maxInterval = 15000,
      timeout = 600000,
      onProgress,
      signal,
    } = options;

    const startTime = Date.now();
    let currentInterval = initialInterval;
    let consecutiveErrors = 0;
    let lastProgressValue = -1;
    let pollCount = 0;
    const backoff = () => { currentInterval = Math.min(currentInterval * 1.3, maxInterval); };

    console.debug("[Agnes SDK] 开始轮询: taskId=", taskId, "间隔:", initialInterval, "ms");

    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`视频生成超时 (${timeout / 1000}s)，ID: ${taskId}`);
      }
      if (signal?.aborted) throw new Error(`轮询已取消，ID: ${taskId}`);

      pollCount++;
      let progress: TaskProgress;
      try {
        progress = await getProgress(taskId);
        consecutiveErrors = 0;
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= 20) throw new Error(`查询连续失败 (${consecutiveErrors}次)`);
        console.debug("[Agnes SDK] 查询失败 (", consecutiveErrors, "/20)");
        await delay(currentInterval); backoff(); continue;
      }
      if (progress.progress !== lastProgressValue) {
        console.debug("[Agnes SDK] 进度 [#" + pollCount + "]:", progress.status, progress.progress, "%, 任务:", progress.taskId);
        lastProgressValue = progress.progress;
      }
      onProgress?.(progress);

      if (progress.status === "completed") {
        if (progress.result && progress.result.url) {
          console.debug("[Agnes SDK] 视频生成完成! URL:", progress.result.url.slice(0, 100));
          return progress.result;
        }
        console.debug("[Agnes SDK] 状态 completed 但无 URL，继续等待...");
        await delay(currentInterval); backoff(); continue;
      }
      if (progress.status === "failed") throw new Error(`视频生成失败，ID: ${taskId}`);
      await delay(currentInterval); backoff();
    }
  }

  return { create, createFromImage, getProgress, poll };
}

// -----------------------------------------------------------
// 内部辅助
// -----------------------------------------------------------
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deepFind(obj: Record<string, unknown>, field: string): unknown {
  if (obj[field] !== undefined) return obj[field];
  if (field.includes(".")) {
    const parts = field.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const result = deepFind(val as Record<string, unknown>, field);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

function parseProgress(val: unknown): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val >= 0 ? val : 0;
  const str = String(val).trim();
  if (str.endsWith("%")) { const n = Number(str.slice(0, -1)); return isNaN(n) ? 0 : n; }
  const n = Number(str);
  return isNaN(n) ? 0 : n;
}

function normalizeTaskProgress(raw: Record<string, unknown>): TaskProgress {
  const innerVideoData = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : undefined;
  const innerS = innerVideoData?.status;
  const innerEffective = (innerS && String(innerS).toLowerCase() !== "queued") ? String(innerS) : undefined;
  const statusRaw = String(raw.status ?? innerEffective ?? deepFind(raw, "state") ?? "").toLowerCase();
  let progress = parseProgress(raw.progress ?? innerVideoData?.progress ?? 0);
  if (progress === 0 && ["completed","done","success","succeeded","failed","error","succeed"].some(s => statusRaw.includes(s))) progress = 100;
  if (progress === 0 && ["not_start","pending","queued"].some(s => statusRaw.includes(s))) progress = 1;
  const resultUrl = String(innerVideoData?.url ?? innerVideoData?.output_url ?? raw.url ?? raw.output_url ?? raw.remixed_from_video_id ?? deepFind(raw, "url") ?? "");
  const taskId = String(raw.task_id ?? raw.taskId ?? raw.id ?? innerVideoData?.task_id ?? innerVideoData?.taskId ?? innerVideoData?.id ?? "");
  const videoId = String(raw.video_id ?? raw.videoId ?? raw.id ?? innerVideoData?.id ?? "");
  return {
    taskId, status: mapStatus(statusRaw), progress, videoId,
    result: resultUrl ? { url: resultUrl, duration: Number(innerVideoData?.duration ?? raw.duration ?? 0) } : undefined,
  };
}

function mapStatus(raw: string): TaskStatus {
  if (!raw) return "queued";
  const s = raw.toLowerCase().trim();
  if (["completed","succeeded","succeed","done","finished","success","complete"].includes(s)) return "completed";
  if (["failed","error","failure","fail"].includes(s)) return "failed";
  if (["processing","running","in_progress","inprogress","active","pending","not_start","not_started"].includes(s)) return "processing";
  return "queued";
}
