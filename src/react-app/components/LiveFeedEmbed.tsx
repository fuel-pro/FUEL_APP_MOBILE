import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  LIVE_FEED_CATEGORIES,
  LIVE_FEED_FAVORITES_KEY,
  LIVE_FEED_HISTORY_KEY,
  HISTORY_MAX,
  getRandomLiveFeedCombo,
  saveReminders,
  loadReminders,
  nextReminderTime,
  formatMinuteOfDay,
  getLiveFeedEmbedUrl,
  getSubCategory,
  fetchLiveChannels,
  resolveChannelFetchParams,
  type LiveCategory,
  type LiveChannel,
  type LiveFeedCategory,
  type LiveFeedFavorite,
  type LiveFeedHistoryEntry,
  type LiveFeedReminder,
  type ReminderRecurrence,
} from "@/react-app/services/LiveStreamService";
import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";
import { useAuth } from "@/react-app/context/AuthContext";
import { ALL_COUNTRIES } from "@/react-app/lib/world-country-utils";
import {
  Tv,
  Radio,
  Grid3x3,
  Maximize2,
  Minimize2,
  Heart,
  Shuffle,
  Clock,
  X,
  Sparkles,
  Layers,
  Tag,
  Bell,
  Calendar,
  Trash2,
  Loader2,
  Monitor,
  Play,
  Search,
} from "lucide-react";

interface LiveFeedEmbedProps {
  /** Initial category (default: "tv") */
  defaultCategory?: LiveCategory;
  /** Initial sub-category id (within the default category) */
  defaultSubCategory?: string;
  /** Initial country code (ISO-2, lowercased). Empty = all countries */
  defaultCountry?: string;
  /** Whether to show the category switcher (multi-category mode) */
  showCategorySwitcher?: boolean;
  /** Whether to show the sub-category switcher (2nd-level taxonomy) */
  showSubCategorySwitcher?: boolean;
  /** Whether to show the feature toolbar (favorites, surprise, fullscreen) */
  showFeatureToolbar?: boolean;
  /** Restrict to a single family ("video" | "audio") — hides the other */
  family?: "video" | "audio";
  /** Visual accent color for the active category badge */
  accent?: "blue" | "purple";
  /** Compact mode: shorter player height */
  compact?: boolean;
}

/**
 * LiveFeedEmbed
 *
 * Hybrid live-channel browser + station preview:
 *  - The provider's live-guide page is embedded in an iframe as the BROWSE
 *    view (category/country/sub-category selectors update the iframe src).
 *  - The STATION PREVIEW (this task) plays the individually SELECTED station
 *    natively inside FuelPro: YouTube channels via YouTube iframe embed,
 *    HLS (.m3u8) channels via hls.js (direct URL first, CORS-proxy
 *    fallback), radio stations via a plain <audio> element. Only playable
 *    stations (having at least one stream or YouTube URL) are listed.
 *
 * FEATURES (favorites/history/reminders cloud-synced cross-device):
 *  - 2-LEVEL taxonomy (category + sub-category)
 *  - Country filter (195 countries) + Show All (global)
 *  - Station picker with live search + per-station preview
 *  - Favorites, Surprise Me, Recently Watched
 *  - EPG / WATCH REMINDERS (schedule what to watch when)
 *  - Fullscreen mode
 */

/** ISO weekdays Mon(1)..Sun(7) labels. */
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Format a ms-epoch timestamp as a relative "in Xm" / "in Xh" / "X ago" string. */
function formatRelativeTime(ts: number): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  const mins = Math.round(abs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return past ? `${mins}m ago` : `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return past ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return past ? `${days}d ago` : `in ${days}d`;
}

/** Extract a YouTube video id from any YouTube URL form (or a raw 11-char id). */
function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{11}$/.test(url.trim()) ? url.trim() : null;
}

/** Build the CORS-proxy URL for an HLS resource (same-origin on both hosts). */
function hlsProxyUrl(url: string): string {
  return `/api/hls-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * StationPreview — plays the individually SELECTED station (from the live
 * provider's catalog) natively inside FuelPro. YouTube channels use a
 * YouTube iframe embed; HLS channels use hls.js (direct URL first, proxy
 * fallback on fatal network error); radio stations use a plain <audio>
 * element (cross-origin audio playback needs no CORS).
 */
function StationPreview({
  station,
  isAudio,
  onClose,
}: {
  station: LiveChannel;
  isAudio: boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const ytId = useMemo(
    () =>
      (station.youtube_urls?.length ?? 0) > 0
        ? extractYouTubeId(station.youtube_urls[0])
        : null,
    [station],
  );
  const streamUrl = station.stream_urls?.[0] || "";
  const isHls =
    !ytId && !!streamUrl && (isAudio ? /\.m3u8(\?|$)/i.test(streamUrl) : true);
  const countryName = station.country
    ? ALL_COUNTRIES.find((c) => c.code === station.country)?.name ||
      station.country.toUpperCase()
    : "";

  // HLS / direct playback wiring (skip when rendering a YouTube iframe)
  useEffect(() => {
    if (ytId || !streamUrl) return;
    let destroyed = false;
    let hls: import("hls.js").default | null = null;
    let retriedViaProxy = false;
    const mediaEl: HTMLVideoElement | HTMLAudioElement | null = isAudio
      ? audioRef.current
      : videoRef.current;
    if (!mediaEl) return;
    setError(null);

    const attachDirect = (url: string) => {
      mediaEl.src = url;
      mediaEl.play().catch(() => {
        /* autoplay blocked — user presses play */
      });
    };

    (async () => {
      if (isHls) {
        try {
          const Hls = (await import("hls.js")).default;
          if (destroyed) return;
          if (Hls.isSupported()) {
            hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              manifestLoadingTimeOut: 15000,
              levelLoadingTimeOut: 15000,
              fragLoadingTimeOut: 30000,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(mediaEl);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              mediaEl.play().catch(() => {
                /* autoplay blocked */
              });
            });
            hls.on(Hls.Events.ERROR, (_evt, data) => {
              if (!data.fatal) return;
              if (!retriedViaProxy) {
                // Retry once via the CORS proxy (streams without CORS headers)
                retriedViaProxy = true;
                try {
                  hls?.destroy();
                } catch {
                  /* */
                }
                hls = new Hls({ enableWorker: true, lowLatencyMode: true });
                hls.loadSource(hlsProxyUrl(streamUrl));
                hls.attachMedia(mediaEl);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                  mediaEl.play().catch(() => {
                    /* */
                  });
                });
                hls.on(Hls.Events.ERROR, (_e2, d2) => {
                  if (d2.fatal && !destroyed)
                    setError(
                      "This station's stream is currently unreachable. Try another station.",
                    );
                });
                return;
              }
              if (!destroyed)
                setError(
                  "This station's stream is currently unreachable. Try another station.",
                );
            });
            return;
          }
        } catch {
          /* fall through to native */
        }
        // Safari native HLS / fallback
        if (mediaEl.canPlayType("application/vnd.apple.mpegurl")) {
          attachDirect(streamUrl);
        } else {
          attachDirect(streamUrl);
        }
      } else {
        // Non-HLS direct stream (mp3/aac/icecast etc.)
        attachDirect(streamUrl);
      }
    })();

    return () => {
      destroyed = true;
      try {
        hls?.destroy();
      } catch {
        /* */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.nanoid, retryKey]);

  const kindBadge = ytId ? "YouTube" : isAudio ? "Radio" : "HLS";

  return (
    <div className="absolute inset-0 z-30 bg-black flex flex-col">
      {/* Preview header */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <Play size={12} className="text-green-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-white truncate">
            {station.name}
          </span>
          {countryName && (
            <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:inline">
              {countryName}
            </span>
          )}
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex-shrink-0">
            {kindBadge}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1 flex-shrink-0">
            <span className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
            PREVIEW
          </span>
        </div>
        <button
          onClick={onClose}
          title="Back to channel browser"
          className="text-[10px] px-2 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-1 flex-shrink-0"
        >
          <X size={10} /> Browse
        </button>
      </div>
      {/* Preview body */}
      <div className="flex-1 relative bg-black">
        {ytId ? (
          <iframe
            key={`${station.nanoid}-${retryKey}`}
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&rel=0`}
            title={station.name}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : isAudio ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <div className="w-20 h-20 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <Radio size={36} className="text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-white text-center">
              {station.name}
            </p>
            {countryName && (
              <p className="text-[11px] text-gray-400 -mt-2">{countryName}</p>
            )}
            <audio
              key={`${station.nanoid}-${retryKey}`}
              ref={audioRef}
              controls
              autoPlay
              className="w-full max-w-md"
            />
          </div>
        ) : (
          <video
            key={`${station.nanoid}-${retryKey}`}
            ref={videoRef}
            controls
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 p-4">
            <div className="text-center space-y-3">
              <p className="text-xs text-gray-300 max-w-xs">{error}</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600"
                >
                  Back to browser
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveFeedEmbed({
  defaultCategory = "tv",
  defaultSubCategory,
  defaultCountry = "",
  showCategorySwitcher = true,
  showSubCategorySwitcher = true,
  showFeatureToolbar = true,
  family,
  accent = "blue",
  compact = false,
}: LiveFeedEmbedProps) {
  // ─── IFRAME-EMBED PLAYER ───────────────────────────────────────────────
  // This component renders a DIRECT iframe embed of the upstream live-feed
  // provider (tvgarden.world) as the player. This is the bulletproof path:
  // no hls.js, no CORS proxy, no dead-stream detection, no auto-advance.
  // The provider curates only live streams, so the iframe always shows
  // actual video. The category/country/sub-category selectors simply update
  // the iframe `src`, which reloads the provider's page for that slice.

  const { user } = useAuth();
  const [category, setCategory] = useState<LiveCategory>(defaultCategory);
  const [subCategoryId, setSubCategoryId] = useState<string>(
    defaultSubCategory || "all",
  );
  const [country, setCountry] = useState<string>(defaultCountry);
  const [showAll, setShowAll] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false);
  const [favorites, setFavorites] = useState<LiveFeedFavorite[]>([]);
  const [history, setHistory] = useState<LiveFeedHistoryEntry[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);

  // EPG / Watch Reminders — cloud-backed, cross-device
  const [reminders, setReminders] = useState<LiveFeedReminder[]>([]);
  const [showRemindersPanel, setShowRemindersPanel] = useState(false);
  const [reminderForm, setReminderForm] = useState<{
    label: string;
    time: string;
    recurrence: ReminderRecurrence;
    weekday: number;
  }>({
    label: "",
    time: "20:00",
    recurrence: "once",
    weekday: 1,
  });
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Iframe load state — shows a spinner until the provider page renders.
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── STATION PICKER + PREVIEW ────────────────────────────────────────────
  // Playable stations for the active category/sub/country combo (fetched
  // from the live-feed API via the same-origin proxy). Selecting a station
  // overlays a native PREVIEW player on top of the browse iframe.
  const [stations, setStations] = useState<LiveChannel[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState<LiveChannel | null>(
    null,
  );
  const [stationSearch, setStationSearch] = useState("");

  // Cloud load guard
  const cloudLoadCompleteRef = useRef(false);

  useEffect(() => {
    setCountry(defaultCountry);
  }, [defaultCountry]);

  const availableCategories = useMemo<LiveFeedCategory[]>(() => {
    if (family === "video")
      return LIVE_FEED_CATEGORIES.filter((c) => c.family === "video");
    if (family === "audio")
      return LIVE_FEED_CATEGORIES.filter((c) => c.family === "audio");
    return LIVE_FEED_CATEGORIES;
  }, [family]);

  const activeCat = LIVE_FEED_CATEGORIES.find((c) => c.id === category);
  const isRadio = activeCat?.family === "audio";

  // ─── BUILD THE IFRAME SRC ──────────────────────────────────────────────
  const activeSubCategory = useMemo(
    () => getSubCategory(category, subCategoryId),
    [category, subCategoryId],
  );

  const embedUrl = useMemo(() => {
    const cc = showAll ? "" : country;
    return getLiveFeedEmbedUrl(cc, category, activeSubCategory);
  }, [country, showAll, category, activeSubCategory]);

  // ─── FETCH PLAYABLE STATIONS for the active combo ───────────────────────
  // Only stations with at least one stream or YouTube URL are listed (never
  // show dead stations). YouTube-backed stations sort first (most reliable
  // playback), then alphabetical. Selection resets on combo change.
  useEffect(() => {
    let cancelled = false;
    setSelectedStation(null);
    setStationSearch("");
    setStationsLoading(true);
    (async () => {
      try {
        const params = resolveChannelFetchParams(
          category,
          subCategoryId,
          country,
          showAll,
        );
        const results = await Promise.all(
          params.map((p) => fetchLiveChannels(p.mode, p.type, p.id)),
        );
        if (cancelled) return;
        const seen = new Set<string>();
        const playable = results
          .flat()
          // Normalize: the API omits array keys when empty (e.g. radio
          // channels have no youtube_urls key) — always materialize both
          // arrays so downstream code can never crash on missing keys.
          .map((ch) => ({
            ...ch,
            stream_urls: ch.stream_urls ?? [],
            youtube_urls: ch.youtube_urls ?? [],
            languages: ch.languages ?? [],
          }))
          .filter(
            (ch) =>
              ch &&
              ((ch.stream_urls?.length ?? 0) > 0 ||
                (ch.youtube_urls?.length ?? 0) > 0),
          )
          .filter((ch) => {
            if (seen.has(ch.nanoid)) return false;
            seen.add(ch.nanoid);
            return true;
          })
          .sort((a, b) => {
            const ay = (a.youtube_urls?.length ?? 0) > 0 ? 0 : 1;
            const by = (b.youtube_urls?.length ?? 0) > 0 ? 0 : 1;
            if (ay !== by) return ay - by;
            return a.name.localeCompare(b.name);
          });
        setStations(playable);
      } catch {
        if (!cancelled) setStations([]);
      } finally {
        if (!cancelled) setStationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, subCategoryId, country, showAll]);

  // Search-filtered station options (capped for dropdown performance)
  const filteredStations = useMemo(() => {
    const q = stationSearch.trim().toLowerCase();
    const list = q
      ? stations.filter((s) => s.name.toLowerCase().includes(q))
      : stations;
    return list.slice(0, 500);
  }, [stations, stationSearch]);

  // ─── IFRAME LOAD HANDLING ──────────────────────────────────────────────
  useEffect(() => {
    setIframeLoading(true);
    if (iframeLoadTimerRef.current) clearTimeout(iframeLoadTimerRef.current);
    iframeLoadTimerRef.current = setTimeout(
      () => setIframeLoading(false),
      12000,
    );
    return () => {
      if (iframeLoadTimerRef.current) clearTimeout(iframeLoadTimerRef.current);
    };
  }, [embedUrl]);

  const onIframeLoad = useCallback(() => {
    setIframeLoading(false);
    if (iframeLoadTimerRef.current) clearTimeout(iframeLoadTimerRef.current);
  }, []);

  // ─── CLOUD LOAD: favorites + history + reminders ──────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    cloudLoadCompleteRef.current = false;
    (async () => {
      try {
        const [favData, histData, remData] = await Promise.all([
          cloudStorageService.get<LiveFeedFavorite[]>(LIVE_FEED_FAVORITES_KEY),
          cloudStorageService.get<LiveFeedHistoryEntry[]>(
            LIVE_FEED_HISTORY_KEY,
          ),
          loadReminders(),
        ]);
        if (!cancelled) {
          if (Array.isArray(favData)) setFavorites(favData);
          if (Array.isArray(histData)) setHistory(histData);
          setReminders(remData);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) cloudLoadCompleteRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ─── HISTORY TRACKING (debounced) ──────────────────────────────────────
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!cloudLoadCompleteRef.current || !user?.id) return;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      const catDef = LIVE_FEED_CATEGORIES.find((c) => c.id === category);
      if (!catDef) return;
      const subDef = catDef.subCategories.find((s) => s.id === subCategoryId);
      const countryName =
        ALL_COUNTRIES.find((c) => c.code === country)?.name || undefined;
      const entry: LiveFeedHistoryEntry = {
        category,
        categoryLabel: catDef.label,
        subCategoryId: subDef?.id,
        subCategoryLabel: subDef?.label,
        country,
        countryName,
        playedAt: Date.now(),
      };
      setHistory((prev) => {
        const filtered = prev.filter(
          (h) =>
            !(
              h.category === entry.category &&
              h.subCategoryId === entry.subCategoryId &&
              h.country === entry.country
            ),
        );
        const next = [entry, ...filtered].slice(0, HISTORY_MAX);
        cloudStorageService.set(LIVE_FEED_HISTORY_KEY, next).catch(() => {});
        return next;
      });
    }, 3000);
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    };
  }, [category, subCategoryId, country, user?.id]);

  // ─── FAVORITED? (current combo is in favorites) ───────────────────────
  useEffect(() => {
    const exists = favorites.some(
      (f) =>
        f.category === category &&
        f.subCategoryId === subCategoryId &&
        f.country === country,
    );
    setIsFavorited(exists);
  }, [favorites, category, subCategoryId, country]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────
  const handleCategoryChange = (newCat: LiveCategory) => {
    setCategory(newCat);
    const newCatDef = LIVE_FEED_CATEGORIES.find((c) => c.id === newCat);
    const hasAll = newCatDef?.subCategories.some((s) => s.id === "all");
    setSubCategoryId(hasAll ? "all" : newCatDef?.subCategories[0]?.id || "all");
  };

  const toggleFavorite = () => {
    if (!cloudLoadCompleteRef.current || !user?.id) return;
    const catDef = LIVE_FEED_CATEGORIES.find((c) => c.id === category);
    if (!catDef) return;
    const subDef = catDef.subCategories.find((s) => s.id === subCategoryId);
    const countryName =
      ALL_COUNTRIES.find((c) => c.code === country)?.name || undefined;
    const favId = `${category}-${subDef?.id || "all"}-${country || "all"}`;
    setFavorites((prev) => {
      const exists = prev.find(
        (f) =>
          f.category === category &&
          f.subCategoryId === subDef?.id &&
          f.country === country,
      );
      let next: LiveFeedFavorite[];
      if (exists) {
        next = prev.filter((f) => f.id !== exists.id);
      } else {
        next = [
          {
            id: favId,
            category,
            categoryLabel: catDef.label,
            subCategoryId: subDef?.id,
            subCategoryLabel: subDef?.label,
            country,
            countryName,
            createdAt: Date.now(),
          },
          ...prev,
        ];
      }
      cloudStorageService.set(LIVE_FEED_FAVORITES_KEY, next).catch(() => {});
      return next;
    });
  };

  const surpriseMe = () => {
    const { category: randCat, subCategory: randSub } =
      getRandomLiveFeedCombo();
    if (family === "video" || family === "audio") {
      const catDef = LIVE_FEED_CATEGORIES.find((c) => c.id === randCat);
      if (catDef && catDef.family !== family) {
        const familyCats = LIVE_FEED_CATEGORIES.filter(
          (c) => c.family === family && c.id !== "tv" && c.id !== "radio",
        );
        if (familyCats.length > 0) {
          const fc = familyCats[Math.floor(Math.random() * familyCats.length)];
          const fSubs = fc.subCategories.filter((s) => s.id !== "all");
          const fSub =
            fSubs.length > 0
              ? fSubs[Math.floor(Math.random() * fSubs.length)]
              : fc.subCategories[0];
          setCategory(fc.id);
          setSubCategoryId(fSub.id);
          return;
        }
      }
    }
    setCategory(randCat);
    setSubCategoryId(randSub.id);
  };

  const loadFavorite = (fav: LiveFeedFavorite) => {
    setCategory(fav.category);
    setSubCategoryId(fav.subCategoryId || "all");
    setCountry(fav.country);
    setShowAll(false);
    setShowFavoritesPanel(false);
  };

  // ─── EPG / REMINDERS CRUD ───────────────────────────────────────────────
  const openReminderModal = () => {
    setReminderForm({
      label: "",
      time: "20:00",
      recurrence: "once",
      weekday: 1,
    });
    setShowReminderModal(true);
  };

  const closeReminderModal = () => setShowReminderModal(false);

  const saveReminderFromModal = () => {
    const [hhStr, mmStr] = reminderForm.time.split(":");
    const hh = parseInt(hhStr, 10);
    const mm = parseInt(mmStr, 10);
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59)
      return;
    const catDef = LIVE_FEED_CATEGORIES.find((c) => c.id === category);
    if (!catDef) return;
    const subDef = catDef.subCategories.find((s) => s.id === subCategoryId);
    const countryName =
      ALL_COUNTRIES.find((c) => c.code === country)?.name || undefined;
    const reminder: LiveFeedReminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      channelId: `${category}-${subDef?.id || "all"}-${country || "all"}`,
      channelName: `${catDef.label}${subDef ? " · " + subDef.label : ""}${
        countryName ? " · " + countryName : ""
      }`,
      country,
      category,
      label:
        reminderForm.label.trim() ||
        `${catDef.label}${subDef ? " · " + subDef.label : ""} reminder`,
      minuteOfDay: hh * 60 + mm,
      recurrence: reminderForm.recurrence,
      weekday: reminderForm.weekday,
      createdAt: Date.now(),
    };
    setReminders((prev) => {
      const next = [...prev, reminder].sort(
        (a, b) => a.minuteOfDay - b.minuteOfDay,
      );
      saveReminders(next).catch(() => {});
      return next;
    });
    setShowReminderModal(false);
    setShowRemindersPanel(true);
  };

  const deleteReminder = (id: string) => {
    setReminders((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveReminders(next).catch(() => {});
      return next;
    });
  };

  // ─── FULLSCREEN ─────────────────────────────────────────────────────────
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = useCallback(() => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const accentBg =
    accent === "purple" ? "bg-purple-500 text-white" : "bg-blue-500 text-white";

  const playerHeight = compact ? 320 : isFullscreen ? "100%" : 480;

  // ─── RENDER ─────────────────────────────────────────────────────────────
  const embedContent = (
    <>
      {/* Header: category + country filter + feature toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2 min-w-0">
          {isRadio ? (
            <Radio
              size={16}
              className="text-purple-600 dark:text-purple-400 flex-shrink-0"
            />
          ) : (
            <Tv
              size={16}
              className="text-blue-600 dark:text-blue-400 flex-shrink-0"
            />
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {activeCat?.label || "Live Channels"}
          </h3>
          <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {showFeatureToolbar && (
            <>
              <button
                onClick={surpriseMe}
                title="Surprise me with a random channel"
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 ${
                  accent === "purple"
                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60"
                    : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                }`}
              >
                <Shuffle size={10} /> Surprise
              </button>
              <button
                onClick={toggleFavorite}
                title={
                  isFavorited ? "Remove from favorites" : "Add to favorites"
                }
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 ${
                  isFavorited
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <Heart
                  size={10}
                  className={isFavorited ? "fill-current" : ""}
                />
                {favorites.length > 0 ? favorites.length : ""}
              </button>
              {favorites.length > 0 && (
                <button
                  onClick={() => setShowFavoritesPanel((v) => !v)}
                  title="View favorites & history"
                  className="text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <Clock size={10} /> Recent
                </button>
              )}
              <button
                onClick={() => {
                  setShowRemindersPanel((v) => !v);
                  setShowFavoritesPanel(false);
                }}
                title="Watch reminders & schedule"
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 ${
                  showRemindersPanel
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <Bell size={10} /> Reminders
                {reminders.length > 0 && (
                  <span className="ml-0.5">{reminders.length}</span>
                )}
              </button>
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {isFullscreen ? (
                  <Minimize2 size={10} />
                ) : (
                  <Maximize2 size={10} />
                )}
              </button>
            </>
          )}
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setShowAll(false);
            }}
            className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[140px]"
            aria-label="Select country"
          >
            <option value="">🌍 All Countries</option>
            {ALL_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAll((v) => !v)}
            className={`text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 ${
              showAll
                ? accentBg
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
            title="Show channels from all countries"
          >
            <Grid3x3 size={10} /> {showAll ? "Global" : "Show All"}
          </button>
        </div>
      </div>

      {/* Dropdown filters: Category + Sub-category */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
        {showCategorySwitcher && availableCategories.length > 1 && (
          <label className="flex items-center gap-1.5 flex-shrink-0">
            <Layers size={12} className="text-gray-400 flex-shrink-0" />
            <select
              value={category}
              onChange={(e) =>
                handleCategoryChange(e.target.value as LiveCategory)
              }
              className="text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 pr-7 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Select category"
            >
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id} title={cat.description}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {showSubCategorySwitcher &&
          activeCat &&
          activeCat.subCategories.length > 1 && (
            <label className="flex items-center gap-1.5 flex-shrink-0">
              <Tag size={12} className="text-gray-400 flex-shrink-0" />
              <select
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                className="text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 pr-7 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                aria-label="Select sub-category"
              >
                {activeCat.subCategories.map((sub) => (
                  <option key={sub.id} value={sub.id} title={sub.description}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        {/* Station picker — select an individual station to PREVIEW it */}
        <label className="flex items-center gap-1.5 flex-shrink-0">
          <Monitor size={12} className="text-gray-400 flex-shrink-0" />
          <select
            value={selectedStation?.nanoid || ""}
            onChange={(e) => {
              const st = stations.find((s) => s.nanoid === e.target.value);
              setSelectedStation(st || null);
            }}
            disabled={stationsLoading}
            className="text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 pr-7 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors max-w-[180px]"
            aria-label="Select a station to preview"
          >
            <option value="">
              {stationsLoading
                ? "Loading stations…"
                : stations.length === 0
                  ? "No stations found"
                  : `Preview a station (${stations.length})`}
            </option>
            {filteredStations.map((st) => (
              <option key={st.nanoid} value={st.nanoid}>
                {st.name}
                {st.country ? ` (${st.country.toUpperCase()})` : ""}
              </option>
            ))}
          </select>
        </label>
        {/* Station search — filters the picker options (10+ items rule) */}
        {stations.length > 10 && (
          <label className="flex items-center gap-1 flex-shrink-0 relative">
            <Search
              size={11}
              className="absolute left-1.5 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              placeholder="Search stations…"
              className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-6 pr-2 py-1 w-32 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search stations"
            />
          </label>
        )}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">
          {showAll
            ? "Global"
            : country
              ? ALL_COUNTRIES.find((c) => c.code === country)?.name ||
                country.toUpperCase()
              : "All countries"}
        </span>
      </div>

      {/* Favorites + History panel */}
      {showFavoritesPanel && (
        <div className="px-3 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {favorites.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                <Heart size={11} className="text-red-500" /> Favorites
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {favorites.map((fav) => (
                  <button
                    key={fav.id}
                    onClick={() => loadFavorite(fav)}
                    className="text-[10px] px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    {fav.categoryLabel}
                    {fav.subCategoryLabel ? ` · ${fav.subCategoryLabel}` : ""}
                    {fav.countryName ? ` · ${fav.countryName}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {history.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                <Clock size={11} className="text-blue-500" /> Recently Watched
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {history.slice(0, 8).map((h, idx) => (
                  <button
                    key={`${h.category}-${h.subCategoryId}-${h.country}-${idx}`}
                    onClick={() =>
                      loadFavorite({
                        id: `hist-${idx}`,
                        category: h.category,
                        categoryLabel: h.categoryLabel,
                        subCategoryId: h.subCategoryId,
                        subCategoryLabel: h.subCategoryLabel,
                        country: h.country,
                        countryName: h.countryName,
                        createdAt: 0,
                      })
                    }
                    className="text-[10px] px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    {h.categoryLabel}
                    {h.subCategoryLabel ? ` · ${h.subCategoryLabel}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {favorites.length === 0 && history.length === 0 && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center py-2">
              No favorites or history yet. Use the ♥ button to bookmark
              channels, or browse to build your history.
            </p>
          )}
        </div>
      )}

      {/* Reminders panel */}
      {showRemindersPanel && (
        <div className="px-3 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Bell size={11} className="text-amber-500" /> Watch Reminders
            </h4>
            <button
              onClick={openReminderModal}
              className="text-[10px] px-2 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1"
            >
              <Calendar size={10} /> New
            </button>
          </div>
          {reminders.length > 0 ? (
            <div className="space-y-1 max-h-[260px] overflow-y-auto">
              {reminders.map((r) => {
                const next = nextReminderTime(r);
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                        {r.label}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {formatMinuteOfDay(r.minuteOfDay)} ·{" "}
                        {r.recurrence === "once"
                          ? "Once"
                          : r.recurrence === "daily"
                            ? "Daily"
                            : `Weekly (${WEEKDAYS[(r.weekday || 1) - 1]})`}{" "}
                        · {next ? formatRelativeTime(next) : "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteReminder(r.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Delete reminder"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center py-2">
              No reminders set. Click "New" to schedule a watch reminder.
            </p>
          )}
        </div>
      )}

      {/* Reminder modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 max-w-md w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell size={14} className="text-amber-500" /> Set Watch Reminder
              </h3>
              <button
                onClick={closeReminderModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300 block mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={reminderForm.label}
                  onChange={(e) =>
                    setReminderForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="e.g. Evening News"
                  className="w-full text-xs px-2 py-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300 block mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={reminderForm.time}
                  onChange={(e) =>
                    setReminderForm((f) => ({ ...f, time: e.target.value }))
                  }
                  className="w-full text-xs px-2 py-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300 block mb-1">
                  Repeat
                </label>
                <select
                  value={reminderForm.recurrence}
                  onChange={(e) =>
                    setReminderForm((f) => ({
                      ...f,
                      recurrence: e.target.value as ReminderRecurrence,
                    }))
                  }
                  className="w-full text-xs px-2 py-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="once">Once</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                </select>
              </div>
              {reminderForm.recurrence === "weekly" && (
                <div>
                  <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300 block mb-1">
                    Day of week
                  </label>
                  <select
                    value={reminderForm.weekday}
                    onChange={(e) =>
                      setReminderForm((f) => ({
                        ...f,
                        weekday: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full text-xs px-2 py-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {WEEKDAYS.map((label, idx) => (
                      <option key={idx} value={idx + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={closeReminderModal}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={saveReminderFromModal}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1"
              >
                <Bell size={11} /> Set Reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER — direct iframe embed of the live-feed provider */}
      <div
        ref={playerContainerRef}
        className="relative w-full bg-black overflow-hidden"
        style={{
          height:
            typeof playerHeight === "number"
              ? `${playerHeight}px`
              : playerHeight,
        }}
      >
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black">
            <div className="text-center">
              <Loader2
                size={32}
                className="text-blue-500 animate-spin mx-auto mb-2"
              />
              <p className="text-xs text-gray-400">Loading live channels…</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={embedUrl}
          src={embedUrl}
          title={activeCat?.label || "Live Channels"}
          onLoad={onIframeLoad}
          className="absolute inset-0 w-full h-full border-0 bg-black"
          allow="accelerometer; autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          loading="eager"
        />
        {/* STATION PREVIEW — overlays the browse iframe when a station is selected */}
        {selectedStation && (
          <StationPreview
            station={selectedStation}
            isAudio={isRadio}
            onClose={() => setSelectedStation(null)}
          />
        )}
      </div>

      {/* Footer — active combo label (+ selected station when previewing) */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
          <Sparkles size={10} className="inline mr-1 text-blue-400" />
          {activeCat?.label}
          {activeSubCategory && activeSubCategory.id !== "all"
            ? ` · ${activeSubCategory.label}`
            : ""}
          {showAll
            ? " · Global"
            : country
              ? ` · ${ALL_COUNTRIES.find((c) => c.code === country)?.name || country.toUpperCase()}`
              : " · All countries"}
          {selectedStation ? ` · ▶ ${selectedStation.name}` : ""}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
          Live sync{cloudLoadCompleteRef.current ? " ✓" : "…"}
        </span>
      </div>
    </>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between p-2 bg-gray-900">
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={14} className="text-blue-400" />
            <span className="text-xs font-semibold">
              Live Channels — Fullscreen
            </span>
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
          {embedContent}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {embedContent}
    </div>
  );
}
