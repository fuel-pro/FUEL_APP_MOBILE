/**
 * Reverse-engineered streamingunity.vip (StreamingCommunity mirror) contract.
 *
 * The site is an Inertia.js (Laravel) SPA. Every GET page returns an HTML
 * document whose root element carries a `data-page` attribute containing the
 * full Inertia page object as HTML-entity-encoded JSON. That is the whole
 * "API" — there is no public JSON REST endpoint that works without a session
 * (the api/* routes require POST + CSRF token), so the server-side proxy
 * simply GETs the public pages and parses the embedded `data-page` JSON.
 *
 * Reverse-engineered route map (from the injected Ziggy route table):
 *   catalog  GET /en                                  -> Home/Home   (sliders + genres)
 *   browse   GET /en/browse/{slider}[?genre=N]        -> Titles/Browse
 *   search   GET /en/search?q=X                       -> Titles/Browse
 *   title    GET /en/titles/{id}-{slug}               -> Titles/Title (movie scws_id | tv loadedSeason.episodes[].scws_id)
 *   season   GET /en/titles/{id}-{slug}/season-{num}  -> Titles/Title
 *   player   GET /en/iframe/{id}[?episode_id=N]       -> HTML with <iframe src="https://vixcloud.co/embed/{scws_id}?token=...">
 *
 * Image CDN: https://cdn.streamingunity.vip/images/{filename}
 * Video CDN: https://vixcloud.co/embed/{scws_id}?token=... (time-limited token,
 *            must be fetched fresh per play via the /en/iframe route).
 */

export const SU_BASE = "https://streamingunity.vip";
export const SU_CDN = "https://cdn.streamingunity.vip";
export const SU_LOCALE = "en";

export interface SuImage {
  filename: string;
  type: "poster" | "cover" | "background" | "logo" | "cover_mobile" | string;
  lang?: string | null;
}

export interface SuTitle {
  id: number;
  slug: string;
  name: string;
  type: "movie" | "tv";
  score?: string;
  age?: number;
  seasons_count?: number;
  last_air_date?: string;
  images?: SuImage[];
  plot?: string;
  runtime?: number | null;
  release_date?: string;
  scws_id?: number | null;
  quality?: string;
  tmdb_id?: number | null;
  imdb_id?: string | null;
  genres?: SuGenre[];
  main_actors?: SuPerson[];
  main_directors?: SuPerson[];
  trailers?: SuTrailer[];
  seasons?: SuSeason[];
  keywords?: string[];
}

export interface SuGenre {
  id: number;
  name: string;
  type: "movie" | "tv" | "all";
}

export interface SuPerson {
  id: number;
  name: string;
}

export interface SuTrailer {
  id?: number;
  youtube_id?: string;
  url?: string;
}

export interface SuEpisode {
  id: number;
  number: number;
  name?: string;
  plot?: string;
  duration?: number;
  scws_id: number;
  season_id: number;
  quality?: string;
}

export interface SuSeason {
  id: number;
  number: number;
  name?: string | null;
  plot?: string;
  title_id: number;
  episodes?: SuEpisode[];
}

export interface SuSlider {
  name: string;
  label: string;
  titles: SuTitle[];
}

export interface SuCatalog {
  sliders: SuSlider[];
  genres: SuGenre[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Fetch a streamingunity page and return the decoded Inertia page object. */
export async function fetchSuPage(path: string): Promise<any> {
  const url = path.startsWith("http") ? path : `${SU_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  return parseDataPage(html);
}

/** Extract + decode the Inertia `data-page` JSON from an HTML document. */
export function parseDataPage(html: string): any {
  const m = html.match(/data-page="([\s\S]*?)"/);
  if (!m) return null;
  const decoded = decodeEntities(m[1]);
  try {
    // The attribute value ends at the closing quote; trim any trailing junk.
    const end = decoded.lastIndexOf("}");
    return JSON.parse(decoded.slice(0, end + 1));
  } catch {
    return null;
  }
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

/** Build the public image URL for a title image. */
export function suImageUrl(filename?: string | null): string | null {
  if (!filename) return null;
  return `${SU_CDN}/images/${filename}`;
}

/** Pick the best image of a given type from a title's images array. */
export function pickImage(
  images: SuImage[] | undefined,
  type: string,
): string | null {
  if (!images || images.length === 0) return null;
  const found = images.find((i) => i.type === type);
  return suImageUrl(found?.filename);
}

/** The three home sliders (trending/latest/top10) — the movie catalog. */
export function suSliderPath(slider: string): string {
  return `/${SU_LOCALE}/browse/${encodeURIComponent(slider)}`;
}

export function suSearchPath(q: string): string {
  return `/${SU_LOCALE}/search?q=${encodeURIComponent(q)}`;
}

export function suTitlePath(id: number | string, slug: string): string {
  return `/${SU_LOCALE}/titles/${id}-${encodeURIComponent(slug)}`;
}

export function suSeasonPath(
  id: number | string,
  slug: string,
  num: number,
): string {
  return `/${SU_LOCALE}/titles/${id}-${encodeURIComponent(slug)}/season-${num}`;
}

export function suIframePath(
  id: number | string,
  episodeId?: number | string,
): string {
  const ep = episodeId ? `?episode_id=${episodeId}` : "";
  return `/${SU_LOCALE}/iframe/${id}${ep}`;
}

/**
 * Fetch the player iframe route and extract the vixcloud embed URL.
 * The iframe route returns a tiny HTML page whose <iframe src> is the
 * token-bearing vixcloud player URL. That URL is what the client iframes.
 */
export async function fetchSuPlayerUrl(
  id: number | string,
  episodeId?: number | string,
): Promise<string | null> {
  const res = await fetch(`${SU_BASE}${suIframePath(id, episodeId)}`, {
    headers: { "User-Agent": UA, Referer: `${SU_BASE}/` },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/src="(https:\/\/vixcloud\.co\/embed\/[^"]+)"/);
  if (!m) return null;
  return decodeEntities(m[1]);
}

/** Movie genre ids -> labels (type "movie" or "all", from the live catalog). */
export const SU_MOVIE_GENRES: Record<number, string> = {
  4: "Action",
  11: "Adventure",
  19: "Animation",
  12: "Comedy",
  2: "Crime",
  24: "Documentary",
  1: "Drama",
  16: "Family",
  8: "Fantasy",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

/** Filter a title list to movies only (type === "movie"). */
export function moviesOnly(titles: SuTitle[] | undefined): SuTitle[] {
  return (titles || []).filter((t) => t && t.type === "movie");
}
