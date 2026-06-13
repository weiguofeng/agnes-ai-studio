// ============================================================
// Agnes SDK — 统一入口
// ============================================================
// 用法：
//   import { agnes } from "@/services/agnes";
//
//   // 文生图
//   const images = await agnes.image.generate({ prompt: "..." });
//
//   // 图生图
//   const images = await agnes.image.edit({ image: file, prompt: "...", strength: 0.7 });
//
//   // 文生视频（异步提交 + 轮询）
//   const video = await agnes.video.createAndWait({ prompt: "...", duration: 5 });
//
//   // 图生视频
//   const video = await agnes.video.createFromImageAndWait({ image: file });
//
//   // 动态更新配置
//   agnes.configure({ apiKey: "sk-xxx", model: "agnes-xl-v2" });
// ============================================================

import { createClient } from "./client";
import { createImageService } from "./image";
import { createVideoService } from "./video";

export { AgnesApiError } from "./types";
export type { ConfigSource, ConfigWithSource } from "./client";
export type {
  AgnesConfig,
  ImageSize,
  TextToImageParams,
  ImageToImageParams,
  TextToVideoParams,
  ImageToVideoParams,
  ImageResult,
  VideoResult,
  TaskProgress,
  TaskStatus,
} from "./types";

/**
 * Agnes SDK 单例。
 *
 * - 优先级读取配置：环境变量 → localStorage → 默认值
 * - 自动在每次请求时注入 Authorization header
 * - 统一错误处理，抛出 AgnesApiError
 * - 支持动态 configure() 更新配置
 */
export const agnes = (() => {
  const client = createClient();
  const image = createImageService(client);
  const video = createVideoService(client);

  return {
    /** 图像生成服务 */
    image,
    /** 视频生成服务 */
    video,
    /** 获取当前配置（含来源信息） */
    getConfigWithSource: client.getConfigWithSource,
    /** 获取当前配置 */
    getConfig: client.getConfig,
    /** 获取配置来源描述 */
    getConfigSource: client.getConfigSource,
    /** 动态更新配置 */
    configure: client.configure,
  };
})();
