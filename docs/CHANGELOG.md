# Changelog

## 2026-06-16

### Fixed

- Restored the image-to-video task rendering path by replacing broken truncated strings in `src/components/generation/TaskCard.tsx`, `src/components/shared/TaskList.tsx`, and `src/app/image-to-video/page.tsx`.
- Confirmed the dev server now stays reachable at `http://localhost:3001` and returns HTTP 200 after restart.
- Verified `tsc --noEmit` and `eslint src` complete successfully; ESLint still reports pre-existing warnings only.

### Verification

- `D:\node\node.exe .\node_modules\next\dist\bin\next build` passed.
- `D:\node\node.exe .\node_modules\typescript\bin\tsc --noEmit` passed.
- `D:\node\node.exe .\node_modules\eslint\bin\eslint.js src` passed with existing warnings.
- `Invoke-WebRequest http://localhost:3001` returned `200`.

## V2.8.1 Timeline Playback Import Fix (2026-06-15)

### Fixed

- Pipeline timeline import now reuses only timelines that belong to the selected project, avoiding imports into another project's active timeline.
- Pipeline timeline import localizes remote Agnes/CDN image and video URLs into Blob URLs through the asset store before adding editor clips, while preserving original remote URLs in clip metadata.
- Editor video preview no longer sets `crossOrigin="anonymous"` by default, avoiding unnecessary CORS requirements for ordinary playback.

### Tests

- `npm.cmd run test:unit -- tests/unit/closedLoopQa.test.ts tests/unit/productionHardening.test.ts` passed with 9 files and 76 tests.
- `npx.cmd tsc --noEmit` passed.

## V2.8.1 Closed-Loop QA Gate (2026-06-15)

### Added

- Added `npm run typecheck`, `npm run test`, `npm run test:unit`, `npm run test:smoke`, `npm run test:integration`, and `npm run qa:closed-loop` script entry points.
- Added `npm run lint:report` to generate a JSON ESLint warning baseline at `tests/reports/eslint-report.json`.
- Added `docs/QA_CLOSED_LOOP_PLAN.md` for story -> storyboard -> prompt -> image -> image-to-video -> assets -> editor -> export validation.
- Added `docs/QA_CLOSED_LOOP_REPORT_TEMPLATE.md` for repeatable QA reporting.
- Added closed-loop unit regressions for image-to-video candidate filtering, project-scoped timeline import, and export JSON completeness.

### Fixed

- Production queue pending video candidates now require both `imageStatus=completed` and a real `imageResultUrl`, preventing image-to-video work from starting without an image source.
- Migrated the lint gate from deprecated `next lint` to ESLint CLI (`eslint src`), avoiding Next CLI deprecation output and generated `next-env.d.ts` false errors.
- Disabled Next build's built-in lint phase so `npm run build` only builds and the dedicated ESLint CLI gate owns lint validation.

### Tests

- `npm.cmd run test:unit` passed with 9 files and 74 tests.
- Initial `npx.cmd tsc --noEmit` before build failed because clean `.next/types/**/*.ts` files had not been generated yet.
- `npm.cmd run build` passed with existing lint warnings.
- `npx.cmd tsc --noEmit` passed after build generated Next type files.
- `npm.cmd run lint` passed with existing warnings.
- `npm.cmd run qa:closed-loop` passed end-to-end after script order was corrected.

## V2.8.1 Pipeline Recovery Fixes (2026-06-15)

### Fixed

- Pipeline timeline import now creates a project-scoped editor timeline when no active timeline exists, avoiding silent no-op imports after video generation.
- Agnes video polling now treats 429 / rate-limit responses as recoverable polling pressure and backs off more aggressively without switching away from image-to-video.
- `StorageService.saveAssetFromUrl` retries remote Agnes/CDN asset persistence through the existing server download proxy when direct browser `fetch` fails.

### Tests

- `npx.cmd vitest run tests/unit/productionHardening.test.ts tests/unit/productionQueueVideoWorkflow.test.ts` passed with 16 tests.
- `npx.cmd vitest run tests/unit/productionHardening.test.ts tests/unit/productionQueueStore.test.ts tests/unit/productionQueueVideoWorkflow.test.ts tests/unit/productionQueueBatchImage.test.ts tests/unit/productionPipelineHardening.test.ts` passed with 38 tests.
- `npx.cmd tsc --noEmit` passed.
- `npm.cmd run build` passed with existing lint warnings.
- `npm.cmd run lint` passed with existing warnings.

## V2.8.1 Storage Proxy Fallback (2026-06-15)

### Fixed

- `StorageService.saveAssetFromUrl` now retries remote Agnes/CDN asset persistence through the existing server download proxy when direct browser `fetch` fails.
- This addresses CORS, signed URL policy, and browser remote URL access failures during asset persistence without switching away from the image-to-video main workflow.
- Pipeline JSON export was verified by downloading and parsing an exported project file.

### Tests

- `npx.cmd vitest run tests/unit/productionHardening.test.ts` passed, including the new proxy fallback regression.
- `npx.cmd tsc --noEmit` passed.
- `npm.cmd run build` passed with existing lint warnings.
- `npm.cmd run lint` passed with existing warnings.

## V2.8.1 (2026-06-14)

### Fixed

- Production queue video polling prefers real Agnes `video_id` and avoids querying `/agnesapi?video_id=task_*`.
- Batch pause / terminate cancels selected local polling and live task state.
- Production queue prompt completeness and batch image/video generation were hardened.
- Storage monitor project-level statistics were corrected.
- Project story script recovery was restored.

### Added

- Production queue regression tests for prompt completeness, video runnable filtering, image prompt selection, video ID polling, batch termination, and storage statistics.

### QA

- Unit tests passed.
- TypeScript passed.
- Lint passed with existing warnings.
- Build passed with existing warnings.
