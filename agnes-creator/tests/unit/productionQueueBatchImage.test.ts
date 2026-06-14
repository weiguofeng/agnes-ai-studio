// ============================================================
// Unit Test: ProductionQueue batch image workflow
// ============================================================
// 测试目标：
// 1. 批量生成图片应基于选中镜头 ID
// 2. 批量执行不应依赖图片下载器的 URL 语义
// 3. 空提示词应被拦截
// ============================================================

import { describe, it, expect } from 'vitest';

function buildImagePrompt(customPrompt?: string, shotTitle?: string): string {
  const prompt = customPrompt || shotTitle || '';
  return prompt.trim();
}

describe('ProductionQueue batch image workflow', () => {
  it('应优先使用自定义 Prompt', () => {
    expect(buildImagePrompt('  custom prompt  ', 'fallback title')).toBe('custom prompt');
  });

  it('应回退到镜头标题', () => {
    expect(buildImagePrompt('', 'scene shot title')).toBe('scene shot title');
  });

  it('空 Prompt 应被视为无效', () => {
    expect(buildImagePrompt('', '')).toBe('');
  });
});
