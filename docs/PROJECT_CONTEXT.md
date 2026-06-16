# Agnes AI Studio

## Current Version

V2.9

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
- Production Pipeline
- V2.7 Production Dashboard
- V2.8 Production Hardening
- V2.9 Pipeline UX & Recovery Hardening
- V2.9 Pipeline Prompt Crash Fix
- V2.9 Production Queue Batch Image Fix
- V2.9 Production Queue Video Task Fix
- V2.9 Production Queue Control & Storage Fix
- V2.9 Storage Proxy Fallback Fix
- V2.9 Timeline Import Recovery Fix
- V2.9 Agnes Polling Rate-Limit Backoff Fix
- V2.9 Closed-Loop QA Gate
- V2.9 Timeline Playback Import Fix
- V2.9 Dev Startup Recovery Fix
- V2.9 Multi-Character Image Compositing
- V2.9 Video Duration Control
- V2.9 ProductionQueueItem videoDurationFrames
- V2.9 StoryboardPreview & CharacterImageSection Pipeline Refactor

---

## QA Status

- Build: passed with `next build`
- TypeScript: passed with `tsc --noEmit`
- Lint: passed through `eslint src` with existing warnings
- Unit Tests: production hardening, production queue, storage fallback, Agnes polling regressions, timeline playback import, and closed-loop QA gate regressions passed with 9 files / 76 tests in the latest local pass
- Browser QA: `http://localhost:3001` returned HTTP 200 after the dev server restart
- Export QA: JSON pipeline export downloaded and parsed successfully in the previous pass
- Closed-Loop QA: `agnes-creator` now has `npm run qa:closed-loop`, `npm run typecheck`, `npm run test:unit`, `npm run test:smoke`, and `npm run test:integration` script entry points. The closed-loop plan and report template live in `docs/QA_CLOSED_LOOP_PLAN.md` and `docs/QA_CLOSED_LOOP_REPORT_TEMPLATE.md`.
- Lint Gate: `npm run lint` now uses ESLint CLI (`eslint src`) instead of deprecated `next lint`; `npm run lint:report` can generate a JSON warning baseline.

---

## Core Workflow

Story -> Storyboard -> Prompt -> Image -> Image-to-Video -> Assets Library -> Video Editor -> Export

---

## Current Development Focus

V2.9 adds multi-character image compositing (see details below) and video duration control to the production pipeline.

Multi-character compositing: When a shot scene involves multiple characters, their generated reference images are automatically composited into a single image (horizontal layout) before being sent to the image-to-video API. This ensures visual consistency across all characters in the generated video. The compositing is handled by `src/lib/imageCompositor.ts`.

Video duration control: Each shot card in the production queue now has a duration selector with presets (3s/5s/8s/10s/18s) and custom input (1-30s). The selected duration is converted to `numFrames` (at 24fps) and passed directly to the Agnes Video V2.0 API. The per-shot duration is persisted in the production queue store via the `videoDurationFrames` field.

The old storyboard generator (text-to-storyboard AI) and CharacterDnaPanel have been removed from the pipeline page. The left panel now shows StoryboardPreview (reads from project scenes) and CharacterImageSection (generates character reference images). The sidebar no longer includes AI Story Studio and Storyboard Design menu items.
## Known Issues

1. Agnes service responses can still include 500 errors or remote task lookup failures. The client must keep image-to-video as the main workflow and use retry/recovery/pause rather than text-to-video fallback.
2. Historical ESLint warnings still need cleanup in V2.9.
3. `eslint src` still reports existing warnings unrelated to this startup fix.


