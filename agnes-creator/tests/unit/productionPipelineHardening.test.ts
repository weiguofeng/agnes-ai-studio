import { describe, expect, it } from 'vitest';
import { createVideoService } from '@/services/agnes/video';

function isLikelyShortPrompt(prompt: string | undefined, shotTitle?: string): boolean {
  const value = (prompt || '').trim();
  if (!value) return true;
  if (shotTitle && value === shotTitle.trim()) return true;
  return value.length < 80 && /^(镜头|Shot)\s*\d*[:：]/i.test(value) && value.endsWith('...');
}

function selectPollId(task: { taskId: string; videoId?: string }): string {
  return task.videoId || task.taskId;
}

function cancellableShotIds(items: Array<{ shotId: string; imageStatus: string; videoStatus: string }>, selectedIds: string[]): string[] {
  return selectedIds.filter((shotId) => {
    const item = items.find((candidate) => candidate.shotId === shotId);
    return !!item && [item.imageStatus, item.videoStatus].some((status) => status === 'generating' || status === 'regenerating_image' || status === 'regenerating_video');
  });
}

function countStorageAssets(params: {
  assets: Array<{ id: string; type: string; status: string; projectId?: string; url?: string; originalUrl?: string }>;
  projectId: string;
  imageUrls: string[];
  videoUrls: string[];
}): { images: number; videos: number } {
  const imageKeys = new Set(params.imageUrls.filter(Boolean));
  const videoKeys = new Set(params.videoUrls.filter(Boolean));
  for (const asset of params.assets.filter((candidate) => candidate.status === 'active' && candidate.projectId === params.projectId)) {
    const key = asset.originalUrl || asset.url || asset.id;
    if (asset.type === 'image') imageKeys.add(key);
    if (asset.type === 'video') videoKeys.add(key);
  }
  return { images: imageKeys.size, videos: videoKeys.size };
}

describe('Production pipeline hardening', () => {
  it('Agnes video service extracts nested video_id for polling', async () => {
    const service = createVideoService({
      getConfig: () => ({ baseUrl: 'https://apihub.agnes-ai.com/v1', apiKey: 'test-key', model: 'agnes-video-v2.0' }),
      post: async () => ({ data: { task_id: 'task_abc', video_id: 'video_123' } }),
    } as any);

    const task = await service.create({ prompt: 'full video prompt' });

    expect(task.taskId).toBe('task_abc');
    expect(task.videoId).toBe('video_123');
    expect(selectPollId(task)).toBe('video_123');
  });

  it('short generated shot titles should be treated as prompt placeholders', () => {
    expect(isLikelyShortPrompt('镜头 2: As he opens it, golden sparks ...', '镜头 2: As he opens it, golden sparks ...')).toBe(true);
    expect(isLikelyShortPrompt('A complete cinematic prompt with character identity, setting, lighting, composition, camera motion, action continuity, and quality constraints.')).toBe(false);
  });

  it('batch pause only terminates selected active generation tasks', () => {
    const items = [
      { shotId: 'shot-1', imageStatus: 'completed', videoStatus: 'generating' },
      { shotId: 'shot-2', imageStatus: 'completed', videoStatus: 'completed' },
      { shotId: 'shot-3', imageStatus: 'generating', videoStatus: 'pending' },
    ];

    expect(cancellableShotIds(items, ['shot-1', 'shot-2', 'shot-3'])).toEqual(['shot-1', 'shot-3']);
  });

  it('storage monitor counts active project assets and queue URLs without thumbnails', () => {
    const counts = countStorageAssets({
      projectId: 'project-1',
      imageUrls: ['https://cdn.example.com/a.png'],
      videoUrls: ['https://cdn.example.com/a.mp4'],
      assets: [
        { id: 'asset-1', type: 'image', status: 'active', projectId: 'project-1', originalUrl: 'https://cdn.example.com/a.png' },
        { id: 'asset-2', type: 'thumbnail', status: 'active', projectId: 'project-1', originalUrl: 'https://cdn.example.com/thumb.png' },
        { id: 'asset-3', type: 'video', status: 'active', projectId: 'project-1', originalUrl: 'https://cdn.example.com/b.mp4' },
        { id: 'asset-4', type: 'video', status: 'active', projectId: 'project-2', originalUrl: 'https://cdn.example.com/c.mp4' },
      ],
    });

    expect(counts).toEqual({ images: 1, videos: 2 });
  });
});
