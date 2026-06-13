// ============================================================
// Real Agnes API Client for Integration Tests
// ============================================================
// 真实调用 Agnes API，无任何 Mock
// ============================================================

const BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1';
const API_KEY = process.env.AGNES_API_KEY || process.env.NEXT_PUBLIC_AGNES_API_KEY || '';

export function getApiConfig() {
  if (!API_KEY) {
    throw new Error('AGNES_API_KEY not found');
  }
  return { baseUrl: BASE_URL, apiKey: API_KEY };
}

export interface VideoTaskResult {
  taskId: string;
  videoId: string;
  status: string;
  progress: number;
  videoUrl?: string;
}

export async function createVideoTask(params: {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  numFrames?: number;
  frameRate?: number;
  imageBase64?: string;
}): Promise<VideoTaskResult> {
  const { baseUrl, apiKey } = getApiConfig();

  const payload: Record<string, unknown> = {
    model: params.model || 'agnes-video-v2.0',
    prompt: params.prompt,
    height: params.height ?? 768,
    width: params.width ?? 1152,
    num_frames: params.numFrames ?? 49,
    frame_rate: params.frameRate ?? 24,
  };

  if (params.imageBase64) {
    payload.image = params.imageBase64;
  }

  const response = await fetch(`${baseUrl}/videos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Agnes API error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const taskId = String(data.task_id || data.taskId || data.id || '');
  const videoId = String(data.video_id || data.videoId || '');

  if (!taskId) {
    throw new Error(`No task_id in response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return { taskId, videoId, status: String(data.status || 'queued'), progress: Number(data.progress || 0) };
}

export async function pollVideoTask(
  taskId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<VideoTaskResult> {
  const { baseUrl, apiKey } = getApiConfig();
  const timeoutMs = options.timeoutMs ?? 300_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const startTime = Date.now();

  let lastStatus = '';

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(`${baseUrl}/videos/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Polling failed (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const status = String(data.status || 'queued');
    const progress = Number(data.progress || 0);
    const videoUrl = String(data.remixed_from_video_id || data.url || '');

    if (status !== lastStatus) {
      console.log(`  [poll] task=${taskId.slice(0, 20)}... status=${status} progress=${progress} elapsed=${((Date.now() - startTime) / 1000).toFixed(0)}s`);
      lastStatus = status;
    }

    if (status === 'completed') {
      return { taskId, videoId: String(data.video_id || ''), status, progress: 100, videoUrl: videoUrl || undefined };
    }

    if (status === 'failed') {
      const error = String((data as any).error || 'unknown error');
      throw new Error(`Video generation failed: ${error}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Video generation timed out after ${timeoutMs / 1000}s`);
}

export function createMinimalTestImage(): string {
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
}