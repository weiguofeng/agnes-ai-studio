"use client";

import { useState, useCallback } from "react";
import { agnes, AgnesApiError } from "@/services/agnes";
import { useTaskStore } from "@/stores/taskStore";
import { useConfigStore } from "@/stores/configStore";
import type { ImageResult, ImageToImageParams } from "@/services/agnes";

export interface ExtendedImageToImageParams extends ImageToImageParams {
  seed?: number;
  steps?: number;
  guidance_scale?: number;
  negative_prompt?: string;
}

interface UseGenerateImageToImageReturn {
  generate: (params: ExtendedImageToImageParams) => Promise<void>;
  result: ImageResult[] | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useGenerateImageToImage(): UseGenerateImageToImageReturn {
  const [result, setResult] = useState<ImageResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (params: ExtendedImageToImageParams) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const images = await agnes.image.edit(params);
      setResult(images);
      if (images && images.length > 0) {
        const config = useConfigStore.getState();
        useTaskStore.getState().addTask({
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          taskId: "",
          type: "image-to-image",
          model: params.model || config.imageToImageModel || config.model,
          prompt: params.prompt,
          status: "completed",
          progress: 100,
          resultUrl: images[0].url,
          thumbnail: "",
          errorMessage: "",
          params: { strength: params.strength },
        });
      }
    } catch (err) {
      const message = err instanceof AgnesApiError ? err.message : "生成失败，请检查 API 配置后重试";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => { setResult(null); setError(null); setIsLoading(false); }, []);

  return { generate, result, isLoading, error, reset };
}
