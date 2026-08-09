/**
 * Cloud Storage Service — Supabase-backed, cross-device key/value store.
 *
 * Replaces localStorage as the source of truth for business data. Uses the
 * live `app_kv` table (JSONB `data`, `owner_id`, `station_id`, RLS-protected,
 * unlimited size, accessible from any device/browser signed into the same
 * Supabase account). localStorage is kept ONLY as a read-through cache for
 * offline performance — it is never the authoritative store.
 *
 * API is async and intentionally matches the shape callers already use
 * (get / set / delete / getAll), so contexts can adopt it with minimal churn.
 */

import { getSupabaseClient } from "@/supabase/client";

const COLLECTION = "fuel_data";
const CACHE_PREFIX = "fuelpro_cloud_";

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function cacheKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

/** Current authenticated user id, or null. */
async function currentUserId(): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Read-through cache helper. */
function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify(value));
  } catch {
    // Cache is best-effort; ignore quota errors.
  }
}

function clearCache(key: string): void {
  try {
    localStorage.removeItem(cacheKey(key));
  } catch {
    /* ignore */
  }
}

class CloudStorageService {
  private memoryCache = new Map<string, { value: unknown; ts: number }>();
  private memTtlMs = 5_000;

  /** Whether Supabase auth is available (client configured + user signed in). */
  async isAvailable(): Promise<boolean> {
    return (await currentUserId()) !== null;
  }

  /**
   * Get a value from cloud (app_kv). Falls back to the local cache when the
   * network or auth is unavailable so reads never block the UI.
   */
  async get<T = Json>(key: string): Promise<T | null> {
    // Fast memory cache.
    const mem = this.memoryCache.get(key);
    if (mem && Date.now() - mem.ts < this.memTtlMs) {
      return mem.value as T;
    }

    const ownerId = await currentUserId();
    if (!ownerId) return readCache<T>(key);

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("app_kv")
        .select("data")
        .eq("id", key)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error) throw error;

      if (data?.data != null) {
        const value = data.data as T;
        this.memoryCache.set(key, { value, ts: Date.now() });
        writeCache(key, value);
        return value;
      }
      // No cloud row — fall back to cache (e.g. offline-first write not yet synced).
      return readCache<T>(key);
    } catch {
      return readCache<T>(key);
    }
  }

  /**
   * Persist a value to cloud (app_kv) upsert. Also writes the local cache so
   * subsequent reads are instant and offline-capable.
   */
  async set<T = Json>(key: string, value: T): Promise<void> {
    writeCache(key, value);
    this.memoryCache.set(key, { value, ts: Date.now() });

    const ownerId = await currentUserId();
    if (!ownerId) return; // offline / unauthenticated — cached locally only

    try {
      const client = getSupabaseClient();
      const { error } = await client.from("app_kv").upsert(
        {
          id: key,
          collection: COLLECTION,
          owner_id: ownerId,
          data: value as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) throw error;
    } catch (err) {
      // Cloud write failed (network/RLS). Data is safely cached locally and
      // will be overwritten on the next successful set. Surface to console for
      // debugging without breaking the caller.
      console.warn(`[CloudStorage] set failed for "${key}":`, err);
    }
  }

  /** Delete from cloud + cache. */
  async delete(key: string): Promise<void> {
    clearCache(key);
    this.memoryCache.delete(key);

    const ownerId = await currentUserId();
    if (!ownerId) return;

    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from("app_kv")
        .delete()
        .eq("id", key)
        .eq("owner_id", ownerId);
      if (error) throw error;
    } catch (err) {
      console.warn(`[CloudStorage] delete failed for "${key}":`, err);
    }
  }

  /**
   * Get all cloud rows for the current user (optionally filtered by collection
   * prefix on the key). Returns a { key: value } map.
   */
  async getAll<T = Json>(prefix?: string): Promise<Record<string, T>> {
    const ownerId = await currentUserId();
    if (!ownerId) return {};

    try {
      const client = getSupabaseClient();
      let query = client
        .from("app_kv")
        .select("id, data")
        .eq("owner_id", ownerId);
      if (prefix) query = query.like("id", `${prefix}%`);
      const { data, error } = await query;
      if (error) throw error;

      const out: Record<string, T> = {};
      for (const row of data ?? []) {
        out[row.id] = row.data as T;
      }
      return out;
    } catch {
      return {};
    }
  }

  /** Drop the in-memory cache (forces next get to hit cloud). */
  invalidate(key?: string): void {
    if (key) this.memoryCache.delete(key);
    else this.memoryCache.clear();
  }
}

export const cloudStorageService = new CloudStorageService();
export default cloudStorageService;
