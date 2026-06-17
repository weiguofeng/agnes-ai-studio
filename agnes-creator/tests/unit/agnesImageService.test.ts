import { describe, expect, it } from "vitest";
import { createImageService } from "@/services/agnes/image";
import type { AgnesClient } from "@/services/agnes/client";

function createMockClient(config: ReturnType<AgnesClient["getConfig"]>) {
  const posts: Array<{ url: string; payload: unknown }> = [];
  const client = {
    getConfig: () => config,
    post: async (url: string, payload: unknown) => {
      posts.push({ url, payload });
      return { data: [{ url: "https://example.com/image.png" }], created: 1 };
    },
  } as unknown as AgnesClient;

  return { client, posts };
}

describe("createImageService", () => {
  it("keeps video models out of text-to-image generation payloads", async () => {
    const { client, posts } = createMockClient({
      apiKey: "test-key",
      baseUrl: "https://apihub.agnes-ai.com/v1",
      model: "agnes-video-v2.0",
      textToImageModel: "agnes-video-v2.0",
      imageToImageModel: "agnes-image-2.1-flash",
      textToVideoModel: "agnes-video-v2.0",
      imageToVideoModel: "agnes-video-v2.0",
    });

    await createImageService(client).generate({ prompt: "test", size: "1024x1024" });

    expect(posts[0].url).toBe("/images/generations");
    expect(posts[0].payload).toMatchObject({ model: "agnes-image-2.1-flash" });
  });

  it("falls back from registered models that do not support image generation", async () => {
    const { client, posts } = createMockClient({
      apiKey: "test-key",
      baseUrl: "https://apihub.agnes-ai.com/v1",
      model: "agnes-image-2.1-flash",
      textToImageModel: "agnes-2.0-flash",
      imageToImageModel: "agnes-image-2.1-flash",
      textToVideoModel: "agnes-video-v2.0",
      imageToVideoModel: "agnes-video-v2.0",
    });

    await createImageService(client).generate({ prompt: "test", size: "1024x1024" });

    expect(posts[0].payload).toMatchObject({ model: "agnes-image-2.1-flash" });
  });
});
