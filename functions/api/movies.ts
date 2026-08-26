/**
 * Cloudflare Pages Function — Movies API
 *
 * Reverse-engineered proxy for streamingunity.vip (a StreamingCommunity
 * mirror, an Inertia.js/Laravel SPA). Mirrors the Vercel handler in
 * api/movies.ts. The reverse-engineered contract (the public GET pages whose
 * HTML embeds an Inertia `data-page` JSON object) is captured inline here
 * because Cloudflare Pages Functions bundle each file independently (no
 * cross-file imports from api/_lib). Keep this in sync with
 * api/_lib/streamingunity.ts.
 *
 * Lives at functions/api/movies.ts → /api/movies
 *
 * GET /api/movies?mode=catalog
 * GET /api/movies?mode=browse&slider=trending|latest|top10[&genre=N]
 * GET /api/movies?mode=search&q=X
 * GET /api/movies?mode=title&id=429&slug=avatar
 * GET /api/movies?mode=player&id=429[&episode=9977]
 */

interface Env {}

const SU_BASE = "https://streamingunity.vip";
const SU_CDN = "https://cdn.streamingunity.vip";
const SU_LOCALE = "en";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
};

interface SuImage {
  filename: string;
  type: string;
  lang?: string | null;
}
interface SuTitle {
  id: number;
  slug: string;
  name: string;
  type: "movie" | "tv";
  score?: string;
  age?: number;
  seasons_count?: number;
  last_air_date?: string;
  release_date?: string;
  images?: SuImage[];
  plot?: string;
  runtime?: number | null;
  scws_id?: number | null;
  quality?: string;
  tmdb_id?: number | null;
  imdb_id?: string | null;
  genres?: { id: number; name: string }[];
  main_actors?: { id: number; name: string }[];
  main_directors?: { id: number; name: string }[];
  trailers?: { youtube_id?: string; url?: string }[];
  seasons?: { id: number; number: number; name?: string | null }[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseDataPage(html: string): any {
  const m = html.match(/data-page="([\s\S]*?)"/);
  if (!m) return null;
  const decoded = decodeEntities(m[1]);
  try {
    const end = decoded.lastIndexOf("}");
    return JSON.parse(decoded.slice(0, end + 1));
  } catch {
    return null;
  }
}

async function fetchSuPage(path: string): Promise<any> {
  const url = path.startsWith("http") ? path : `${SU_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) return null;
  return parseDataPage(await res.text());
}

function suImageUrl(filename?: string | null): string | null {
  return filename ? `${SU_CDN}/images/${filename}` : null;
}

function pickImage(images: SuImage[] | undefined, type: string): string | null {
  if (!images || images.length === 0) return null;
  return suImageUrl(images.find((i) => i.type === type)?.filename);
}

function moviesOnly(titles: SuTitle[] | undefined): SuTitle[] {
  return (titles || []).filter((t) => t && t.type === "movie");
}

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

async function fetchSuPlayerUrl(
  id: string,
  episodeId?: string,
): Promise<string | null> {
  const ep = episodeId ? `?episode_id=${episodeId}` : "";
  const res = await fetch(`${SU_BASE}/${SU_LOCALE}/iframe/${id}${ep}`, {
    headers: { "User-Agent": UA, Referer: `${SU_BASE}/` },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/src="(https:\/\/vixcloud\.co\/embed\/[^"]+)"/);
  return m ? decodeEntities(m[1]) : null;
}

// In-memory cache (per isolate, 5-min TTL). Player URLs are NOT cached.
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get("mode") || "catalog";

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    if (mode === "player") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id", url: null }, 400);
      const playerUrl = await fetchSuPlayerUrl(
        id,
        url.searchParams.get("episode") || undefined,
      );
      return json({ url: playerUrl });
    }

    if (mode === "title") {
      const id = url.searchParams.get("id");
      const slug = url.searchParams.get("slug") || "";
      if (!id) return json({ error: "Missing id", title: null }, 400);
      const page = await fetchSuPage(
        `/${SU_LOCALE}/titles/${id}-${encodeURIComponent(slug)}`,
      );
      const t: SuTitle | undefined = page?.props?.title;
      if (!t) return json({ title: null });
      const loadedSeason = page?.props?.loadedSeason;
      return json({
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
    }

    const cacheKey = `${mode}|${url.searchParams.get("slider") || ""}|${url.searchParams.get("genre") || ""}|${url.searchParams.get("q") || ""}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return json(cached.data);

    if (mode === "catalog") {
      const page = await fetchSuPage(`/${SU_LOCALE}`);
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
      return json(payload);
    }

    if (mode === "browse") {
      const slider = url.searchParams.get("slider") || "trending";
      const genre = url.searchParams.get("genre");
      const genreQ = genre ? `?genre=${encodeURIComponent(genre)}` : "";
      const page = await fetchSuPage(
        `/${SU_LOCALE}/browse/${encodeURIComponent(slider)}${genreQ}`,
      );
      const titles = moviesOnly(page?.props?.titles).map(normalizeTitle);
      const payload = {
        label: page?.props?.label ?? null,
        titles,
        count: titles.length,
      };
      cache.set(cacheKey, { data: payload, ts: Date.now() });
      return json(payload);
    }

    if (mode === "search") {
      const query = url.searchParams.get("q") || "";
      if (!query.trim()) return json({ titles: [], count: 0 });
      const page = await fetchSuPage(
        `/${SU_LOCALE}/search?q=${encodeURIComponent(query)}`,
      );
      const titles = moviesOnly(page?.props?.titles).map(normalizeTitle);
      const payload = { titles, count: titles.length };
      cache.set(cacheKey, { data: payload, ts: Date.now() });
      return json(payload);
    }

    return json({ error: "Unknown mode", titles: [] }, 400);
  } catch {
    return json({ error: "fetch failed", titles: [] });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
