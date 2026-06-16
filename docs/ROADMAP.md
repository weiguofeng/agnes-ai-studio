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

- Full zh-CN / en-US copy coverage
- StorageMonitor safe cleanup UI
- QueueCardView lock/unlock/delete actions
- PromptInlineEditor crash fixes
- Production queue batch operations fixed
- Agnes polling 429/rate-limit backoff
- Closed-loop QA scripts and regression tests
- ESLint CLI migration

---

## V2.9 (Completed)

### Production Pipeline Enhancement

- Multi-character image compositing for video generation
- Video duration control (3s/5s/8s/10s/18s/custom) per shot
- Pipeline left panel refactored to StoryboardPreview + CharacterImageSection
- Removed old AI Story Studio and Storyboard Design menus

---

## V3.0 (Completed)

### Pipeline Queue Refactoring

- Removed image generation from production queue (queue focuses only on video)
- Queue card shows character image thumbnails instead of image preview
- Truncated prompt display with expand/edit
- BatchOperations: removed image batch button
- Fixed CORS: character images served via server proxy before compositing
- Fixed API: createFromImage now uses JSON POST with image URL(s), NOT FormData
- Fixed polling rate limits: PollRateLimiter, jitter, stagger, 429 backoff
- Fixed useCallback stale closure: project in dependency array
- Fixed postForm missing boundary: removed manual Content-Type

---

## Future Plans

### V3.1

- Storyboard detail page improvements
- Character image gallery in pipeline
- Queue reorder and drag-and-drop

### V3.2

- Multi-model support for video generation
- Batch duration override
- Export queue as timeline presets

### V3.3

- Cloud task scheduling
- Multi-project queue
- One-click full project generation
