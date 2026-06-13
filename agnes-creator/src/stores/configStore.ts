import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgnesConfig, ConfigSource } from "@/services/agnes";

export interface ConfigState extends AgnesConfig {
  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  setTextToImageModel: (model: string) => void;
  setImageToImageModel: (model: string) => void;
  setTextToVideoModel: (model: string) => void;
  setImageToVideoModel: (model: string) => void;
  reset: () => void;
  isConfigured: boolean;
  /** 当前配置来源 */
  configSource: ConfigSource;
}

const CORRECT_BASE_URL = "https://apihub.agnes-ai.com/v1";

const DEFAULTS: AgnesConfig & { isConfigured: boolean; configSource: ConfigSource } = {
  apiKey: "",
  baseUrl: CORRECT_BASE_URL,
  model: "agnes-image-2.1-flash",
  textToImageModel: "agnes-image-2.1-flash",
  imageToImageModel: "agnes-image-2.1-flash",
  textToVideoModel: "agnes-video-v2.0",
  imageToVideoModel: "agnes-video-v2.0",
  isConfigured: false,
  configSource: "default",
};

// 自动修正常见错误的 Base URL
function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.includes("api.agnesai.com")) {
    console.warn("[ConfigStore] 检测到错误的域名 api.agnesai.com，自动修正为 apihub.agnes-ai.com");
    return trimmed.replace("api.agnesai.com", "apihub.agnes-ai.com");
  }
  return trimmed;
}

// 检测环境变量配置
function detectEnvConfig(): { apiKey: string; source: ConfigSource } {
  // 服务端环境变量
  if (typeof process !== "undefined") {
    const serverKey = process.env?.AGNES_API_KEY;
    if (serverKey) return { apiKey: serverKey, source: "env" };

    const publicKey = process.env?.NEXT_PUBLIC_AGNES_API_KEY;
    if (publicKey) return { apiKey: publicKey, source: "nextPublicEnv" };
  }
  return { apiKey: "", source: "default" };
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => {
      // 初始检测环境变量
      const { apiKey: envKey, source: envSource } = detectEnvConfig();
      const isConfiguredFromEnv = !!envKey;

      return {
        ...DEFAULTS,
        apiKey: envKey || DEFAULTS.apiKey,
        configSource: envSource,
        isConfigured: isConfiguredFromEnv || false,

        setApiKey: (apiKey) => set({
          apiKey,
          configSource: "localStorage",
          isConfigured: !!apiKey && !!get().baseUrl,
        }),

        setBaseUrl: (baseUrl) => set({
          baseUrl: normalizeBaseUrl(baseUrl),
          isConfigured: !!get().apiKey && !!baseUrl,
        }),

        setModel: (model) => set({ model }),
        setTextToImageModel: (textToImageModel) => set({ textToImageModel }),
        setImageToImageModel: (imageToImageModel) => set({ imageToImageModel }),
        setTextToVideoModel: (textToVideoModel) => set({ textToVideoModel }),
        setImageToVideoModel: (imageToVideoModel) => set({ imageToVideoModel }),

        reset: () => set({ ...DEFAULTS, ...detectEnvConfig() }),
      };
    },
    {
      name: "agnes-api-config",
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (state?.baseUrl && typeof state.baseUrl === "string") {
          state.baseUrl = normalizeBaseUrl(state.baseUrl as string);
        }
        // 合并环境变量
        const { apiKey: envKey, source: envSource } = detectEnvConfig();
        return {
          ...DEFAULTS,
          ...state,
          apiKey: envKey || ((state as any)?.apiKey ?? DEFAULTS.apiKey),
          configSource: envSource || "localStorage",
          isConfigured: !!(envKey || (state as any)?.apiKey),
        } as ConfigState;
      },
      version: 2,
    }
  )
);
