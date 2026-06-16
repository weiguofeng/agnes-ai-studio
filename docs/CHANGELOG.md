## 2026-06-16 (V3.1)

### Fixed

- **429 rate limit during batch video generation** — Three fixes applied:
  1. PollRateLimiter rewritten with Promise-chain mutex to eliminate race conditions (concurrent acquire() calls could all pass through)
  2. Added sliding window rate tracking (max 3 queries per 20s) — self-throttles before hitting API limit
  3. Increased all intervals: query 3000→12000ms, create 2500→3000ms, poll 5000→15000ms, batch stagger 3000→6000ms, 429 backoff 2.5x→4x
  4. Removed initial stagger (redundant with 15s poll interval)

- **10s video duration 400 Bad Request** — Preset frames values corrected to match API requirement (num_frames % 8 == 1):
  - 3s: 72→81, 8s: 192→193, 10s: 240→241, 18s: 432→441
  - `secondsToFrames()` rewritten to round to nearest valid value

- **Video download CORS error** — StorageService now uses server proxy for all video downloads (CDN has no CORS headers)
- **Download proxy updated** to accept `video/mp4`, `video/webm` content types

### Changed

- **StatisticsPanel**: Removed imagesCompleted stat. avgDuration now uses video timing, displayed in minutes. estimatedRemaining uses fixed 2 min/video rate.
- **CurrentTasksWidget**: Filters to pipeline-only tasks (id starts with "pipeline-video-"). Added animated progress bars. Auto-hides when no active/failed tasks. Auto-cleanup after 3s completion.
- **ProductionModeToggle**: Removed from page header
- **TimelineImport**: Component + all handlers + BatchOperations import button deleted
- **handleBatchImportTimeline**: Removed from page.tsx, BatchOperations, and all references
- **CharacterImageSection**: Auto-saves generated images to StorageService + syncs to useAssetStore
- **Pipeline video save**: Added error logging (no longer silent catch). Added sync to useAssetStore.
- **Asset browser (/asset-browser)**: Added time sorting (newest/oldest), date range filter (today/week/month), project tag filter. Fixed blob URL refresh on page load.

### Added

- `StorageService.refreshAssetUrl()` — Recreates blob URLs from IndexedDB blobs after page refresh
- Pipeline video and character image assets synced to `/assets` page via `useAssetStore.addAsset()`

### Documentation

- PROJECT_CONTEXT.md: Updated to V3.1 with full current state
- ROADMAP.md: Updated with V3.1 completed section and future plans
- CHANGELOG.md: This entry

### Verification

- `npm run build` — Compiled successfully, all 23 pages
- Pipeline page bundle: 20.3 kB
- Asset browser: 4.43 kB
- `/assets` page: 5.52 kB
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
## 2026-06-16 (V3.2)

### Added

- **Unified Asset System (V3.2)** — Memory-safe asset management with index/blob separation:

  - **New type**: `src/types/asset.ts` — `AssetIndex` (lightweight metadata) + `AssetFilter` (multi-dimension query)
  - **New store**: `src/stores/unifiedAssetStore.ts` — Zustand store with `persist`, stores only index data (no blobs). Supports search, filter by project/character/type/tag, sort by name/size/date, favorites-first
  - **New hook**: `src/hooks/useAssetBlob.ts` — On-demand blob loading from IndexedDB with auto-revoke on unmount. `useAssetBlob(record)` returns blob URL while component is mounted. `useAssetBlobMap(records)` batch loads multiple assets
  - **Auto-sync**: Pipeline-generated character images and videos auto-saved to IndexedDB via `StorageService` and synced to `useUnifiedAssetStore`

- **Redesigned Assets Page** (`/assets`):
  - Lazy-loaded grid with IntersectionObserver (loads blob from IndexedDB only when visible, revokes on scroll-away)
  - Filter by type (all/image/video), project name, character name, tags
  - Preview dialog with image/video display, metadata, and download button
  - Favorite toggle, batch delete, manual refresh

### Changed

- **Pipeline page**: Old `useAssetStore` replaced with `useUnifiedAssetStore` for syncing video assets
- **CharacterImageSection**: Generated character images now auto-saved to IndexedDB via `StorageService.saveAssetFromUrl` and synced to `useUnifiedAssetStore`

### Deprecated

- `src/stores/assetStore.ts` — No longer imported by any component. Kept for backward compatibility, but all new code should use `useUnifiedAssetStore`

### Verification

- `npm run build` — Compiled successfully, all 23 pages
- `/assets` page: 8.47 kB (includes lazy loading, preview, filters)
- Pipeline page: 19.4 kB
- No memory leaks: blob URLs created on-demand and revoked on component unmount
