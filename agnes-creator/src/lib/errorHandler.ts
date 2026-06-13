/**
 * Error Handler — 统一错误处理系统
 * V2.4: API 错误分类 + 重试策略 + 用户提示
 */
import { logger } from "./logger";

// ========== Error Types ==========

export type ErrorCategory =
  | "rate_limit"       // 429
  | "server_error"     // 500
  | "timeout"          // 请求超时
  | "network"          // 网络错误
  | "task_lost"        // 任务在服务端丢失
  | "polling_failure"  // 轮询失败
  | "invalid_input"    // 无效输入
  | "unknown";         // 其他

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  retryDelayMs: number;
  originalError: unknown;
}

// ========== Error Classification ==========

export function classifyError(err: unknown): ClassifiedError {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();

  // 429 Rate Limit
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) {
    return { category: "rate_limit", message: "请求频率过高，请稍后重试", retryable: true, retryDelayMs: 3000, originalError: err };
  }

  // 500 Server Error
  if (msg.includes("500") || msg.includes("server error") || msg.includes("internal server")) {
    return { category: "server_error", message: "服务端错误，正在重试", retryable: true, retryDelayMs: 2000, originalError: err };
  }

  // Timeout
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("abort")) {
    return { category: "timeout", message: "请求超时，正在重试", retryable: true, retryDelayMs: 1000, originalError: err };
  }

  // Network Error
  if (msg.includes("network") || msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("fetch failed")) {
    return { category: "network", message: "网络连接异常，请检查网络", retryable: true, retryDelayMs: 3000, originalError: err };
  }

  // Task Lost
  if (msg.includes("task not found") || msg.includes("task lost") || msg.includes("no task")) {
    return { category: "task_lost", message: "任务已丢失，请重新提交", retryable: true, retryDelayMs: 500, originalError: err };
  }

  // Polling Failure
  if (msg.includes("poll") || msg.includes("status check")) {
    return { category: "polling_failure", message: "状态查询失败，正在重试", retryable: true, retryDelayMs: 2000, originalError: err };
  }

  // Default: unknown error — still retryable once
  return { category: "unknown", message: msg.slice(0, 120), retryable: true, retryDelayMs: 1000, originalError: err };
}

// ========== Retry Manager ==========

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  module = "unknown",
): Promise<{ data?: T; error?: ClassifiedError; attempts: number }> {
  const cfg = { ...DEFAULT_RETRY, ...config };
  let lastError: ClassifiedError | undefined;
  let attempts = 0;

  for (let i = 0; i <= cfg.maxRetries; i++) {
    attempts++;
    try {
      const data = await fn();
      if (i > 0) logger.info(module, `重试成功 (第${i}次)`);
      return { data, attempts };
    } catch (err) {
      lastError = classifyError(err);
      logger.warn(module, `调用失败 (${i + 1}/${cfg.maxRetries + 1}): ${lastError.message}`, {
        category: lastError.category,
        retryable: lastError.retryable,
      });

      if (!lastError.retryable || i >= cfg.maxRetries) {
        logger.error(module, `最终失败: ${lastError.message}`);
        return { error: lastError, attempts };
      }

      // Exponential backoff
      const delay = Math.min(cfg.baseDelayMs * Math.pow(cfg.backoffFactor, i), cfg.maxDelayMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { error: lastError, attempts };
}

// ========== 429 Detection Helper ==========

export function isRateLimitError(err: unknown): boolean {
  return classifyError(err).category === "rate_limit";
}

export function getRetryAfterMs(err: unknown): number {
  if (err instanceof Response && err.headers?.get) {
    const retryAfter = err.headers.get("retry-after");
    if (retryAfter) return parseInt(retryAfter, 10) * 1000 || 5000;
  }
  return 3000;
}
