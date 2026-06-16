/**
 * Image compositing utility for multi-character video generation.
 * When a shot has multiple characters, composite their reference images
 * into a single image to pass to the image-to-video API.
 */

/**
 * Options for compositing multiple images into one.
 */
export interface CompositeOptions {
  /** Max width per image in the composite layout */
  maxWidthPerImage?: number;
  /** Max height of the composite output */
  maxHeight?: number;
  /** Output image quality (0-1) */
  quality?: number;
}

/**
 * Given an array of image blob URLs (or data URLs), composite them
 * into a single image arranged horizontally (side by side).
 * Falls back to the first image if only one image is provided.
 */
export async function compositeImages(
  imageUrls: string[],
  options: CompositeOptions = {}
): Promise<Blob | null> {
  if (!imageUrls || imageUrls.length === 0) return null;
  if (imageUrls.length === 1) {
    // Single image - fetch and return as blob
    const resp = await fetch(imageUrls[0]);
    return resp.blob();
  }

  const { maxWidthPerImage = 512, maxHeight = 768, quality = 0.92 } = options;

  // Load all images into canvas elements
  const imgs = await Promise.all(
    imageUrls.map(async (url) => {
      const img = await loadImage(url);
      return img;
    })
  );

  // Calculate composite dimensions (horizontal layout)
  const totalWidth = Math.min(
    imgs.reduce((sum, img) => sum + Math.min(img.width, maxWidthPerImage), 0),
    maxWidthPerImage * imageUrls.length
  );

  const compositeHeight = Math.min(
    Math.max(...imgs.map((img) => img.height)),
    maxHeight
  );

  // Create canvas and composite
  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = compositeHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x = 0;
  for (const img of imgs) {
    const w = Math.min(img.width, maxWidthPerImage);
    const h = (img.height / img.width) * w;
    const y = Math.max(0, (compositeHeight - h) / 2);
    ctx.drawImage(img, x, y, w, h);
    x += w;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create composite blob'));
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Duration presets for video generation
 * Maps label -> { seconds, frames } (at 24fps)
 */
export const VIDEO_DURATION_PRESETS = [
  { label: '3s', seconds: 3, frames: 81 },   // 81%8=1, ~3.38s @24fps
  { label: '5s', seconds: 5, frames: 121 },  // 121%8=1, ~5.04s @24fps (default)
  { label: '10s', seconds: 10, frames: 241 }, // 241%8=1, ~10.04s @24fps
  { label: '18s', seconds: 18, frames: 441 }, // 441%8=1, ~18.38s @24fps
] as { label: string; seconds: number; frames: number }[];

export const DEFAULT_DURATION_FRAMES = 121; // ~5 seconds at 24fps

/**
 * Calculate numFrames from seconds.
 */
export function secondsToFrames(seconds: number, frameRate = 24): number {
  // API requires: num_frames >= 49 && num_frames % 8 == 1
  // Find the nearest valid frame count
  const raw = Math.round(seconds * frameRate);
  const result = Math.round((raw - 1) / 8) * 8 + 1;
  return Math.max(49, result);
}

/**
 * Load an image from URL and return an HTMLImageElement.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url.slice(0, 50)}`));
    img.src = url;
  });
}

/**
 * Check if a shot has multiple character images that should be composited.
 */
export function shouldCompositeImages(characterImageUrls: string[]): boolean {
  return characterImageUrls.filter(Boolean).length > 1;
}
