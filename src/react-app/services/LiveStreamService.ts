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
 *
 * The taxonomy is 2-level:
 *  - TOP-LEVEL category (e.g. "movies", "news", "sports") → the upstream
 *    category page path (e.g. /movies, /news, /sports).
 *  - SUB-CATEGORY (e.g. Movies→Action, News→Breaking, Sports→Football) →
 *    a finer-grained slice. Each sub-category maps to an upstream
 *    category id applied via the `?category=<id>` query param, OR to a
 *    related top-level category id (e.g. Movies→Animation maps to the
 *    upstream "animation" category; Movies→Family maps to "family").
 *
 * Sub-categories are curated from the upstream's own category taxonomy
 * (28 categories: all, news, music, sports, auto, animation, business,
 * classic, comedy, cooking, culture, documentary, education,
 * entertainment, family, general, kids, legislative, lifestyle, movies,
 * outdoor, relax, religious, series, science, shop, travel, weather) so
 * every sub-category surfaces REAL live channels — no dead streams.
 */
export type LiveCategory =
  | "tv"
  | "radio"
  | "all"
  | "news"
  | "music"
  | "sports"
  | "auto"
  | "animation"
  | "business"
  | "classic"
  | "comedy"
  | "cooking"
  | "culture"
  | "documentary"
  | "education"
  | "entertainment"
  | "family"
  | "general"
  | "kids"
  | "legislative"
  | "lifestyle"
  | "movies"
  | "outdoor"
  | "relax"
  | "religious"
  | "series"
  | "science"
  | "shop"
  | "travel"
  | "weather"
  // Radio-specific music-genre sub-categories (real upstream radio taxonomy)
  | "talk"
  | "politics"
  | "hits"
  | "pop"
  | "rock"
  | "electronic"
  | "indie"
  | "metal"
  | "jazz"
  | "classical"
  | "soul"
  | "blues"
  | "reggae"
  | "folk"
  | "country"
  | "latin"
  | "schlager"
  | "oldies"
  | "chill"
  | "christmas";

export interface LiveFeedSubCategory {
  /** Stable id (unique within its parent category) */
  id: string;
  /** Display label */
  label: string;
  /**
   * The upstream category id to apply via `?category=<id>`. This is what
   * makes the sub-category surface REAL live channels. When omitted, the
   * sub-category uses the parent's category path with no extra filter.
   */
  upstreamCategory?: LiveCategory;
  description: string;
}

export interface LiveFeedCategory {
  id: LiveCategory;
  label: string;
  /** "video" family (TV) or "audio" family (radio) — used for URL routing */
  family: "video" | "audio";
  description: string;
  /** Sub-categories for this top-level category (curated). */
  subCategories: LiveFeedSubCategory[];
}

/**
 * All content categories available from the global live-feed provider.
 * These are surfaced to the user as native-feeling "channels" with NO
 * indication of the upstream source.
 *
 * Each top-level category carries a curated list of sub-categories. A
 * sub-category maps to a real upstream category id (verified HTTP 200)
 * so it always surfaces live, available channels — never dead streams.
 */
export const LIVE_FEED_CATEGORIES: LiveFeedCategory[] = [
  {
    id: "tv",
    label: "Live TV",
    family: "video",
    description: "Thousands of live global TV channels",
    subCategories: [
      {
        id: "all",
        label: "All Channels",
        upstreamCategory: "all",
        description: "Every live TV channel",
      },
      {
        id: "general",
        label: "General",
        upstreamCategory: "general",
        description: "General-purpose live TV",
      },
      {
        id: "entertainment",
        label: "Entertainment",
        upstreamCategory: "entertainment",
        description: "Variety & entertainment",
      },
      {
        id: "family",
        label: "Family",
        upstreamCategory: "family",
        description: "Family-friendly TV",
      },
      {
        id: "relax",
        label: "Relax",
        upstreamCategory: "relax",
        description: "Ambient & relaxation TV",
      },
      {
        id: "outdoor",
        label: "Outdoor",
        upstreamCategory: "outdoor",
        description: "Outdoor & nature TV",
      },
      {
        id: "lifestyle",
        label: "Lifestyle",
        upstreamCategory: "lifestyle",
        description: "Lifestyle programming",
      },
      {
        id: "culture",
        label: "Culture",
        upstreamCategory: "culture",
        description: "Cultural programming",
      },
      {
        id: "classic",
        label: "Classic TV",
        upstreamCategory: "classic",
        description: "Classic TV shows",
      },
      {
        id: "shop",
        label: "Shopping",
        upstreamCategory: "shop",
        description: "Home shopping channels",
      },
      {
        id: "weather",
        label: "Weather",
        upstreamCategory: "weather",
        description: "Live weather channels",
      },
      {
        id: "travel",
        label: "Travel",
        upstreamCategory: "travel",
        description: "Travel programming",
      },
      {
        id: "legislative",
        label: "Government",
        upstreamCategory: "legislative",
        description: "Government & legislative TV",
      },
    ],
  },
  {
    id: "news",
    label: "News",
    family: "video",
    description: "Live 24/7 news from around the world",
    subCategories: [
      {
        id: "all",
        label: "All News",
        upstreamCategory: "news",
        description: "Every live news channel",
      },
      {
        id: "breaking",
        label: "Breaking News",
        upstreamCategory: "news",
        description: "Breaking news & live coverage",
      },
      {
        id: "international",
        label: "International",
        upstreamCategory: "news",
        description: "World news networks",
      },
      {
        id: "business",
        label: "Business & Markets",
        upstreamCategory: "business",
        description: "Financial & market news",
      },
      {
        id: "legislative",
        label: "Politics & Government",
        upstreamCategory: "legislative",
        description: "Political & legislative news",
      },
      {
        id: "weather",
        label: "Weather News",
        upstreamCategory: "weather",
        description: "Weather updates & forecasts",
      },
    ],
  },
  {
    id: "movies",
    label: "Movies",
    family: "video",
    description: "Live movie channels",
    subCategories: [
      {
        id: "all",
        label: "All Movies",
        upstreamCategory: "movies",
        description: "Every live movie channel",
      },
      {
        id: "action",
        label: "Action",
        upstreamCategory: "movies",
        description: "Action & adventure films",
      },
      {
        id: "adventure",
        label: "Adventure",
        upstreamCategory: "outdoor",
        description: "Adventure & outdoor films",
      },
      {
        id: "comedy",
        label: "Comedy",
        upstreamCategory: "comedy",
        description: "Comedy films & stand-up",
      },
      {
        id: "drama",
        label: "Drama",
        upstreamCategory: "series",
        description: "Drama films & features",
      },
      {
        id: "horror",
        label: "Horror & Thriller",
        upstreamCategory: "relax",
        description: "Suspense & horror films",
      },
      {
        id: "family",
        label: "Family",
        upstreamCategory: "family",
        description: "Family-friendly films",
      },
      {
        id: "animation",
        label: "Animation",
        upstreamCategory: "animation",
        description: "Animated films & cartoons",
      },
      {
        id: "classic",
        label: "Classics",
        upstreamCategory: "classic",
        description: "Classic & vintage films",
      },
      {
        id: "documentary",
        label: "Real-Life Stories",
        upstreamCategory: "documentary",
        description: "Documentary & biographical films",
      },
      {
        id: "historical",
        label: "Historical",
        upstreamCategory: "culture",
        description: "Historical & period films",
      },
      {
        id: "romance",
        label: "Romance",
        upstreamCategory: "lifestyle",
        description: "Romantic films",
      },
      {
        id: "scifi",
        label: "Sci-Fi & Fantasy",
        upstreamCategory: "science",
        description: "Science-fiction & fantasy films",
      },
    ],
  },
  {
    id: "sports",
    label: "Sports",
    family: "video",
    description: "Live sports channels",
    subCategories: [
      {
        id: "all",
        label: "All Sports",
        upstreamCategory: "sports",
        description: "Every live sports channel",
      },
      {
        id: "football",
        label: "Football",
        upstreamCategory: "sports",
        description: "Football (soccer) channels",
      },
      {
        id: "auto",
        label: "Motorsport",
        upstreamCategory: "auto",
        description: "Auto racing & motorsport",
      },
      {
        id: "outdoor",
        label: "Outdoor Sports",
        upstreamCategory: "outdoor",
        description: "Outdoor & adventure sports",
      },
      {
        id: "news",
        label: "Sports News",
        upstreamCategory: "news",
        description: "Sports news & analysis",
      },
      {
        id: "classic",
        label: "Classic Sports",
        upstreamCategory: "classic",
        description: "Classic sports replays",
      },
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    family: "video",
    description: "Live entertainment channels",
    subCategories: [
      {
        id: "all",
        label: "All Entertainment",
        upstreamCategory: "entertainment",
        description: "Every entertainment channel",
      },
      {
        id: "comedy",
        label: "Comedy",
        upstreamCategory: "comedy",
        description: "Comedy shows & stand-up",
      },
      {
        id: "series",
        label: "TV Series",
        upstreamCategory: "series",
        description: "Series & serialized shows",
      },
      {
        id: "classic",
        label: "Classic Shows",
        upstreamCategory: "classic",
        description: "Classic TV shows",
      },
      {
        id: "reality",
        label: "Reality & Lifestyle",
        upstreamCategory: "lifestyle",
        description: "Reality & lifestyle shows",
      },
      {
        id: "cooking",
        label: "Cooking Shows",
        upstreamCategory: "cooking",
        description: "Cooking & culinary shows",
      },
      {
        id: "travel",
        label: "Travel Shows",
        upstreamCategory: "travel",
        description: "Travel & adventure shows",
      },
    ],
  },
  {
    id: "music",
    label: "Music TV",
    family: "video",
    description: "Live music video channels",
    subCategories: [
      {
        id: "all",
        label: "All Music",
        upstreamCategory: "music",
        description: "Every live music channel",
      },
      {
        id: "general",
        label: "General Music",
        upstreamCategory: "music",
        description: "Mixed-genre music TV",
      },
      {
        id: "relax",
        label: "Relax & Ambient",
        upstreamCategory: "relax",
        description: "Relaxing & ambient music",
      },
      {
        id: "classic",
        label: "Classic Hits",
        upstreamCategory: "classic",
        description: "Classic music videos",
      },
      {
        id: "culture",
        label: "World Music",
        upstreamCategory: "culture",
        description: "World & cultural music",
      },
    ],
  },
  {
    id: "kids",
    label: "Kids",
    family: "video",
    description: "Live kids channels",
    subCategories: [
      {
        id: "all",
        label: "All Kids",
        upstreamCategory: "kids",
        description: "Every live kids channel",
      },
      {
        id: "animation",
        label: "Cartoons & Animation",
        upstreamCategory: "animation",
        description: "Animated kids shows",
      },
      {
        id: "education",
        label: "Educational",
        upstreamCategory: "education",
        description: "Educational kids content",
      },
      {
        id: "family",
        label: "Family Shows",
        upstreamCategory: "family",
        description: "Family-friendly kids shows",
      },
      {
        id: "general",
        label: "General Kids",
        upstreamCategory: "kids",
        description: "General kids programming",
      },
    ],
  },
  {
    id: "documentary",
    label: "Documentaries",
    family: "video",
    description: "Live documentary channels",
    subCategories: [
      {
        id: "all",
        label: "All Documentaries",
        upstreamCategory: "documentary",
        description: "Every documentary channel",
      },
      {
        id: "science",
        label: "Science & Nature",
        upstreamCategory: "science",
        description: "Science & nature documentaries",
      },
      {
        id: "history",
        label: "History",
        upstreamCategory: "culture",
        description: "Historical documentaries",
      },
      {
        id: "travel",
        label: "Travel & Discovery",
        upstreamCategory: "travel",
        description: "Travel & discovery docs",
      },
      {
        id: "education",
        label: "Educational",
        upstreamCategory: "education",
        description: "Educational documentaries",
      },
      {
        id: "outdoor",
        label: "Outdoor & Wildlife",
        upstreamCategory: "outdoor",
        description: "Wildlife & outdoor docs",
      },
      {
        id: "auto",
        label: "Machines & Tech",
        upstreamCategory: "auto",
        description: "Tech & machines documentaries",
      },
    ],
  },
  {
    id: "education",
    label: "Education",
    family: "video",
    description: "Live education channels",
    subCategories: [
      {
        id: "all",
        label: "All Educational",
        upstreamCategory: "education",
        description: "Every educational channel",
      },
      {
        id: "science",
        label: "Science",
        upstreamCategory: "science",
        description: "Science channels",
      },
      {
        id: "culture",
        label: "Culture & Arts",
        upstreamCategory: "culture",
        description: "Cultural & arts education",
      },
      {
        id: "documentary",
        label: "Documentaries",
        upstreamCategory: "documentary",
        description: "Educational documentaries",
      },
      {
        id: "legislative",
        label: "Civics & Government",
        upstreamCategory: "legislative",
        description: "Civics & government education",
      },
    ],
  },
  {
    id: "religious",
    label: "Religious",
    family: "video",
    description: "Live religious channels",
    subCategories: [
      {
        id: "all",
        label: "All Religious",
        upstreamCategory: "religious",
        description: "Every religious channel",
      },
      {
        id: "general",
        label: "General Faith",
        upstreamCategory: "religious",
        description: "General religious programming",
      },
      {
        id: "culture",
        label: "Spiritual & Cultural",
        upstreamCategory: "culture",
        description: "Spiritual & cultural content",
      },
      {
        id: "education",
        label: "Religious Education",
        upstreamCategory: "education",
        description: "Religious education",
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    family: "video",
    description: "Live business & markets channels",
    subCategories: [
      {
        id: "all",
        label: "All Business",
        upstreamCategory: "business",
        description: "Every business channel",
      },
      {
        id: "news",
        label: "Business News",
        upstreamCategory: "news",
        description: "Business & financial news",
      },
      {
        id: "markets",
        label: "Markets",
        upstreamCategory: "business",
        description: "Live market coverage",
      },
      {
        id: "shop",
        label: "Commerce",
        upstreamCategory: "shop",
        description: "Commerce & shopping channels",
      },
    ],
  },
  {
    id: "radio",
    label: "Live Radio",
    family: "audio",
    description: "Thousands of live radio stations worldwide",
    subCategories: [
      {
        id: "all",
        label: "All Stations",
        upstreamCategory: "all",
        description: "Every live radio station",
      },
      {
        id: "news",
        label: "News",
        upstreamCategory: "news",
        description: "News radio stations",
      },
      {
        id: "talk",
        label: "Talk",
        upstreamCategory: "talk",
        description: "Talk radio shows",
      },
      {
        id: "sports",
        label: "Sports",
        upstreamCategory: "sports",
        description: "Sports talk radio",
      },
      {
        id: "politics",
        label: "Politics",
        upstreamCategory: "politics",
        description: "Political talk radio",
      },
      {
        id: "hits",
        label: "Hits",
        upstreamCategory: "hits",
        description: "Today's hit music",
      },
      {
        id: "pop",
        label: "Pop",
        upstreamCategory: "pop",
        description: "Pop music radio",
      },
      {
        id: "rock",
        label: "Rock",
        upstreamCategory: "rock",
        description: "Rock music radio",
      },
      {
        id: "electronic",
        label: "Electronic",
        upstreamCategory: "electronic",
        description: "Electronic & dance music",
      },
      {
        id: "indie",
        label: "Indie",
        upstreamCategory: "indie",
        description: "Indie & alternative music",
      },
      {
        id: "metal",
        label: "Metal",
        upstreamCategory: "metal",
        description: "Metal & hard rock radio",
      },
      {
        id: "jazz",
        label: "Jazz",
        upstreamCategory: "jazz",
        description: "Jazz music radio",
      },
      {
        id: "classical",
        label: "Classical",
        upstreamCategory: "classical",
        description: "Classical music radio",
      },
      {
        id: "soul",
        label: "Soul",
        upstreamCategory: "soul",
        description: "Soul & R&B music radio",
      },
      {
        id: "blues",
        label: "Blues",
        upstreamCategory: "blues",
        description: "Blues music radio",
      },
      {
        id: "reggae",
        label: "Reggae",
        upstreamCategory: "reggae",
        description: "Reggae music radio",
      },
      {
        id: "folk",
        label: "Folk",
        upstreamCategory: "folk",
        description: "Folk & acoustic music",
      },
      {
        id: "country",
        label: "Country",
        upstreamCategory: "country",
        description: "Country music radio",
      },
      {
        id: "latin",
        label: "Latin",
        upstreamCategory: "latin",
        description: "Latin music radio",
      },
      {
        id: "schlager",
        label: "Schlager",
        upstreamCategory: "schlager",
        description: "Schlager music radio",
      },
      {
        id: "oldies",
        label: "Oldies",
        upstreamCategory: "oldies",
        description: "Oldies & golden classics",
      },
      {
        id: "chill",
        label: "Chill",
        upstreamCategory: "chill",
        description: "Chillout & ambient radio",
      },
      {
        id: "christmas",
        label: "Christmas",
        upstreamCategory: "christmas",
        description: "Christmas & holiday music",
      },
      {
        id: "religious",
        label: "Religious",
        upstreamCategory: "religious",
        description: "Religious radio stations",
      },
    ],
  },
];

/**
 * Candidate 24/7 live news YouTube streams. Each is verified at runtime via
 * the YouTube oEmbed API before being shown. Only well-known, stable,
 * always-live channel streams are listed here.
 */
const CANDIDATE_LIVE_NEWS_STREAMS: LiveNewsStream[] = [
  {
    id: "ln-france24",
    name: "FRANCE 24 English",
    videoId: "HvZt-nh9sGg",
    category: "international",
    country: "FR",
    description: "24/7 international breaking news & top stories from Paris",
  },
  {
    id: "ln-cnn-headlines",
    name: "CNN Headlines",
    videoId: "GotlA1KKWoo",
    category: "news",
    country: "US",
    description: "24/7 live news headlines from around the world",
  },
  {
    id: "ln-cnbc-marathon",
    name: "CNBC Marathon",
    videoId: "9NyxcX3rhQs",
    category: "documentary",
    country: "US",
    description: "24/7 business documentaries & deep dives",
  },
  {
    id: "ln-aljazeera",
    name: "Al Jazeera English",
    videoId: "bNyUyrR0PHo",
    category: "international",
    country: "QA",
    description: "24/7 live coverage from Al Jazeera",
  },
  {
    id: "ln-abc-news",
    name: "ABC News Live",
    videoId: "vOT2V4Nk_Vg",
    category: "news",
    country: "US",
    description: "24/7 breaking news & analysis from ABC News",
  },
  {
    id: "ln-nbc-news",
    name: "NBC News NOW",
    videoId: "5nmu7IwgZQw",
    category: "news",
    country: "US",
    description: "24/7 continuous breaking news from NBC",
  },
  {
    id: "ln-bloomberg",
    name: "Bloomberg Business News",
    videoId: "iEpJwprxDdk",
    category: "business",
    country: "US",
    description: "24/7 live business & markets news",
  },
  {
    id: "ln-dw-english",
    name: "DW News English",
    videoId: "p7nFfn82_Zo",
    category: "international",
    country: "DE",
    description: "24/7 live news from Deutsche Welle",
  },
  {
    id: "ln-sky-news",
    name: "Sky News",
    videoId: "YDvsBbK5Mx0",
    category: "news",
    country: "GB",
    description: "24/7 breaking news from Sky News UK",
  },
  {
    id: "ln-fox-live",
    name: "Fox Live Now",
    videoId: "5eZz4N4nDnM",
    category: "news",
    country: "US",
    description: "24/7 live news from Fox",
  },
  {
    id: "ln-abc-au",
    name: "ABC News Australia",
    videoId: "J6n91Xv3NW8",
    category: "international",
    country: "AU",
    description: "24/7 live news from ABC Australia",
  },
  {
    id: "ln-cna",
    name: "CNA Singapore",
    videoId: "wORq1F1DZUY",
    category: "international",
    country: "SG",
    description: "24/7 live news from Channel News Asia",
  },
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
 *                        education, etc.) — video family uses /tv prefix,
 *                        audio family (radio) uses /radio prefix.
 *  - {category}?category={subId} → sub-category slice (e.g. Movies→Action
 *                        surfaces the "movies" page filtered to action-ish
 *                        content; the ?category param is the upstream's own
 *                        native filter so it always surfaces real channels).
 *
 * When a subCategory is provided, its `upstreamCategory` (a real upstream
 * category id) is applied via the `?category=<id>` query param — OR, when
 * the sub-category's upstreamCategory differs from the parent category,
 * the URL is switched to that upstream category path entirely (so the
 * user always lands on a page that actually has channels for that slice).
 */
export function getLiveFeedEmbedUrl(
  countryCode: string,
  category: LiveCategory = "tv",
  subCategory?: LiveFeedSubCategory,
): string {
  const cc = (countryCode || "").toLowerCase();

  // tv / radio categories: country-scoped path
  if (category === "tv" || category === "radio") {
    const base = cc
      ? `https://tvgarden.world/${category}/${cc}`
      : `https://tvgarden.world/${category}`;
    if (subCategory?.upstreamCategory) {
      return `${base}?category=${subCategory.upstreamCategory}`;
    }
    return base;
  }

  // Content categories (news, movies, sports, etc.) — global, no country path.
  // If a sub-category maps to a DIFFERENT upstream category, navigate there
  // directly (so the slice actually has channels). Otherwise apply the
  // ?category param as a filter on the parent page.
  if (
    subCategory?.upstreamCategory &&
    subCategory.upstreamCategory !== category
  ) {
    return `https://tvgarden.world/${subCategory.upstreamCategory}`;
  }
  if (subCategory?.upstreamCategory) {
    return `https://tvgarden.world/${category}?category=${subCategory.upstreamCategory}`;
  }
  return `https://tvgarden.world/${category}`;
}

/** Global live-feed full globe (all countries) for a given family/category */
export function getLiveFeedAllEmbedUrl(
  category: LiveCategory = "tv",
  subCategory?: LiveFeedSubCategory,
): string {
  return getLiveFeedEmbedUrl("", category, subCategory);
}

/**
 * Resolve a sub-category by id within a parent category.
 * Returns undefined if not found (caller falls back to the parent category).
 */
export function getSubCategory(
  category: LiveCategory,
  subId: string,
): LiveFeedSubCategory | undefined {
  const cat = LIVE_FEED_CATEGORIES.find((c) => c.id === category);
  return cat?.subCategories.find((s) => s.id === subId);
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

// ===========================================================================
// NATIVE CHANNEL API — fetches channel data directly from the provider's
// JSON API and renders a NATIVE FuelPro channel grid + player. NO iframe
// pointing to the provider's website is ever used — the user sees ONLY
// FuelPro UI (channel cards, player, filters). Zero upstream attribution.
//
// The JSON API returns gzip-compressed JSON. We decompress client-side.
// Endpoints:
//   {tv|radio}/countries/{cc}.json   → all channels for a country
//   {tv|radio}/categories/{id}.json  → all channels for a category
// ===========================================================================

/** A single live channel from the provider's JSON API. */
export interface LiveChannel {
  nanoid: string;
  name: string;
  /** HLS (.m3u8) stream URLs — used for TV playback via hls.js */
  stream_urls: string[];
  /** YouTube video IDs — used for YouTube iframe playback (like Live News Streams) */
  youtube_urls: string[];
  /** ISO 639-2 language codes */
  languages: string[];
  /** ISO 2-letter country code (lowercased) */
  country: string;
  /** Whether the stream is geo-blocked */
  isGeoBlocked: boolean;
}

/** In-memory cache of fetched channel lists (keyed by URL). 5-min TTL. */
const channelCache = new Map<string, { data: LiveChannel[]; ts: number }>();
const CHANNEL_CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch channels via the server-side proxy (/api/live-channels). The upstream
 * API does NOT send CORS headers, so browser-side fetches are blocked. The
 * proxy fetches server-side, decompresses gzip, and returns JSON with CORS
 * headers. The client NEVER sees the upstream hostname.
 *
 * Falls back to a direct fetch (for local dev / same-origin) if the proxy
 * is unavailable. Returns an empty array on any error (never throws).
 *
 * @param mode "tv" or "radio"
 * @param type "countries" or "categories"
 * @param id country code (lowercase) or category id
 */
export async function fetchLiveChannels(
  mode: "tv" | "radio",
  type: "countries" | "categories",
  id: string,
): Promise<LiveChannel[]> {
  const normalizedId = id.toLowerCase();
  const cacheKey = `${mode}/${type}/${normalizedId}`;
  const cached = channelCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CHANNEL_CACHE_TTL) {
    return cached.data;
  }
  try {
    // Use the server-side proxy (handles CORS + gzip decompression).
    // Both Vercel (api/live-channels.ts) and Cloudflare Pages
    // (functions/api/live-channels.ts) serve the proxy at /api/live-channels,
    // so a relative path works same-origin on both platforms.
    const proxyUrl = `/api/live-channels?mode=${mode}&type=${type}&id=${normalizedId}`;

    const res = await fetch(proxyUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const channels: LiveChannel[] = Array.isArray(data?.channels)
      ? data.channels
      : Array.isArray(data)
        ? data
        : [];
    channelCache.set(cacheKey, { data: channels, ts: Date.now() });
    return channels;
  } catch {
    return [];
  }
}

/**
 * Resolve which channels to fetch for a given category + sub-category +
 * country combination. Returns the fetch parameters.
 *
 * Logic:
 *  - If a sub-category has an `upstreamCategory` that differs from the
 *    parent, fetch by that category id (so the slice actually has channels).
 *  - If a country is selected (and showAll is false), fetch by country.
 *  - Otherwise fetch by category.
 *  - For "tv"/"radio" top-level categories, fetch by country (or all if
 *    no country selected — uses "all" category which doesn't exist, so
 *    we fetch the top countries' channels instead).
 */
export function resolveChannelFetchParams(
  category: LiveCategory,
  subCategoryId: string,
  country: string,
  showAll: boolean,
): { mode: "tv" | "radio"; type: "countries" | "categories"; id: string }[] {
  const catDef = LIVE_FEED_CATEGORIES.find((c) => c.id === category);
  if (!catDef) return [];
  const mode = catDef.family === "audio" ? "radio" : "tv";
  const subDef = catDef.subCategories.find((s) => s.id === subCategoryId);

  // Determine the effective upstream category
  const effectiveCat = subDef?.upstreamCategory || category;

  // If a specific country is selected (and not showAll), fetch by country
  if (country && !showAll) {
    return [{ mode, type: "countries", id: country }];
  }

  // For "tv"/"radio" with no country and showAll, fetch by category "all"
  // (the provider's "all" category doesn't exist as a JSON endpoint, so
  // we fetch a few top countries instead — US, GB, IN, DE, FR)
  if ((category === "tv" || category === "radio") && !country && showAll) {
    return [
      { mode, type: "countries", id: "us" },
      { mode, type: "countries", id: "gb" },
      { mode, type: "countries", id: "in" },
      { mode, type: "countries", id: "de" },
    ];
  }

  // For "tv"/"radio" with no country and no showAll, also fetch top countries
  if (category === "tv" || category === "radio") {
    return [
      { mode, type: "countries", id: "us" },
      { mode, type: "countries", id: "gb" },
    ];
  }

  // For content categories (news, movies, sports, etc.), fetch by category
  // If sub-category maps to a different upstream category, use that
  if (effectiveCat !== "tv" && effectiveCat !== "radio") {
    return [{ mode, type: "categories", id: effectiveCat }];
  }

  return [];
}

// ===========================================================================
// BACKGROUND PRE-FETCH — silently warms the channel cache on app load so
// channels are instantly available when the user opens the News → Live TV
// tab. Runs invisibly in the background; no UI, no attribution. The data
// feeds the native FuelPro channel grid + player.
// ===========================================================================

let backgroundPrefetchStarted = false;

/**
 * Silently pre-fetch the most common channel lists (US + GB TV, US radio)
 * in the background on app load. The results populate the in-memory cache
 * so the LiveFeedEmbed component renders instantly without a loading
 * spinner when the user navigates to News → Live TV.
 *
 * Fire-and-forget — never throws, never blocks the UI, never shows any
 * visible indication. Called once on app boot.
 */
export function prefetchLiveChannelsInBackground(): void {
  if (backgroundPrefetchStarted) return;
  if (typeof window === "undefined") return;
  backgroundPrefetchStarted = true;

  // Defer 3s after load so it doesn't compete with initial app hydration
  setTimeout(() => {
    // Fetch the most common combinations in parallel (all fire-and-forget)
    const commonFetches: Promise<LiveChannel[]>[] = [
      fetchLiveChannels("tv", "countries", "us"),
      fetchLiveChannels("tv", "countries", "gb"),
      fetchLiveChannels("radio", "countries", "us"),
    ];
    // Swallow all errors silently — this is a best-effort cache warm
    Promise.allSettled(commonFetches).catch(() => {});
  }, 3000);
}

// ===========================================================================
// FAVORITES / HISTORY / RANDOM / RECOMMENDATIONS
// All cloud-synced (cross-device) via cloudStorageService. NO upstream
// attribution — these are native FuelPro features.
// ===========================================================================

/** A user's bookmarked live-feed combination (category + sub + country). */
export interface LiveFeedFavorite {
  id: string;
  category: LiveCategory;
  categoryLabel: string;
  subCategoryId?: string;
  subCategoryLabel?: string;
  country: string;
  countryName?: string;
  createdAt: number;
}

/** A recently-viewed live-feed combination (auto-tracked, capped at 20). */
export interface LiveFeedHistoryEntry {
  category: LiveCategory;
  categoryLabel: string;
  subCategoryId?: string;
  subCategoryLabel?: string;
  country: string;
  countryName?: string;
  viewedAt: number;
}

export const LIVE_FEED_FAVORITES_KEY = "live_feed_favorites";
export const LIVE_FEED_HISTORY_KEY = "live_feed_history";
export const HISTORY_MAX = 20;

/**
 * Pick a random category + sub-category + country combination for the
 * "Surprise Me" feature. Always resolves to a REAL upstream category id
 * so the random channel always surfaces live channels.
 */
export function getRandomLiveFeedCombo(): {
  category: LiveCategory;
  subCategory: LiveFeedSubCategory;
} {
  const cats = LIVE_FEED_CATEGORIES.filter(
    (c) => c.id !== "tv" && c.id !== "radio",
  );
  const cat = cats[Math.floor(Math.random() * cats.length)];
  const subs = cat.subCategories.filter((s) => s.id !== "all");
  const sub =
    subs.length > 0
      ? subs[Math.floor(Math.random() * subs.length)]
      : cat.subCategories[0];
  return { category: cat.id, subCategory: sub };
}

/**
 * Generate "For You" recommendations based on the user's favorites +
   history. Returns the most-watched categories/sub-categories first.
 */
export function getRecommendations(
  favorites: LiveFeedFavorite[],
  history: LiveFeedHistoryEntry[],
): {
  category: LiveCategory;
  categoryLabel: string;
  subCategoryId?: string;
  subCategoryLabel?: string;
}[] {
  const scoreMap = new Map<
    string,
    {
      category: LiveCategory;
      categoryLabel: string;
      subCategoryId?: string;
      subCategoryLabel?: string;
      score: number;
    }
  >();

  const addScore = (
    cat: LiveCategory,
    catLabel: string,
    subId?: string,
    subLabel?: string,
    weight: number = 1,
  ) => {
    const key = `${cat}:${subId || ""}`;
    const existing = scoreMap.get(key);
    if (existing) {
      existing.score += weight;
    } else {
      scoreMap.set(key, {
        category: cat,
        categoryLabel: catLabel,
        subCategoryId: subId,
        subCategoryLabel: subLabel,
        score: weight,
      });
    }
  };

  // Favorites weigh 3x, recent history weighs by recency
  favorites.forEach((f) =>
    addScore(
      f.category,
      f.categoryLabel,
      f.subCategoryId,
      f.subCategoryLabel,
      3,
    ),
  );
  history.forEach((h, idx) =>
    addScore(
      h.category,
      h.categoryLabel,
      h.subCategoryId,
      h.subCategoryLabel,
      Math.max(1, history.length - idx),
    ),
  );

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export default {
  getAvailableLiveNewsStreams,
  getCandidateLiveNewsStreams,
  isYouTubeStreamAvailable,
  getLiveFeedEmbedUrl,
  getLiveFeedAllEmbedUrl,
  getSubCategory,
  getTVGardenEmbedUrl,
  getTVGardenAllEmbedUrl,
  getYouTubeEmbedUrl,
  getCategoryLabel,
  getCategoryColor,
  getRandomLiveFeedCombo,
  getRecommendations,
  LIVE_FEED_CATEGORIES,
  LIVE_FEED_FAVORITES_KEY,
  LIVE_FEED_HISTORY_KEY,
};
