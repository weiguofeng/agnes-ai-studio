# API Documentation

> [中文](API.md) · [Architecture](ARCHITECTURE_EN.md) · [Deployment](DEPLOYMENT_EN.md)

## Overview
All API requests go through Next.js server proxy to avoid CORS/TLS issues.

## Proxy Routes
| Route | Target |
|-------|--------|
| /api/agnes/v1/text-to-image | apihub.agnes-ai.com/v1/text-to-image |
| /api/agnes/v1/image-to-image | apihub.agnes-ai.com/v1/image-to-image |
| /api/agnes/v1/videos | apihub.agnes-ai.com/v1/videos |
| /api/agnes/agnesapi | apihub.agnes-ai.com/agnesapi |
| /api/pipeline/download-image | Server download proxy |

## SDK Usage
```typescript
import { agnes } from "@/services/agnes";
// Text to image: agnes.image.generate()
// Image to image: agnes.image.edit()
// Image to video: agnes.video.createFromImageAndWait()
// Configure: agnes.configure()
```

## Video
- POST /v1/videos: Create task
- GET /agnesapi?video_id=<ID>: Query status

## Rate Limiting
Built-in PollRateLimiter. Create >=5s, Query >=12s, Burst 20s/3, 429 4x backoff.
