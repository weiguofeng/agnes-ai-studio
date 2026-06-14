// ========== V2.8 Production Hardening Tests ==========
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage
beforeEach(() => {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    length: 0,
    key: vi.fn(() => null),
  } as unknown as Storage;
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
});
