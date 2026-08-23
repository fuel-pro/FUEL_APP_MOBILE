/**
 * tvgarden Catalog API (Vercel serverless)
 *
 * Returns the full reverse-engineered catalog of available countries (218)
 * + TV categories (27) + radio categories (22) from the tvgarden.world
 * source. Lets the frontend dynamically build filter dropdowns without
 * hardcoding the lists.
 *
 * GET /api/tvgarden
 *   -> { countries: [{code,name}], tvCategories: [{id,label}],
 *        radioCategories: [{id,label}], sourceCount: {...} }
 *
 * GET /api/tvgarden?mode=tv&type=countries&id=us
 *   -> alias for /api/live-channels (same channel fetch, same response shape)
 *      so the frontend can use a single endpoint for both catalog + channels.
 */
import type { IncomingMessage, ServerResponse } from "http";
import {
  decodeTvgardenBody,
  filterPlayable,
  isValidTvgRequest,
  tvgardenCatalog,
  tvgardenUrl,
  type TvgChannel,
  type TvgMode,
  type TvgType,
} from "./_lib/tvgarden.js";

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

const cache = new Map<string, { data: TvgChannel[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const r = wrapRes(res);
  const query = parseQuery(req);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=300");

  if (req.method === "OPTIONS") {
    r.status(204).end();
    return;
  }

  const mode = (query.mode as string) || "";
  const type = (query.type as string) || "";
  const id = ((query.id as string) || "").toLowerCase();

  // No mode/type/id -> return the catalog index
  if (!mode && !type && !id) {
    r.status(200).json(tvgardenCatalog());
    return;
  }

  // mode/type/id present -> fetch channels (alias for /api/live-channels)
  if (!isValidTvgRequest(mode, type, id)) {
    r.status(400).json({
      error: "Invalid mode/type/id",
      channels: [],
      count: 0,
    });
    return;
  }

  const cacheKey = `${mode}/${type}/${id}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    r.status(200).json({ channels: cached.data, count: cached.data.length });
    return;
  }

  try {
    const upstreamRes = await fetch(
      tvgardenUrl(mode as TvgMode, type as TvgType, id),
    );
    if (!upstreamRes.ok) {
      r.status(200).json({ channels: [], count: 0 });
      return;
    }
    const channels = await decodeTvgardenBody(await upstreamRes.arrayBuffer());
    const playable = filterPlayable(channels);
    cache.set(cacheKey, { data: playable, ts: Date.now() });
    r.status(200).json({ channels: playable, count: playable.length });
  } catch (err) {
    console.error("[tvgarden] fetch error:", err);
    r.status(200).json({ channels: [], count: 0 });
  }
}
