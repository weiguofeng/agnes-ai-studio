# Agnes AI Studio

## Current Version

V3.2

---

## Project Positioning

Agnes AI Studio is an AI video production platform. The target pipeline is:

Character -> Project -> Pipeline -> Generate Character Images -> Batch Generate Videos -> Assets Library (auto-save) -> Video Editor -> Export

The old "Story -> Storyboard -> Prompt -> Image" flow has been removed. Stories are imported from external LLMs as storyboards directly into projects.

---

## Completed Modules

- Prompt Workflow
- Character Library
- Project Management
- Storyboard Builder
- Assets Library (Zustand persist + IndexedDB dual storage)
- Video Editor
- AI Story Studio
- Agnes Video V2.0 Integration
- Internationalization System (zh-CN / en-US)
- API Key Management
- Production Pipeline (V3.1)
- Pipeline Rate Limiting & CORS Handling
- Multi-Character Video Generation

---

## QA Status

- Build: passed with `npm run build`
- All 23 pages compile successfully

---

## Current State (V3.2)

### Production Pipeline Architecture

The pipeline page (`/pipeline`) is the main production interface. Two-column layout:

**Left Column:** StoryboardPreview + CharacterImageSection
**Right Column:** StatisticsPanel, CurrentTasksWidget, ProductionQueuePanel, StorageMonitor, ProjectExportPanel

### Layout & Navigation

- **Removed:** ProductionModeToggle (formal/draft mode toggle from page header)
- **Removed:** TimelineImport component and all its logic (importAll, importLocked, importScene, importShot handlers, BatchOperations import timeline button)
- **Removed:** Image generation from production queue (no handleGenerateImage, no image status/buttons)

### StatisticsPanel

Shows: total shots, total scenes, videos completed, failed count, pending count, success rate, average duration (minutes), estimated remaining (minutes, calculated as remaining Ã— 2 min per video).

- **Removed:** imagesCompleted stat (no longer relevant)
- **Fixed:** avgDuration now uses videoCompletedAt - videoStartedAt, displayed in minutes
- **Fixed:** estimatedRemaining uses fixed rate of ~2 min per 5-second video
- **Fixed:** pendingCount only counts video status (not image)

### CurrentTasksWidget

Shows active pipeline video tasks with animated progress bars.

- **Filtered**: Only shows tasks with id starting with "pipeline-video-" (excludes other page tasks)
- **Auto-cleanup**: When all pipeline tasks complete, removed from store after 3 seconds
- **Dynamic progress**: Processing tasks show percentage bar, queued/submitted show animated indeterminate bar
- **Hides completely**: When no active or failed tasks, returns null

### ProductionQueuePanel

**Video generation flow:**
1. Shots loaded from project scenes via "Load to Queue"
2. Character images generated in CharacterImageSection â†?stored in `project.characterImages`
3. User selects shots â†?"Batch Generate Videos"
4. `hasVideoSourceImage` checks each shot has character images
5. `handleGenerateVideo` calls `agnes.video.createFromImage()`:
   - Single character: `"image": "url"`
   - Multi character: `"extra_body": { "image": ["url1", "url2"] }`
   - Uses JSON POST to `POST /v1/videos` (not FormData)
   - Character image URLs passed directly (API fetches server-side)
6. Polls via `/agnesapi?video_id=<ID>` with global rate limiter
7. On completion: video URL stored in queue, auto-saved to asset library AND synced to assetStore

**Video duration:** 3s/5s/8s/10s/18s presets + custom. Uses API-valid `num_frames` (%8==1):
- 3s: 81 frames
- 5s: 121 frames
- 8s: 193 frames
- 10s: 241 frames
- 18s: 441 frames

**QueueCardView features:** Character image thumbnails per shot, truncated prompt display with expand/edit, video duration selector, video status badge, lock/unlock/regenerate/delete actions, batch operations.

### Rate Limiting (video.ts)

Three-layer rate limiting for Agnes API calls:

1. **Mutex queue** â€?Promise-chain mutex serializes all concurrent acquire() calls
2. **Interval limiting** â€?Query: 12000ms between requests (~5 RPM). Create: 5000ms between POST
3. **Sliding window** â€?Max 3 queries per 20s window; waits when approaching limit

Poll defaults: interval=15000ms, maxInterval=60000ms, 429 backoff=4x, error backoff=2x

### Video CORS Handling

- `StorageService.saveAssetFromUrl` for videos: directly uses server proxy (`/api/pipeline/download-image`), skips browser fetch (video CDNs have no CORS headers)
- Download proxy updated to accept `video/mp4`, `video/webm`, `video/quicktime` content types

### Asset Library (V3.2 Unified System)

**Architecture: IndexedDB stores blobs, Zustand stores lightweight indexes (memory-safe)**
- **Binary data**: Stored in IndexedDB via `AssetsDB` (images/videos/thumbnails stores + metadata index)
- **Index layer**: `useUnifiedAssetStore` (Zustand + persist) stores only `AssetIndex` objects (id, name, type, tags, projectId, characterId, timestamps) ¡ª no blob data
- **Memory safety**: blob URLs created on-demand via `useAssetBlob` hook, auto-revoked on component unmount. Only visible cards (~30) hold blob URLs at any time
- **Lazy loading**: Assets page uses IntersectionObserver to load blobs from IndexedDB only when cards scroll into viewport (300px margin)

**Assets page** (`/assets`):
- Filter by: type (all/image/video), project name, character name, tags
- Search: by name, project name, character name, tags
- Sort: favorites-first, by createdAt/name/fileSize (asc/desc)
- Preview: click to open dialog with metadata, download button
- Batch operations: multi-select delete (cascades to IndexedDB + store)
- Refresh: manual sync from IndexedDB

**Auto-save pipeline integration:**
- Character images: generated in CharacterImageSection -> saved to IndexedDB via `StorageService.saveAssetFromUrl` -> synced to `useUnifiedAssetStore`
- Videos: completed in pipeline -> saved to IndexedDB via `StorageService.saveAssetFromUrl` -> synced to `useUnifiedAssetStore`
- Old `useAssetStore` deprecated ¡ª no longer imported by any component
### Character Image Handling

- Images stored in `project.characterImages` (Record<string, charId â†?url>)
- Generated via CharacterImageSection â†?Agnes Image API
- On generation: auto-saved to StorageService + synced to useAssetStore
- Character reference images from character library shown in section
- Prompt editor with regenerable prompt and size selection

### API Integration

- `POST /v1/videos` â€?Creates video task (JSON, image URL not file)
- `GET /agnesapi?video_id=<ID>` â€?Query result (recommended)
- `GET /v1/videos/{task_id}` â€?Legacy query
- Model: `agnes-video-v2.0`
- Default frame_rate: 24
- Valid num_frames: >= 49 && num_frames % 8 == 1

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/pipeline/page.tsx` | Main pipeline page |
| `src/services/agnes/video.ts` | Video API service + rate limiter |
| `src/services/agnes/client.ts` | HTTP client + config |
| `src/services/StorageService.ts` | IndexedDB asset storage |
| `src/components/pipeline/StatisticsPanel.tsx` | Production statistics |
| `src/components/pipeline/CurrentTasksWidget.tsx` | Live task progress |
| `src/components/pipeline/QueueCardView.tsx` | Queue item cards |
| `src/components/pipeline/CharacterImageSection.tsx` | Character image generation |
| `src/components/pipeline/StoryboardPreview.tsx` | Storyboard preview |
| `src/stores/productionQueueStore.ts` | Queue state + batch stats |
| `src/stores/taskStore.ts` | Task state + poll scheduler |
| `src/lib/imageCompositor.ts` | Video duration presets |

---

## Known Issues

1. **Character CDN images (platform-outputs.agnes-ai.space)** lack CORS headers. Browser-side canvas operations require server proxy fallback. Handled in `imageCompositor.ts` via `/api/pipeline/download-image`.
2. **Video CDN (platform-outputs.agnes-ai.space)** also lacks CORS headers. `StorageService` uses proxy for all video downloads.
3. **Blob URLs expire on page refresh.** `StorageService.refreshAssetUrl()` recreates them from IndexedDB on load.
4. **429 rate limits on /agnesapi.** Mutex + sliding window + conservative intervals in place. May need adjustment if API limits change.

