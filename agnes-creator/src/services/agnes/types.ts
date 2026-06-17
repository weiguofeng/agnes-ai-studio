// ============================================================
// Agnes SDK 鈥?绫诲瀷瀹氫箟
// ============================================================

/** SDK 閰嶇疆锛堟敮鎸佹寜鍔熻兘鎸囧畾妯″瀷锛?*/
export interface AgnesConfig {
  apiKey: string;
  baseUrl: string;
  /** 榛樿妯″瀷锛堝悇鍔熻兘鏈寚瀹氭椂浣跨敤锛?*/
  model: string;
  /** 鏂囩敓鍥炬ā鍨?*/
  textToImageModel?: string;
  /** 鍥剧敓鍥炬ā鍨?*/
  imageToImageModel?: string;
  /** 鏂囩敓瑙嗛妯″瀷 */
  textToVideoModel?: string;
  /** 鍥剧敓瑙嗛妯″瀷 */
  imageToVideoModel?: string;
}

/** 鍥剧墖灏哄 */
export type ImageSize = "256x256" | "512x512" | "1024x1024"
  | "768x1344" | "1344x768" | "1024x1792" | "1792x1024";

/** 鏂囩敓鍥捐姹傚弬鏁?*/
export interface TextToImageParams {
  prompt: string;
  size?: ImageSize;
  model?: string;
  n?: number;
}

/** 鍥剧敓鍥捐姹傚弬鏁?*/
export interface ImageToImageParams {
  image: File | Blob;
  prompt: string;
  size?: ImageSize;
  strength?: number;
  model?: string;
}

/** 鏂囩敓瑙嗛璇锋眰鍙傛暟 */
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

/** 鍥剧敓瑙嗛璇锋眰鍙傛暟 */
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

/** 鍥剧墖缁撴灉 */
export interface ImageResult {
  url: string;
  revisedPrompt?: string;
}

/** 瑙嗛缁撴灉 */
export interface VideoResult {
  url: string;
  duration: number;
}

/** 浠诲姟鐘舵€?*/
export type TaskStatus = "queued" | "processing" | "completed" | "failed";

/** 浠诲姟杩涘害 */
export interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  progress: number;
  result?: VideoResult;
  videoId?: string;
}

/** API 閫氱敤鍝嶅簲 */
export interface ApiResponse<T> {
  data: T;
  created: number;
}

/** 鍒涘缓瑙嗛浠诲姟鐨勫搷搴?*/
export interface VideoCreateResponse {
  id?: string;
  taskId?: string;
  task_id?: string;
  videoId?: string;
  video_id?: string;
}

/** 瑙嗛浠诲姟鐘舵€佸搷搴?*/
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

/** SDK 閿欒 */
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
