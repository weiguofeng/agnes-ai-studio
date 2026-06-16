// ========== V2.8 Production Hardening Tests ==========
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock localStorage
beforeEach(() => {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((key) => delete store[key]); }),
    length: 0,
    key: vi.fn(() => null),
  } as unknown as Storage;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ProjectAutoSaveService", () => {
  it("should mark dirty state and save", async () => {
    const { markDirty, saveNow } = await import("@/services/ProjectAutoSaveService");
    markDirty();
    const result = await saveNow();
    expect(result).toBe(true);
  });

  it("should persist last saved timestamp", async () => {
    const { saveNow, getLastSavedAt } = await import("@/services/ProjectAutoSaveService");
    await saveNow();
    expect(getLastSavedAt()).toBeGreaterThan(0);
  });
});

describe("PromptHistoryStore", () => {
  it("should save and retrieve versions", async () => {
    const { usePromptHistoryStore } = await import("@/stores/promptHistoryStore");
    const store = usePromptHistoryStore.getState();
    store.saveVersion("shot-1", "test prompt v1");
    store.saveVersion("shot-1", "test prompt v2");
    const versions = store.getVersions("shot-1");
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].prompt).toBe("test prompt v2");
  });

  it("should not duplicate identical prompts", async () => {
    const { usePromptHistoryStore } = await import("@/stores/promptHistoryStore");
    const store = usePromptHistoryStore.getState();
    store.saveVersion("shot-dedup", "same prompt");
    store.saveVersion("shot-dedup", "same prompt");
    const versions = store.getVersions("shot-dedup");
    expect(versions.length).toBe(1);
  });

  it("should delete a version", async () => {
    const { usePromptHistoryStore } = await import("@/stores/promptHistoryStore");
    const store = usePromptHistoryStore.getState();
    store.saveVersion("shot-del", "version 1");
    store.saveVersion("shot-del", "version 2");
    store.deleteVersion("shot-del", 0);
    const versions = store.getVersions("shot-del");
    expect(versions.length).toBe(1);
    expect(versions[0].prompt).toBe("version 1");
  });
});

describe("BackupService", () => {
  it("should generate valid backup filename", async () => {
    const svc = await import("@/services/BackupService");
    const name = svc.generateBackupFilename("proj-test");
    expect(name).toContain("agnes-backup-proj-test-");
    expect(name).toMatch(/\.project\.json$/);
  });
});

describe("RestoreService", () => {
  it("should restore project, queue, prompt history, and timeline from backup", async () => {
    const { restoreProject } = await import("@/services/RestoreService");
    const { useProjectStore } = await import("@/stores/projectStore");
    const { useProductionQueue } = await import("@/stores/productionQueueStore");
    const { usePromptHistoryStore } = await import("@/stores/promptHistoryStore");
    const { useEditorStore } = await import("@/stores/editorStore");
    const backup = {
      version: "2.8" as const,
      exportedAt: 1000,
      project: {
        id: "project-restore",
        name: "Restored Project",
        description: "Backup restore regression",
        tags: ["restore"],
        styleDna: "cinematic night",
        lockedCharacterIds: ["char-1"],
        scenes: [],
        storyScript: "A coherent restored story.",
        createdAt: 1000,
        updatedAt: 1000,
      },
      productionQueue: [{
        id: "queue-1",
        projectId: "project-restore",
        sceneId: "scene-1",
        shotId: "shot-1",
        shotTitle: "Shot 1",
        sceneTitle: "Scene 1",
        order: 0,
        sceneOrder: 1,
        shotOrder: 1,
        imageStatus: "completed",
        videoStatus: "completed",
        imageResultUrl: "blob:image-1",
        videoResultUrl: "blob:video-1",
        imageRetries: 0,
        videoRetries: 0,
        imageLocked: false,
        videoLocked: false,
      }],
      timeline: [{
        id: "timeline-1",
        name: "Restored Timeline",
        projectId: "project-restore",
        duration: 4,
        fps: 24,
        width: 1920,
        height: 1080,
        createdAt: 1000,
        updatedAt: 1000,
        clips: [{
          id: "clip-1",
          timelineId: "timeline-1",
          source: { type: "shot", id: "shot-1" },
          type: "video",
          title: "Shot 1",
          startTime: 0,
          endTime: 4,
          duration: 4,
          src: "blob:video-1",
          properties: {},
        }],
      }],
      promptHistory: { "shot-1": [{ prompt: "restored prompt", savedAt: 1000 }] },
      assets: [],
    };

    useProjectStore.setState({ projects: [] });
    useProductionQueue.setState({ items: [] });
    usePromptHistoryStore.setState({ history: {} });
    useEditorStore.setState({ timelines: [], activeTimelineId: null });

    const result = await restoreProject(backup);

    expect(result.success).toBe(true);
    expect(useProjectStore.getState().getProjectById("project-restore")?.storyScript).toBe("A coherent restored story.");
    expect(useProductionQueue.getState().getProjectItems("project-restore")).toHaveLength(1);
    expect(usePromptHistoryStore.getState().getVersions("shot-1")[0].prompt).toBe("restored prompt");
    expect(useEditorStore.getState().timelines.find((timeline) => timeline.projectId === "project-restore")?.clips).toHaveLength(1);
  });
});

describe("StorageService V2.8", () => {
  it("should export formatFileSize", async () => {
    const svc = await import("@/services/StorageService");
    expect(svc.formatFileSize(0)).toBe("0 B");
    expect(svc.formatFileSize(1024)).toBe("1 KB");
  });

  it("should reject incorrect cleanup confirmation", async () => {
    const svc = await import("@/services/StorageService");
    const result = await svc.StorageService.confirmCleanup("wrong");
    expect(result.success).toBe(false);
  });

  it("should accept correct cleanup confirmation", async () => {
    const svc = await import("@/services/StorageService");
    const result = await svc.StorageService.confirmCleanup("DELETE");
    expect(result.success).toBe(true);
  });

  it("should fall back to proxy when direct remote fetch fails", async () => {
    const assetsDb = await import("@/services/AssetsDB");
    const saveSpy = vi.spyOn(assetsDb.AssetsDB, "save").mockResolvedValue(undefined);
    const saveMetaSpy = vi.spyOn(assetsDb.AssetsDB, "saveMeta").mockResolvedValue(undefined);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-asset"),
      revokeObjectURL: vi.fn(),
    });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("CORS blocked"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: "data:image/png;base64,AQID",
          mimeType: "image/png",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const svc = await import("@/services/StorageService");
    const result = await svc.StorageService.saveAssetFromUrl({
      url: "https://cdn.example.com/signed-image.png",
      type: "image",
      projectId: "project-1",
      shotId: "shot-1",
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://cdn.example.com/signed-image.png");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/pipeline/download-image", expect.objectContaining({ method: "POST" }));
    expect(saveSpy).toHaveBeenCalledWith("images", expect.any(String), expect.any(Blob));
    expect(saveMetaSpy).toHaveBeenCalledWith(expect.objectContaining({
      originalUrl: "https://cdn.example.com/signed-image.png",
      type: "image",
      projectId: "project-1",
      shotId: "shot-1",
    }));
  });
});
