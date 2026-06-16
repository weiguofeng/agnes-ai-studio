// ============================================================
// Agnes SDK — HTTP Client
// ============================================================
// 功能：
//   1. 按优先级读取配置：环境变量 → localStorage → 默认值
//   2. 基于 Axios 自动附加 Authorization header
//   3. 统一错误处理为 AgnesApiError
//   4. 支持 configure() 动态更新配置
//   5. 提供 getConfigSource() 查询配置来源
// ============================================================

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { AgnesApiError, type AgnesConfig } from "./types";

// -----------------------------------------------------------
// 配置管理
// -----------------------------------------------------------

const STORAGE_KEY = "agnes-api-config";

/** 配置来源枚举 */
export type ConfigSource = "env" | "nextPublicEnv" | "localStorage" | "default";

export interface ConfigWithSource {
  config: AgnesConfig;
  source: ConfigSource;
}

/** 默认配置 */
const DEFAULT_CONFIG: AgnesConfig = {
  apiKey: "",
  baseUrl: "https://apihub.agnes-ai.com/v1",
  model: "agnes-image-2.1-flash",
  textToImageModel: "agnes-image-2.1-flash",
  imageToImageModel: "agnes-image-2.1-flash",
  textToVideoModel: "agnes-video-v2.0",
  imageToVideoModel: "agnes-video-v2.0",
};

/**
 * 统一配置加载函数。
 * 优先级：
 *   1. process.env.AGNES_API_KEY（服务端环境变量）
 *   2. process.env.NEXT_PUBLIC_AGNES_API_KEY（客户端环境变量）
 *   3. localStorage（用户通过 Settings 页面输入）
 *   4. 默认空配置
 */
function loadConfig(): ConfigWithSource {
  // 尝试服务端环境变量（仅在 Node.js 环境可用）
  try {
    const serverKey = typeof process !== "undefined" ? process.env?.AGNES_API_KEY : undefined;
    if (serverKey) {
      return {
        config: { ...DEFAULT_CONFIG, apiKey: serverKey },
        source: "env",
      };
    }
  } catch { /* SSR 或无 process 环境 */ }

  // 尝试客户端环境变量 (NEXT_PUBLIC_*)
  try {
    const publicKey = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_AGNES_API_KEY : undefined;
    if (publicKey) {
      return {
        config: { ...DEFAULT_CONFIG, apiKey: publicKey },
        source: "nextPublicEnv",
      };
    }
  } catch { /* 无 process 环境 */ }

  // 尝试 localStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const state = parsed.state ?? parsed;
        if (state.apiKey) {
          return {
            config: {
              apiKey: state.apiKey ?? DEFAULT_CONFIG.apiKey,
              baseUrl: state.baseUrl ?? DEFAULT_CONFIG.baseUrl,
              model: state.model ?? DEFAULT_CONFIG.model,
              textToImageModel: state.textToImageModel ?? DEFAULT_CONFIG.textToImageModel,
              imageToImageModel: state.imageToImageModel ?? DEFAULT_CONFIG.imageToImageModel,
              textToVideoModel: state.textToVideoModel ?? DEFAULT_CONFIG.textToVideoModel,
              imageToVideoModel: state.imageToVideoModel ?? DEFAULT_CONFIG.imageToVideoModel,
            },
            source: "localStorage",
          };
        }
      }
    } catch { /* localStorage 不可用 */ }
  }

  return { config: { ...DEFAULT_CONFIG }, source: "default" };
}

/** 将配置写入 localStorage */
function saveConfigToStorage(config: AgnesConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: config, version: 0 }));
  } catch {
    // localStorage 不可用时静默忽略
  }
}

// -----------------------------------------------------------
// 错误处理
// -----------------------------------------------------------

interface RawApiErrorBody {
  error?: { code?: string; message?: string };
}

/** 将 Axios 错误转换为 AgnesApiError */
function formatAxiosError(err: AxiosError<RawApiErrorBody>): AgnesApiError {
  const status = err.response?.status;
  const body = err.response?.data;
  const code = body?.error?.code ?? "UNKNOWN_ERROR";
  const message =
    body?.error?.message ??
    err.message ??
    "请求失败，请检查网络连接或 API 配置";
  return new AgnesApiError(code, message, status, body);
}

// -----------------------------------------------------------
// HTTP 客户端工厂
// -----------------------------------------------------------

export function createClient() {
  const instance: AxiosInstance = axios.create();

  instance.interceptors.request.use((config) => {
    const { config: cfg } = loadConfig();
    config.baseURL = cfg.baseUrl;
    config.headers.Authorization = `Bearer ${cfg.apiKey}`;
    return config;
  });

  instance.interceptors.response.use(
    (res) => res.data,
    (err: AxiosError<RawApiErrorBody>) => Promise.reject(formatAxiosError(err))
  );

  return {
    instance,
    /** 获取当前配置（含来源信息） */
    getConfigWithSource: (): ConfigWithSource => loadConfig(),
    /** 获取当前配置（仅配置对象，向后兼容） */
    getConfig: (): AgnesConfig => loadConfig().config,
    /** 获取配置来源描述 */
    getConfigSource: (): ConfigSource => loadConfig().source,
    /** 动态更新配置（写入 localStorage） */
    configure: (partial: Partial<AgnesConfig>): void => {
      const { config: current } = loadConfig();
      const next: AgnesConfig = { ...current, ...partial };
      saveConfigToStorage(next);
    },
    get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> =>
      instance.get(url, config) as Promise<T>,
    post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
      instance.post(url, data, config) as Promise<T>,
    postForm: <T = unknown>(url: string, formData: FormData): Promise<T> =>
      instance.post(url, formData, {
        // NOTE: Do NOT set Content-Type manually - let axios set it with the boundary
      }) as Promise<T>,
  };
}

export type AgnesClient = ReturnType<typeof createClient>;
