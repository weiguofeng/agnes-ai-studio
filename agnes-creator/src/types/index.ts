// ========== Prompt Types ==========
export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  category: PromptCategory;
  tags: string[];
  variables: string[];
  description: string;
  isFavorite: boolean;
  usageCount: number;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export type PromptCategory = "general" | "character" | "scene" | "style" | "action" | "environment" | "custom";

export interface PromptVariable {
  key: string;
  label: string;
  defaultValue: string;
  description?: string;
}

// ========== Character Types ==========
export interface CharacterReference {
  type: "main" | "side" | "full";
  url: string;
  label?: string;
}

export interface CharacterProfile {
  age: string;
  gender: string;
  appearance: string;
  hair: string;
  clothing: string;
  personality: string;
  background: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tags: string[];
  referenceImages: string[];
  /** V2.4: Structured reference images */
  references: CharacterReference[];
  /** V2.4: Character profile */
  profile: CharacterProfile;
  /** V2.4: Auto-generated DNA block for prompt injection */
  dnaBlock: string;
  isFavorite: boolean;
  projectId?: string;
  /** V2.4: Is this character locked to a project? */
  isLocked: boolean;
  createdAt: number;
  updatedAt: number;
}

// ========== Project Types ==========
export interface Project {
  id: string;
  name: string;
  description: string;
  storyScript?: string;
  thumbnail?: string;
  tags: string[];
  status: ProjectStatus;
  scenes: Scene[];
  characters: string[];
  assets: string[];
  /** V2.4: Project-level style DNA */
  styleDna: string;
  /** V2.4: Locked character IDs */
  lockedCharacterIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type ProjectStatus = "draft" | "active" | "completed" | "archived";

// ========== Scene Types ==========
export interface Scene {
  id: string;
  projectId: string;
  title: string;
  description: string;
  order: number;
  shots: Shot[];
  prompt?: string;
  renderedPrompt?: string;
  characterIds: string[];
  assetIds: string[];
  /** V2.4: Camera angle for storyboard */
  cameraAngle?: string;
  createdAt: number;
  updatedAt: number;
}

// ========== Shot Types ==========
export interface Shot {
  id: string;
  sceneId: string;
  title: string;
  description: string;
  order: number;
  type: ShotType;
  prompt: string;
  renderedPrompt: string;
  /** V2.4: Per-shot negative prompt */
  negativePrompt: string;
  characterIds: string[];
  assetIds: string[];
  resultUrl?: string;
  thumbnailUrl?: string;
  /** V2.4: Image generation task */
  imageTaskId?: string;
  /** V2.4: Image generation status */
  imageStatus?: ProductionStatus;
  /** V2.4: Video generation task */
  videoTaskId?: string;
  /** V2.4: Video generation status */
  videoStatus?: ProductionStatus;
  duration: number;
  transition?: TransitionType;
  createdAt: number;
  updatedAt: number;
}

export type ShotType = "image" | "video";

export type TransitionType = "cut" | "fade" | "dissolve" | "wipe" | "slide";

// ========== Asset Types ==========
export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  category: AssetCategory;
  isFavorite: boolean;
  projectId?: string;
  metadata?: Record<string, unknown>;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: number;
  updatedAt: number;
}

export type AssetType = "image" | "video" | "audio" | "document" | "prompt";

export type AssetCategory = "generated" | "uploaded" | "reference" | "output";

// ========== Editor Types ==========
export interface EditorTimeline {
  id: string;
  name: string;
  projectId?: string;
  clips: EditorClip[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

export interface EditorClip {
  id: string;
  timelineId: string;
  source: EditorClipSource;
  type: "video" | "image" | "text";
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  src?: string;
  thumbnailUrl?: string;
  transition?: TransitionType;
  transitionDuration?: number;
  effects?: EditorEffect[];
  properties: Record<string, unknown>;
}

export interface EditorClipSource {
  type: "asset" | "shot" | "generation";
  id: string;
}

export interface EditorEffect {
  type: string;
  params: Record<string, unknown>;
}

// ========== Generation Types ==========
export interface GenerationRequest {
  projectId?: string;
  sceneId?: string;
  shotId?: string;
  type: "text-to-image" | "image-to-image" | "text-to-video" | "image-to-video";
  prompt: string;
  model: string;
  params?: Record<string, unknown>;
  sourceImage?: string;
}

// ========== V2.4 Production Types ==========

/** Production status for batch generation */
export type ProductionStatus =
  | "pending"
  | "generating"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled"
  // V2.4 Production Pipeline granular error states (no text-to-video fallback)
  | "image_fetch_failed"
  | "image_expired"
  | "image_cors_blocked"
  | "image_not_found"
  | "image_rate_limited"
  | "video_api_failed"
  | "video_timeout"
  // V2.5 Scene Status System
  | "image_locked"
  | "video_locked"
  | "image_deleted"
  | "video_deleted"
  | "regenerating_image"
  | "regenerating_video";

/** Production queue item */
export interface ProductionQueueItem {
  id: string;
  projectId: string;
  sceneId: string;
  shotId: string;
  shotTitle: string;
  sceneTitle: string;
  order: number;
  /** V2.6: Scene/Shot numbering */
  sceneOrder: number;
  shotOrder: number;
  /** Image generation */
  imageStatus: ProductionStatus;
  imageTaskId?: string;
  imageResultUrl?: string;
  imageRetries: number;
  imageError?: string;
  imageStartedAt?: number;
  imageCompletedAt?: number;
  /** V2.5: Image lock */
  imageLocked: boolean;
  /** Video generation */
  videoStatus: ProductionStatus;
  videoTaskId?: string;
  videoResultUrl?: string;
  videoRetries: number;
  videoError?: string;
  videoStartedAt?: number;
  /** V2.5: Video lock */
  videoLocked: boolean;
  videoCompletedAt?: number;
  /** V2.7: Custom editable prompt */
  imagePrompt?: string;
  videoPrompt?: string;
  negativePrompt?: string;
  customPrompt?: string;
}

/** Prompt pack for a shot */
export interface PromptPack {
  shotId: string;
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt: string;
  characterDna?: string;
  styleDna?: string;
}

/** Project export format */
export interface ProjectExport {
  version: "2.4";
  exportedAt: number;
  project: {
    name: string;
    description: string;
    tags: string[];
    styleDna: string;
  };
  characters: Array<{
    name: string;
    profile: CharacterProfile;
    dnaBlock: string;
    references: CharacterReference[];
  }>;
  storyScenes: Array<{
    title: string;
    description: string;
    cameraAngle?: string;
    shots: Array<{
      title: string;
      description: string;
      prompt: string;
      negativePrompt: string;
      imageUrl?: string;
      videoUrl?: string;
    }>;
  }>;
}
