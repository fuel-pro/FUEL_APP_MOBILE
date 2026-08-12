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

type Json =
  Record<string, unknown> | unknown[] | string | number | boolean | null;

function cacheKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

/**
 * Build the app_kv row id for a logical key, scoped by user (and optionally
 * by station).
 *
 * CRITICAL: the row id MUST be unique per user (+ station). Earlier versions
 * used the bare key (e.g. "expenses_data") as the id with `onConflict: "id"`,
 * which meant every user sharing that key name overwrote the same row —
 * destroying other users' data and flipping `owner_id` so RLS
 * (`owner_id = auth.uid()`) locked the original owner out of their own data.
 *
 * Scoping by owner_id gives each user an isolated row for the same logical
 * key. Scoping additionally by station_id gives each station its own isolated
 * data set (so a user with multiple stations has independent expenses, prices,
 * suppliers, etc. per station), which is required unless a "Combined View" is
 * explicitly selected.
 *
 * Row id shapes:
 *   - station-scoped: `${key}__${ownerId}__${stationId}`
 *   - user-scoped:    `${key}__${ownerId}`   (legacy / combined-view)
 */
function rowId(key: string, ownerId: string, stationId?: string): string {
  return stationId ? `${key}__${ownerId}__${stationId}` : `${key}__${ownerId}`;
}

/** The legacy user-scoped id (used for backward-compatible reads). */
function userScopedId(key: string, ownerId: string): string {
  return `${key}__${ownerId}`;
}

/**
 * Coerce a value read from the app_kv `data` (JSONB) column into the expected
 * JSON shape. Older versions of set() (and some manual API inserts) stored
 * arrays/objects as a double-encoded JSON STRING inside the JSONB column
 * (e.g. the column held `"[{ ... }]"` instead of `[{ ... }]`). Without this
 * guard, callers that check `Array.isArray(value)` would see `false` for the
 * string and silently discard ALL cloud-synced per-component data (suppliers,
 * expenses, shifts, payroll, etc.) — manifesting as an empty UI even though
 * the data exists in the DB. This helper transparently unwraps such strings
 * so existing rows auto-heal: the next set() repersists the parsed value as
 * proper JSONB, fixing the stored data without any migration script.
 */
function coerceJson<T = Json>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      // Not JSON — return the original string wrapped as the value.
      return raw as unknown as T;
    }
  }
  return raw as T;
}

/**
 * Current authenticated user id, or null.
 *
 * SYNCHRONOUS FAST-PATH: reads from localStorage (`fuelpro_auth_identity`,
 * written by AuthContext on login) BEFORE making any network call. This
 * eliminates the 200-500ms `auth.getUser()` round-trip that previously
 * blocked EVERY `get()`/`set()` call — the single biggest source of latency
 * in the entire data-loading pipeline. Falls back to the Supabase client
 * only when localStorage doesn't have it (first render before AuthContext
 * persists).
 */
let cachedUserId: string | null = null;
let userIdCacheTs = 0;
const USER_ID_CACHE_TTL = 30_000; // 30 seconds

function readUserIdFromStorage(): string | null {
  try {
    const raw = localStorage.getItem("fuelpro_auth_identity");
    if (raw) {
      const identity = JSON.parse(raw);
      if (identity?.id) return identity.id;
    }
  } catch {
    // ignore
  }
  return null;
}

async function currentUserId(): Promise<string | null> {
  // 1. In-memory cache (fastest).
  if (cachedUserId && Date.now() - userIdCacheTs < USER_ID_CACHE_TTL) {
    return cachedUserId;
  }
  // 2. localStorage (synchronous, no network).
  const stored = readUserIdFromStorage();
  if (stored) {
    cachedUserId = stored;
    userIdCacheTs = Date.now();
    return stored;
  }
  // 3. Supabase client (network call, slowest).
  try {
    const client = getSupabaseClient();
    const { data } = await client.auth.getUser();
    const id = data.user?.id ?? null;
    if (id) {
      cachedUserId = id;
      userIdCacheTs = Date.now();
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * SYNCHRONOUS user id — for instant renders. Reads from the in-memory cache
 * or localStorage. Returns null if no user is known yet (first paint before
 * AuthContext persists). Callers that need a definitive answer should still
 * use the async `currentUserId()`.
 */
function currentUserIdSync(): string | null {
  if (cachedUserId && Date.now() - userIdCacheTs < USER_ID_CACHE_TTL) {
    return cachedUserId;
  }
  return readUserIdFromStorage();
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
  private memTtlMs = 60_000; // 60 seconds — data rarely changes faster than this

  /** Whether Supabase auth is available (client configured + user signed in). */
  async isAvailable(): Promise<boolean> {
    return (await currentUserId()) !== null;
  }

  /**
   * SYNCHRONOUS cached read — returns data from the in-memory cache or the
   * localStorage read-through cache with ZERO network calls. Use this in
   * useState initializers so the FIRST render shows data instantly (before
   * the async `get()` resolves). Returns null if no cache exists yet.
   *
   * The async `get()` should still be called on mount to sync from cloud,
   * but `getCached()` eliminates the blank-state flash on cross-device login
   * and on every tab switch/navigation.
   */
  getCached<T = Json>(key: string, stationId?: string): T | null {
    const ck = stationId ? `${key}__${stationId}` : key;
    // 1. In-memory cache (instant).
    const mem = this.memoryCache.get(ck);
    if (mem && Date.now() - mem.ts < this.memTtlMs) {
      return mem.value as T;
    }
    // 2. localStorage read-through cache (instant, no network).
    return readCache<T>(ck);
  }

  /** Whether a value is cached (memory or localStorage) for instant access. */
  hasCached(key: string, stationId?: string): boolean {
    return this.getCached(key, stationId) != null;
  }

  /**
   * Get a value from cloud (app_kv). Falls back to the local cache when the
   * network or auth is unavailable so reads never block the UI.
   *
   * When `stationId` is provided, reads the station-scoped row first. If that
   * does not exist, falls back to the user-scoped row (legacy / pre-station
   * data) so existing data migrates transparently on first read. The next
   * `set()` repersists it under the station-scoped id.
   */
  async get<T = Json>(key: string, stationId?: string): Promise<T | null> {
    // Fast memory cache (keyed by the effective cache key).
    const ck = stationId ? `${key}__${stationId}` : key;
    const mem = this.memoryCache.get(ck);
    if (mem && Date.now() - mem.ts < this.memTtlMs) {
      return mem.value as T;
    }

    const ownerId = await currentUserId();
    if (!ownerId) return readCache<T>(ck);

    try {
      const client = getSupabaseClient();
      const scopedId = rowId(key, ownerId, stationId);

      // 1. Station-scoped row (when stationId provided).
      if (stationId) {
        const { data, error } = await client
          .from("app_kv")
          .select("data")
          .eq("id", scopedId)
          .eq("owner_id", ownerId)
          .maybeSingle();
        if (error) throw error;
        if (data?.data != null) {
          const value = coerceJson<T>(data.data);
          if (value != null) {
            this.memoryCache.set(ck, { value, ts: Date.now() });
            writeCache(ck, value);
            // Auto-heal: if the stored row was a double-encoded string,
            // repersist as proper JSONB so future reads skip the parse.
            if (typeof data.data === "string") {
              this.set(key, value, stationId).catch(() => {});
            }
            return value;
          }
        }
      }

      // 2. User-scoped row (legacy / combined-view / pre-station data).
      const usId = userScopedId(key, ownerId);
      const { data: usData, error: usError } = await client
        .from("app_kv")
        .select("data")
        .eq("id", usId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (usError) throw usError;
      if (usData?.data != null) {
        const value = coerceJson<T>(usData.data);
        if (value != null) {
          this.memoryCache.set(ck, { value, ts: Date.now() });
          writeCache(ck, value);
          if (typeof usData.data === "string") {
            // Repersist under the scoped id as proper JSONB.
            this.set(key, value, stationId).catch(() => {});
          }
          return value;
        }
      }

      // 3. Legacy bare-key row (pre-user-scoping). Read once so existing data
      // is not lost; the next set() repersists it under the scoped id.
      if (key !== usId) {
        const { data: legacy } = await client
          .from("app_kv")
          .select("data")
          .eq("id", key)
          .eq("owner_id", ownerId)
          .maybeSingle();
        if (legacy?.data != null) {
          const value = coerceJson<T>(legacy.data);
          if (value != null) {
            this.memoryCache.set(ck, { value, ts: Date.now() });
            writeCache(ck, value);
            this.set(key, value, stationId).catch(() => {});
            return value;
          }
        }
      }
      // No cloud row — fall back to cache (e.g. offline-first write not yet synced).
      return readCache<T>(ck);
    } catch {
      return readCache<T>(ck);
    }
  }

  /**
   * Persist a value to cloud (app_kv) upsert. Also writes the local cache so
   * subsequent reads are instant and offline-capable.
   *
   * When `stationId` is provided, writes the station-scoped row and sets the
   * `station_id` column so station-filtered queries work. The legacy bare-key
   * row (if any) is left in place for combined-view reads; it is NOT deleted
   * so a user toggling Combined View still sees aggregated data.
   */
  async set<T = Json>(
    key: string,
    value: T,
    stationId?: string,
  ): Promise<void> {
    const ck = stationId ? `${key}__${stationId}` : key;
    writeCache(ck, value);
    this.memoryCache.set(ck, { value, ts: Date.now() });

    const ownerId = await currentUserId();
    if (!ownerId) return; // offline / unauthenticated — cached locally only

    try {
      const client = getSupabaseClient();
      const { error } = await client.from("app_kv").upsert(
        {
          id: rowId(key, ownerId, stationId),
          collection: COLLECTION,
          owner_id: ownerId,
          station_id: stationId ?? null,
          data: value as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
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
  async delete(key: string, stationId?: string): Promise<void> {
    const ck = stationId ? `${key}__${stationId}` : key;
    clearCache(ck);
    this.memoryCache.delete(ck);

    const ownerId = await currentUserId();
    if (!ownerId) return;

    try {
      const client = getSupabaseClient();
      const scopedId = rowId(key, ownerId, stationId);
      const { error } = await client
        .from("app_kv")
        .delete()
        .eq("id", scopedId)
        .eq("owner_id", ownerId);
      if (error) throw error;
      // Also clean up a legacy bare-key row if one exists for this owner.
      if (scopedId !== key) {
        await client
          .from("app_kv")
          .delete()
          .eq("id", key)
          .eq("owner_id", ownerId);
      }
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

    const suffix = `__${ownerId}`;
    try {
      const client = getSupabaseClient();
      // Only rows owned by this user (RLS also enforces this). The prefix is
      // matched against the logical key, so scope it to the user's rows.
      let query = client
        .from("app_kv")
        .select("id, data")
        .eq("owner_id", ownerId);
      if (prefix) query = query.like("id", `${prefix}%`);
      const { data, error } = await query;
      if (error) throw error;

      const out: Record<string, T> = {};
      for (const row of data ?? []) {
        // Strip the user-scope suffix to recover the logical key callers use.
        const logicalKey = row.id.endsWith(suffix)
          ? row.id.slice(0, -suffix.length)
          : row.id;
        out[logicalKey] = coerceJson<T>(row.data) as T;
      }
      return out;
    } catch {
      return {};
    }
  }

  /** Drop the in-memory cache (forces next get to hit cloud). */
  invalidate(key?: string, stationId?: string): void {
    if (key) {
      const ck = stationId ? `${key}__${stationId}` : key;
      this.memoryCache.delete(ck);
    } else {
      this.memoryCache.clear();
    }
  }

  /**
   * Subscribe to real-time changes on a cloud key. When another device writes
   * to the same app_kv row, the callback fires INSTANTLY with the new value —
   * no polling, no delay. Returns an unsubscribe function.
   *
   * The subscription listens for UPDATE events on app_kv rows matching the
   * computed row id (scoped by owner + station). On receipt, it invalidates
   * the memory cache (so the next get() reads fresh) and calls the callback
   * with the new data.
   */
  subscribe<T = Json>(
    key: string,
    stationId: string | undefined,
    callback: (value: T | null) => void,
  ): () => void {
    let channel: ReturnType<
      ReturnType<typeof getSupabaseClient>["channel"]
    > | null = null;
    let active = true;

    (async () => {
      const ownerId = await currentUserId();
      if (!active || !ownerId) return;

      const ck = stationId ? `${key}__${stationId}` : key;
      const scopedId = rowId(key, ownerId, stationId);
      const client = getSupabaseClient();

      channel = client
        .channel(`app_kv:${scopedId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "app_kv",
            filter: `id=eq.${scopedId}`,
          },
          (payload) => {
            // Invalidate memory cache so next get() reads fresh.
            this.memoryCache.delete(ck);
            const rawNew =
              payload.eventType === "DELETE"
                ? null
                : ((payload.new as { data?: unknown })?.data ?? null);
            const newData = rawNew == null ? null : coerceJson<T>(rawNew);
            if (newData != null) {
              writeCache(ck, newData);
              this.memoryCache.set(ck, { value: newData, ts: Date.now() });
            } else {
              clearCache(ck);
            }
            callback(newData);
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) {
        try {
          getSupabaseClient().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }

  /**
   * Subscribe to real-time changes on ALL app_kv rows for a station. Useful
   * for the FuelContext compact blob + per-component keys that share a
   * station scope. The callback receives the row id + new data for each
   * changed row.
   */
  subscribeToStation<T = Json>(
    stationId: string | undefined,
    callback: (rowId: string, value: T | null) => void,
  ): () => void {
    let channel: ReturnType<
      ReturnType<typeof getSupabaseClient>["channel"]
    > | null = null;
    let active = true;

    (async () => {
      const ownerId = await currentUserId();
      if (!active || !ownerId) return;

      const client = getSupabaseClient();
      const filter = stationId
        ? `station_id=eq.${stationId}`
        : `owner_id=eq.${ownerId}`;

      channel = client
        .channel(`app_kv:station:${stationId ?? ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "app_kv",
            filter,
          },
          (payload) => {
            const row =
              payload.eventType === "DELETE"
                ? (payload.old as { id?: string })
                : (payload.new as { id?: string; data?: unknown });
            const id = row?.id ?? "";
            // Invalidate any memory cache entry whose key is a prefix of this row id.
            for (const [ck] of this.memoryCache) {
              if (id.includes(ck.split("__")[0])) {
                this.memoryCache.delete(ck);
              }
            }
            const rawValue = (payload.new as { data?: unknown })?.data ?? null;
            const value = rawValue == null ? null : coerceJson<T>(rawValue);
            if (value != null && id) {
              callback(id, value);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) {
        try {
          getSupabaseClient().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }
}

export const cloudStorageService = new CloudStorageService();
export default cloudStorageService;
