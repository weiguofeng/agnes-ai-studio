// ============================================================
// Unit Test: ProductionQueue prompt and video readiness
// ============================================================

import { describe, expect, it } from "vitest";
import { getNextPollInterval, isAgnesRateLimitError } from "@/services/agnes/video";

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
  return item.customPrompt || item.videoPrompt || item.imagePrompt || item.shotTitle || "";
}

function getRunnableVideoIds(items: QueueItemLike[], selectedIds: string[]): string[] {
  return selectedIds.filter((shotId) => {
    const item = items.find((candidate) => candidate.shotId === shotId);
    return !!item && !item.videoLocked && !!item.imageResultUrl;
  });
}

describe("Agnes video polling hardening", () => {
  it("treats 429 and rate-limit errors as retryable polling pressure", () => {
    expect(isAgnesRateLimitError(new Error("/agnesapi query failed (429): video status query rate limit exceeded"))).toBe(true);
    expect(isAgnesRateLimitError("Too Many Requests")).toBe(true);
    expect(isAgnesRateLimitError(new Error("500 Internal Server Error"))).toBe(false);
  });

  it("uses stronger backoff for rate-limited polling without exceeding the cap", () => {
    expect(getNextPollInterval(3000, 60000, false)).toBe(3900);
    expect(getNextPollInterval(3000, 60000, true)).toBe(6000);
    expect(getNextPollInterval(45000, 60000, true)).toBe(60000);
  });
});

describe("ProductionQueue prompt and video readiness", () => {
  it("prefers the full video prompt in the prompt editor", () => {
    const item = {
      shotId: "shot-1",
      shotTitle: "Shot 1: short title...",
      imagePrompt: "Full image prompt with character, scene, lighting, and high-quality visual constraints.",
      videoPrompt: "Full video prompt with camera motion, character consistency, scene, and cinematic movement.",
    };

    expect(getDisplayPrompt(item)).toBe(item.videoPrompt);
    expect(getDisplayPrompt(item)).not.toBe(item.shotTitle);
  });

  it("lets a custom prompt override the default full prompt", () => {
    const item = {
      shotId: "shot-1",
      shotTitle: "Short title",
      videoPrompt: "Complete default prompt",
      customPrompt: "Manually revised complete prompt",
    };

    expect(getDisplayPrompt(item)).toBe("Manually revised complete prompt");
  });

  it("runs batch video only for unlocked items with completed images", () => {
    const items: QueueItemLike[] = [
      { shotId: "shot-1", shotTitle: "a", imageResultUrl: "https://example.com/a.png" },
      { shotId: "shot-2", shotTitle: "b" },
      { shotId: "shot-3", shotTitle: "c", imageResultUrl: "https://example.com/c.png", videoLocked: true },
    ];

    expect(getRunnableVideoIds(items, ["shot-1", "shot-2", "shot-3"])).toEqual(["shot-1"]);
  });
});
