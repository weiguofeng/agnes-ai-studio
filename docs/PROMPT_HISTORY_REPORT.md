# Prompt History Report - V2.8

## Implementation
- Store: `src/stores/promptHistoryStore.ts`
- Persistence: Zustand + IndexedDB (via IndexedDBStorage)
- Limit: 50 versions per shot, auto-clean oldest

## Verified
- [x] Save/retrieve versions
- [x] 50-version limit
- [x] Dedup identical prompts
- [x] Delete version
- [x] Stats (totalShots, totalVersions)
- [x] Integrated into PromptInlineEditor
