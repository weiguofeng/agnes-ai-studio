# API Documentation

## Overview

The application integrates with the Agnes AI API through a Next.js proxy layer. All requests are routed through `/api/agnes/[...path]` to handle authentication, CORS, and URL normalization.

## API Proxy

Route: `/api/agnes/[...path]/route.ts`

The proxy forwards requests to `apihub.agnes-ai.com`:

- Extracts API key from `X-Agnes-API-Key` header or environment variables
- Normalizes base URL (only allows `apihub.agnes-ai.com`)
- 120s timeout for upstream requests
- Passes through HTTP status codes from upstream
- Logs errors to server console

## Image Generation

### Text-to-Image

```typescript
import { agnes } from "@/services/agnes";

const images = await agnes.image.generate({
  prompt: "a cat",
  size: "1024x1024",
  n: 1,
  model: "agnes-image-2.1-flash",
  // Optional params (forwarded from hook):
  seed: 42,
  steps: 20,
  guidance_scale: 7.5,
  negative_prompt: "blurry, low quality",
});
// Returns: ImageResult[] = [{ url: "...", revisedPrompt: "..." }]
```

Endpoint: `POST /v1/images/generations`

### Image-to-Image

```typescript
const images = await agnes.image.edit({
  image: file,  // File or Blob
  prompt: "make it a painting",
  size: "1792x1024",
  model: "agnes-image-2.1-flash",
});
```

Uses `extra_body.image` with base64 data URI for the source image.

## Video Generation

### Image-to-Video

```typescript
const videoTask = await agnes.video.createFromImage({
  image: imageUrl,        // string URL or File
  prompt: "slow motion",
  model: "agnes-video-v2.0",
  width: 1280,
  height: 720,
  numFrames: 121,         // ~5s at 24fps
  frameRate: 24,
  negativePrompt: "blurry",
});

// Poll for results:
const result = await agnes.video.poll(videoTask.taskId, {
  interval: 15000,
  maxInterval: 60000,
  timeout: 600000,
  onProgress: (progress) => console.log(progress.progress + "%"),
});
// Returns: VideoResult = { url: "...", duration: ... }
```

Endpoint: `POST /v1/videos`

### Status Query

```typescript
const progress = await agnes.video.getProgress(taskId);
// Returns: { status: "processing"|"completed"|"failed", progress: 50, result?: { url: "..." } }
```

Endpoint: `GET /agnesapi?video_id=<taskId>`

## Video Duration Reference

| Duration | num_frames | frame_rate |
|----------|-----------|------------|
| ~3s | 81 | 24 |
| ~5s | 121 | 24 |
| ~10s | 241 | 24 |
| ~18s | 441 | 24 |

## Rate Limiting

The SDK implements a three-layer rate limiter:

1. **Mutex queue**: Serializes concurrent API calls
2. **Interval control**: 5s between creates, 12s between queries
3. **Sliding window**: Max 3 queries per 20-second window

On 429 response: automatic 4x backoff, up to maxInterval (60s).
