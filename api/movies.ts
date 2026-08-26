/**
 * Movies API (Vercel serverless)
 *
 * Reverse-engineered proxy for streamingunity.vip (a StreamingCommunity
 * mirror, an Inertia.js/Laravel SPA). The shared library
 * `api/_lib/streamingunity.ts` captures the full reverse-engineered contract
 * (the public GET pages whose HTML embeds an Inertia `data-page` JSON object).
 *
 * Why a server-side proxy: the upstream pages do NOT send CORS headers, so
 * browser-side fetches from fuel-app-mobile.pages.dev /
 * fuel-app-mobile.vercel.app are blocked. This function fetches server-side
 * (no CORS restriction), parses the embedded data-page JSON, filters to
 * MOVIES, and returns clean normalized JSON with permissive CORS headers.
 *
 * The client NEVER sees the upstream hostname — all requests go through
 * /api/movies, so there is zero upstream attribution in the UI.
 *
 * GET /api/movies?mode=catalog
 * GET /api/movies?mode=browse&slider=trending|latest|top10[&genre=N]
 * GET /api/movies?mode=search&q=X
 * GET /api/movies?mode=title&id=429&slug=avatar
 * GET /api/movies?mode=player&id=429[&episode=9977]
 */
import type { IncomingMessage, ServerResponse } from "http";
import {
  fetchSuPage,
  fetchSuPlayerUrl,
  moviesOnly,
  pickImage,
  suSliderPath,
  suSearchPath,
  suTitlePath,
  SU_MOVIE_GENRES,
  type SuTitle,
} from "./_lib/streamingunity.js";

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

function parseQuery(req: IncomingMessage): Record<string, string> {
  const fullUrl = req.url || "";
  const idx = fullUrl.indexOf("?");
  if (idx < 0) return {};
  return Object.fromEntries(new URLSearchParams(fullUrl.slice(idx + 1)));
}

/** Normalize a raw title into the compact client shape. */
function normalizeTitle(t: SuTitle) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    type: t.type,
    score: t.score ?? null,
    age: t.age ?? null,
    seasonsCount: t.seasons_count ?? 0,
    year: (t.last_air_date || t.release_date || "").slice(0, 4) || null,
    poster: pickImage(t.images, "poster"),
    cover: pickImage(t.images, "cover"),
    background: pickImage(t.images, "background"),
    logo: pickImage(t.images, "logo"),
  };
}

// In-memory cache (per serverless instance, 5-min TTL). Player URLs are NOT
// cached (the vixcloud token is time-limited).
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const r = wrapRes(res);
  const q = parseQuery(req);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=300");

  if (req.method === "OPTIONS") {
    r.status(204).end();
    return;
  }

  const mode = (q.mode as string) || "catalog";

  try {
    // ---- PLAYER: return the fresh token-bearing vixcloud iframe URL ----
    if (mode === "player") {
      const id = q.id;
      if (!id) {
        r.status(400).json({ error: "Missing id", url: null });
        return;
      }
      const url = await fetchSuPlayerUrl(id, q.episode);
      r.status(200).json({ url });
      return;
    }

    // ---- TITLE: full detail (scws_id for movie / seasons for tv) ----
    if (mode === "title") {
      const id = q.id;
      const slug = q.slug || "";
      if (!id) {
        r.status(400).json({ error: "Missing id", title: null });
        return;
      }
      const page = await fetchSuPage(suTitlePath(id, slug));
      const t: SuTitle | undefined = page?.props?.title;
      if (!t) {
        r.status(200).json({ title: null });
        return;
      }
      const loadedSeason = page?.props?.loadedSeason;
      r.status(200).json({
        title: {
          ...normalizeTitle(t),
          plot: t.plot ?? null,
          runtime: t.runtime ?? null,
          releaseDate: t.release_date ?? null,
          scwsId: t.scws_id ?? null,
          quality: t.quality ?? null,
          tmdbId: t.tmdb_id ?? null,
          imdbId: t.imdb_id ?? null,
          genres: (t.genres || []).map((g) => ({ id: g.id, name: g.name })),
          actors: (t.main_actors || []).map((a) => a.name),
          directors: (t.main_directors || []).map((d) => d.name),
          trailers: (t.trailers || [])
            .map((tr) => tr.youtube_id || tr.url)
            .filter(Boolean),
          seasons: (t.seasons || []).map((s) => ({
            id: s.id,
            number: s.number,
            name: s.name ?? null,
          })),
          loadedSeason: loadedSeason
            ? {
                id: loadedSeason.id,
                number: loadedSeason.number,
                episodes: (loadedSeason.episodes || []).map((e: any) => ({
                  id: e.id,
                  number: e.number,
                  name: e.name ?? null,
                  plot: e.plot ?? null,
                  duration: e.duration ?? null,
                  scwsId: e.scws_id,
                  quality: e.quality ?? null,
                })),
              }
            : null,
        },
      });
      return;
    }

    // ---- CATALOG / BROWSE / SEARCH (movie lists) ----
    const cacheKey = `${mode}|${q.slider || ""}|${q.genre || ""}|${q.q || ""}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      r.status(200).json(cached.data);
      return;
    }

    if (mode === "catalog") {
      const page = await fetchSuPage(`/${"en"}`);
      const props = page?.props || {};
      const sliders = (props.sliders || []).map((s: any) => ({
        name: s.name,
        label: s.label,
        titles: moviesOnly(s.titles).map(normalizeTitle),
      }));
      const genres = (props.genres || [])
        .filter((g: any) => g.type === "movie" || g.type === "all")
        .map((g: any) => ({ id: g.id, name: g.name, type: g.type }));
      const payload = { sliders, genres };
      cache.set(cacheKey, { data: payload, ts: Date.now() });
      r.status(200).json(payload);
      return;
    }

    if (mode === "browse") {
      const slider = (q.slider as string) || "trending";
      const genre = q.genre ? `?genre=${encodeURIComponent(q.genre)}` : "";
      const page = await fetchSuPage(`${suSliderPath(slider)}${genre}`);
      const titles = moviesOnly(page?.props?.titles).map(normalizeTitle);
      const payload = {
        label: page?.props?.label ?? null,
        titles,
        count: titles.length,
      };
      cache.set(cacheKey, { data: payload, ts: Date.now() });
      r.status(200).json(payload);
      return;
    }

    if (mode === "search") {
      const query = (q.q as string) || "";
      if (!query.trim()) {
        r.status(200).json({ titles: [], count: 0 });
        return;
      }
      const page = await fetchSuPage(suSearchPath(query));
      const titles = moviesOnly(page?.props?.titles).map(normalizeTitle);
      const payload = { titles, count: titles.length };
      cache.set(cacheKey, { data: payload, ts: Date.now() });
      r.status(200).json(payload);
      return;
    }

    r.status(400).json({ error: "Unknown mode", titles: [] });
  } catch (err) {
    console.error("[movies] error:", err);
    r.status(200).json({ error: "fetch failed", titles: [] });
  }
}

// SU_MOVIE_GENRES is re-exported for the client genre pills (kept for parity
// with the Cloudflare function which inlines it).
export { SU_MOVIE_GENRES };
