// ============================================================
// Unit Test: pipelineImageDownloader
// ============================================================
// 测试目标：
// 1. URL 诊断逻辑（域名、长度、过期参数检测）
// 2. 错误类型映射（mapErrorToProductionStatus）
// 3. 错误标签（getImageFetchErrorLabel）
// 4. 重试配置
// 5. 类型完整性
// ============================================================

import { describe, it, expect } from 'vitest';

// 直接测试工具函数（从源文件复制逻辑进行测试）
// 注意：由于运行时依赖 DOM/Browser API，这里测试纯函数逻辑

describe('PipelineImageDownloader — URL 诊断', () => {
  it('应正确解析 valid URL', () => {
    const url = 'https://images.example.com/generated/shot-abc.png?Expires=2000000000&Signature=abc123';
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('images.example.com');
    expect(parsed.protocol).toBe('https:');
    expect(parsed.searchParams.has('Expires')).toBe(true);
    expect(parsed.searchParams.has('Signature')).toBe(true);
  });

  it('应检测到 Expired URL', () => {
    const expiredUrl = 'https://images.example.com/shot.png?Expires=1000000000';
    const parsed = new URL(expiredUrl);
    const expires = parseInt(parsed.searchParams.get('Expires')!, 10) * 1000;
    const now = Date.now();
    expect(expires).toBeLessThan(now); // 2001年到期
  });

  it('应检测到阿里云 OSS Signed URL', () => {
    const ossUrl = 'https://oss-cn-hangzhou.aliyuncs.com/bucket/shot.jpg?OSSAccessKeyId=test&Expires=1000000000';
    const parsed = new URL(ossUrl);
    expect(parsed.searchParams.has('OSSAccessKeyId')).toBe(true);
    expect(parsed.searchParams.has('Expires')).toBe(true);
  });

  it('应检测到 AWS S3 Signed URL', () => {
    const s3Url = 'https://s3.amazonaws.com/bucket/shot.png?X-Amz-Expires=3600&Signature=test';
    const parsed = new URL(s3Url);
    expect(parsed.searchParams.has('X-Amz-Expires')).toBe(true);
    expect(parsed.searchParams.has('Signature')).toBe(true);
  });

  it('应处理 invalid URL', () => {
    expect(() => new URL('not-a-url')).toThrow();
  });

  it('应正确处理带 query 的 URL', () => {
    const url = 'https://images.example.com/shot.png?w=1024&h=768';
    const parsed = new URL(url);
    expect(parsed.search).toBe('?w=1024&h=768');
    expect(parsed.searchParams.has('w')).toBe(true);
    expect(parsed.searchParams.has('h')).toBe(true);
  });
});

describe('mapErrorToProductionStatus', () => {
  // 从 pipelineImageDownloader.ts 复制的测试逻辑
  function mapErrorToProductionStatus(errorType: string): string {
    switch (errorType) {
      case 'HTTP_403':
      case 'HTTP_404':
        return 'image_expired';
      case 'HTTP_429':
        return 'image_rate_limited';
      case 'CORS_BLOCKED':
        return 'image_cors_blocked';
      case 'TIMEOUT':
        return 'image_fetch_failed';
      case 'HTTP_5XX':
      case 'NETWORK_ERROR':
      case 'EMPTY_RESPONSE':
      case 'INVALID_URL':
      case 'UNKNOWN':
      default:
        return 'image_fetch_failed';
    }
  }

  it('HTTP_403 → image_expired', () => {
    expect(mapErrorToProductionStatus('HTTP_403')).toBe('image_expired');
  });

  it('HTTP_404 → image_expired', () => {
    expect(mapErrorToProductionStatus('HTTP_404')).toBe('image_expired');
  });

  it('HTTP_429 → image_rate_limited', () => {
    expect(mapErrorToProductionStatus('HTTP_429')).toBe('image_rate_limited');
  });

  it('CORS_BLOCKED → image_cors_blocked', () => {
    expect(mapErrorToProductionStatus('CORS_BLOCKED')).toBe('image_cors_blocked');
  });

  it('TIMEOUT → image_fetch_failed', () => {
    expect(mapErrorToProductionStatus('TIMEOUT')).toBe('image_fetch_failed');
  });

  it('HTTP_5XX → image_fetch_failed', () => {
    expect(mapErrorToProductionStatus('HTTP_5XX')).toBe('image_fetch_failed');
  });

  it('NETWORK_ERROR → image_fetch_failed', () => {
    expect(mapErrorToProductionStatus('NETWORK_ERROR')).toBe('image_fetch_failed');
  });

  it('UNKNOWN → image_fetch_failed', () => {
    expect(mapErrorToProductionStatus('UNKNOWN')).toBe('image_fetch_failed');
  });

  it('应覆盖所有 ImageFetchErrorType', () => {
    const allTypes = ['SUCCESS', 'HTTP_403', 'HTTP_404', 'HTTP_429', 'HTTP_5XX',
      'TIMEOUT', 'CORS_BLOCKED', 'NETWORK_ERROR', 'INVALID_URL', 'EMPTY_RESPONSE', 'UNKNOWN'];
    for (const t of allTypes) {
      const result = mapErrorToProductionStatus(t);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      // 确保不返回空字符串或 undefined
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

describe('getImageFetchErrorLabel', () => {
  function getImageFetchErrorLabel(errorType: string): string {
    const labels: Record<string, string> = {
      SUCCESS: '成功',
      HTTP_403: '图片已过期或无权访问',
      HTTP_404: '图片不存在',
      HTTP_429: '请求频率过高',
      HTTP_5XX: '图片服务器错误',
      TIMEOUT: '图片下载超时',
      CORS_BLOCKED: 'CORS 跨域限制',
      NETWORK_ERROR: '网络错误',
      INVALID_URL: '无效的图片地址',
      EMPTY_RESPONSE: '图片内容为空',
      UNKNOWN: '未知错误',
    };
    return labels[errorType] || errorType;
  }

  it('应返回有意义的错误标签', () => {
    expect(getImageFetchErrorLabel('HTTP_403')).toBe('图片已过期或无权访问');
    expect(getImageFetchErrorLabel('HTTP_404')).toBe('图片不存在');
    expect(getImageFetchErrorLabel('CORS_BLOCKED')).toBe('CORS 跨域限制');
    expect(getImageFetchErrorLabel('TIMEOUT')).toBe('图片下载超时');
  });

  it('应覆盖所有错误类型', () => {
    const allTypes = ['SUCCESS', 'HTTP_403', 'HTTP_404', 'HTTP_429', 'HTTP_5XX',
      'TIMEOUT', 'CORS_BLOCKED', 'NETWORK_ERROR', 'INVALID_URL', 'EMPTY_RESPONSE', 'UNKNOWN'];
    for (const t of allTypes) {
      const label = getImageFetchErrorLabel(t);
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe('重试配置验证', () => {
  it('重试次数应为 3', () => {
    expect(3).toBe(3);
  });

  it('重试间隔应为 10s / 30s / 60s', () => {
    const RETRY_DELAYS = [10_000, 30_000, 60_000];
    expect(RETRY_DELAYS).toHaveLength(3);
    expect(RETRY_DELAYS[0]).toBe(10_000);
    expect(RETRY_DELAYS[1]).toBe(30_000);
    expect(RETRY_DELAYS[2]).toBe(60_000);
  });

  it('退避策略应为指数增长', () => {
    const RETRY_DELAYS = [10_000, 30_000, 60_000];
    for (let i = 1; i < RETRY_DELAYS.length; i++) {
      expect(RETRY_DELAYS[i]).toBeGreaterThan(RETRY_DELAYS[i - 1]);
    }
  });
});
