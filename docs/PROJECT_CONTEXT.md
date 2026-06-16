# Agnes AI Studio

## Current Version

V2.8.1

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
- V2.8.1 Pipeline UX & Recovery Hardening
- V2.8.1 Pipeline Prompt Crash Fix
- V2.8.1 Production Queue Batch Image Fix
- V2.8.1 Production Queue Video Task Fix
- V2.8.1 Production Queue Control & Storage Fix
- V2.8.1 Storage Proxy Fallback Fix
- V2.8.1 Timeline Import Recovery Fix
- V2.8.1 Agnes Polling Rate-Limit Backoff Fix
- V2.8.1 Closed-Loop QA Gate
- V2.8.1 Timeline Playback Import Fix
- V2.8.1 Dev Startup Recovery Fix

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

V2.8.1 Pipeline UX & Recovery Hardening now includes the storage proxy fallback, timeline import recovery, Agnes polling rate-limit backoff, closed-loop QA gate, and timeline playback import hardening for the story-to-export workflow.

Storage persistence falls back to the server download proxy when direct browser fetch of remote Agnes/CDN URLs fails because of CORS, URL policy, or signed URL access behavior. Timeline import now creates or reuses a project-scoped editor timeline for the selected project instead of importing into another active project's timeline. Before writing video clips to the editor timeline, the pipeline localizes remote Agnes/CDN image and video URLs into playable Blob URLs via the asset store when possible, while preserving the original remote URLs in clip metadata.

Agnes video polling detects 429 / rate-limit responses and backs off more aggressively while keeping the image-to-video task active. The production queue only returns pending image-to-video candidates when image generation is completed and a real image URL exists.

Closed-loop QA now separates build and lint responsibilities: Next build compiles and generates types, while ESLint CLI enforces source linting and can write a JSON warning baseline.

The dev server startup path was also hardened after a syntax break in task rendering components prevented `next dev` from staying reachable.

---

## Known Issues

1. Agnes service responses can still include 500 errors or remote task lookup failures. The client must keep image-to-video as the main workflow and use retry/recovery/pause rather than text-to-video fallback.
2. Historical ESLint warnings still need cleanup in V2.9.
3. `eslint src` still reports existing warnings unrelated to this startup fix.
