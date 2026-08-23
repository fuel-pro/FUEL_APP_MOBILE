/**
 * IPTV-Org Channels API
 *
 * Server-side proxy for the iptv-org public API (https://iptv-org.github.io/api/).
 * Fetches channels.json (10MB) + streams.json server-side, merges them, filters
 * by country/category, and returns a compact LiveChannel[] so the browser never
 * downloads the full 10MB file.
 *
 * iptv-org.github.io DOES send CORS headers (GitHub Pages), but the raw files are
 * too large for client-side fetch (channels.json = 10MB, streams.json = 4MB), so
 * this proxy filters server-side and returns only the relevant slice.
 *
 * GET /api/iptv-channels?country=us&category=news
 * GET /api/iptv-channels?country=us            (all categories for that country)
 * GET /api/iptv-channels?category=news         (all countries for that category)
 * GET /api/iptv-channels                       (all channels, capped at 500)
 *
 * Returns: { channels: IptvChannel[], count: number, source: "iptv-org" }
 */
import type { IncomingMessage, ServerResponse } from "http";

export interface IptvChannel {
  id: string;
  name: string;
  url: string;
  logo: string;
  country: string;
  language: string;
  category: string;
}

interface ApiRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
}
interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

function wrapRes(res: ServerResponse): ApiResponse {
  const r = res as ApiResponse;
  r.status = (code: number) => {
    res.statusCode = code;
    return r;
  };
  r.json = (body: unknown) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  return r;
}

function parseQuery(req: IncomingMessage): Record<string, string | string[]> {
  const fullUrl = req.url || "";
  const searchIdx = fullUrl.indexOf("?");
  if (searchIdx < 0) return {};
  return Object.fromEntries(new URLSearchParams(fullUrl.slice(searchIdx + 1)));
}

// In-memory cache (per serverless instance, 10-min TTL — iptv-org updates daily)
const cache = new Map<string, { data: IptvChannel[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

const IPTV_BASE = "https://iptv-org.github.io/api";
const MAX_RESULTS = 500;

interface IptvChannelRaw {
  id: string;
  name: string;
  alt_names?: string[];
  network?: string;
  owners?: string[];
  country: string;
  subdivision?: string | null;
  city?: string | null;
  categories: string[];
  is_nsfw: boolean;
  launched?: string | null;
  closed?: string | null;
  replaced_by?: string | null;
  website?: string | null;
  logo: string;
}

interface IptvStreamRaw {
  channel: string;
  url: string;
  quality?: string | null;
  height?: number | null;
  video_codec?: string | null;
  audio_codec?: string | null;
  bitrate?: number | null;
  frame_rate?: number | null;
}

/** Fetch + parse a JSON file from iptv-org (handles large responses). */
async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${IPTV_BASE}/${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const r = wrapRes(res);
  const query = parseQuery(req);
  const apiReq = req as ApiRequest;
  apiReq.query = query;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=600");

  if (req.method === "OPTIONS") {
    r.status(204).end();
    return;
  }

  const country = ((query.country as string) || "").toLowerCase().trim();
  const category = ((query.category as string) || "").toLowerCase().trim();
  const limit = Math.min(
    MAX_RESULTS,
    parseInt((query.limit as string) || String(MAX_RESULTS), 10) || MAX_RESULTS,
  );

  const cacheKey = `iptv/${country || "all"}/${category || "all"}/${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    r.status(200).json({
      channels: cached.data,
      count: cached.data.length,
      source: "iptv-org",
    });
    return;
  }

  try {
    // Fetch channels + streams in parallel
    const [channelsRaw, streamsRaw] = await Promise.all([
      fetchJson<IptvChannelRaw[]>("channels.json"),
      fetchJson<IptvStreamRaw[]>("streams.json"),
    ]);

    // Build a map of channel_id -> first stream URL (skip closed/replaced channels)
    const streamMap = new Map<string, string>();
    for (const s of streamsRaw) {
      if (s.channel && s.url && !streamMap.has(s.channel)) {
        streamMap.set(s.channel, s.url);
      }
    }

    // Merge: only keep channels that have a stream URL + are not closed/NSFW
    let merged: IptvChannel[] = [];
    for (const ch of channelsRaw) {
      if (ch.closed || ch.replaced_by || ch.is_nsfw) continue;
      const url = streamMap.get(ch.id);
      if (!url) continue; // never show dead streams

      // Country filter
      if (country && ch.country.toLowerCase() !== country) continue;

      // Category filter (channels.json categories is an array)
      if (category) {
        const cats = (ch.categories || []).map((c) => c.toLowerCase());
        if (!cats.includes(category)) continue;
      }

      merged.push({
        id: ch.id,
        name: ch.name || ch.id,
        url,
        logo: ch.logo || "",
        country: ch.country || "",
        language: "",
        category: (ch.categories || []).join(", "),
      });
    }

    // Sort: channels with logos first, then alphabetically
    merged.sort((a, b) => {
      if (!!a.logo !== !!b.logo) return a.logo ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Cap at limit
    if (merged.length > limit) {
      merged = merged.slice(0, limit);
    }

    cache.set(cacheKey, { data: merged, ts: Date.now() });

    r.status(200).json({
      channels: merged,
      count: merged.length,
      source: "iptv-org",
    });
  } catch (err) {
    console.error("[iptv-channels] fetch error:", err);
    r.status(200).json({ channels: [], count: 0, source: "iptv-org" });
  }
}
