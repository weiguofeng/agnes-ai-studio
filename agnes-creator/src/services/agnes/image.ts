// ============================================================
// Agnes SDK 鈥?鍥惧儚鐢熸垚鏈嶅姟
// ============================================================
// 鏍规嵁瀹樻柟鏂囨。锛?//   鏂囩敓鍥?& 鍥剧敓鍥鹃兘浣跨敤 POST /v1/images/generations
//   鍥剧敓鍥炬椂鍦?extra_body.image 涓紶閫掑浘鐗?URL 鎴?Base64 Data URI
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
  // 鏂囩敓鍥?  // -----------------------------------------------------------
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
  // 鍥剧敓鍥?鈥?浣跨敤 /images/generations + extra_body.image
  // -----------------------------------------------------------
  async function edit(params: ImageToImageParams): Promise<ImageResult[]> {
    const config = client.getConfig();
    const model = params.model || config.imageToImageModel || config.model;

    // 灏?File/Blob 杞崲涓?Base64 Data URI
    const imageDataUri = await fileToDataUri(params.image);

    const payload: Record<string, unknown> = {
      model,
      prompt: params.prompt,
      size: params.size ?? "1792x1024",
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
// 鍐呴儴杈呭姪
// -----------------------------------------------------------

/** 灏?File/Blob 杞崲涓?Base64 Data URI */
function fileToDataUri(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("璇诲彇鏂囦欢澶辫触"));
    reader.readAsDataURL(file);
  });
}

function normalizeImageResult(raw: Record<string, unknown>): ImageResult {
  return {
    url: raw.url as string,
    revisedPrompt: (raw.revised_prompt ?? raw.revisedPrompt) as string | undefined,
  };
}
