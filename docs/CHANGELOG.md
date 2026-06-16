## 2026-06-16

### Fixed

- **Pipeline batch video generation** — Three root causes addressed:
  1. useCallback closure captured stale project reference (dep project.id → project) — character images always appeared empty
  2. imageCompositor.ts loadImage failed due to CORS on Agnes CDN — images now downloaded via server proxy first
  3. createFromImage sent FormData/manual Content-Type without boundary — API returned 400. Now sends JSON POST with image URL(s) as the API requires

- **Agnes polling rate limits** — Added PollRateLimiter (max 2 concurrent), initial stagger (0-2000ms), ±30% jitter, 2.5x backoff on 429

- **client.ts postForm Content-Type** — Removed manual Content-Type: multipart/form-data header that was missing boundary parameter

### Changed

- **QueueCardView** — Removed all image generation UI (buttons, status badges, preview pane). Added character image thumbnails per shot. Now shows video preview only.

- **PromptInlineEditor** — Truncated prompt display (80 chars) by default with click-to-expand/edit behavior

- **BatchOperations** — Removed onBatchGenerateImages button and prop

- **handleGenerateVideo** — No longer downloads/composites images into blobs. Passes character image URL(s) directly to API as JSON

- **createFromImage** (ideo.ts) — Rewrote to send JSON POST with image URL string/array instead of FormData/base64

- **ImageToVideoParams type** — image field now accepts File | Blob | string | string[] for backwards compatibility

### Removed

- Image generation from production queue (no more handleGenerateImage, image status/buttons, image preview pane)
- Blob download and composite logic from handleGenerateVideo
- Duplicate const prompt / const numFrames declarations in page.tsx

### Verification

- 
pm run build — Compiled successfully, all 23 pages
- Pipeline page bundle size reduced from 20.2 kB to 17.9 kB
