/**
 * MovieService — client-side service for the Movies sub-tab.
 *
 * Talks to the /api/movies reverse-engineered proxy (Vercel api/movies.ts +
 * Cloudflare functions/api/movies.ts), which fetches the streamingunity.vip
 * (StreamingCommunity mirror) catalog/search/title/player server-side and
 * returns clean normalized JSON. The client NEVER sees the upstream hostname.
 *
 * Uses a relative /api/movies path that works same-origin on both platforms.
 * Includes an in-memory cache + a background prefetch so the Movies sub-tab
 * renders instantly when the user opens it.
 */

export interface MovieItem {
  id: number;
  slug: string;
  name: string;
  type: "movie" | "tv";
  score: string | null;
  age: number | null;
  seasonsCount: number;
  year: string | null;
  poster: string | null;
  cover: string | null;
  background: string | null;
  logo: string | null;
}

export interface MovieSlider {
  name: string;
  label: string;
  titles: MovieItem[];
}

export interface MovieGenre {
  id: number;
  name: string;
  type: "movie" | "tv" | "all";
}

export interface MovieCatalog {
  sliders: MovieSlider[];
  genres: MovieGenre[];
}

export interface MovieEpisode {
  id: number;
  number: number;
  name: string | null;
  plot: string | null;
  duration: number | null;
  scwsId: number;
  quality: string | null;
}

export interface MovieDetail extends MovieItem {
  plot: string | null;
  runtime: number | null;
  releaseDate: string | null;
  scwsId: number | null;
  quality: string | null;
  tmdbId: number | null;
  imdbId: string | null;
  genres: { id: number; name: string }[];
  actors: string[];
  directors: string[];
  trailers: string[];
  seasons: { id: number; number: number; name: string | null }[];
  loadedSeason: {
    id: number;
    number: number;
    episodes: MovieEpisode[];
  } | null;
}

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getJson<T>(path: string): Promise<T | null> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as T;
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    cache.set(path, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/** Fetch the full movie catalog (home sliders + genres). */
export async function fetchMovieCatalog(): Promise<MovieCatalog> {
  const data = await getJson<MovieCatalog>(`/api/movies?mode=catalog`);
  return data ?? { sliders: [], genres: [] };
}

/** Fetch a full slider (trending | latest | top10), optionally genre-filtered. */
export async function fetchMovieBrowse(
  slider: string,
  genre?: number,
): Promise<{ label: string | null; titles: MovieItem[]; count: number }> {
  const g = genre ? `&genre=${genre}` : "";
  const data = await getJson<{
    label: string | null;
    titles: MovieItem[];
    count: number;
  }>(`/api/movies?mode=browse&slider=${encodeURIComponent(slider)}${g}`);
  return data ?? { label: null, titles: [], count: 0 };
}

/** Search movies by query. */
export async function searchMovies(q: string): Promise<MovieItem[]> {
  if (!q.trim()) return [];
  const data = await getJson<{ titles: MovieItem[]; count: number }>(
    `/api/movies?mode=search&q=${encodeURIComponent(q)}`,
  );
  return data?.titles ?? [];
}

/** Fetch a movie's full detail (plot, actors, genres, scwsId, seasons). */
export async function fetchMovieDetail(
  id: number,
  slug: string,
  season?: number,
): Promise<MovieDetail | null> {
  const s = season && season >= 1 ? `&season=${season}` : "";
  const data = await getJson<{ title: MovieDetail | null }>(
    `/api/movies?mode=title&id=${id}&slug=${encodeURIComponent(slug)}${s}`,
  );
  return data?.title ?? null;
}

/**
 * Fetch the fresh player iframe URL for a movie (or a TV episode).
 * The vixcloud token is time-limited, so this is always fetched fresh
 * (the proxy does not cache player URLs).
 */
export async function fetchMoviePlayerUrl(
  id: number,
  episodeId?: number,
): Promise<string | null> {
  const ep = episodeId ? `&episode=${episodeId}` : "";
  try {
    const res = await fetch(`/api/movies?mode=player&id=${id}${ep}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url ?? null;
  } catch {
    return null;
  }
}

export interface MovieStreamInfo {
  playlistUrl: string;
  servers: { name: string; active: boolean; url: string }[];
  thumbnailsUrl: string | null;
  canPlayFHD: boolean;
}

/**
 * Fetch the raw HLS playlist info for NATIVE (hls.js) playback.
 * The vixcloud iframe is frame-ancestors-locked to the upstream site, but
 * the HLS playlist/rendition/segment chain is CORS-open, so the client can
 * play the stream natively — no iframe, no ads, no CSP block. Always fetched
 * fresh (the playlist token is time-limited).
 */
export async function fetchMovieStreams(
  id: number,
  episodeId?: number,
): Promise<MovieStreamInfo | null> {
  const ep = episodeId ? `&episode=${episodeId}` : "";
  try {
    const res = await fetch(`/api/movies?mode=streams&id=${id}${ep}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.streams ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Background prefetch — warm the catalog cache so the Movies sub-tab renders
// instantly. Runs once per page load, ~3s after app boot, fire-and-forget.
// ---------------------------------------------------------------------------
let prefetchStarted = false;
export function prefetchMoviesInBackground(): void {
  if (prefetchStarted) return;
  prefetchStarted = true;
  setTimeout(() => {
    void Promise.allSettled([
      fetchMovieCatalog(),
      fetchMovieBrowse("trending"),
      fetchMovieBrowse("latest"),
    ]);
  }, 3000);
}
