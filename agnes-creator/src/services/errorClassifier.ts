// ============================================================
// ErrorClassifier — 统一错误分类系统
// ============================================================

export enum AgnesErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  RATE_LIMIT = "RATE_LIMIT",
  SERVER_BUSY = "SERVER_BUSY",
  INVALID_IMAGE = "INVALID_IMAGE",
  INVALID_PROMPT = "INVALID_PROMPT",
  CONTENT_REJECTED = "CONTENT_REJECTED",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

export interface ClassifiedError {
  type: AgnesErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
}

const RETRYABLE_TYPES = new Set([
  AgnesErrorType.NETWORK_ERROR,
  AgnesErrorType.TIMEOUT,
  AgnesErrorType.SERVER_BUSY,
  AgnesErrorType.RATE_LIMIT,
]);

const RETRY_DELAYS = [3000, 8000, 15000]; // 第一次3s，第二次8s，第三次15s
export const MAX_RETRIES = 3;

export class ErrorClassifier {
  /**
   * 对错误进行分类
   */
  static classify(err: unknown): ClassifiedError {
    const msg = err instanceof Error ? err.message : String(err || "未知错误");
    const lower = msg.toLowerCase();

    // 网络错误
    if (
      lower.includes("network") ||
      lower.includes("econnrefused") ||
      lower.includes("enotfound") ||
      lower.includes("enetunreach") ||
      lower.includes("err_connection") ||
      lower.includes("failed to fetch") ||
      lower.includes("load failed")
    ) {
      return { type: AgnesErrorType.NETWORK_ERROR, message: msg, userMessage: "网络异常，请检查网络连接", retryable: true };
    }

    // 超时
    if (lower.includes("timeout") || lower.includes("超时") || lower.includes("timed out")) {
      return { type: AgnesErrorType.TIMEOUT, message: msg, userMessage: "任务超时，请重新尝试", retryable: true };
    }

    // 限流
    if (lower.includes("rate limit") || lower.includes("rate_limit") || lower.includes("429") || lower.includes("too many requests")) {
      return { type: AgnesErrorType.RATE_LIMIT, message: msg, userMessage: "请求频率过高，请稍后重试", retryable: true };
    }

    // 服务繁忙
    if (lower.includes("busy") || lower.includes("overloaded") || lower.includes("service unavailable") || lower.includes("503") || lower.includes("502")) {
      return { type: AgnesErrorType.SERVER_BUSY, message: msg, userMessage: "服务繁忙，请稍后重试", retryable: true };
    }

    // 无效图片
    if (
      lower.includes("image") || lower.includes("图片") || lower.includes("invalid file") ||
      lower.includes("file not supported") || lower.includes("格式")
    ) {
      return { type: AgnesErrorType.INVALID_IMAGE, message: msg, userMessage: "图片格式异常或无法处理", retryable: false };
    }

    // 内容被拒绝
    if (
      lower.includes("content") || lower.includes("safety") || lower.includes("inappropriate") ||
      lower.includes("moderation") || lower.includes("被拒绝") || lower.includes("违规")
    ) {
      return { type: AgnesErrorType.CONTENT_REJECTED, message: msg, userMessage: "内容不符合安全规范，请修改后重试", retryable: false };
    }

    // 无效 Prompt
    if (lower.includes("prompt") || lower.includes("输入") || lower.includes("invalid request")) {
      return { type: AgnesErrorType.INVALID_PROMPT, message: msg, userMessage: "输入内容异常，请检查后重试", retryable: false };
    }

    // 找不到模型或渠道
    if (lower.includes("model") || lower.includes("distributor") || lower.includes("无可用渠道") || lower.includes("not found") || lower.includes("404")) {
      return { type: AgnesErrorType.UNKNOWN, message: msg, userMessage: "模型配置异常，请检查 Settings 中的模型设置", retryable: false };
    }

    return { type: AgnesErrorType.UNKNOWN, message: msg, userMessage: msg || "生成失败，请稍后重试", retryable: false };
  }

  /**
   * 获取重试延迟（毫秒）
   */
  static getRetryDelay(attempt: number): number {
    if (attempt < 0) return RETRY_DELAYS[0];
    if (attempt >= RETRY_DELAYS.length) return RETRY_DELAYS[RETRY_DELAYS.length - 1];
    return RETRY_DELAYS[attempt];
  }

  /**
   * 是否可重试
   */
  static isRetryable(type: AgnesErrorType): boolean {
    return RETRYABLE_TYPES.has(type);
  }
}
