# ASSET_MANAGEMENT_REPORT.md

## V2.5 Asset Cleanup & Storage Dashboard

### Cleanup Features
- StorageService.deleteAsset(id) — Delete single asset
- StorageService.deleteProjectAssets(projectId) — Delete all project assets
- StorageService.clearAll() — Clear entire IndexedDB cache

### Storage Dashboard (/storage-dashboard)
Shows:
- Total images count
- Total videos count
- Total thumbnails count
- Storage used vs quota
- Quick actions: Clear all cache

### Pipeline Scene Controls (in pipeline page)
Per-shot controls:
- [View] View image/video
- [Regen Image] Regenerate single image
- [Regen Video] Regenerate single video  
- [Delete Image] Remove image asset
- [Delete Video] Remove video asset
- [Lock Image] Lock image from batch overwrite
- [Lock Video] Lock video from batch overwrite

### Files Modified
- src/services/StorageService.ts — Already includes cleanup methods
- src/app/pipeline/page.tsx — Scene control buttons (TBD)

### Verification
- [ ] Single asset delete works
- [ ] Project-level cleanup works
- [ ] Clear all works
- [ ] Storage Dashboard shows correct stats
- [ ] Lock prevents batch overwrite
