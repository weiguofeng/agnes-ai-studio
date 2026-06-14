// ========== AssetsDB — V2.8 (Optimized) ==========
// IndexedDB storage layer with comprehensive indexes for 500+ images, 200+ videos

const DB_NAME = "AgnesAssetsDB";
const DB_VERSION = 2; // V2.8: Added sceneId, status, createdAt indexes

export type AssetStatus = "active" | "deleted" | "corrupted" | "missing" | "expired";

export interface AssetRecord {
  id: string;
  url: string;           // blob URL
  originalUrl?: string;  // original external URL (for reference)
  type: "image" | "video" | "thumbnail";
  status: AssetStatus;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  projectId?: string;
  sceneId?: string;
  shotId?: string;
  createdAt: number;
  updatedAt: number;
  /** V2.8: Integrity check */
  integrityCheckedAt?: number;
  integrityStatus?: "pending" | "verified" | "failed";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Binary stores
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("thumbnails")) {
        db.createObjectStore("thumbnails", { keyPath: "id" });
      }
      // Metadata store with comprehensive indexes
      if (!db.objectStoreNames.contains("metadata")) {
        const meta = db.createObjectStore("metadata", { keyPath: "id" });
        meta.createIndex("type", "type", { unique: false });
        meta.createIndex("status", "status", { unique: false });
        meta.createIndex("projectId", "projectId", { unique: false });
        meta.createIndex("sceneId", "sceneId", { unique: false });
        meta.createIndex("shotId", "shotId", { unique: false });
        meta.createIndex("createdAt", "createdAt", { unique: false });
        meta.createIndex("integrityStatus", "integrityStatus", { unique: false });
      } else {
        // V2.8: Add new indexes if upgrading
        const meta = req.transaction?.objectStore("metadata");
        if (meta && !meta.indexNames.contains("sceneId")) {
          meta.createIndex("sceneId", "sceneId", { unique: false });
        }
        if (meta && !meta.indexNames.contains("integrityStatus")) {
          meta.createIndex("integrityStatus", "integrityStatus", { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const AssetsDB = {
  async save(storeName: "images" | "videos" | "thumbnails", id: string, blob: Blob): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put({ id, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async load(storeName: "images" | "videos" | "thumbnails", id: string): Promise<Blob | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result?.blob);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName: "images" | "videos" | "thumbnails", id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveMeta(record: AssetRecord): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readwrite");
      tx.objectStore("metadata").put({ ...record, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async loadMeta(id: string): Promise<AssetRecord | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readonly");
      const req = tx.objectStore("metadata").get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async queryMeta(indexName: string, value: string): Promise<AssetRecord[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readonly");
      const req = tx.objectStore("metadata").index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async queryMetaRange(indexName: string, lower: IDBValidKey, upper: IDBValidKey): Promise<AssetRecord[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readonly");
      const range = IDBKeyRange.bound(lower, upper);
      const req = tx.objectStore("metadata").index(indexName).getAll(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAllMeta(): Promise<AssetRecord[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readonly");
      const req = tx.objectStore("metadata").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteMeta(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readwrite");
      tx.objectStore("metadata").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** V2.8: Batch update metadata status */
  async batchUpdateStatus(ids: string[], status: AssetStatus): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readwrite");
      const store = tx.objectStore("metadata");
      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) {
            store.put({ ...req.result, status, updatedAt: Date.now() });
          }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getStorageInfo(): Promise<{ used: number; quota: number; count: number }> {
    const meta = await AssetsDB.getAllMeta();
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { used: est.usage ?? 0, quota: est.quota ?? 0, count: meta.length };
    }
    return { used: 0, quota: 0, count: meta.length };
  },

  async clearAll(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["images", "videos", "thumbnails", "metadata"], "readwrite");
      tx.objectStore("images").clear();
      tx.objectStore("videos").clear();
      tx.objectStore("thumbnails").clear();
      tx.objectStore("metadata").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
