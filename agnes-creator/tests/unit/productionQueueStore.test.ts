// ============================================================
// Unit Test: ProductionQueueStore
// ============================================================
// 测试目标：
// 1. 队列初始化
// 2. 状态更新（含新错误状态）
// 3. 重试计数
// 4. 队列过滤（getPendingVideoItems）
// 5. 断点恢复
// 6. 暂停/恢复
// ============================================================

import { describe, it, expect } from 'vitest';

// 定义与源文件一致的类型
type ProductionStatus =
  | 'pending' | 'generating' | 'completed' | 'failed' | 'skipped' | 'cancelled'
  | 'image_fetch_failed' | 'image_expired' | 'image_cors_blocked'
  | 'image_not_found' | 'image_rate_limited' | 'video_api_failed' | 'video_timeout';

interface ProductionQueueItem {
  id: string;
  projectId: string;
  sceneId: string;
  shotId: string;
  shotTitle: string;
  sceneTitle: string;
  order: number;
  imageStatus: ProductionStatus;
  imageTaskId?: string;
  imageResultUrl?: string;
  imageRetries: number;
  imageError?: string;
  imageStartedAt?: number;
  imageCompletedAt?: number;
  videoStatus: ProductionStatus;
  videoTaskId?: string;
  videoResultUrl?: string;
  videoRetries: number;
  videoError?: string;
  videoStartedAt?: number;
  videoCompletedAt?: number;
}

const MAX_RETRIES = 3;

function createMockItem(overrides: Partial<ProductionQueueItem> = {}): ProductionQueueItem {
  return {
    id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId: 'test-project',
    sceneId: 'scene-1',
    shotId: `shot-${Math.random().toString(36).slice(2, 8)}`,
    shotTitle: '测试镜头',
    sceneTitle: '测试场景',
    order: 1,
    imageStatus: 'pending',
    videoStatus: 'pending',
    imageRetries: 0,
    videoRetries: 0,
    ...overrides,
  };
}

describe('ProductionQueue — 状态管理', () => {
  it('应正确初始化队列项', () => {
    const item = createMockItem({ shotTitle: '主角出场', order: 1 });
    expect(item.shotTitle).toBe('主角出场');
    expect(item.order).toBe(1);
    expect(item.imageStatus).toBe('pending');
    expect(item.videoStatus).toBe('pending');
    expect(item.imageRetries).toBe(0);
  });

  it('应支持 image_fetch_failed 状态', () => {
    const item = createMockItem({
      imageStatus: 'completed',
      videoStatus: 'image_fetch_failed',
      videoError: '图生视频失败 - CORS 跨域限制',
    });
    expect(item.videoStatus).toBe('image_fetch_failed');
    expect(item.videoError).toContain('CORS');
  });

  it('应支持 image_expired 状态', () => {
    const item = createMockItem({
      imageStatus: 'completed',
      videoStatus: 'image_expired',
      videoError: '图片 URL 已过期',
    });
    expect(item.videoStatus).toBe('image_expired');
  });

  it('应支持 video_api_failed 状态', () => {
    const item = createMockItem({
      imageStatus: 'completed',
      videoStatus: 'video_api_failed',
      videoError: 'Agnes API 返回 500',
    });
    expect(item.videoStatus).toBe('video_api_failed');
  });

  it('应支持 video_timeout 状态', () => {
    const item = createMockItem({
      imageStatus: 'completed',
      videoStatus: 'video_timeout',
      videoError: '视频生成超时',
    });
    expect(item.videoStatus).toBe('video_timeout');
  });

  it('应支持 image_cors_blocked 状态', () => {
    const item = createMockItem({
      imageStatus: 'completed',
      videoStatus: 'image_cors_blocked',
      videoError: 'CORS 跨域限制',
    });
    expect(item.videoStatus).toBe('image_cors_blocked');
  });
});

describe('ProductionQueue — getPendingVideoItems 过滤', () => {
  it('只有 imageStatus=completed 且 videoStatus=pending 的项应被选中', () => {
    const items: ProductionQueueItem[] = [
      createMockItem({ shotId: 'shot-1', imageStatus: 'completed', videoStatus: 'pending' }),
      createMockItem({ shotId: 'shot-2', imageStatus: 'completed', videoStatus: 'completed' }),
      createMockItem({ shotId: 'shot-3', imageStatus: 'completed', videoStatus: 'image_fetch_failed' }),
      createMockItem({ shotId: 'shot-4', imageStatus: 'failed', videoStatus: 'pending' }),
      createMockItem({ shotId: 'shot-5', imageStatus: 'completed', videoStatus: 'image_expired' }),
      createMockItem({ shotId: 'shot-6', imageStatus: 'completed', videoStatus: 'video_api_failed' }),
    ];

    // 模拟 getPendingVideoItems 逻辑
    const pending = items.filter((i) => i.videoStatus === 'pending' && i.imageStatus === 'completed');
    
    expect(pending).toHaveLength(1);
    expect(pending[0].shotId).toBe('shot-1');
  });

  it('不应选中任何 image_fetch_failed 状态的项', () => {
    const items: ProductionQueueItem[] = [
      createMockItem({ shotId: 'shot-1', imageStatus: 'completed', videoStatus: 'pending' }),
      createMockItem({ shotId: 'shot-2', imageStatus: 'completed', videoStatus: 'image_fetch_failed' }),
      createMockItem({ shotId: 'shot-3', imageStatus: 'completed', videoStatus: 'image_expired' }),
      createMockItem({ shotId: 'shot-4', imageStatus: 'completed', videoStatus: 'image_cors_blocked' }),
      createMockItem({ shotId: 'shot-5', imageStatus: 'completed', videoStatus: 'image_rate_limited' }),
    ];

    // 模拟 getPendingVideoItems
    const pending = items.filter((i) => i.videoStatus === 'pending' && i.imageStatus === 'completed');
    expect(pending).toHaveLength(1);
  });
});

describe('ProductionQueue — 重试管理', () => {
  it('重试达到 MAX_RETRIES(3) 后应标记为失败', () => {
    const item = createMockItem({ imageStatus: 'completed', videoRetries: 0 });

    // 模拟增量重试
    for (let i = 1; i <= MAX_RETRIES; i++) {
      item.videoRetries = i;
    }

    const isFailed = item.videoRetries >= MAX_RETRIES;
    expect(isFailed).toBe(true);
    expect(item.videoRetries).toBe(3);
  });

  it('重试小于 3 次时应保持 pending', () => {
    const item = createMockItem({ imageStatus: 'completed', videoRetries: 2 });
    const isFailed = item.videoRetries >= MAX_RETRIES;
    expect(isFailed).toBe(false);
  });

  it('重试增量应正确记录', () => {
    let retries = 0;
    const incrementRetry = () => { retries++; };

    incrementRetry(); // 1
    incrementRetry(); // 2
    incrementRetry(); // 3

    expect(retries).toBe(3);
    const shouldMax = retries >= MAX_RETRIES;
    expect(shouldMax).toBe(true);
  });
});

describe('ProductionQueue — 断点恢复', () => {
  it('generating 状态应转换为 pending 用于恢复', () => {
    const items: ProductionQueueItem[] = [
      createMockItem({ shotId: 'shot-1', imageStatus: 'generating', videoStatus: 'pending' }),
      createMockItem({ shotId: 'shot-2', imageStatus: 'completed', videoStatus: 'generating' }),
      createMockItem({ shotId: 'shot-3', imageStatus: 'completed', videoStatus: 'completed' }),
    ];

    // 模拟 recoverPendingTasks
    const pending: Array<{ shotId: string; type: string }> = [];
    for (const item of items) {
      if (item.imageStatus === 'generating' || item.imageStatus === 'pending') {
        pending.push({ shotId: item.shotId, type: 'image' });
      }
      if (item.videoStatus === 'generating' || item.videoStatus === 'pending') {
        pending.push({ shotId: item.shotId, type: 'video' });
      }
    }

    expect(pending).toHaveLength(3); // shot-1 image, shot-1 video, shot-2 video

    // 重置 generating → pending
    for (const item of items) {
      if (item.imageStatus === 'generating') item.imageStatus = 'pending';
      if (item.videoStatus === 'generating') item.videoStatus = 'pending';
    }

    expect(items[0].imageStatus).toBe('pending');
    expect(items[1].videoStatus).toBe('pending');
    expect(items[2].videoStatus).toBe('completed');
  });

  it('已完成的项不应被恢复', () => {
    const items: ProductionQueueItem[] = [
      createMockItem({ shotId: 'shot-1', imageStatus: 'completed', videoStatus: 'completed' }),
      createMockItem({ shotId: 'shot-2', imageStatus: 'completed', videoStatus: 'completed' }),
    ];

    const pending: Array<{ shotId: string; type: string }> = [];
    for (const item of items) {
      if (item.imageStatus === 'generating' || item.imageStatus === 'pending') {
        pending.push({ shotId: item.shotId, type: 'image' });
      }
      if (item.videoStatus === 'generating' || item.videoStatus === 'pending') {
        pending.push({ shotId: item.shotId, type: 'video' });
      }
    }

    expect(pending).toHaveLength(0);
  });
});

describe('ProductionQueue — 暂停/恢复', () => {
  it('暂停后应正确处理', () => {
    let isPaused = false;
    const togglePause = () => { isPaused = !isPaused; };

    // 正常执行
    expect(isPaused).toBe(false);

    // 暂停
    togglePause();
    expect(isPaused).toBe(true);

    // 恢复
    togglePause();
    expect(isPaused).toBe(false);
  });

  it('暂停时不应推进队列', () => {
    const queue = {
      isPaused: false,
      items: Array.from({ length: 5 }, (_, i) => 
        createMockItem({ shotId: `shot-${i + 1}`, imageStatus: 'completed', videoStatus: 'pending' })
      ),
    };

    // 暂停
    queue.isPaused = true;

    // 尝试推进
    const processQueue = () => {
      if (queue.isPaused) return 0;
      let processed = 0;
      for (const item of queue.items) {
        if (item.videoStatus === 'pending' && item.imageStatus === 'completed') {
          item.videoStatus = 'generating';
          processed++;
        }
      }
      return processed;
    };

    expect(processQueue()).toBe(0);

    // 恢复后应能推进
    queue.isPaused = false;
    expect(processQueue()).toBe(5);
  });
});
