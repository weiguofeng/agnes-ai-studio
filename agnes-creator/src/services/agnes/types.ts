// ============================================================
// Agnes SDK — 类型定义
// ============================================================

/** SDK 配置（支持按功能指定模型） */
export interface AgnesConfig {
  apiKey: string;
  baseUrl: string;
  /** 默认模型（各功能未指定时使用） */
  model: string;
  /** 文生图模型 */
  textToImageModel?: string;
  /** 图生图模型 */
  imageToImageModel?: string;
  /** 文生视频模型 */
  textToVideoModel?: string;
  /** 图生视频模型 */
  imageToVideoModel?: string;
}

/** 图片尺寸 */
export type ImageSize = "256x256" | "512x512" | "1024x1024"
  | "768x1344" | "1344x768" | "1024x1792" | "1792x1024";

/** 文生图请求参数 */
export interface TextToImageParams {
  prompt: string;
  size?: ImageSize;
  model?: string;
  n?: number;
}

/** 图生图请求参数 */
export interface ImageToImageParams {
  image: File | Blob;
  prompt: string;
  strength?: number;
  model?: string;
}

/** 文生视频请求参数 */
export interface TextToVideoParams {
  prompt: string;
  model?: string;
  height?: number;
  width?: number;
  numFrames?: number;
  frameRate?: number;
  negativePrompt?: string;
  mode?: string;
  seed?: number;
  numInferenceSteps?: number;
}

/** 图生视频请求参数 */
export interface ImageToVideoParams {
    image?: File | Blob | string | string[];
    prompt?: string;
    model?: string;
    height?: number;
    width?: number;
    numFrames?: number;
    frameRate?: number;
    negativePrompt?: string;
    seed?: number;
  }

/** 图片结果 */
export interface ImageResult {
  url: string;
  revisedPrompt?: string;
}

/** 视频结果 */
export interface VideoResult {
  url: string;
  duration: number;
}

/** 任务状态 */
export type TaskStatus = "queued" | "processing" | "completed" | "failed";

/** 任务进度 */
export interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  progress: number;
  result?: VideoResult;
  videoId?: string;
}

/** API 通用响应 */
export interface ApiResponse<T> {
  data: T;
  created: number;
}

/** 创建视频任务的响应 */
export interface VideoCreateResponse {
  id?: string;
  taskId?: string;
  task_id?: string;
  videoId?: string;
  video_id?: string;
}

/** 视频任务状态响应 */
export interface VideoStatusResponse {
  status: string;
  progress?: number;
  url?: string;
  output_url?: string;
  result_url?: string;
  id?: string;
  video_id?: string;
  videoId?: string;
  taskId?: string;
  task_id?: string;
}

/** SDK 错误 */
export class AgnesApiError extends Error {
  public readonly code: string;
  public readonly status: number | undefined;
  public readonly details: unknown;

  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "AgnesApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.code === "AUTH_ERROR";
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status !== undefined && this.status >= 500;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}
