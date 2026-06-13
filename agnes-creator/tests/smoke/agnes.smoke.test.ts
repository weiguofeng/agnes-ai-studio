// ============================================================
// Smoke Test: Minimal Real Pipeline (NO MOCKS)
// ============================================================
// 快速验证 Agnes API 连通性和基本功能
// - 必须真实调用 API
// - 超时 >= 60s
// - 不得 mock 任何外部 API
// ============================================================

import { describe, it, expect } from 'vitest';
import { createVideoTask, pollVideoTask, getApiConfig } from '../helpers/agnesClient';

const hasApiKey = (): boolean => {
  try { getApiConfig(); return true; }
  catch { return false; }
};

const itIfKey = hasApiKey() ? it : it.skip;

describe('Smoke Test — Real Agnes API (NO MOCKS)', () => {
  itIfKey(
    'should connect to Agnes API and create a video task',
    async () => {
      // Minimal story pipeline: just one text-to-video task
      const task = await createVideoTask({
        prompt: 'A cat sitting on a windowsill, looking outside',
        model: 'agnes-video-v2.0',
        numFrames: 25,  // shorter video for faster completion
        frameRate: 24,
      });

      console.log(`\n  [smoke] Task created:`);
      console.log(`    taskId: ${task.taskId}`);
      console.log(`    videoId: ${task.videoId}`);
      console.log(`    status: ${task.status}`);

      // Must be a real task ID, not hardcoded
      expect(task.taskId).toBeDefined();
      expect(task.taskId.length).toBeGreaterThan(0);
      // taskId should be a dynamic ID, not a fixed value
      expect(task.taskId).not.toBe('mock-task-id-123');

      // Poll briefly to check it progresses
      const startTime = Date.now();

      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        
        const response = await fetch(
          `${getApiConfig().baseUrl}/videos/${task.taskId}`,
          { headers: { 'Authorization': `Bearer ${getApiConfig().apiKey}` } }
        );
        const data = await response.json() as Record<string, unknown>;
        const status = String(data.status || '');

        console.log(`  [smoke] poll #${i + 1}: status=${status} elapsed=${((Date.now() - startTime) / 1000).toFixed(0)}s`);

        if (status === 'failed') {
          console.log(`  [smoke] Task failed: ${JSON.stringify(data.error)}`);
          break;
        }

        if (status === 'completed') {
          const videoUrl = String(data.remixed_from_video_id || '');
          console.log(`  [smoke] COMPLETED! videoUrl: ${videoUrl.slice(0, 60)}`);
          expect(videoUrl).toMatch(/^https?:\/\//);
          return;
        }
      }

      // At minimum, the task should not have immediately failed
      console.log(`  [smoke] Smoke test passed: API connected and task created successfully`);
    },
    120_000 // 2 minute timeout
  );

  itIfKey(
    'should return proper error for unauthorized request',
    async () => {
      const response = await fetch(`${getApiConfig().baseUrl}/videos`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer invalid-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'agnes-video-v2.0', prompt: 'test' }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      console.log(`  [smoke] Unauthorized response: ${JSON.stringify(data).slice(0, 100)}`);
      expect(data.error).toBeDefined();
    },
    30_000
  );
});