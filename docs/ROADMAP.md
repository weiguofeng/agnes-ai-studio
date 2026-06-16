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

## V2.8.1 (Completed)

### Pipeline UX & Recovery Hardening

- Image-to-video task flow requires real video URL before completion
- zh-CN / en-US copy completed for homepage, recovery center, cleanup confirmation, and video error states
- StorageMonitor safe cleanup UI completed
- AppShell / Sidebar / Pipeline responsive layout improved
- QueueCardView image/video lock, unlock, and delete actions completed
- PromptInlineEditor empty-history selector crash fixed
- PromptPack generation supports legacy shot data
- Scene and shot IDs stay consistent during pipeline generation
- Production queue batch image generation fixed
- Production queue batch image-to-video fixed
- Production queue prompt completeness fixed
- Agnes video polling prefers `video_id`
- Batch pause / terminate cancels local polling and live task status
- Storage monitor project-level statistics fixed
- Project story script recovery fixed
- StorageService remote asset persistence now falls back to the server download proxy when direct browser fetch fails
- Timeline import creates a project-scoped editor timeline when no active timeline exists
- Timeline import reuses only timelines belonging to the selected project
- Timeline import localizes remote video/image URLs into playable Blob URLs before adding clips
- Editor video playback no longer requires CORS by default for ordinary video preview
- Agnes video polling handles 429 / rate-limit responses with stronger backoff instead of failing the task
- Closed-loop QA scripts, test plan, report template, and regression coverage added for story-to-export quality gates
- Pending image-to-video queue candidates now require a completed image and real image URL
- Lint gate migrated from deprecated `next lint` to ESLint CLI for source files
- ESLint JSON report script added for warning baseline tracking
- Next build lint phase disabled so build and lint gates stay separate

---

## V2.9

### Quality Gate Cleanup

- Clean historical ESLint warnings and enforce warning baseline tracking
- Add i18n key annotation and hardcoded UI string scanning
- Add mock E2E coverage for image-to-video create -> poll -> complete
- Add Playwright mobile checks for no horizontal overflow
- Add Playwright regression for production pipeline story generation and queue rendering
- Add Agnes 404 / task-not-found end-to-end recovery checks
- Add full browser regression for timeline import into a newly created editor timeline
- Automate closed-loop report generation from local QA command output
- Document dev startup recovery and related accessibility verification

---

## V3.0

### Story To Final Video

Target: input story -> automatically generate characters, storyboard, prompts, images, videos, subtitles, cover, and final video.

Key areas:

- AI subtitle generation
- Cloud task scheduling
- Multi-project queue
- Service Worker cache
- Asset deduplication
