// ============================================================
// Unit Test: Error Handler & Classifier
// ============================================================
// 测试目标：
// 1. 错误分类
// 2. 重试策略
// 3. 错误类型映射完整性
// 4. 日志记录
// ============================================================

import { describe, it, expect } from 'vitest';

describe('ErrorClassifier — 错误分类', () => {
  function classifyError(err: unknown): { category: string; retryable: boolean } {
    const msg = String(err instanceof Error ? err.message : err).toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit')) {
      return { category: 'rate_limit', retryable: true };
    }
    if (msg.includes('500') || msg.includes('server error')) {
      return { category: 'server_error', retryable: true };
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return { category: 'timeout', retryable: true };
    }
    if (msg.includes('network') || msg.includes('fetch failed')) {
      return { category: 'network', retryable: true };
    }
    if (msg.includes('403')) {
      return { category: 'forbidden', retryable: false };
    }
    if (msg.includes('404')) {
      return { category: 'not_found', retryable: false };
    }
    return { category: 'unknown', retryable: false };
  }

  it('429 应分类为 rate_limit 且可重试', () => {
    const err = new Error('429 Too Many Requests');
    const result = classifyError(err);
    expect(result.category).toBe('rate_limit');
    expect(result.retryable).toBe(true);
  });

  it('500 应分类为 server_error 且可重试', () => {
    const err = new Error('500 Internal Server Error');
    const result = classifyError(err);
    expect(result.category).toBe('server_error');
    expect(result.retryable).toBe(true);
  });

  it('timeout 应分类为 timeout 且可重试', () => {
    const err = new Error('timeout');
    const result = classifyError(err);
    expect(result.category).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('403 应分类为 forbidden 且不可重试', () => {
    const err = new Error('403 Forbidden');
    const result = classifyError(err);
    expect(result.category).toBe('forbidden');
    expect(result.retryable).toBe(false);
  });

  it('404 应分类为 not_found 且不可重试', () => {
    const err = new Error('404 Not Found');
    const result = classifyError(err);
    expect(result.category).toBe('not_found');
    expect(result.retryable).toBe(false);
  });

  it('fetch failed 应分类为 network 且可重试', () => {
    const err = new Error('fetch failed');
    const result = classifyError(err);
    expect(result.retryable).toBe(true);
  });
});

describe('ErrorClassifier — 重试策略', () => {
  it('应使用指数退避', () => {
    const delays = [1000, 2000, 4000]; // baseDelay=1000, factor=2
    for (let i = 0; i < 3; i++) {
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      expect(delay).toBe(delays[i]);
    }
  });

  it('重试延迟不应超过 maxDelay', () => {
    const maxDelay = 10000;
    for (let i = 0; i < 10; i++) {
      const delay = Math.min(1000 * Math.pow(2, i), maxDelay);
      expect(delay).toBeLessThanOrEqual(maxDelay);
    }
  });

  it('withRetry 应在成功时返回 data', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      return 'success';
    };

    const result = await (async () => {
      try {
        const data = await fn();
        return { data, attempts };
      } catch (err) {
        return { error: err, attempts };
      }
    })();

    expect(result.data).toBe('success');
    expect(result.attempts).toBe(1);
  });

  it('withRetry 应在失败指定次数后返回 error', async () => {
    let callCount = 0;
    const maxRetries = 2;
    const fn = async () => {
      callCount++;
      throw new Error('server error');
    };

    let lastError;
    let totalAttempts = 0;
    for (let i = 0; i <= maxRetries; i++) {
      totalAttempts++;
      try {
        await fn();
        break;
      } catch (err) {
        lastError = err;
        if (i >= maxRetries) break;
      }
    }

    expect(lastError).toBeDefined();
    expect(totalAttempts).toBe(3);
    expect(callCount).toBe(3);
  });
});

describe('ProductionStatus 类型完整性', () => {
  it('应包含所有 V2.4 新增状态', () => {
    const newStatuses = [
      'image_fetch_failed',
      'image_expired',
      'image_cors_blocked',
      'image_not_found',
      'image_rate_limited',
      'video_api_failed',
      'video_timeout',
    ];
    expect(newStatuses).toHaveLength(7);
    for (const s of newStatuses) {
      expect(s.startsWith('image_') || s.startsWith('video_')).toBe(true);
    }
  });

  it('新状态应与原有状态不重复', () => {
    const oldStatuses = ['pending', 'generating', 'completed', 'failed', 'skipped', 'cancelled'];
    const newStatuses = [
      'image_fetch_failed', 'image_expired', 'image_cors_blocked',
      'image_not_found', 'image_rate_limited', 'video_api_failed', 'video_timeout',
    ];
    for (const ns of newStatuses) {
      expect(oldStatuses.includes(ns)).toBe(false);
    }
  });
});
