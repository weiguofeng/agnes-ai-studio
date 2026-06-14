# EDITOR_TEST_MODE_REPORT.md

## V2.5 Editor Testing Mode

### Purpose
Allow editor development and testing without going through the full Pipeline.

### Features
- New toggle: "Testing Mode" in editor header
- When enabled: bypass Pipeline, allow direct asset loading
- Direct import: import images and videos from AssetsDB directly into the timeline
- No generation required: test timeline playback, transitions, effects immediately

### Usage
1. Open Editor
2. Enable "Testing Mode" toggle
3. Click "Import Assets" to open Asset Browser
4. Select images/videos to add to timeline
5. Preview and test timeline behavior

### Files Modified
- src/app/editor/page.tsx — Testing mode toggle + import UI
- src/stores/editorStore.ts — Testing mode state

### Verification
- [ ] Testing mode toggle is visible
- [ ] Assets can be imported without Pipeline
- [ ] Timeline plays imported assets
- [ ] Testing mode does not interfere with normal editor mode
