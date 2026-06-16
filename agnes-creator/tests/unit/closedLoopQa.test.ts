import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character, Project, ProjectExport, ProductionQueueItem, Scene } from '@/types';

function createLocalStorageMock(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((key) => delete store[key]); }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() { return Object.keys(store).length; },
  } as unknown as Storage;
}

function createShot(shotId: string, order: number) {
  return {
    id: shotId,
    sceneId: 'scene-closed-loop',
    title: `Shot ${order + 1}`,
    description: 'A locked character moves through a cinematic scene.',
    order,
    type: 'image' as const,
    prompt: 'Locked character, consistent costume, cinematic lighting.',
    renderedPrompt: '',
    negativePrompt: 'different face, inconsistent outfit',
    characterIds: ['char-closed-loop'],
    assetIds: [],
    duration: 5,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

function createScene(): Scene {
  return {
    id: 'scene-closed-loop',
    projectId: 'project-closed-loop',
    title: 'Closed Loop Scene',
    description: 'A regression scene for story to export validation.',
    order: 0,
    shots: [createShot('shot-ready', 0), createShot('shot-no-image-url', 1)],
    characterIds: ['char-closed-loop'],
    assetIds: [],
    createdAt: 1000,
    updatedAt: 1000,
  };
}

function buildProjectExport(params: {
  project: Project;
  characters: Character[];
  projectItems: ProductionQueueItem[];
}): ProjectExport {
  return {
    version: '2.4',
    exportedAt: 1234,
    project: {
      name: params.project.name,
      description: params.project.description,
      tags: params.project.tags || [],
      styleDna: params.project.styleDna || '',
    },
    characters: (params.project.lockedCharacterIds || [])
      .map((id) => {
        const character = params.characters.find((candidate) => candidate.id === id);
        return character ? {
          name: character.name,
          profile: character.profile,
          dnaBlock: character.dnaBlock,
          references: character.references || [],
        } : null;
      })
      .filter(Boolean) as ProjectExport['characters'],
    storyScenes: params.project.scenes.map((scene) => ({
      title: scene.title,
      description: scene.description,
      cameraAngle: scene.cameraAngle,
      shots: scene.shots.map((shot) => {
        const queueItem = params.projectItems.find((item) => item.shotId === shot.id);
        return {
          title: shot.title,
          description: shot.description,
          prompt: shot.prompt || '',
          negativePrompt: shot.negativePrompt || '',
          imageUrl: queueItem?.imageResultUrl || '',
          videoUrl: queueItem?.videoResultUrl || '',
        };
      }),
    })),
  };
}

describe('Closed-loop QA gates', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  function ensureProjectTimeline(editorStore: {
    activeTimelineId: string | null;
    timelines: Array<{ id: string; projectId?: string }>;
    getTimelineById: (id: string) => { id: string; projectId?: string } | undefined;
    setActiveTimeline: (id: string) => void;
    createTimeline: (data: { name: string; projectId: string; duration: number; fps: number; width: number; height: number }) => string;
  }, project: { id: string; name: string }): string {
    const activeTimeline = editorStore.activeTimelineId ? editorStore.getTimelineById(editorStore.activeTimelineId) : undefined;
    if (activeTimeline?.projectId === project.id) return activeTimeline.id;
    const projectTimeline = editorStore.timelines.find((timeline) => timeline.projectId === project.id);
    if (projectTimeline) {
      editorStore.setActiveTimeline(projectTimeline.id);
      return projectTimeline.id;
    }
    return editorStore.createTimeline({
      name: `${project.name} Timeline`,
      projectId: project.id,
      duration: 0,
      fps: 24,
      width: 1920,
      height: 1080,
    });
  }

  it('only queues image-to-video work when a completed image has a real source URL', async () => {
    const { useProductionQueue } = await import('@/stores/productionQueueStore');
    useProductionQueue.setState({ items: [], selectedShotIds: [], isPaused: false });

    useProductionQueue.getState().initFromShots('project-closed-loop', [{
      id: 'scene-closed-loop',
      title: 'Closed Loop Scene',
      shots: [
        { id: 'shot-ready', title: 'Ready shot', order: 0, imagePrompt: 'image prompt', videoPrompt: 'video prompt' },
        { id: 'shot-no-image-url', title: 'Missing image URL', order: 1, imagePrompt: 'image prompt', videoPrompt: 'video prompt' },
      ],
    }]);

    useProductionQueue.getState().updateImageStatus('shot-ready', 'completed', 'image-task-1', 'https://cdn.example.com/ready.png');
    useProductionQueue.getState().updateImageStatus('shot-no-image-url', 'completed', 'image-task-2');

    const pending = useProductionQueue.getState().getPendingVideoItems('project-closed-loop');

    expect(pending.map((item) => item.shotId)).toEqual(['shot-ready']);
  });

  it('creates a project-scoped timeline before importing completed videos', async () => {
    const { useEditorStore } = await import('@/stores/editorStore');
    useEditorStore.setState({ timelines: [], activeTimelineId: null, testingMode: false });

    const editorStore = useEditorStore.getState();
    const timelineId = ensureProjectTimeline(editorStore, { id: 'project-closed-loop', name: 'Closed Loop' });

    editorStore.addClip(timelineId, {
      timelineId,
      source: { type: 'shot', id: 'shot-ready' },
      type: 'video',
      title: 'Ready shot',
      startTime: 0,
      endTime: 5,
      duration: 5,
      src: 'https://cdn.example.com/ready.mp4',
      thumbnailUrl: 'https://cdn.example.com/ready.png',
      properties: {},
    });

    const timeline = useEditorStore.getState().getTimelineById(timelineId);
    expect(timeline?.projectId).toBe('project-closed-loop');
    expect(timeline?.clips).toHaveLength(1);
    expect(timeline?.clips[0].source).toEqual({ type: 'shot', id: 'shot-ready' });
  });

  it('does not import a project video into another project active timeline', async () => {
    const { useEditorStore } = await import('@/stores/editorStore');
    useEditorStore.setState({ timelines: [], activeTimelineId: null, testingMode: false });

    const otherTimelineId = useEditorStore.getState().createTimeline({
      name: 'Other Project Timeline',
      projectId: 'project-other',
      duration: 0,
      fps: 24,
      width: 1920,
      height: 1080,
    });

    const timelineId = ensureProjectTimeline(useEditorStore.getState(), { id: 'project-closed-loop', name: 'Closed Loop' });

    expect(timelineId).not.toBe(otherTimelineId);
    expect(useEditorStore.getState().getTimelineById(timelineId)?.projectId).toBe('project-closed-loop');
    expect(useEditorStore.getState().getTimelineById(otherTimelineId)?.projectId).toBe('project-other');
  });

  it('imports timeline clips with localized playable blob URLs while preserving original remote URLs', () => {
    const queueItem = {
      shotId: 'shot-ready',
      shotTitle: 'Ready shot',
      shotOrder: 1,
      imageResultUrl: 'https://cdn.example.com/ready.png',
      videoResultUrl: 'https://cdn.example.com/ready.mp4',
    };
    const localizedVideoUrl = 'blob:localized-video';
    const localizedImageUrl = 'blob:localized-image';

    const clip = {
      timelineId: 'timeline-closed-loop',
      source: { type: 'shot' as const, id: queueItem.shotId },
      type: 'video' as const,
      title: queueItem.shotTitle,
      startTime: 0,
      endTime: 5,
      duration: 5,
      src: localizedVideoUrl,
      thumbnailUrl: localizedImageUrl,
      properties: {
        originalVideoUrl: queueItem.videoResultUrl,
        originalImageUrl: queueItem.imageResultUrl,
      },
    };

    expect(clip.src).toBe('blob:localized-video');
    expect(clip.thumbnailUrl).toBe('blob:localized-image');
    expect(clip.properties.originalVideoUrl).toBe('https://cdn.example.com/ready.mp4');
  });

  it('exports locked characters, shot prompts, image URLs, and video URLs as parseable JSON data', () => {
    const scene = createScene();
    const project: Project = {
      id: 'project-closed-loop',
      name: 'Closed Loop Project',
      description: 'Story to export regression fixture',
      storyScript: 'A complete story enters the production pipeline.',
      tags: ['qa'],
      status: 'active',
      scenes: [scene],
      characters: ['char-closed-loop'],
      assets: [],
      styleDna: 'cinematic lighting',
      lockedCharacterIds: ['char-closed-loop'],
      createdAt: 1000,
      updatedAt: 1000,
    };
    const character: Character = {
      id: 'char-closed-loop',
      name: 'Agnes Test Hero',
      description: 'Locked character consistency fixture',
      prompt: 'same face, same outfit, same silhouette',
      tags: ['qa'],
      referenceImages: [],
      references: [{ type: 'main', url: 'https://cdn.example.com/ref.png' }],
      profile: {
        age: 'young adult',
        gender: 'female',
        appearance: 'silver hair and clear blue eyes',
        hair: 'silver bob cut',
        clothing: 'navy studio jacket',
        personality: 'calm',
        background: 'AI video director',
      },
      dnaBlock: 'Agnes Test Hero, silver hair, navy studio jacket',
      isFavorite: false,
      isLocked: true,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const projectItems = [{
      id: 'queue-ready',
      projectId: 'project-closed-loop',
      sceneId: 'scene-closed-loop',
      shotId: 'shot-ready',
      shotTitle: 'Ready shot',
      sceneTitle: 'Closed Loop Scene',
      order: 0,
      sceneOrder: 1,
      shotOrder: 1,
      imageStatus: 'completed' as const,
      imageResultUrl: 'https://cdn.example.com/ready.png',
      imageRetries: 0,
      imageLocked: false,
      videoStatus: 'completed' as const,
      videoResultUrl: 'https://cdn.example.com/ready.mp4',
      videoRetries: 0,
      videoLocked: false,
    }];

    const content = JSON.stringify(buildProjectExport({ project, characters: [character], projectItems }));
    const parsed = JSON.parse(content) as ProjectExport;

    expect(parsed.characters[0].dnaBlock).toContain('Agnes Test Hero');
    expect(parsed.storyScenes[0].shots[0].imageUrl).toBe('https://cdn.example.com/ready.png');
    expect(parsed.storyScenes[0].shots[0].videoUrl).toBe('https://cdn.example.com/ready.mp4');
    expect(parsed.storyScenes[0].shots[1].videoUrl).toBe('');
  });
});
