// ============================================================
// Agnes SDK - HTTP Client
// ============================================================
// 中文说明：统一读取配置，浏览器端通过 Next.js 代理访问 Agnes，避免 TLS/CORS 问题。
// ============================================================

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { AgnesApiError, type AgnesConfig } from "./types";

const STORAGE_KEY = "agnes-api-config";

export type ConfigSource = "env" | "nextPublicEnv" | "localStorage" | "default";

export interface ConfigWithSource {
  config: AgnesConfig;
  source: ConfigSource;
}

const DEFAULT_CONFIG: AgnesConfig = {
  apiKey: "",
  baseUrl: "https://apihub.agnes-ai.com/v1",
  model: "agnes-image-2.1-flash",
  textToImageModel: "agnes-image-2.1-flash",
  imageToImageModel: "agnes-image-2.1-flash",
  textToVideoModel: "agnes-video-v2.0",
  imageToVideoModel: "agnes-video-v2.0",
};

function loadConfig(): ConfigWithSource {
  try {
    const serverKey = typeof process !== "undefined" ? process.env?.AGNES_API_KEY : undefined;
    if (serverKey) return { config: { ...DEFAULT_CONFIG, apiKey: serverKey }, source: "env" };
  } catch {}

  try {
    const publicKey = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_AGNES_API_KEY : undefined;
    if (publicKey) return { config: { ...DEFAULT_CONFIG, apiKey: publicKey }, source: "nextPublicEnv" };
  } catch {}

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
    } catch {}
  }

  return { config: { ...DEFAULT_CONFIG }, source: "default" };
}

function saveConfigToStorage(config: AgnesConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: config, version: 0 }));
  } catch {}
}

interface RawApiErrorBody {
  error?: { code?: string; message?: string };
  message?: string;
  detail?: string;
}

function formatAxiosError(err: AxiosError<RawApiErrorBody>): AgnesApiError {
  const status = err.response?.status;
  const body = err.response?.data;
  const code = body?.error?.code ?? "UNKNOWN_ERROR";
  const message = body?.error?.message ?? body?.message ?? body?.detail ?? err.message ?? "请求失败，请检查网络连接或 API 配置";
  return new AgnesApiError(code, message, status, body);
}

export function createClient() {
  const instance: AxiosInstance = axios.create();

  instance.interceptors.request.use((config) => {
    const { config: cfg } = loadConfig();
    const isBrowser = typeof window !== "undefined";
    config.baseURL = isBrowser ? "/api/agnes" : cfg.baseUrl;
    config.headers.Authorization = `Bearer ${cfg.apiKey}`;
    if (isBrowser) {
      config.headers["X-Agnes-API-Key"] = cfg.apiKey;
      config.headers["X-Agnes-Base-URL"] = cfg.baseUrl;
    }
    return config;
  });

  instance.interceptors.response.use(
    (res) => res.data,
    (err: AxiosError<RawApiErrorBody>) => Promise.reject(formatAxiosError(err))
  );

  return {
    instance,
    getConfigWithSource: (): ConfigWithSource => loadConfig(),
    getConfig: (): AgnesConfig => loadConfig().config,
    getConfigSource: (): ConfigSource => loadConfig().source,
    configure: (partial: Partial<AgnesConfig>): void => {
      const { config: current } = loadConfig();
      saveConfigToStorage({ ...current, ...partial });
    },
    get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> =>
      instance.get(url, config) as Promise<T>,
    post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
      instance.post(url, data, config) as Promise<T>,
    postForm: <T = unknown>(url: string, formData: FormData): Promise<T> =>
      instance.post(url, formData) as Promise<T>,
  };
}

export type AgnesClient = ReturnType<typeof createClient>;
