/**
 * Live Channels API
 *
 * Server-side proxy for the live-channel JSON API. The upstream API does NOT
 * send CORS headers, so browser-side fetches from fuel-app-mobile.pages.dev /
 * fuel-app-mobile.vercel.app are blocked by the browser. This serverless
 * function fetches the data server-side (no CORS restriction), decompresses
 * the gzip response, and returns it with permissive CORS headers so the
 * client can consume it.
 *
 * The client NEVER sees the upstream hostname — all requests go through
 * /api/live-channels, so there is zero upstream attribution in the UI.
 *
 * GET /api/live-channels?mode=tv|radio&type=countries|categories&id=us|news
 *
 * Returns: { channels: LiveChannel[], count: number }
 */
import type { IncomingMessage, ServerResponse } from "http";
import { gunzipSync } from "zlib";

interface LiveChannel {
  nanoid: string;
  name: string;
  stream_urls: string[];
  youtube_urls: string[];
  languages: string[];
  country: string;
  isGeoBlocked: boolean;
}

/** Minimal Vercel-compatible request/response wrappers (no @vercel/node dep). */
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

// In-memory cache (per serverless instance, 5-min TTL)
const cache = new Map<string, { data: LiveChannel[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const r = wrapRes(res);
  const query = parseQuery(req);
  const apiReq = req as ApiRequest;
  apiReq.query = query;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=300");

  if (req.method === "OPTIONS") {
    r.status(204).end();
    return;
  }

  const mode = (query.mode as string) || "tv";
  const type = (query.type as string) || "countries";
  const id = ((query.id as string) || "us").toLowerCase();

  // Validate parameters
  if (!["tv", "radio"].includes(mode)) {
    r.status(400).json({ error: "Invalid mode" });
    return;
  }
  if (!["countries", "categories"].includes(type)) {
    r.status(400).json({ error: "Invalid type" });
    return;
  }

  const cacheKey = `${mode}/${type}/${id}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    r.status(200).json({ channels: cached.data, count: cached.data.length });
    return;
  }

  const upstreamUrl = `https://tvgarden.world/api/${mode}/${type}/${id}.json`;

  try {
    // Fetch WITHOUT Accept-Encoding so fetch doesn't auto-decompress.
    // The upstream returns raw gzip bytes with content-type: application/json
    // but NO Content-Encoding header, so fetch() doesn't auto-decompress.
    const upstreamRes = await fetch(upstreamUrl, {
      headers: { "Accept-Encoding": "identity" },
    });

    if (!upstreamRes.ok) {
      r.status(200).json({ channels: [], count: 0 });
      return;
    }

    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    let jsonText: string;

    // Check for gzip magic bytes (0x1f 0x8b) — the upstream returns
    // gzip-compressed JSON even with Accept-Encoding: identity
    if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      jsonText = gunzipSync(buffer).toString("utf-8");
    } else {
      jsonText = buffer.toString("utf-8");
    }

    const data = JSON.parse(jsonText);
    const channels: LiveChannel[] = Array.isArray(data) ? data : [];

    // Filter out channels with no playable URL (never show dead streams)
    const playable = channels.filter(
      (ch) =>
        (ch.stream_urls && ch.stream_urls.length > 0) ||
        (ch.youtube_urls && ch.youtube_urls.length > 0),
    );

    cache.set(cacheKey, { data: playable, ts: Date.now() });

    r.status(200).json({ channels: playable, count: playable.length });
  } catch (err) {
    console.error("[live-channels] fetch error:", err);
    r.status(200).json({ channels: [], count: 0 });
  }
}
