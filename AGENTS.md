# Agnes AI Studio - Agent Instructions

## 项目说明

项目名称：Agnes AI Studio

项目目标：构建 AI 视频生产流水线

角色 -> 项目 -> 流水线 -> 生成角色图 -> 批量生成视频 -> 素材资源库 -> 任务中心 -> 视频编辑器 -> 导出

---

## Read First

开始任何任务前，请优先阅读：

- docs/PROJECT_CONTEXT.md
- docs/ROADMAP.md
- docs/CHANGELOG.md

---

# 核心原则

## Rule 1: Character Consistency First
角色一致性优先级高于任务成功率。
- 禁止：图生视频失败后自动切换文生视频
- 允许：Retry, Recovery, Pause Queue, Human Review
- 禁止：Silent Downgrade

## Rule 2: Root Cause First
优先寻找根因，禁止使用临时绕过方案。
- 必须输出：Root Cause, Solution, Verification

## Rule 3: Pipeline Stability First
优先级：Character Consistency > Pipeline Stability > Error Recovery > Performance > New Features

## Rule 4: Internationalization Required
所有新增UI必须支持 zh-CN 和 en-US，禁止硬编码文本。

## Rule 5: Task Failure Policy
任务失败时优先：Retry, Resume, Pause
禁止：Silent Failure, Silent Fallback, Data Loss

## Video Generation Rules
图生视频是主工作流。失败时必须分析：CORS, URL Expiration, CDN Failure, Network Issue, Agnes API Issue
禁止自动切换文生视频。

## QA Rules
完成任务前必须执行：npm run build，输出测试结果。

---

## Documentation Rules

### 文档必须包含中文注释
所有文档文件必须包含适当的中文注释，便于新会话理解项目上下文。

要求：
- docs/CHANGELOG.md -- 每个版本节点前加中文注释说明
- docs/PROJECT_CONTEXT.md -- 每个章节前加中文注释
- docs/ROADMAP.md -- 每个版本区块前加中文注释

### 行数限制（不超过500行，不含中文注释行）
- AGENTS.md: 不超过500行
- docs/CHANGELOG.md: 不超过500行
- docs/PROJECT_CONTEXT.md: 不超过500行
- docs/ROADMAP.md: 不超过500行

注释行定义为：以 "#" 或 "<!--" 开头，或单独成行的纯注释内容。

---

# Project State Snapshot (2026-06-17 V3.2 Hotfix 3 (2026-06-18))

## Current Version: V3.2 Hotfix 3

## Architecture Overview

### Data Flow
Character -> Project (scenes + shots) -> Pipeline -> CharacterImageSection generates character images -> ProductionQueue generates videos -> Assets Library (IndexedDB) + Task Center

### Pipeline Page (/pipeline)
- Left column: StoryboardPreview + CharacterImageSection
- Right column: StatisticsPanel + CurrentTasksWidget(projectId) + ProductionQueuePanel + StorageMonitor

### Character Image Section (CharacterImageSection.tsx)
- Default size: 9:16 HD (1024x1792)
- Reference images deduplicated via new Set()
- Prompt editor: editable prompt + size selector (bg-background/80)
- Preview: click for full-size modal, download + save buttons
- No auto-save -> user must click save to IndexedDB

### Video Generation (handleGenerateVideo)
1. Clears old pipeline tasks for same shot before creating new ones
2. Checks hasVideoSourceImage(sid) -> character images or legacy imageResultUrl
3. Creates task in useTaskStore with prefix pipeline-video-{shotId}-{timestamp}
4. Calls agnes.video.createFromImage() -> POST /v1/videos with image URL(s)
5. Polls via agnes.video.poll() -> /agnesapi?video_id=<ID> (own polling, not PollScheduler)
6. On completion: saves to asset library and syncs to unified store

### Batch Generation (handleBatchGenerateVideos)
- Clears all pipeline tasks, aborts in-flight polls (videoAbortControllers)
- Resets processingVideos Set, staggers each generation by 6s
- Clears pipeline tasks to prevent PollScheduler interference

### CurrentTasksWidget
- Accepts projectId prop -> only current project tasks
- Cleanup: stale tasks from other projects on mount
- Completed tasks removed immediately; failed after 60s; all done cleared after 3s

### Image-to-Video Page (/image-to-video)
- Single image + multiple prompts -> multiple videos
- AssetPickerDialog for asset library selection
- Size: 1920x1080, 1280x720, 1080x1920, 720x1280, 1024x1024, 768x768
- Duration: ~3s(81f), ~5s(121f), ~10s(241f), ~18s(441f) with negative prompt
- 5s delay between requests; save to asset library

### Image-to-Image Page (/image-to-image)
- Multi-image upload, same prompt applied to all
- Size options, 5s delay, save to asset library

### Task Center (/history)
- Click-to-play video (no autoPlay), save-to-library button with duplicate detection

### Rate Limiting (video.ts)
- Three-layer: Mutex queue -> Interval (query 12s, create 5s) -> Sliding window (3/20s)
- Poll: interval=15s, maxInterval=60s, 429 backoff=4x, consecutive error limit=20

### Asset Library
- Binary: IndexedDB via AssetsDB. Index: Zustand useUnifiedAssetStore
- Lazy loading: IntersectionObserver, auto-revoke on unmount

### CORS Handling
- All downloads use server proxy /api/pipeline/download-image
- StorageService always uses proxy (removed direct fetch)

## Common Pitfalls to Avoid
1. Never hard-code prompt suffixes (cinematic, motion) -- use shot descriptions as-is
2. Always use StorageService return value ID when calling addIndex
3. Always call syncFromStorage() on mount
4. CharacterForm onSubmit: edit=updateCharacter, create=addCharacter
5. Pipeline tasks: use addTask/updateTask (NOT execute) -- avoid PollScheduler double-polling
6. Clear .next cache after hotfixes: Remove-Item -Recurse -Force .next
7. handleGenerateVideo: clear old tasks per shot before creating
8. CurrentTasksWidget: always pass projectId
9. Use node --input-type=module for files with Chinese chars
10. StorageService always uses proxy for CDN URLs
11. Image-to-Video: 5s delay between requests

### image.ts generate() ????
- generate ?????? params as unknown as Record ??????
- ?????seed(>=0?), steps, guidance_scale, negative_prompt
- ?????console.debug("[ImageService] Generating image, payload:", ...)

### Axios ?????
- ?????console.debug("[AgnesClient] Response OK:", status, url)
- ?????console.error ?? url/method/status/data/headers ????
- ???????? AgnesApiError

### useGenerateImage ????
- catch ????? err.message (API ??????)
- ?? console.error("[useGenerateImage] Error:", err) ??????

### ???? poll ????
- ????? progress.errorMessage ??????
- console.error("[Agnes SDK] Video generation failed", { taskId, errorMessage })

### extractVideoTaskIds video ID ??
- ? API ??? video_id ??????? task ID (video_ + base64) ???
- ?? base64 ??? video_id:video_xxx ??

### ??????
- ???? PowerShell Set-Content ????(??? UTF-8 ??)
- ???? Node.js (--input-type=module) ? git checkout ??
- ??? \r\n ??

## Build Verification
- npm run build passes
- First dev load ~20-30s cold start, subsequent ~200ms
- Port 3000 always used; kill other processes if needed
## Build Verification
- npm run build passes
- First dev load ~20-30s cold start, subsequent ~200ms
- Port 3000 always used; kill other processes if needed
