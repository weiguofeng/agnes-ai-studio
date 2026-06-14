// ============================================================
// Unit Test: ProductionQueue prompt and video readiness
// ============================================================

import { describe, it, expect } from 'vitest';

interface QueueItemLike {
  shotId: string;
  shotTitle: string;
  imagePrompt?: string;
  videoPrompt?: string;
  customPrompt?: string;
  imageResultUrl?: string;
  videoLocked?: boolean;
}

function getDisplayPrompt(item: QueueItemLike): string {
  return item.customPrompt || item.videoPrompt || item.imagePrompt || item.shotTitle || '';
}

function getRunnableVideoIds(items: QueueItemLike[], selectedIds: string[]): string[] {
  return selectedIds.filter((shotId) => {
    const item = items.find((candidate) => candidate.shotId === shotId);
    return !!item && !item.videoLocked && !!item.imageResultUrl;
  });
}

describe('ProductionQueue prompt and video readiness', () => {
  it('编辑 Prompt 应优先显示完整视频 Prompt', () => {
    const item = {
      shotId: 'shot-1',
      shotTitle: '镜头 1: 缩略标题...',
      imagePrompt: '完整图片提示词，包含角色、场景、灯光和高质量画面约束',
      videoPrompt: '完整视频提示词，包含镜头运动、角色一致性、场景和电影感运动',
    };

    expect(getDisplayPrompt(item)).toBe(item.videoPrompt);
    expect(getDisplayPrompt(item)).not.toBe(item.shotTitle);
  });

  it('自定义 Prompt 应覆盖默认完整 Prompt', () => {
    const item = {
      shotId: 'shot-1',
      shotTitle: '短标题',
      videoPrompt: '完整默认提示词',
      customPrompt: '人工修订后的完整提示词',
    };

    expect(getDisplayPrompt(item)).toBe('人工修订后的完整提示词');
  });

  it('批量视频只应运行已完成图片且未锁定的视频项', () => {
    const items: QueueItemLike[] = [
      { shotId: 'shot-1', shotTitle: 'a', imageResultUrl: 'https://example.com/a.png' },
      { shotId: 'shot-2', shotTitle: 'b' },
      { shotId: 'shot-3', shotTitle: 'c', imageResultUrl: 'https://example.com/c.png', videoLocked: true },
    ];

    expect(getRunnableVideoIds(items, ['shot-1', 'shot-2', 'shot-3'])).toEqual(['shot-1']);
  });
});
