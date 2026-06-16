# Agnes AI Studio

## Current Version

V3.0

---

## Project Positioning

Agnes AI Studio is an AI video production platform. The target pipeline is:

Story -> Storyboard -> Prompt -> Image -> Image-to-Video -> Assets Library -> Video Editor -> Export

---

## Completed Modules

- Prompt Workflow
- Character Library
- Project Management
- Storyboard Builder
- Assets Library
- Video Editor
- AI Story Studio
- Agnes Video Integration
- Internationalization System
- API Key Management
- QA Testing
- Production Pipeline (V2.7+)
- V2.8 Production Hardening
- V2.9 Pipeline UX & Recovery Hardening
- V3.0 Pipeline Queue Refactoring (see current state)

---

## QA Status

- Build: passed with `npm run build`
- All 23 pages compile successfully

---

## Current State (V3.0)

### Production Pipeline Architecture

The pipeline page (`/pipeline`) is the main production interface. It has a two-column layout:

**Left Column:** StoryboardPreview + CharacterImageSection
**Right Column:** StatisticsPanel, CurrentTasksWidget, ProductionQueuePanel, StorageMonitor, ProjectExportPanel

### Production Queue

The queue focuses **only on video generation**. Image generation has been removed from the queue.

**QueueCardView features:**
- Video preview only (full-width, no side-by-side image preview)
- Character image thumbnails per shot (clickable for full preview)
- Truncated prompt display with click-to-expand editing
- Video duration selector (3s/5s/8s/10s/18s/custom)
- Video status badge, lock/unlock, regenerate, delete actions
- Batch operations (generate videos, pause, resume, delete, lock)

### Video Generation Flow

1. Shots are loaded from project scenes via "Load to Queue" button
2. Character reference images are generated in CharacterImageSection (stored in `project.characterImages`)
3. User selects shots and clicks "Batch Generate Videos"
4. `hasVideoSourceImage` checks if each shot has either legacy `imageResultUrl` or character image URLs
5. `handleGenerateVideo` creates video via Agnes API:
   - **Single character:** passes image URL as `"image": "url"` (string)
   - **Multi character:** passes image URLs as `"extra_body": { "image": ["url1", "url2"] }` (array)
   - Uses JSON POST (not FormData) to `POST /v1/videos`
   - The API server fetches images from URLs directly (no CORS issues)
6. Result is polled via `/agnesapi?video_id=<ID>` with rate limiting

### Rate Limiting (video.ts)

- `PollRateLimiter`: max 2 concurrent /agnesapi queries
- Initial stagger: random 0-2000ms before first poll
- Jitter: ±30% random on each poll interval
- 429 backoff: interval × 2.5 on rate limit
- Default interval: 4000ms, max: 30000ms

### API Integration

- `createFromImage` sends JSON POST with image URL(s) - NOT FormData/file upload
- `client.ts` `postForm` no longer sets `Content-Type` header manually (fixes missing boundary)
- Image-to-video and text-to-video use the same endpoint `/v1/videos`
- Model: `agnes-video-v2.0`

### Character Image Handling

- Character images are stored in `project.characterImages` (Record<string, string>)
- Generated from CharacterImageSection via Agnes Image API
- Images are hosted on Agnes CDN (no CORS headers)
- For display/preview, images are loaded directly (CORS error handled gracefully)
- For video generation, URLs are passed to Agnes API which fetches them server-side

### Known Issues

1. Character CDN images lack CORS headers - browser-side canvas operations (compositeImages) require server proxy fallback. This is handled by downloading via `/api/pipeline/download-image` before compositing.
2. Legacy `imageResultUrl` field may still exist on queue items from old sessions but is no longer the primary image source.
