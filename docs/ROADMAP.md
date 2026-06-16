# Agnes AI Studio Roadmap

## V2.4 (Completed)

### Character Consistency Pipeline

- Character DNA, reference, and lock support
- Batch video generation and production queue
- URL diagnostics, server proxy, and retry strategy

---

## V2.5

### Automation

- Automatic image generation
- Automatic video generation
- Automatic subtitle generation
- Automatic cover generation

---

## V2.6

### AI Production Studio

- One-click full project generation
- Batch project production
- Multi-project queue
- Cloud task scheduling

---

## V2.7 (Completed)

### Production Dashboard Upgrade

- Dual-column layout, statistics panel, shot cards, prompt editor
- Asset preview, batch actions, timeline import, storage monitor, production mode, live tasks

---

## V2.8 (Completed)

### Production Hardening

- Auto-save system
- Prompt history persistence
- Permanent asset Blob storage
- Asset integrity checks
- Safe cleanup flow
- Project backup and restore
- Recovery center
- IndexedDB optimization
- Unit tests

---

## V2.9 (Completed)

### Pipeline UX & Recovery Hardening

- Full zh-CN / en-US copy coverage
- StorageMonitor safe cleanup UI
- QueueCardView lock/unlock/delete actions
- PromptInlineEditor crash fixes
- Production queue batch operations fixed
- Agnes polling 429/rate-limit backoff
- Closed-loop QA scripts and regression tests

---

## V3.0 (Completed)

### Pipeline Queue Refactoring

- Removed image generation from production queue
- Multi-character image compositing for video generation
- Video duration control (3s/5s/8s/10s/18s/custom)
- Fixed CORS: server proxy for image/video download
- Fixed API: JSON POST with image URLs (not FormData)
- Fixed polling rate limits: PollRateLimiter + jitter + stagger
- Fixed useCallback stale closure
- Fixed postForm Content-Type boundary
- Removed old AI Story Studio and Storyboard Design menus
- Fixed video duration presets (valid num_frames %8==1)

---

## V3.1 (Completed)

### Pipeline Statistics & UI Optimization

- **StatisticsPanel**: Removed imagesCompleted stat, fixed avgDuration (minutes), fixed estimatedRemaining (2 min/video)
- **CurrentTasksWidget**: Filtered to pipeline-only tasks, added animated progress bars, auto-hide on completion
- **TimelineImport**: Deleted component + all related logic + BatchOperations import button
- **ProductionModeToggle**: Removed from page header
- **Rate limiting**: Mutex-based PollRateLimiter, sliding window (3/20s), increased intervals (12s query, 15s poll)
- **Asset library sync**: Pipeline saves (character images + videos) auto-synced to useAssetStore for /assets page
- **Asset library enhancement**: Time sorting, date range filtering, project tag filtering, cascade delete
- **Character images**: Auto-save to StorageService + sync to useAssetStore on generation
- **Video save**: Error logging added (no longer silent catch), dual write to StorageService + useAssetStore

---

## V3.2 (Current)

### Unified Asset System (Memory-Safe)

- **Index/blob separation**: IndexedDB stores binary blobs, Zustand stores lightweight AssetIndex metadata (no blobs in store)
- **Memory safety**: Blob URLs created on-demand via useAssetBlob hook, auto-revoked on component unmount
- **Lazy loading**: Assets page uses IntersectionObserver to load blobs only when cards are visible
- **Multi-dimension filtering**: Type, project name, character name, tags, search, sort
- **Preview dialog**: Image/video preview with metadata and download
- **Pipeline auto-save**: Character images + videos auto-saved to IndexedDB and synced to unified store
- **Deprecated**: Old useAssetStore replaced by useUnifiedAssetStore

---
## Future Plans

### V3.3

- Multi-model support for video generation
- Queue reorder and drag-and-drop
- Character image gallery in pipeline
- Storyboard detail page improvements

### V3.4

- Cloud task scheduling
- Multi-project queue
- One-click full project generation
- Export queue as timeline presets

### V3.5

- Subtitle auto-generation
- Cover auto-generation
- Batch project production across multiple projects

