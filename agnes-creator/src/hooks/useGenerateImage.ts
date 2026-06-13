"use client";

import { useState, useCallback } from "react";
import { agnes, AgnesApiError } from "@/services/agnes";
import { useTaskStore } from "@/stores/taskStore";
import { useConfigStore } from "@/stores/configStore";
import type { TextToImageParams, ImageResult } from "@/services/agnes";

export interface ExtendedTextToImageParams extends TextToImageParams {
  seed?: number;
  steps?: number;
  guidance_scale?: number;
  negative_prompt?: string;
}

interface UseGenerateImageReturn {
  generate: (params: ExtendedTextToImageParams) => Promise<void>;
  result: ImageResult[] | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useGenerateImage(): UseGenerateImageReturn {
  const [result, setResult] = useState<ImageResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (params: ExtendedTextToImageParams) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const config = useConfigStore.getState();
      const model = params.model || config.textToImageModel || config.model;

      // Build payload with extra params
      const payload: Record<string, unknown> = {
        prompt: params.prompt,
        size: params.size ?? "1024x1024",
        n: params.n ?? 1,
        model,
      };
      if (params.seed !== undefined && params.seed >= 0) payload.seed = params.seed;
      if (params.steps !== undefined) payload.steps = params.steps;
      if (params.guidance_scale !== undefined) payload.guidance_scale = params.guidance_scale;
      if (params.negative_prompt) payload.negative_prompt = params.negative_prompt;

      const images = await agnes.image.generate(payload as unknown as TextToImageParams);
      setResult(images);
      if (images && images.length > 0) {
        useTaskStore.getState().addTask({
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          taskId: "",
          type: "text-to-image",
          model,
          prompt: params.prompt,
          status: "completed",
          progress: 100,
          resultUrl: images[0].url,
          thumbnail: "",
          errorMessage: "",
          params: { size: params.size, seed: params.seed, steps: params.steps },
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
