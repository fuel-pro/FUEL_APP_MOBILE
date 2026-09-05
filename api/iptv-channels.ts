/**
 * Vercel serverless — IPTV-Org Channels API (+ index.m3u source).
 *
 * Mirrors functions/api/iptv-channels.ts (Cloudflare Pages) so /api/iptv-channels
 * works on BOTH hosts. Additionally, this version ALSO ingests the iptv-org
 * canonical `index.m3u` playlist:
 *
 *   https://iptv-org.github.io/iptv/index.m3u
 *
 * and merges channels found there but absent from (or broken in) the
 * channels.json + streams.json merge — giving the longest-tail catalog
 * (multi-stream channels, GEO-tagged entries, etc.). Channels are deduped by
 * id (JSON-API id wins; the m3u tvg-id fills gaps). The browser never touches
 * iptv-org directly; it only calls this same-origin proxy.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export interface IptvChannel {
  id: string;
  name: string;
  url: string;
  logo: string;
  country: string;
  language: string;
  category: string;
}

const IPTV_BASE = "https://iptv-org.github.io/api";
const IPTV_M3U = "https://iptv-org.github.io/iptv/index.m3u";
const MAX_RESULTS = 12000;

interface IptvChannelRaw {
  id: string;
  name: string;
  country: string;
  categories: string[];
  is_nsfw: boolean;
  closed?: string | null;
  replaced_by?: string | null;
  logo: string;
}
interface IptvStreamRaw {
  channel: string;
  url: string;
}

const cache = new Map<string, { data: IptvChannel[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=600");
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${IPTV_BASE}/${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Parse an iptv-org playlist (.m3u). Each entry is:
 *   #EXTINF:-1 tvg-id="<id>" tvg-logo="<url>" group-title="<category>",<name>
 *   <stream-url>
 */
export function parseIptvM3u(text: string): IptvChannel[] {
  const lines = text.split(/\r?\n/);
  const out: IptvChannel[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;
    const meta = line.slice("#EXTINF:".length);
    const commaIdx = meta.lastIndexOf(",");
    if (commaIdx < 0) continue;
    const attrs = meta.slice(0, commaIdx);
    const name = meta.slice(commaIdx + 1).trim();
    // Next non-empty, non-#EXT line is the stream URL.
    let url = "";
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next) continue;
      if (next.startsWith("#EXT")) break; // attribute-only line — skip
      url = next;
      break;
    }
    if (!url) continue;
    const idMatch = /tvg-id="([^"]*)"/.exec(attrs);
    const logoMatch = /tvg-logo="([^"]*)"/.exec(attrs);
    const groupMatch = /group-title="([^"]*)"/.exec(attrs);
    out.push({
      id: idMatch?.[1] || `m3u-${i}`,
      name: name || `Channel ${i}`,
      url,
      logo: logoMatch?.[1] || "",
      country: "",
      language: "",
      category: groupMatch?.[1] || "",
    });
  }
  return out;
}

/** Merge m3u-sourced channels into the JSON-API list, dedup by id. */
export function mergeIptvSources(
  jsonChannels: IptvChannel[],
  m3uChannels: IptvChannel[],
): IptvChannel[] {
  const byId = new Map<string, IptvChannel>();
  for (const c of jsonChannels) byId.set(c.id, c);
  for (const c of m3uChannels) {
    const existing = byId.get(c.id);
    if (existing) {
      // Backfill country/category/language when the JSON row lacked them.
      if (!existing.country && c.country) existing.country = c.country;
      if (!existing.category && c.category) existing.category = c.category;
    } else if (!byId.has(c.id) && c.url) {
      byId.set(c.id, c);
    }
  }
  return Array.from(byId.values());
}

function json(res: ServerResponse, body: unknown): void {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify(body));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  const reqUrl = new URL(req.url || "/", "http://localhost");
  const country = (reqUrl.searchParams.get("country") || "")
    .toLowerCase()
    .trim();
  const category = (reqUrl.searchParams.get("category") || "")
    .toLowerCase()
    .trim();
  const limit = Math.min(
    MAX_RESULTS,
    parseInt(reqUrl.searchParams.get("limit") || String(MAX_RESULTS), 10) ||
      MAX_RESULTS,
  );

  const cacheKey = `iptv/${country || "all"}/${category || "all"}/${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    json(res, {
      channels: cached.data,
      count: cached.data.length,
      source: "iptv-org",
    });
    return;
  }

  try {
    // 1) JSON-API merge (channels.json + streams.json).
    const [channelsRaw, streamsRaw] = await Promise.all([
      fetchJson<IptvChannelRaw[]>("channels.json"),
      fetchJson<IptvStreamRaw[]>("streams.json"),
    ]);
    const streamMap = new Map<string, string>();
    for (const s of streamsRaw) {
      if (s.channel && s.url && !streamMap.has(s.channel)) {
        streamMap.set(s.channel, s.url);
      }
    }

    const jsonMerged: IptvChannel[] = [];
    for (const ch of channelsRaw) {
      if (ch.closed || ch.replaced_by || ch.is_nsfw) continue;
      const streamUrl = streamMap.get(ch.id);
      if (!streamUrl) continue;
      if (country && ch.country?.toLowerCase() !== country) continue;
      if (category) {
        const cats = (ch.categories || []).map((c) => c.toLowerCase());
        if (!cats.includes(category)) continue;
      }
      jsonMerged.push({
        id: ch.id,
        name: ch.name || ch.id,
        url: streamUrl,
        logo: ch.logo || "",
        country: ch.country || "",
        language: "",
        category: (ch.categories || []).join(", "),
      });
    }

    // 2) index.m3u source — merge channels not covered by the JSON path.
    let m3uChannels: IptvChannel[] = [];
    try {
      const m3uRes = await fetch(IPTV_M3U, { headers: { Accept: "*/*" } });
      if (m3uRes.ok) {
        const text = await m3uRes.text();
        m3uChannels = parseIptvM3u(text)
          .filter((c) => {
            if (country && c.country)
              return c.country.toLowerCase() === country;
            if (category && c.category) {
              return c.category.toLowerCase().includes(category);
            }
            return true;
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch {
      // m3u is best-effort; never fail the whole endpoint for it.
    }

    let merged = mergeIptvSources(jsonMerged, m3uChannels);
    merged.sort((a, b) => {
      if (!!a.logo !== !!b.logo) return a.logo ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (merged.length > limit) merged = merged.slice(0, limit);

    cache.set(cacheKey, { data: merged, ts: Date.now() });
    json(res, { channels: merged, count: merged.length, source: "iptv-org" });
  } catch (err) {
    console.error("[iptv-channels] fetch error:", err);
    json(res, { channels: [], count: 0, source: "iptv-org" });
  }
}
