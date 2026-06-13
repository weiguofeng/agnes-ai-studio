"use client";

import { useConfigStore } from "@/stores/configStore";

export function useConfig() {
  const apiKey = useConfigStore((s) => s.apiKey);
  const baseUrl = useConfigStore((s) => s.baseUrl);
  const model = useConfigStore((s) => s.model);
  const textToImageModel = useConfigStore((s) => s.textToImageModel);
  const imageToImageModel = useConfigStore((s) => s.imageToImageModel);
  const textToVideoModel = useConfigStore((s) => s.textToVideoModel);
  const imageToVideoModel = useConfigStore((s) => s.imageToVideoModel);
  const configSource = useConfigStore((s) => s.configSource);

  const setApiKey = useConfigStore((s) => s.setApiKey);
  const setBaseUrl = useConfigStore((s) => s.setBaseUrl);
  const setModel = useConfigStore((s) => s.setModel);
  const setTextToImageModel = useConfigStore((s) => s.setTextToImageModel);
  const setImageToImageModel = useConfigStore((s) => s.setImageToImageModel);
  const setTextToVideoModel = useConfigStore((s) => s.setTextToVideoModel);
  const setImageToVideoModel = useConfigStore((s) => s.setImageToVideoModel);

  const reset = useConfigStore((s) => s.reset);

  const isConfigured = !!apiKey && !!baseUrl;

  return {
    apiKey, baseUrl, model,
    textToImageModel, imageToImageModel, textToVideoModel, imageToVideoModel,
    setApiKey, setBaseUrl, setModel,
    setTextToImageModel, setImageToImageModel, setTextToVideoModel, setImageToVideoModel,
    reset, isConfigured,
    /** 当前配置来源环境 */
    configSource,
  };
}
