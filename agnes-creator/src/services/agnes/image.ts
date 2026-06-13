// ============================================================
// Agnes SDK — 图像生成服务
// ============================================================
// 根据官方文档：
//   文生图 & 图生图都使用 POST /v1/images/generations
//   图生图时在 extra_body.image 中传递图片 URL 或 Base64 Data URI
// ============================================================

import type { AgnesClient } from "./client";
import type {
  ApiResponse,
  ImageResult,
  TextToImageParams,
  ImageToImageParams,
} from "./types";

export function createImageService(client: AgnesClient) {
  // -----------------------------------------------------------
  // 文生图
  // -----------------------------------------------------------
  async function generate(
    params: TextToImageParams
  ): Promise<ImageResult[]> {
    const config = client.getConfig();
    const payload: Record<string, unknown> = {
      prompt: params.prompt,
      size: params.size ?? "1024x1024",
      n: params.n ?? 1,
      model: params.model || config.textToImageModel || config.model,
    };

    const res = await client.post<ApiResponse<Record<string, unknown>[]>>(
      "/images/generations",
      payload
    );

    return (res.data ?? []).map(normalizeImageResult);
  }

  // -----------------------------------------------------------
  // 图生图 — 使用 /images/generations + extra_body.image
  // -----------------------------------------------------------
  async function edit(params: ImageToImageParams): Promise<ImageResult[]> {
    const config = client.getConfig();
    const model = params.model || config.imageToImageModel || config.model;

    // 将 File/Blob 转换为 Base64 Data URI
    const imageDataUri = await fileToDataUri(params.image);

    const payload: Record<string, unknown> = {
      model,
      prompt: params.prompt,
      size: "1024x1024",
      n: 1,
      extra_body: {
        image: [imageDataUri],
      },
    };

    const res = await client.post<ApiResponse<Record<string, unknown>[]>>(
      "/images/generations",
      payload
    );

    return (res.data ?? []).map(normalizeImageResult);
  }

  return { generate, edit };
}

// -----------------------------------------------------------
// 内部辅助
// -----------------------------------------------------------

/** 将 File/Blob 转换为 Base64 Data URI */
function fileToDataUri(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function normalizeImageResult(raw: Record<string, unknown>): ImageResult {
  return {
    url: raw.url as string,
    revisedPrompt: (raw.revised_prompt ?? raw.revisedPrompt) as string | undefined,
  };
}
