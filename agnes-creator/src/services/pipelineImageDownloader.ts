// ============================================================
// Pipeline Image Downloader
// ============================================================
// 专用服务：从 imageResultUrl 获取图片用于图生视频
// 职责：
//   1. 诊断 - 记录完整 URL、域名、长度、过期判断
//   2. 下载 - 优先服务端代理（绕过 CORS），降级前端 fetch
//   3. 分类 - 区分网络错误/CORS/HTTP状态/Signed URL过期
//   4. 重试 - 指数退避（10s / 30s / 60s）
// 核心原则：禁止任何形式的文生视频降级
// ============================================================

import { logger } from "@/lib/logger";
import type { ProductionStatus } from "@/types";

// ============================================================
// 类型定义
// ============================================================

export type ImageFetchErrorType =
  | "SUCCESS"
  | "HTTP_403"
  | "HTTP_404"
  | "HTTP_429"
  | "HTTP_5XX"
  | "TIMEOUT"
  | "CORS_BLOCKED"
  | "NETWORK_ERROR"
  | "INVALID_URL"
  | "EMPTY_RESPONSE"
  | "UNKNOWN";

export interface ImageFetchDiagnostics {
  urlLength: number;
  urlDomain: string;
  urlProtocol: string;
  urlHasQuery: boolean;
  urlPathExtension: string;
  urlHasExpiryParams: boolean;
  urlExpiryTimestamp?: number;
  callTime: number;
}

export interface ImageFetchResult {
  success: boolean;
  errorType: ImageFetchErrorType;
  errorMessage: string;
  diagnostics: ImageFetchDiagnostics;
  dataUrl?: string;
  mimeType?: string;
  fileSize?: number;
}

// ============================================================
// 重试配置
// ============================================================

const RETRY_DELAYS = [10_000, 30_000, 60_000];
const MAX_RETRIES = 3;

// ============================================================
// URL 诊断
// ============================================================

function diagnoseUrl(url: string): ImageFetchDiagnostics {
  const now = Date.now();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      urlLength: url.length,
      urlDomain: "invalid",
      urlProtocol: "invalid",
      urlHasQuery: false,
      urlPathExtension: "",
      urlHasExpiryParams: false,
      callTime: now,
    };
  }

  const pathParts = parsedUrl.pathname.split(".");
  const ext = pathParts.length > 1 ? pathParts.pop()!.toLowerCase() : "";

  const queryParams = parsedUrl.searchParams;
  const hasExpiryParams =
    queryParams.has("Expires") ||
    queryParams.has("expires") ||
    queryParams.has("X-Amz-Expires") ||
    queryParams.has("Signature") ||
    queryParams.has("AWSAccessKeyId") ||
    queryParams.has("Policy") ||
    queryParams.has("Key-Pair-Id") ||
    queryParams.has("e") ||
    queryParams.has("OSSAccessKeyId");

  let expiryTimestamp: number | undefined;
  const expiresParam = queryParams.get("Expires") || queryParams.get("expires");
  if (expiresParam) {
    const ts = parseInt(expiresParam, 10);
    if (!isNaN(ts)) {
      expiryTimestamp = ts * 1000;
    }
  }
  const ossExpires = queryParams.get("x-oss-expires");
  if (ossExpires) {
    const ts = parseInt(ossExpires, 10);
    if (!isNaN(ts)) {
      expiryTimestamp = now + ts * 1000;
    }
  }

  return {
    urlLength: url.length,
    urlDomain: parsedUrl.hostname,
    urlProtocol: parsedUrl.protocol,
    urlHasQuery: !!parsedUrl.search,
    urlPathExtension: ext,
    urlHasExpiryParams: hasExpiryParams,
    urlExpiryTimestamp: expiryTimestamp,
    callTime: now,
  };
}

// ============================================================
// 诊断日志
// ============================================================

function logDiagnostics(shotId: string | undefined, diag: ImageFetchDiagnostics): void {
  const tag = shotId ? "shot=" + shotId.slice(-8) : "pipeline";
  const lines: string[] = [
    "[ImageDownloader:" + tag + "] ===== URL 诊断开始 =====",
    "  URL 长度: " + diag.urlLength + " 字符",
    "  域名: " + diag.urlDomain,
    "  协议: " + diag.urlProtocol,
    "  含 Query 参数: " + diag.urlHasQuery,
    "  路径扩展名: " + (diag.urlPathExtension || "无"),
    "  含过期参数: " + diag.urlHasExpiryParams,
    "  调用时间: " + new Date(diag.callTime).toISOString(),
  ];

  if (diag.urlExpiryTimestamp) {
    const expiryDate = new Date(diag.urlExpiryTimestamp);
    lines.push("  URL 过期时间: " + expiryDate.toISOString());
    const isExpired = diag.callTime > diag.urlExpiryTimestamp;
    lines.push("  是否已过期: " + (isExpired ? "是 (已过期)" : "否 (有效期内)"));
    lines.push("  距离过期: " + ((diag.urlExpiryTimestamp - diag.callTime) / 1000 / 60).toFixed(1) + " 分钟");
  }

  lines.push("  [ImageDownloader:" + tag + "] ===== URL 诊断结束 =====");
  logger.info("ImageDownloader", lines.join("\n"));
}

// ============================================================
// 服务器代理下载
// ============================================================

async function downloadViaServerProxy(
  url: string,
  shotId?: string
): Promise<ImageFetchResult> {
  const diag = diagnoseUrl(url);
  logDiagnostics(shotId, diag);

  if (diag.urlExpiryTimestamp && diag.callTime > diag.urlExpiryTimestamp) {
    return {
      success: false,
      errorType: "HTTP_403",
      errorMessage: "图片 URL 已过期 (过期时间: " + new Date(diag.urlExpiryTimestamp).toISOString() + ", 调用时间: " + new Date(diag.callTime).toISOString() + ")",
      diagnostics: diag,
    };
  }

  try {
    const response = await fetch("/api/pipeline/download-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, shotId }),
    });

    const result = await response.json() as {
      success: boolean;
      data?: string;
      mimeType?: string;
      error?: string;
      statusCode?: number;
      urlLength?: number;
      urlDomain?: string;
      contentLength?: number;
      headers?: Record<string, string>;
    };

    if (!result.success) {
      const statusCode = result.statusCode || 0;
      let errorType: ImageFetchErrorType;

      if (statusCode === 403) errorType = "HTTP_403";
      else if (statusCode === 404) errorType = "HTTP_404";
      else if (statusCode === 429) errorType = "HTTP_429";
      else if (statusCode >= 500) errorType = "HTTP_5XX";
      else if (statusCode === 408) errorType = "TIMEOUT";
      else errorType = "UNKNOWN";

      return {
        success: false,
        errorType,
        errorMessage: result.error || "HTTP " + statusCode,
        diagnostics: diag,
      };
    }

    const byteSize = result.data
      ? Math.round((result.data.length * 3) / 4)
      : 0;

    return {
      success: true,
      errorType: "SUCCESS",
      errorMessage: "",
      diagnostics: diag,
      dataUrl: result.data,
      mimeType: result.mimeType,
      fileSize: byteSize,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isCorsError =
      errorMessage.toLowerCase().includes("cors") ||
      errorMessage.toLowerCase().includes("cross-origin") ||
      errorMessage.toLowerCase().includes("load failed");

    return {
      success: false,
      errorType: isCorsError ? "CORS_BLOCKED" : "NETWORK_ERROR",
      errorMessage: isCorsError
        ? "服务端代理请求被 CORS 拦截"
        : "网络错误: " + errorMessage.slice(0, 200),
      diagnostics: diag,
    };
  }
}

// ============================================================
// 前端 Fetch 降级
// ============================================================

async function downloadViaBrowserFetch(
  url: string,
  shotId?: string
): Promise<ImageFetchResult> {
  const diag = diagnoseUrl(url);
  const tag = shotId ? "shot=" + shotId.slice(-8) : "pipeline";

  logger.info("ImageDownloader", "[ImageDownloader:" + tag + "] 尝试浏览器端 fetch 下载");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      mode: "cors",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      let errorType: ImageFetchErrorType;
      if (response.status === 403) errorType = "HTTP_403";
      else if (response.status === 404) errorType = "HTTP_404";
      else if (response.status === 429) errorType = "HTTP_429";
      else if (response.status >= 500) errorType = "HTTP_5XX";
      else errorType = "UNKNOWN";

      return {
        success: false,
        errorType,
        errorMessage: "HTTP " + response.status + " " + response.statusText,
        diagnostics: diag,
      };
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const blob = await response.blob();

    if (blob.size === 0) {
      return {
        success: false,
        errorType: "EMPTY_RESPONSE",
        errorMessage: "图片内容为空 (0 bytes)",
        diagnostics: diag,
      };
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader 读取失败"));
      reader.readAsDataURL(blob);
    });

    return {
      success: true,
      errorType: "SUCCESS",
      errorMessage: "",
      diagnostics: diag,
      dataUrl,
      mimeType: contentType,
      fileSize: blob.size,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMessage.toLowerCase().includes("abort");
    const isCors = errorMessage.toLowerCase().includes("cors") ||
                   errorMessage.toLowerCase().includes("load failed");

    return {
      success: false,
      errorType: isTimeout ? "TIMEOUT" : isCors ? "CORS_BLOCKED" : "NETWORK_ERROR",
      errorMessage: isTimeout
        ? "图片下载超时"
        : isCors
          ? "浏览器 CORS 限制：禁止前端 fetch 下载"
          : "下载失败: " + errorMessage.slice(0, 200),
      diagnostics: diag,
    };
  }
}

// ============================================================
// 主下载函数（含重试）
// ============================================================

export interface DownloadWithRetryOptions {
  shotId?: string;
  maxRetries?: number;
}

export async function downloadImageWithRetry(
  imageUrl: string,
  options: DownloadWithRetryOptions = {}
): Promise<ImageFetchResult> {
  const { shotId, maxRetries = MAX_RETRIES } = options;
  const tag = shotId ? "shot=" + shotId.slice(-8) : "pipeline";

  logger.info("ImageDownloader", "[ImageDownloader:" + tag + "] 开始下载图片, URL=" + imageUrl.length + " chars");

  let lastResult: ImageFetchResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
      logger.info("ImageDownloader", "[ImageDownloader:" + tag + "] 重试 #" + attempt + "/" + maxRetries + ", 等待 " + (delayMs / 1000) + "s");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const serverResult = await downloadViaServerProxy(imageUrl, shotId);
    if (serverResult.success) {
      logger.info("ImageDownloader",
        "[ImageDownloader:" + tag + "] 服务端代理下载成功, " +
        "大小=" + (serverResult.fileSize ? (serverResult.fileSize / 1024).toFixed(1) + " KB" : "?") + ", " +
        "type=" + serverResult.mimeType
      );
      return serverResult;
    }

    lastResult = serverResult;

    const nonRetryableTypes: ImageFetchErrorType[] = ["HTTP_403", "HTTP_404", "INVALID_URL", "CORS_BLOCKED"];
    if (nonRetryableTypes.includes(serverResult.errorType)) {
      logger.warn("ImageDownloader",
        "[ImageDownloader:" + tag + "] 不可重试错误 type=" + serverResult.errorType + ", " +
        "msg=" + serverResult.errorMessage
      );
      return serverResult;
    }

    if (attempt < maxRetries) {
      logger.info("ImageDownloader", "[ImageDownloader:" + tag + "] 服务端代理失败, 尝试浏览器端 fetch 作为备选");
      const browserResult = await downloadViaBrowserFetch(imageUrl, shotId);
      if (browserResult.success) {
        return browserResult;
      }
      lastResult = browserResult;
    }
  }

  return lastResult!;
}

// ============================================================
// 辅助函数
// ============================================================

export function getImageFetchErrorLabel(errorType: ImageFetchErrorType): string {
  const labels: Record<ImageFetchErrorType, string> = {
    SUCCESS: "成功",
    HTTP_403: "图片已过期或无权访问",
    HTTP_404: "图片不存在",
    HTTP_429: "请求频率过高",
    HTTP_5XX: "图片服务器错误",
    TIMEOUT: "图片下载超时",
    CORS_BLOCKED: "CORS 跨域限制",
    NETWORK_ERROR: "网络错误",
    INVALID_URL: "无效的图片地址",
    EMPTY_RESPONSE: "图片内容为空",
    UNKNOWN: "未知错误",
  };
  return labels[errorType] || errorType;
}

export function mapErrorToProductionStatus(errorType: ImageFetchErrorType): ProductionStatus {
  switch (errorType) {
    case "HTTP_403":
    case "HTTP_404":
      return "image_expired";
    case "HTTP_429":
      return "image_rate_limited";
    case "CORS_BLOCKED":
      return "image_cors_blocked";
    case "TIMEOUT":
      return "image_fetch_failed";
    case "HTTP_5XX":
    case "NETWORK_ERROR":
    case "EMPTY_RESPONSE":
    case "INVALID_URL":
    case "UNKNOWN":
    default:
      return "image_fetch_failed";
  }
}