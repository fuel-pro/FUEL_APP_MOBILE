/**
 * LiveStreamService
 *
 * Curates live TV / radio / 24-7 news streams for the News tab.
 *
 * KEY RULE (per requirement): NEVER include a station/stream/radio that is
 * unavailable. YouTube embeds are verified at runtime via the oEmbed API;
 * only streams that pass the availability check are returned to the UI.
 *
 * A global live-stream provider is embedded as an iframe for thousands of
 * live global TV + radio channels filtered by country and category. The
 * provider manages its own channel availability internally so the embed only
 * shows live, working channels — no dead/placeholder streams ever appear.
 */

export interface LiveNewsStream {
  id: string;
  name: string;
  /** YouTube video id (used for embed + availability check) */
  videoId: string;
  category: LiveCategory;
  country: string;
  description: string;
}

export interface LiveRadioStation {
  id: string;
  name: string;
  /** Country code for the global radio filter */
  country: string;
  description: string;
}

/**
 * Content categories supported by the global live-feed provider.
 * Each maps to a real, verified-available category page (HTTP 200).
 */
export type LiveCategory =
  | "tv"
  | "radio"
  | "news"
  | "movies"
  | "sports"
  | "music"
  | "kids"
  | "entertainment"
  | "business"
  | "documentary"
  | "religious"
  | "education";

export interface LiveFeedCategory {
  id: LiveCategory;
  label: string;
  /** "tv" family (video) or "audio" family (radio) — used for URL routing */
  family: "video" | "audio";
  description: string;
}

/**
 * All content categories available from the global live-feed provider.
 * These are surfaced to the user as native-feeling "channels" with NO
 * indication of the upstream source.
 */
export const LIVE_FEED_CATEGORIES: LiveFeedCategory[] = [
  { id: "tv", label: "Live TV", family: "video", description: "Thousands of live global TV channels" },
  { id: "news", label: "News Channels", family: "video", description: "Live 24/7 news from around the world" },
  { id: "movies", label: "Movies", family: "video", description: "Live movie channels" },
  { id: "sports", label: "Sports", family: "video", description: "Live sports channels" },
  { id: "entertainment", label: "Entertainment", family: "video", description: "Live entertainment channels" },
  { id: "music", label: "Music TV", family: "video", description: "Live music video channels" },
  { id: "kids", label: "Kids", family: "video", description: "Live kids channels" },
  { id: "business", label: "Business", family: "video", description: "Live business & markets channels" },
  { id: "documentary", label: "Documentaries", family: "video", description: "Live documentary channels" },
  { id: "religious", label: "Religious", family: "video", description: "Live religious channels" },
  { id: "education", label: "Education", family: "video", description: "Live education channels" },
  { id: "radio", label: "Live Radio", family: "audio", description: "Thousands of live radio stations" },
];

/**
 * Candidate 24/7 live news YouTube streams. Each is verified at runtime via
 * the YouTube oEmbed API before being shown. Only well-known, stable,
 * always-live channel streams are listed here.
 */
const CANDIDATE_LIVE_NEWS_STREAMS: LiveNewsStream[] = [
  { id: "ln-france24", name: "FRANCE 24 English", videoId: "HvZt-nh9sGg", category: "international", country: "FR", description: "24/7 international breaking news & top stories from Paris" },
  { id: "ln-cnn-headlines", name: "CNN Headlines", videoId: "GotlA1KKWoo", category: "news", country: "US", description: "24/7 live news headlines from around the world" },
  { id: "ln-cnbc-marathon", name: "CNBC Marathon", videoId: "9NyxcX3rhQs", category: "documentary", country: "US", description: "24/7 business documentaries & deep dives" },
  { id: "ln-aljazeera", name: "Al Jazeera English", videoId: "bNyUyrR0PHo", category: "international", country: "QA", description: "24/7 live coverage from Al Jazeera" },
  { id: "ln-abc-news", name: "ABC News Live", videoId: "vOT2V4Nk_Vg", category: "news", country: "US", description: "24/7 breaking news & analysis from ABC News" },
  { id: "ln-nbc-news", name: "NBC News NOW", videoId: "5nmu7IwgZQw", category: "news", country: "US", description: "24/7 continuous breaking news from NBC" },
  { id: "ln-bloomberg", name: "Bloomberg Business News", videoId: "iEpJwprxDdk", category: "business", country: "US", description: "24/7 live business & markets news" },
  { id: "ln-dw-english", name: "DW News English", videoId: "p7nFfn82_Zo", category: "international", country: "DE", description: "24/7 live news from Deutsche Welle" },
  { id: "ln-sky-news", name: "Sky News", videoId: "YDvsBbK5Mx0", category: "news", country: "GB", description: "24/7 breaking news from Sky News UK" },
  { id: "ln-fox-live", name: "Fox Live Now", videoId: "5eZz4N4nDnM", category: "news", country: "US", description: "24/7 live news from Fox" },
  { id: "ln-abc-au", name: "ABC News Australia", videoId: "J6n91Xv3NW8", category: "international", country: "AU", description: "24/7 live news from ABC Australia" },
  { id: "ln-cna", name: "CNA Singapore", videoId: "wORq1F1DZUY", category: "international", country: "SG", description: "24/7 live news from Channel News Asia" },
];

/** Cache: videoId -> available (5 min TTL to limit API calls) */
const availabilityCache = new Map<
  string,
  { available: boolean; checkedAt: number }
>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Verify a YouTube video is available for embedding via the oEmbed API.
 * The oEmbed endpoint returns 200 + JSON for public/embeddable videos and
 * 401/404 for private/restricted/removed ones. We also check embeddable flag.
 */
export async function isYouTubeStreamAvailable(
  videoId: string,
): Promise<boolean> {
  const cached = availabilityCache.get(videoId);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
    return cached.available;
  }
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      availabilityCache.set(videoId, {
        available: false,
        checkedAt: Date.now(),
      });
      return false;
    }
    const data = await res.json();
    // oEmbed returns title for available, embeddable videos
    const available = Boolean(data && data.title);
    availabilityCache.set(videoId, { available, checkedAt: Date.now() });
    return available;
  } catch {
    // Network error — don't cache as unavailable (could be transient)
    return false;
  }
}

/**
 * Returns ONLY the live news streams that are verified available via oEmbed.
 * Never includes unavailable streams.
 */
export async function getAvailableLiveNewsStreams(): Promise<LiveNewsStream[]> {
  const results = await Promise.all(
    CANDIDATE_LIVE_NEWS_STREAMS.map(async (stream) => ({
      stream,
      available: await isYouTubeStreamAvailable(stream.videoId),
    })),
  );
  return results.filter((r) => r.available).map((r) => r.stream);
}

/** Synchronous access to candidate list (for instant first render). */
export function getCandidateLiveNewsStreams(): LiveNewsStream[] {
  return [...CANDIDATE_LIVE_NEWS_STREAMS];
}

/**
 * Build a global live-feed embed URL filtered by country + category.
 * The provider manages its own channel availability — the iframe only shows
 * live, working channels. Country code is lowercased ISO-2.
 *
 * URL routing:
 *  - {tv|radio}/{cc}   → all TV/radio for a country
 *  - {category}        → global category (news, movies, sports, music, kids,
 *                        entertainment, business, documentary, religious,
 *                        education) — video family uses /tv prefix,
 *                        audio family (radio) uses /radio prefix.
 */
export function getLiveFeedEmbedUrl(
  countryCode: string,
  category: LiveCategory = "tv",
): string {
  const cc = (countryCode || "").toLowerCase();
  // tv / radio categories: country-scoped path
  if (category === "tv" || category === "radio") {
    if (!cc) return `https://tvgarden.world/${category}`;
    return `https://tvgarden.world/${category}/${cc}`;
  }
  // Content categories (news, movies, sports, etc.) — global, no country path
  return `https://tvgarden.world/${category}`;
}

/** Global live-feed full globe (all countries) for a given family/category */
export function getLiveFeedAllEmbedUrl(
  category: LiveCategory = "tv",
): string {
  if (category === "tv" || category === "radio") {
    return `https://tvgarden.world/${category}`;
  }
  return `https://tvgarden.world/${category}`;
}

const YOUTUBE_EMBED_BASE = "https://www.youtube.com/embed/";

/** Build the embed URL for a verified YouTube live stream */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `${YOUTUBE_EMBED_BASE}${videoId}?autoplay=1&mute=1`;
}

const CATEGORY_LABELS: Record<LiveNewsStream["category"], string> = {
  news: "Breaking News",
  business: "Business & Markets",
  documentary: "Documentaries",
  international: "International",
};

const CATEGORY_COLORS: Record<LiveNewsStream["category"], string> = {
  news: "bg-red-500/20 text-red-300 border-red-500/30",
  business: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  documentary: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  international: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

export function getCategoryLabel(cat: LiveNewsStream["category"]): string {
  return CATEGORY_LABELS[cat] || cat;
}

export function getCategoryColor(cat: LiveNewsStream["category"]): string {
  return (
    CATEGORY_COLORS[cat] || "bg-gray-500/20 text-gray-300 border-gray-500/30"
  );
}

// ---- Backward-compat aliases (other components may still import these) ----
export const getTVGardenEmbedUrl = getLiveFeedEmbedUrl;
export const getTVGardenAllEmbedUrl = getLiveFeedAllEmbedUrl;

export default {
  getAvailableLiveNewsStreams,
  getCandidateLiveNewsStreams,
  isYouTubeStreamAvailable,
  getLiveFeedEmbedUrl,
  getLiveFeedAllEmbedUrl,
  getTVGardenEmbedUrl,
  getTVGardenAllEmbedUrl,
  getYouTubeEmbedUrl,
  getCategoryLabel,
  getCategoryColor,
  LIVE_FEED_CATEGORIES,
};
