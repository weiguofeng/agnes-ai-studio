// ============================================================
// Integration Test: Real Agnes Pipeline (NO MOCKS)
// ============================================================
// 测试完整真实链路:
//   Text-to-Video → 完成 → 验证视频URL
//   Image-to-Video → 完成 → 验证视频URL
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { createVideoTask, pollVideoTask, getApiConfig } from '../helpers/agnesClient';
import * as fs from 'fs';
import * as path from 'path';

const hasApiKey = (): boolean => {
  try { getApiConfig(); return true; }
  catch { return false; }
};

const itIfKey = hasApiKey() ? it : it.skip;

describe('Real Agnes Pipeline — Integration Test (NO MOCKS)', () => {
  // ==========================================================
  // Test 1: Text-to-Video (REAL API)
  // ==========================================================
  itIfKey(
    'TEXT-TO-VIDEO: should create task via real API and complete',
    async () => {
      // Verify no mocking - this must be a real fetch call
      const task = await createVideoTask({
        prompt: 'A calm ocean wave gently rolling onto a sandy beach at sunset, golden colors',
        model: 'agnes-video-v2.0',
        width: 1152,
        height: 768,
        numFrames: 49,
        frameRate: 24,
      });

      // ASSERT: task was created with real IDs
      expect(task.taskId).toBeDefined();
      expect(task.taskId.length).toBeGreaterThan(0);
      // FAIL if taskId is hardcoded or mocked
      expect(task.taskId).not.toBe('mock-task-id');
      expect(task.taskId).not.toBe('fake-task-id');
      expect(task.status).toBe('queued');

      console.log(`\n  TEXT-TO-VIDEO TASK CREATED:`);
      console.log(`    taskId: ${task.taskId}`);
      console.log(`    videoId: ${task.videoId}`);
      console.log(`    initialStatus: ${task.status}`);

      // Poll for completion with 10 minute timeout
      console.log(`  Polling for completion (up to 10 min)...`);
      const result = await pollVideoTask(task.taskId, {
        timeoutMs: 600_000,  // 10 minutes
        intervalMs: 10_000,  // poll every 10s
      });

      // ASSERT: video was generated
      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
      expect(result.videoUrl).toBeDefined();
      expect(result.videoUrl!.length).toBeGreaterThan(0);
      expect(result.videoUrl!).toMatch(/^https?:\/\//);
      expect(result.videoUrl!).toContain('.mp4');

      console.log(`  TEXT-TO-VIDEO PIPELINE SUCCESS:`);
      console.log(`    status: ${result.status}`);
      console.log(`    videoId: ${result.videoId}`);
      console.log(`    videoUrl: ${result.videoUrl!}`);
    },
    620_000  // 10 min 20s timeout
  );

  // ==========================================================
  // Test 2: Image-to-Video (REAL API)
  // ==========================================================
  itIfKey(
    'IMAGE-TO-VIDEO: should create task from image via real API and complete',
    async () => {
      // Read the test image (100x100 valid PNG, ~20KB)
      const b64Path = path.join(__dirname, '..', 'helpers', 'test_image.b64');
      const testImage = fs.readFileSync(b64Path, 'utf-8').trim();

      console.log(`\n  Using test image: ${testImage.length} chars base64`);

      const task = await createVideoTask({
        prompt: 'Animate this scene with gentle motion, zoom in slowly',
        model: 'agnes-video-v2.0',
        imageBase64: testImage,
        numFrames: 49,
        frameRate: 24,
      });

      // ASSERT: task was created
      expect(task.taskId).toBeDefined();
      expect(task.taskId.length).toBeGreaterThan(0);
      expect(task.taskId).not.toBe('mock-task-id');
      expect(task.status).toBe('queued');

      console.log(`  IMAGE-TO-VIDEO TASK CREATED:`);
      console.log(`    taskId: ${task.taskId}`);

      // Poll for completion
      const result = await pollVideoTask(task.taskId, {
        timeoutMs: 600_000,
        intervalMs: 10_000,
      });

      // ASSERT: video was generated
      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
      expect(result.videoUrl).toBeDefined();
      expect(result.videoUrl!.length).toBeGreaterThan(0);
      expect(result.videoUrl!).toMatch(/^https?:\/\//);

      console.log(`  IMAGE-TO-VIDEO PIPELINE SUCCESS:`);
      console.log(`    taskId: ${result.taskId}`);
      console.log(`    videoUrl: ${result.videoUrl!}`);
    },
    620_000
  );

  // ==========================================================
  // Test 3: Error handling — invalid auth
  // ==========================================================
  itIfKey(
    'ERROR: should fail gracefully with invalid auth token',
    async () => {
      const { baseUrl } = getApiConfig();
      const response = await fetch(`${baseUrl}/videos`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-key-12345',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'agnes-video-v2.0', prompt: 'test' }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBeDefined();

      console.log(`  ERROR RESPONSE: status=${response.status}`);
      console.log(`    message: ${JSON.stringify(data.error).slice(0, 100)}`);
    },
    30_000
  );
});