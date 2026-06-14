# PIPELINE_SCENE_CONTROL_REPORT.md

## V2.5 Pipeline Scene Controls

### Per-Shot Controls Added
Each shot in the pipeline now has:
- [View Image] — Opens image preview
- [View Video] — Opens video preview
- [Regenerate Image] — Resets image status to regenerating_image
- [Regenerate Video] — Resets video status to regenerating_video
- [Delete Image] — Marks image as deleted, clears URL
- [Delete Video] — Marks video as deleted, clears URL
- [Lock Image] — Sets imageLocked=true, batch gen skips it
- [Lock Video] — Sets videoLocked=true, batch gen skips it

### Lock Behavior
- Locked images/videos are excluded from batch generation
- getPendingImageItems() and getPendingVideoItems() filter locked items
- Locked items can still be manually regenerated

### Delete Behavior
- Sets status to image_deleted/video_deleted
- Clears the result URL to free memory
- Metadata (shot title, order, etc.) preserved
- Can be regenerated after deletion

### Files Modified
- src/stores/productionQueueStore.ts — New methods
- src/types/index.ts — New status types + lock fields
- src/app/pipeline/page.tsx — UI controls

### Verification
- [ ] View opens preview for completed items
- [ ] Regenerate resets only the target shot
- [ ] Delete clears the result URL
- [ ] Lock prevents batch overwrite
- [ ] Unlock restores batch eligibility
