# STORAGE_REFACTOR_REPORT.md

## V2.5 Asset Storage Refactor

### Root Cause
Images and videos stored as URLs in localStorage via Zustand persist. Non-scalable: limited to ~5MB, blocks main thread, risk of data loss.

### Solution
1. Created src/services/AssetsDB.ts — IndexedDB wrapper with 4 stores:
   - images — Blob storage for generated images
   - ideos — Blob storage for generated videos
   - 	humbnails — Blob storage for thumbnails
   - metadata — Indexed metadata records (type, projectId, shotId, status, createdAt)

2. Created src/services/StorageService.ts — Unified storage API:
   - saveAssetFromUrl() — Fetch remote URL → store in IndexedDB
   - saveAssetFromBlob() — Store existing Blob
   - loadAsset() — Retrieve Blob by ID
   - deleteAsset() — Remove from IndexedDB + revoke blob URL
   - deleteProjectAssets() — Remove all assets for a project
   - listAssets() / listAssetsByType() — Query metadata
   - getStorageInfo() — Usage/ quota info
   - clearAll() — Full cleanup

### localStorage now only stores:
- Projects, Scenes, Tasks, Metadata (Zustand persist)
- No base64/blob data for images or videos

### Files Modified
- src/services/AssetsDB.ts — NEW
- src/services/StorageService.ts — NEW
- src/stores/productionQueueStore.ts — Updated for V2.5
- src/types/index.ts — Updated ProductionStatus + ProductionQueueItem

### Verification
- [ ] IndexedDB opens and creates stores on first access
- [ ] saveAssetFromUrl stores blob correctly
- [ ] loadAsset retrieves blob correctly
- [ ] deleteAsset removes from all stores
- [ ] localStorage size reduced
