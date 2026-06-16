import { useState, useEffect, useRef, useCallback } from "react";
import { StorageService } from "@/services/StorageService";
import type { AssetRecord } from "@/services/AssetsDB";

interface UseAssetBlobResult {
  /** Object URL for display, undefined while loading */
  url: string | undefined;
  /** Original AssetRecord, if available */
  record?: AssetRecord;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh / reload the blob */
  refresh: () => void;
}

/**
 * Load a blob from IndexedDB on demand and auto-revoke on unmount.
 * Only holds blob URL while the component is mounted.
 */
export function useAssetBlob(assetRecord: AssetRecord | null | undefined): UseAssetBlobResult {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revokeRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);

  // Clean up old blob URL
  const revokeCurrent = useCallback(() => {
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current);
      revokeRef.current = undefined;
    }
  }, []);

  const load = useCallback(async () => {
    if (!assetRecord) {
      revokeCurrent();
      setUrl(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    // If URL is already a blob URL from StorageService, use it directly
    if (assetRecord.url?.startsWith("blob:")) {
      setUrl(assetRecord.url);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const blobResult = await StorageService.loadAsset(
        assetRecord.id,
        assetRecord.type
      );
      if (!mountedRef.current) return;

      if (blobResult.success && blobResult.data) {
        revokeCurrent();
        const objectUrl = URL.createObjectURL(blobResult.data);
        revokeRef.current = objectUrl;
        setUrl(objectUrl);
      } else {
        // Fallback: use original URL
        setUrl(assetRecord.url || assetRecord.originalUrl);
        if (!blobResult.success) {
          setError(blobResult.error || "Failed to load asset");
        }
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setUrl(assetRecord.url || assetRecord.originalUrl);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [assetRecord, revokeCurrent]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      revokeCurrent();
    };
  }, [load, revokeCurrent]);

  return { url, record: assetRecord ?? undefined, loading, error, refresh: load };
}

/**
 * Batch-load multiple assets with a single loading state.
 * Returns a Map of id -> blob URL.
 */
export function useAssetBlobMap(
  records: AssetRecord[]
): Map<string, string | undefined> {
  const [map, setMap] = useState<Map<string, string | undefined>>(new Map());

  useEffect(() => {
    const m = new Map<string, string | undefined>();
    let cancelled = false;

    Promise.all(
      records.map(async (rec) => {
        if (rec.url?.startsWith("blob:")) {
          m.set(rec.id, rec.url);
          return;
        }
        try {
          const result = await StorageService.loadAsset(rec.id, rec.type);
          if (!cancelled && result.success && result.data) {
            m.set(rec.id, URL.createObjectURL(result.data));
          }
        } catch {
          m.set(rec.id, rec.url);
        }
      })
    ).then(() => {
      if (!cancelled) setMap(m);
    });

    return () => {
      cancelled = true;
      // Clean up created blob URLs
      m.forEach((u) => {
        if (u?.startsWith("blob:")) URL.revokeObjectURL(u);
      });
    };
  }, [records]);

  return map;
}
