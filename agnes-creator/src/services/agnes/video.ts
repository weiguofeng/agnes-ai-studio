// ============================================================
// Agnes SDK - video generation service
// ============================================================
// API:
//   POST /v1/videos                   -> create video task
//   GET  /agnesapi?video_id=<TASK_ID> -> query video result
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

export function isAgnesRateLimitError(err: unknown): boolean {
  const message = String(err instanceof Error ? err.message : err).toLowerCase();
  return message.includes("429") || message.includes("rate limit") || message.includes("too many requests");
}

export function getNextPollInterval(currentInterval: number, maxInterval: number, rateLimited = false): number {
  const factor = rateLimited ? 2 : 1.3;
  return Math.min(Math.ceil(currentInterval * factor), maxInterval);
}

export function createVideoService(client: AgnesClient) {
  function extractVideoTaskIds(response: unknown): { taskId: string; videoId: string } {
    if (!response || typeof response !== "object") return { taskId: "", videoId: "" };
    const obj = response as Record<string, unknown>;
    const data = obj.data && typeof obj.data === "object" ? obj.data as Record<string, unknown> : undefined;
    const nestedData = data?.data && typeof data.data === "object" ? data.data as Record<string, unknown> : undefined;
    const taskId = String(obj.task_id ?? obj.taskId ?? data?.task_id ?? data?.taskId ?? nestedData?.task_id ?? nestedData?.taskId ?? obj.id ?? data?.id ?? nestedData?.id ?? "");
    const videoId = String(obj.video_id ?? obj.videoId ?? data?.video_id ?? data?.videoId ?? nestedData?.video_id ?? nestedData?.videoId ?? "");
    return { taskId, videoId };
  }

  function fileToDataUri(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

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
        if (!ctx) {
          reject(new Error("Canvas not available"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to compress image"));
        }, "image/jpeg", quality);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to load image"));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function queryAgnesApi(taskId: string): Promise<Record<string, unknown>> {
    const config = client.getConfig();
    const baseDomain = config.baseUrl.replace(/\/v1$/, "");
    const url = `${baseDomain}/agnesapi?video_id=${encodeURIComponent(taskId)}`;
    console.debug("[Agnes SDK] Query /agnesapi:", url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`/agnesapi query failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    console.debug("[Agnes SDK] /agnesapi response:", JSON.stringify(data).slice(0, 600));
    return data as Record<string, unknown>;
  }

  async function create(params: TextToVideoParams): Promise<{
    taskId: string; videoId: string; numericId: string; syncUrl: string;
  }> {
    const config = client.getConfig();
    const model = params.model || config.textToVideoModel || config.model;
    const payload: Record<string, unknown> = {
      model,
      prompt: params.prompt,
      height: params.height ?? 768,
      width: params.width ?? 1152,
      num_frames: params.numFrames ?? 121,
      frame_rate: params.frameRate ?? 24,
    };
    const res = await client.post<unknown>("/videos", payload);
    console.debug("[Agnes SDK] POST /videos response:", JSON.stringify(res).slice(0, 800));
    const { taskId, videoId } = extractVideoTaskIds(res);
    if (!taskId) throw new Error("Failed to create video task: " + JSON.stringify(res).slice(0, 300));
    console.debug("[Agnes SDK] Create result - taskId:", taskId, "videoId:", videoId);
    return { taskId, videoId: videoId || taskId, numericId: "", syncUrl: "" };
  }

    async function createFromImage(params: ImageToVideoParams): Promise<{ taskId: string; videoId: string; numericId: string; syncUrl: string; }> {
    const config = client.getConfig();
    const model = params.model || config.imageToVideoModel || config.model;
    // API accepts JSON with image URL(s), NOT FormData or base64
    const payload: Record<string, unknown> = {
      model,
      prompt: params.prompt || "",
      num_frames: params.numFrames ?? 121,
      frame_rate: params.frameRate ?? 24,
    };
    if (params.height) payload.height = params.height;
    if (params.width) payload.width = params.width;
    if (params.negativePrompt) payload.negative_prompt = params.negativePrompt;
    if (params.seed) payload.seed = params.seed;
    if (params.image) {
      if (Array.isArray(params.image)) {
        // Multi-image: pass as extra_body.image array
        payload.extra_body = { image: params.image };
      } else {
        // Single image: pass as image URL string
        payload.image = params.image;
      }
    }
    console.debug("[Agnes SDK] POST /videos (image):", JSON.stringify({ ...payload, image: payload.image ? "(set)" : undefined, extra_body: payload.extra_body ? "(set)" : undefined }).slice(0, 400));
    const res = await client.post<unknown>("/videos", payload);
    console.debug("[Agnes SDK] POST /videos (image) response:", JSON.stringify(res).slice(0, 600));
    const { taskId, videoId } = extractVideoTaskIds(res);
    if (!taskId) throw new Error("Failed to create image-to-video task: " + JSON.stringify(res).slice(0, 300));
    return { taskId, videoId: videoId || taskId, numericId: "", syncUrl: "" };
  }

  async function getProgress(taskId: string): Promise<TaskProgress> {
    console.debug("[Agnes SDK] Query progress: taskId=", taskId);
    let data: Record<string, unknown>;
    try {
      data = await queryAgnesApi(taskId);
    } catch (err) {
      console.error("[Agnes SDK] Query failed:", err);
      throw err;
    }
    let body: Record<string, unknown> = data;
    if (data && typeof data === "object" && data.code === "success" && data.data && typeof data.data === "object") {
      body = data.data as Record<string, unknown>;
    }
    const progress = normalizeTaskProgress(body);
    console.debug("[Agnes SDK] Progress - status:", progress.status, "progress:", progress.progress, "%");
    return progress;
  }

  async function poll(taskId: string, options: PollOptions = {}): Promise<VideoResult> {
    const {
      interval: initialInterval = 3000,
      maxInterval = 60000,
      timeout = 600000,
      onProgress,
      signal,
    } = options;

    const startTime = Date.now();
    let currentInterval = initialInterval;
    let consecutiveErrors = 0;
    let lastProgressValue = -1;
    let pollCount = 0;
    const backoff = (rateLimited = false) => {
      currentInterval = getNextPollInterval(currentInterval, maxInterval, rateLimited);
    };

    console.debug("[Agnes SDK] Start polling: taskId=", taskId, "interval:", initialInterval, "ms");

    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Video generation timeout (${timeout / 1000}s), ID: ${taskId}`);
      }
      if (signal?.aborted) throw new Error(`Polling cancelled, ID: ${taskId}`);

      pollCount++;
      let progress: TaskProgress;
      try {
        progress = await getProgress(taskId);
        consecutiveErrors = 0;
      } catch (err) {
        if (isAgnesRateLimitError(err)) {
          backoff(true);
          console.debug("[Agnes SDK] Rate limited while polling; backing off to", currentInterval, "ms");
          await delay(currentInterval);
          continue;
        }
        consecutiveErrors++;
        if (consecutiveErrors >= 20) throw new Error(`Query failed consecutively (${consecutiveErrors} times)`);
        console.debug("[Agnes SDK] Query failed (", consecutiveErrors, "/20)");
        await delay(currentInterval);
        backoff();
        continue;
      }
      if (progress.progress !== lastProgressValue) {
        console.debug("[Agnes SDK] Progress [#" + pollCount + "]:", progress.status, progress.progress, "%, task:", progress.taskId);
        lastProgressValue = progress.progress;
      }
      onProgress?.(progress);

      if (progress.status === "completed") {
        if (progress.result && progress.result.url) {
          console.debug("[Agnes SDK] Video generation completed! URL:", progress.result.url.slice(0, 100));
          return progress.result;
        }
        console.debug("[Agnes SDK] Completed status without URL; continuing to wait...");
        await delay(currentInterval);
        backoff();
        continue;
      }
      if (progress.status === "failed") throw new Error(`Video generation failed, ID: ${taskId}`);
      await delay(currentInterval);
      backoff();
    }
  }

  return { create, createFromImage, getProgress, poll };
}

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
  if (str.endsWith("%")) {
    const n = Number(str.slice(0, -1));
    return isNaN(n) ? 0 : n;
  }
  const n = Number(str);
  return isNaN(n) ? 0 : n;
}

function normalizeTaskProgress(raw: Record<string, unknown>): TaskProgress {
  const innerVideoData = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : undefined;
  const innerS = innerVideoData?.status;
  const innerEffective = (innerS && String(innerS).toLowerCase() !== "queued") ? String(innerS) : undefined;
  const statusRaw = String(raw.status ?? innerEffective ?? deepFind(raw, "state") ?? "").toLowerCase();
  let progress = parseProgress(raw.progress ?? innerVideoData?.progress ?? 0);
  if (progress === 0 && ["completed", "done", "success", "succeeded", "failed", "error", "succeed"].some((s) => statusRaw.includes(s))) progress = 100;
  if (progress === 0 && ["not_start", "pending", "queued"].some((s) => statusRaw.includes(s))) progress = 1;
  const resultUrl = String(innerVideoData?.url ?? innerVideoData?.output_url ?? raw.url ?? raw.output_url ?? raw.remixed_from_video_id ?? deepFind(raw, "url") ?? "");
  const taskId = String(raw.task_id ?? raw.taskId ?? raw.id ?? innerVideoData?.task_id ?? innerVideoData?.taskId ?? innerVideoData?.id ?? "");
  const videoId = String(raw.video_id ?? raw.videoId ?? innerVideoData?.video_id ?? innerVideoData?.videoId ?? raw.id ?? innerVideoData?.id ?? "");
  return {
    taskId,
    status: mapStatus(statusRaw),
    progress,
    videoId,
    result: resultUrl ? { url: resultUrl, duration: Number(innerVideoData?.duration ?? raw.duration ?? 0) } : undefined,
  };
}

function mapStatus(raw: string): TaskStatus {
  if (!raw) return "queued";
  const s = raw.toLowerCase().trim();
  if (["completed", "succeeded", "succeed", "done", "finished", "success", "complete"].includes(s)) return "completed";
  if (["failed", "error", "failure", "fail"].includes(s)) return "failed";
  if (["processing", "running", "in_progress", "inprogress", "active", "pending", "not_start", "not_started"].includes(s)) return "processing";
  return "queued";
}

