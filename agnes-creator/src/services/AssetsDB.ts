// ========== AssetsDB - IndexedDB Storage Layer ==========
// V2.5: Replaces localStorage for image/video binary data storage

const DB_NAME = "AgnesAssetsDB";
const DB_VERSION = 1;

export interface AssetRecord {
  id: string;
  url: string;           // blob URL or external URL
  type: "image" | "video" | "thumbnail";
  status: "active" | "deleted";
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  projectId?: string;
  shotId?: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("thumbnails")) {
        db.createObjectStore("thumbnails", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("metadata")) {
        const meta = db.createObjectStore("metadata", { keyPath: "id" });
        meta.createIndex("type", "type", { unique: false });
        meta.createIndex("projectId", "projectId", { unique: false });
        meta.createIndex("shotId", "shotId", { unique: false });
        meta.createIndex("status", "status", { unique: false });
        meta.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const AssetsDB = {
  /** Save a blob/file into IndexedDB */
  async save(storeName: "images" | "videos" | "thumbnails", id: string, blob: Blob): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put({ id, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Load a blob from IndexedDB */
  async load(storeName: "images" | "videos" | "thumbnails", id: string): Promise<Blob | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result?.blob);
      req.onerror = () => reject(req.error);
    });
  },

  /** Delete a blob from IndexedDB */
  async delete(storeName: "images" | "videos" | "thumbnails", id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Save asset metadata */
  async saveMeta(record: AssetRecord): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readwrite");
      tx.objectStore("metadata").put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Load asset metadata by id */
  async loadMeta(id: string): Promise<AssetRecord | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readonly");
      const req = tx.objectStore("metadata").get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  /** Query metadata by index */
  async queryMeta(indexName: string, value: string): Promise<AssetRecord[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readonly");
      const req = tx.objectStore("metadata").index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  /** Get all metadata records */
  async getAllMeta(): Promise<AssetRecord[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readonly");
      const req = tx.objectStore("metadata").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  /** Delete metadata record */
  async deleteMeta(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("metadata", "readwrite");
      tx.objectStore("metadata").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get storage estimate */
  async getStorageInfo(): Promise<{ used: number; quota: number; count: number }> {
    const meta = await AssetsDB.getAllMeta();
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return {
        used: est.usage ?? 0,
        quota: est.quota ?? 0,
        count: meta.length,
      };
    }
    return { used: 0, quota: 0, count: meta.length };
  },

  /** Clear all stores */
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
