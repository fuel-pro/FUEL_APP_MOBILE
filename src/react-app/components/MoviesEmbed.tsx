/**
 * MoviesEmbed — the Movies sub-tab (reverse-engineered streamingunity.vip /
 * StreamingCommunity mirror). Renders a native FuelPro movie + series catalog
 * (movies, series, TV shows, limited series) with search, genre filter, type
 * filter, surprise pick, cloud-synced favorites / watchlist / continue-
 * watching, a detail modal with season/episode picker, and a NATIVE hls.js
 * player (the raw HLS playlist chain is CORS-open, so playback needs no
 * iframe — the upstream embed iframe is kept only as an explicit fallback).
 *
 * Matches the LiveFeedEmbed feature set so all live-content sub-tabs in the
 * News tab behave consistently. Cloud sync uses the 3-ref guard pattern
 * (cloudLoadCompleteRef / localModifiedRef / post-load flush) to prevent the
 * flash-then-blank data-loss bug.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import {
  Film,
  Search,
  Star,
  Shuffle,
  Heart,
  Clock,
  Play,
  X,
  Bookmark,
  BookmarkCheck,
  ListVideo,
  Loader2,
  History,
  Trash2,
  MonitorPlay,
  Tv,
  Clapperboard,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";
import {
  fetchMovieCatalog,
  fetchMovieBrowse,
  searchMovies,
  fetchMovieDetail,
  fetchMoviePlayerUrl,
  fetchMovieStreams,
  type MovieItem,
  type MovieDetail,
  type MovieGenre,
  type MovieStreamInfo,
} from "@/react-app/services/MovieService";

// ─── Cloud keys ----------------------------------------------------------------
const FAVORITES_KEY = "movie_favorites";
const WATCHLIST_KEY = "movie_watchlist";
const HISTORY_KEY = "movie_history";
const HISTORY_MAX = 24;
const FAVORITES_MAX = 100;

type ViewMode = "catalog" | "search" | "genre";
type TypeFilter = "all" | "movie" | "tv";

interface Props {
  accent?: "blue" | "purple" | "amber";
}

/** Build the CORS-proxy URL for an HLS resource (same-origin on both hosts).
 * vixcloud blocks direct browser cross-origin fetches (403 on Origin), so the
 * player routes the playlist/rendition/segment chain through the proxy. */
function movieHlsProxyUrl(url: string): string {
  const origin = window.location.origin;
  return `${origin}/api/hls-proxy?url=${encodeURIComponent(url)}`;
}

// ─── MoviePlayer — native hls.js player for the reverse-engineered stream ─────
// Plays the raw HLS playlist: no iframe, no ads, no analytics, no
// frame-ancestors CSP block. vixcloud blocks direct browser cross-origin
// fetches, so the chain is routed through the same-origin HLS CORS proxy
// (the existing /api/hls-proxy used by Live TV). Falls back to the embed
// iframe only when the native stream cannot be loaded.
function MoviePlayer({
  streamInfo,
  title,
  poster,
  onClose,
  onUseFallback,
}: {
  streamInfo: MovieStreamInfo;
  title: string;
  poster: string | null;
  onClose: () => void;
  onUseFallback?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<
    { height: number; bitrate: number; hlsIndex: number }[]
  >([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = auto (hls index)
  const [error, setError] = useState<string | null>(null);
  const [showQuality, setShowQuality] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);

    const onFatal = () =>
      setError(
        "This title's stream is blocked on your network or temporarily unreachable. " +
          "Tap an episode below, or Retry — streams rotate between servers.",
      );

    // Direct-first: the vixcloud playlist endpoint sends
    // `Access-Control-Allow-Origin: *` and serves regular (browser) IPs, so
    // hls.js can fetch it cross-origin with NO proxy. The proxy is only the
    // fallback for networks where vixcloud blocks the user's IP/ASN (the
    // proxy's own datacenter IP may itself be blocked — vixcloud 403s both
    // Cloudflare and AWS IPs on the playlist endpoint — so direct-first is
    // the ONLY reliable path for most users).
    let triedProxy = false;
    let manifestParsed = false;
    // Server rotation: the upstream exposes multiple server URLs (Server1,
    // Server2, …). When the active one fatally fails, rotate to the next —
    // this is what rescues the episodes whose primary server is down.
    const serverUrls = (streamInfo.servers || [])
      .filter((s) => s.url)
      .map((s) => {
        // Reattach the auth params (token/expires/asn/h) that the playlist
        // URL carries but the bare server URLs may be missing.
        const pl = new URL(streamInfo.playlistUrl);
        const u = new URL(s.url, pl.origin);
        for (const key of ["token", "expires", "asn", "h"]) {
          const v = pl.searchParams.get(key);
          if (v && !u.searchParams.get(key)) u.searchParams.set(key, v);
        }
        return u.href;
      });
    let serverIdx = 0;
    // Hard timeout — if nothing plays within 20s, surface the error instead
    // of spinning forever (the reported "keeps loading" bug).
    const playTimeout = window.setTimeout(() => {
      if (video.readyState === 0 && video.paused) onFatal();
    }, 20000);
    const clearPlayTimeout = () => window.clearTimeout(playTimeout);
    const onPlaying = () => clearPlayTimeout();
    video.addEventListener("playing", onPlaying);

    const attachHls = (src: string) => {
      const hls = new Hls({
        enableWorker: false,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 30000,
        // Retry manifest/level/frag errors a few times before going fatal —
        // the segment CDN occasionally rate-limits, and a hard fatal on the
        // first 403 is what made some episodes look permanently broken.
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        levelLoadingRetryDelay: 1000,
        fragLoadingRetryDelay: 1000,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        manifestParsed = true;
        const lv = (hls.levels || [])
          .map((l, hlsIndex) => ({
            height: l.height,
            bitrate: l.bitrate,
            hlsIndex,
          }))
          .sort((a, b) => b.height - a.height);
        setLevels(lv);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Manifest load failed — rotate to the next server (fixes episodes
          // whose primary server is down), then try the proxy as last resort.
          if (
            !triedProxy &&
            !manifestParsed &&
            serverIdx < serverUrls.length - 1
          ) {
            serverIdx += 1;
            hls.destroy();
            hlsRef.current = null;
            attachHls(serverUrls[serverIdx]);
            return;
          }
          if (!triedProxy && !manifestParsed) {
            triedProxy = true;
            hls.destroy();
            hlsRef.current = null;
            attachHls(
              movieHlsProxyUrl(serverUrls[serverIdx] ?? streamInfo.playlistUrl),
            );
            return;
          }
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        onFatal();
      });
      return hls;
    };

    const cleanup = () => {
      clearPlayTimeout();
      video.removeEventListener("playing", onPlaying);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    if (Hls.isSupported()) {
      attachHls(serverUrls[0] ?? streamInfo.playlistUrl);
      return cleanup;
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS — direct first, server rotation, proxy last.
      video.src = serverUrls[0] ?? streamInfo.playlistUrl;
      video.play().catch(() => {});
      const onErr = () => {
        if (serverIdx < serverUrls.length - 1) {
          serverIdx += 1;
          video.src = serverUrls[serverIdx];
          video.play().catch(() => {});
          return;
        }
        if (!triedProxy) {
          triedProxy = true;
          video.src = movieHlsProxyUrl(
            serverUrls[serverIdx] ?? streamInfo.playlistUrl,
          );
          video.play().catch(() => {});
          return;
        }
        onFatal();
      };
      video.addEventListener("error", onErr);
      return () => {
        clearPlayTimeout();
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("error", onErr);
      };
    }
    onFatal();
    return cleanup;
  }, [streamInfo, retryNonce]);

  const setQuality = (hlsIndex: number) => {
    setCurrentLevel(hlsIndex);
    if (hlsRef.current) hlsRef.current.currentLevel = hlsIndex;
    setShowQuality(false);
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-4 group">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full"
        controls
        playsInline
        poster={poster ?? undefined}
        aria-label={title}
      />
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
        title="Close player"
      >
        <X size={14} />
      </button>
      {/* Quality selector */}
      {levels.length > 1 && (
        <div className="absolute top-2 left-2 z-10">
          <button
            onClick={() => setShowQuality((v) => !v)}
            className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 flex items-center gap-1 text-[10px]"
            title="Quality"
          >
            <Settings2 size={13} />
            {currentLevel === -1
              ? "Auto"
              : `${levels.find((l) => l.hlsIndex === currentLevel)?.height ?? ""}p`}
          </button>
          {showQuality && (
            <div className="absolute top-9 left-0 rounded-lg bg-black/90 border border-white/10 py-1 min-w-[110px]">
              <button
                onClick={() => setQuality(-1)}
                className={`block w-full text-left px-3 py-1.5 text-[11px] ${currentLevel === -1 ? "text-amber-400" : "text-white/80 hover:bg-white/10"}`}
              >
                Auto
              </button>
              {levels.map((l) => (
                <button
                  key={l.hlsIndex}
                  onClick={() => setQuality(l.hlsIndex)}
                  className={`block w-full text-left px-3 py-1.5 text-[11px] ${currentLevel === l.hlsIndex ? "text-amber-400" : "text-white/80 hover:bg-white/10"}`}
                >
                  {l.height}p
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 px-4 text-center">
          <p className="text-xs text-gray-300 max-w-sm">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setRetryNonce((n) => n + 1)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <RotateCcw size={13} /> Retry
            </button>
            {onUseFallback && (
              <button
                onClick={onUseFallback}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
              >
                Use fallback player
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MoviesEmbed({ accent = "amber" }: Props) {
  const { user } = useAuth();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>("catalog");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogSliders, setCatalogSliders] = useState<
    { name: string; label: string; titles: MovieItem[] }[]
  >([]);
  const [genres, setGenres] = useState<MovieGenre[]>([]);
  const [activeGenre, setActiveGenre] = useState<number | null>(null);
  const [browseSlider, setBrowseSlider] = useState("trending");
  const [browseTitles, setBrowseTitles] = useState<MovieItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MovieItem[]>([]);

  // ── Detail + player ───────────────────────────────────────────────────────
  const [selected, setSelected] = useState<MovieItem | null>(null);
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<MovieStreamInfo | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // ── Season selector (series / TV shows / limited series) ─────────────────
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);

  // ── Trailer (in-app YouTube preview modal) ────────────────────────────────
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [activeTrailer, setActiveTrailer] = useState(0);

  // ── Cloud-synced favorites / watchlist / history ──────────────────────────
  const [favorites, setFavorites] = useState<MovieItem[]>([]);
  const [watchlist, setWatchlist] = useState<MovieItem[]>([]);
  const [history, setHistory] = useState<MovieItem[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  // 3-ref guard (anti flash-then-blank cloud-sync bug)
  const cloudLoadCompleteRef = useRef(false);
  const localModifiedRef = useRef(false);

  // ── Load catalog on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cat = await fetchMovieCatalog();
        if (cancelled) return;
        setCatalogSliders(cat.sliders);
        setGenres(cat.genres);
        if (cat.sliders.length === 0) setError("Could not load the catalog.");
      } catch {
        if (!cancelled) setError("Could not load the catalog.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Cloud load: favorites + watchlist + history ───────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    cloudLoadCompleteRef.current = false;
    (async () => {
      try {
        const [fav, wl, hist] = await Promise.all([
          cloudStorageService.get<MovieItem[]>(FAVORITES_KEY),
          cloudStorageService.get<MovieItem[]>(WATCHLIST_KEY),
          cloudStorageService.get<MovieItem[]>(HISTORY_KEY),
        ]);
        if (cancelled) return;
        if (Array.isArray(fav)) setFavorites(fav);
        if (Array.isArray(wl)) setWatchlist(wl);
        if (Array.isArray(hist)) setHistory(hist);
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

  // ── Persist helpers (local-only modifications) ───────────────────────────
  const persist = useCallback(
    (key: string, value: MovieItem[]) => {
      if (!cloudLoadCompleteRef.current || !user?.id) return;
      localModifiedRef.current = true;
      cloudStorageService.set(key, value).catch(() => {});
    },
    [user?.id],
  );

  // ── Fetch a slider / genre browse ─────────────────────────────────────────
  const loadBrowse = useCallback(
    async (slider: string, genre?: number | null) => {
      setLoading(true);
      const data = await fetchMovieBrowse(slider, genre ?? undefined);
      setBrowseTitles(data.titles);
      setBrowseSlider(slider);
      setLoading(false);
    },
    [],
  );

  const handleGenre = (genreId: number | null) => {
    setActiveGenre(genreId);
    setView("genre");
    void loadBrowse(browseSlider, genreId);
  };

  const handleSliderBrowse = (slider: string) => {
    setActiveGenre(null);
    setView("catalog");
    void loadBrowse(slider, null);
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setView("catalog");
      setSearchResults([]);
      return;
    }
    setView("search");
    const results = await searchMovies(q);
    setSearchResults(results);
  }, []);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (v: string) => {
    setSearchQuery(v);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => void runSearch(v), 450);
  };

  // ── Surprise me ───────────────────────────────────────────────────────────
  const surprise = () => {
    const pool =
      view === "search"
        ? searchResults
        : view === "genre" || browseTitles.length
          ? browseTitles
          : catalogSliders.flatMap((s) => s.titles);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    openDetail(pick);
  };

  // ── Open detail modal ─────────────────────────────────────────────────────
  const openDetail = (item: MovieItem) => {
    setSelected(item);
    setDetail(null);
    setPlayerUrl(null);
    setStreamInfo(null);
    setSelectedEpisode(null);
    setTrailerOpen(false);
    setActiveTrailer(0);
    setSelectedSeason(null);
    setSeasonLoading(false);
    setDetailLoading(true);
    void fetchMovieDetail(item.id, item.slug).then((d) => {
      setSelectedSeason(d?.loadedSeason?.number ?? null);
      // track in continue-watching history
      if (cloudLoadCompleteRef.current && user?.id) {
        setHistory((prev) => {
          const next = [item, ...prev.filter((h) => h.id !== item.id)].slice(
            0,
            HISTORY_MAX,
          );
          persist(HISTORY_KEY, next);
          return next;
        });
      }
      setDetail(d);
      setDetailLoading(false);
    });
  };

  // ── Season switch — fetch that season's episodes (series/TV/limited) ─────
  const changeSeason = (seasonNum: number) => {
    if (!selected || seasonNum === selectedSeason) return;
    setSelectedSeason(seasonNum);
    setSelectedEpisode(null);
    setStreamInfo(null);
    setPlayerUrl(null);
    setSeasonLoading(true);
    void fetchMovieDetail(selected.id, selected.slug, seasonNum).then((d) => {
      if (d) setDetail(d);
      setSeasonLoading(false);
    });
  };

  // ── Player ────────────────────────────────────────────────────────────────
  // Native-first: fetch the raw HLS stream info (CORS-open playlist) and play
  // with hls.js. The iframe embed is kept only as an explicit fallback.
  const play = (episodeId?: number) => {
    if (!selected) return;
    setPlayerLoading(true);
    setPlayerUrl(null);
    setStreamInfo(null);
    void fetchMovieStreams(selected.id, episodeId).then((info) => {
      if (info?.playlistUrl) {
        setStreamInfo(info);
        setPlayerLoading(false);
        return;
      }
      // Fallback: the iframe embed (works on platforms where the upstream
      // allows framing, or when the streams extraction fails).
      void fetchMoviePlayerUrl(selected.id, episodeId).then((url) => {
        setPlayerUrl(url);
        setPlayerLoading(false);
      });
    });
  };

  const useFallbackPlayer = () => {
    if (!selected) return;
    setStreamInfo(null);
    setPlayerLoading(true);
    void fetchMoviePlayerUrl(
      selected.id,
      selectedEpisode ?? detail?.loadedSeason?.episodes?.[0]?.id ?? undefined,
    ).then((url) => {
      setPlayerUrl(url);
      setPlayerLoading(false);
    });
  };

  // ── Favorites / watchlist toggles ─────────────────────────────────────────
  const isFavorited = (item: MovieItem) =>
    favorites.some((f) => f.id === item.id);
  const isWatchlisted = (item: MovieItem) =>
    watchlist.some((w) => w.id === item.id);

  const toggleFavorite = (item: MovieItem) => {
    if (!user?.id) return;
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === item.id);
      const next = exists
        ? prev.filter((f) => f.id !== item.id)
        : [item, ...prev].slice(0, FAVORITES_MAX);
      persist(FAVORITES_KEY, next);
      return next;
    });
  };

  const toggleWatchlist = (item: MovieItem) => {
    if (!user?.id) return;
    setWatchlist((prev) => {
      const exists = prev.some((w) => w.id === item.id);
      const next = exists
        ? prev.filter((w) => w.id !== item.id)
        : [item, ...prev].slice(0, FAVORITES_MAX);
      persist(WATCHLIST_KEY, next);
      return next;
    });
  };

  const removeHistoryItem = (item: MovieItem) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== item.id);
      persist(HISTORY_KEY, next);
      return next;
    });
  };

  // ── Current movie list to render (movies + series, type-filtered) ─────────
  const unfilteredList: MovieItem[] =
    view === "search"
      ? searchResults
      : view === "genre" || browseTitles.length
        ? browseTitles
        : catalogSliders.flatMap((s) => s.titles);
  const listToRender: MovieItem[] =
    typeFilter === "all"
      ? unfilteredList
      : unfilteredList.filter((t) => t.type === typeFilter);

  const accentBorder =
    accent === "amber"
      ? "border-amber-400/40"
      : accent === "purple"
        ? "border-purple-400/40"
        : "border-blue-400/40";

  return (
    <div className="space-y-4">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search movies & series..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-400"
          />
        </div>
        {/* Type filter: All / Movies / TV Series (series, TV shows, limited series) */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
          {(
            [
              { id: "all", label: "All", icon: Clapperboard },
              { id: "movie", label: "Movies", icon: Film },
              { id: "tv", label: "TV Series", icon: Tv },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                typeFilter === t.id
                  ? "bg-amber-500 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={surprise}
          title="Surprise me"
          className="px-3 py-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 text-xs font-medium flex items-center gap-1.5"
        >
          <Shuffle size={14} /> Surprise
        </button>
        <button
          onClick={() => setShowLibrary((v) => !v)}
          title="My library"
          className="px-3 py-2 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 text-xs font-medium flex items-center gap-1.5"
        >
          <ListVideo size={14} /> Library ({favorites.length + watchlist.length}
          )
        </button>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          {cloudLoadCompleteRef.current ? "Live sync ✓" : "Live sync…"}
        </span>
      </div>

      {/* Genre pills + slider browse */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          onClick={() => handleGenre(null)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${activeGenre === null && view === "catalog" ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
        >
          All
        </button>
        {genres.slice(0, 12).map((g) => (
          <button
            key={g.id}
            onClick={() => handleGenre(g.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${activeGenre === g.id ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
          >
            {g.name}
          </button>
        ))}
        <span className="mx-1 w-px h-4 bg-gray-300 dark:bg-gray-600" />
        {["trending", "latest", "top10"].map((s) => (
          <button
            key={s}
            onClick={() => handleSliderBrowse(s)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25"
          >
            {s === "trending"
              ? "Trending"
              : s === "latest"
                ? "Latest"
                : "Top 10"}
          </button>
        ))}
      </div>

      {/* Library panel (favorites / watchlist / continue-watching) */}
      {showLibrary && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
          {/* Favorites */}
          <LibrarySection
            title="Favorites"
            icon={<Heart size={14} className="text-rose-500" />}
            items={favorites}
            onOpen={openDetail}
            onRemove={(it) => toggleFavorite(it)}
            empty="No favorites yet — tap the ♥ on a movie."
          />
          {/* Watchlist */}
          <LibrarySection
            title="Watchlist"
            icon={<Bookmark size={14} className="text-blue-500" />}
            items={watchlist}
            onOpen={openDetail}
            onRemove={(it) => toggleWatchlist(it)}
            empty="No watchlist items — tap the bookmark on a movie."
          />
          {/* Continue watching */}
          <LibrarySection
            title="Continue Watching"
            icon={<History size={14} className="text-emerald-500" />}
            items={history}
            onOpen={openDetail}
            onRemove={removeHistoryItem}
            empty="Movies you open appear here."
          />
        </div>
      )}

      {/* Movie grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 size={24} className="animate-spin" />
          <span className="ml-2 text-sm">Loading movies…</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <Film
            size={40}
            className="mx-auto text-gray-300 dark:text-gray-600 mb-3"
          />
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      ) : listToRender.length === 0 ? (
        <div className="text-center py-12">
          <Film
            size={40}
            className="mx-auto text-gray-300 dark:text-gray-600 mb-3"
          />
          <p className="text-gray-500 text-sm">
            {view === "search"
              ? `No movies matching "${searchQuery}"`
              : "No movies found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {listToRender.map((m) => (
            <MovieCard
              key={m.id}
              movie={m}
              onOpen={() => openDetail(m)}
              onFavorite={() => toggleFavorite(m)}
              onWatchlist={() => toggleWatchlist(m)}
              favorited={isFavorited(m)}
              watchlisted={isWatchlisted(m)}
              accent={accentBorder}
            />
          ))}
        </div>
      )}

      {/* ─────────────── DETAIL MODAL ─────────────── */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-gray-200 dark:border-gray-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Backdrop */}
            {(detail?.background || selected.background || selected.cover) && (
              <div className="relative h-36 sm:h-48 w-full overflow-hidden rounded-t-2xl">
                <img
                  src={
                    detail?.background ||
                    selected.background ||
                    selected.cover ||
                    ""
                  }
                  alt={selected.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {selected.name}
                    {selected.year && (
                      <span className="text-xs font-normal text-gray-500">
                        ({selected.year})
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {selected.score && (
                      <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                        <Star size={12} className="fill-amber-500" />
                        {selected.score}
                      </span>
                    )}
                    {detail?.quality && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">
                        {detail.quality}
                      </span>
                    )}
                    {detail?.runtime != null && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={11} /> {detail.runtime} min
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase flex items-center gap-1">
                      {selected.type === "tv" ? (
                        <>
                          <Tv size={10} /> Series
                        </>
                      ) : (
                        <>
                          <Film size={10} /> Movie
                        </>
                      )}
                    </span>
                    {selected.type === "tv" && selected.seasonsCount > 0 && (
                      <span className="text-xs text-gray-500">
                        {selected.seasonsCount}{" "}
                        {selected.seasonsCount === 1 ? "season" : "seasons"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Genres */}
              {detail && detail.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {detail.genres.map((g) => (
                    <span
                      key={g.id}
                      className="px-2 py-0.5 rounded-md text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Plot */}
              {(detail?.plot || detailLoading) && (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                  {detailLoading ? "Loading…" : detail?.plot}
                </p>
              )}

              {/* Cast / Directors */}
              {detail && (
                <div className="space-y-1 mb-4 text-xs text-gray-500 dark:text-gray-400">
                  {detail.directors.length > 0 && (
                    <p>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Director:
                      </span>{" "}
                      {detail.directors.join(", ")}
                    </p>
                  )}
                  {detail.actors.length > 0 && (
                    <p>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Cast:
                      </span>{" "}
                      {detail.actors.slice(0, 6).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* PLAYER — native hls.js first, iframe fallback */}
              {streamInfo ? (
                <MoviePlayer
                  streamInfo={streamInfo}
                  title={selected.name}
                  poster={selected.cover ?? selected.poster}
                  onClose={() => setStreamInfo(null)}
                  onUseFallback={useFallbackPlayer}
                />
              ) : playerUrl ? (
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-4">
                  <iframe
                    src={playerUrl}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    frameBorder="0"
                    title={selected.name}
                  />
                  <button
                    onClick={() => setPlayerUrl(null)}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                    title="Close player"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() =>
                    play(
                      selectedEpisode ??
                        // TV series need an episode for the stream lookup —
                        // default to the first episode of the loaded season.
                        detail?.loadedSeason?.episodes?.[0]?.id ??
                        undefined,
                    )
                  }
                  disabled={playerLoading}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 mb-4 transition-colors"
                >
                  {playerLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} className="fill-white" />
                  )}
                  {playerLoading ? "Loading player…" : "Watch Now"}
                </button>
              )}

              {/* TV: season selector (all seasons, incl. latest) + episodes */}
              {selected.type === "tv" &&
                detail &&
                detail.seasons.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <label
                        htmlFor="fp-season-select"
                        className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                      >
                        Season
                      </label>
                      <select
                        id="fp-season-select"
                        value={detail.loadedSeason?.number ?? ""}
                        onChange={(e) => changeSeason(Number(e.target.value))}
                        disabled={seasonLoading}
                        className="flex-1 min-w-0 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1.5 disabled:opacity-60"
                      >
                        {detail.seasons.map((s) => (
                          <option key={s.id} value={s.number}>
                            {s.name || `Season ${s.number}`}
                            {s.number ===
                            Math.max(...detail.seasons.map((x) => x.number))
                              ? " (Latest)"
                              : ""}
                          </option>
                        ))}
                      </select>
                      {seasonLoading && (
                        <Loader2
                          size={14}
                          className="animate-spin text-amber-500"
                        />
                      )}
                    </div>
                    {detail.loadedSeason &&
                      detail.loadedSeason.episodes.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {detail.seasons.length === 1
                              ? "Episodes"
                              : `Season ${detail.loadedSeason.number} Episodes`}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-auto">
                            {detail.loadedSeason.episodes.map((ep) => (
                              <button
                                key={ep.id}
                                onClick={() => {
                                  setSelectedEpisode(ep.id);
                                  play(ep.id);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors ${selectedEpisode === ep.id ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                              >
                                <span className="font-medium">
                                  E{ep.number}
                                </span>{" "}
                                {ep.name && (
                                  <span className="opacity-80">
                                    · {ep.name}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                  </div>
                )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleFavorite(selected)}
                  className={`flex-1 min-w-[120px] py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${isFavorited(selected) ? "bg-rose-500/20 text-rose-600 dark:text-rose-400" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
                >
                  <Heart
                    size={13}
                    className={isFavorited(selected) ? "fill-rose-500" : ""}
                  />
                  {isFavorited(selected) ? "Favorited" : "Favorite"}
                </button>
                <button
                  onClick={() => toggleWatchlist(selected)}
                  className={`flex-1 min-w-[120px] py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${isWatchlisted(selected) ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
                >
                  {isWatchlisted(selected) ? (
                    <BookmarkCheck size={13} />
                  ) : (
                    <Bookmark size={13} />
                  )}
                  {isWatchlisted(selected) ? "Watchlisted" : "Watchlist"}
                </button>
                {detail && detail.trailers.length > 0 && (
                  <button
                    onClick={() => {
                      setActiveTrailer(0);
                      setTrailerOpen(true);
                    }}
                    className="flex-1 min-w-[120px] py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25"
                  >
                    <MonitorPlay size={13} /> Trailer
                    {detail.trailers.length > 1 && (
                      <span className="text-[10px] opacity-70">
                        ({detail.trailers.length})
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* In-app trailer preview modal (YouTube embed). The API only
                  returns validated-playable trailer ids (upstream ids that
                  are private/deleted are filtered out, with a YouTube
                  search fallback), so this always yields a working preview. */}
              {trailerOpen && detail && detail.trailers.length > 0 && (
                <div
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3 sm:p-6"
                  onClick={() => setTrailerOpen(false)}
                  role="dialog"
                  aria-label={`${selected.name} trailer`}
                >
                  <div
                    className="relative w-full max-w-3xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white truncate">
                        {selected.name}
                        <span className="ml-2 text-[11px] font-normal text-red-400">
                          Trailer{" "}
                          {detail.trailers.length > 1
                            ? `${activeTrailer + 1} of ${detail.trailers.length}`
                            : ""}
                        </span>
                      </p>
                      <button
                        onClick={() => setTrailerOpen(false)}
                        className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
                        title="Close trailer"
                        aria-label="Close trailer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                      <iframe
                        key={detail.trailers[activeTrailer]}
                        src={`https://www.youtube-nocookie.com/embed/${detail.trailers[activeTrailer]}?autoplay=1&rel=0`}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        frameBorder="0"
                        title={`${selected.name} trailer`}
                      />
                    </div>
                    {detail.trailers.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {detail.trailers.map((t, i) => (
                          <button
                            key={t}
                            onClick={() => setActiveTrailer(i)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${activeTrailer === i ? "bg-red-500 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                          >
                            Trailer {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Library section (favorites / watchlist / continue-watching) ─────────────
function LibrarySection({
  title,
  icon,
  items,
  onOpen,
  onRemove,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: MovieItem[];
  onOpen: (m: MovieItem) => void;
  onRemove: (m: MovieItem) => void;
  empty: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
        {icon} {title}
      </p>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-400">{empty}</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((m) => (
            <div
              key={m.id}
              className="relative flex-shrink-0 w-20 group cursor-pointer"
              onClick={() => onOpen(m)}
            >
              <div className="w-20 h-28 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                {m.poster ? (
                  <img
                    src={m.poster}
                    alt={m.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={18} className="text-gray-400" />
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(m);
                }}
                className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash2 size={10} />
              </button>
              <p className="mt-1 text-[10px] text-gray-600 dark:text-gray-400 line-clamp-1">
                {m.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Movie card ──────────────────────────────────────────────────────────────
function MovieCard({
  movie,
  onOpen,
  onFavorite,
  onWatchlist,
  favorited,
  watchlisted,
  accent,
}: {
  movie: MovieItem;
  onOpen: () => void;
  onFavorite: () => void;
  onWatchlist: () => void;
  favorited: boolean;
  watchlisted: boolean;
  accent: string;
}) {
  return (
    <div className="group relative">
      <div
        onClick={onOpen}
        className={`relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 ${accent} cursor-pointer transition-transform group-hover:scale-[1.02]`}
      >
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={28} className="text-gray-400" />
          </div>
        )}
        {/* hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
          <div className="flex items-center gap-1">
            <Play size={12} className="text-white fill-white" />
            <span className="text-white text-[10px] font-semibold">Watch</span>
          </div>
        </div>
        {/* score badge */}
        {movie.score && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] bg-black/70 text-amber-400 font-semibold flex items-center gap-1">
            <Star size={9} className="fill-amber-400" /> {movie.score}
          </span>
        )}
        {/* type badge (Series vs Movie) */}
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] bg-black/70 text-white/90 font-medium flex items-center gap-1 uppercase">
          {movie.type === "tv" ? (
            <>
              <Tv size={9} /> Series
            </>
          ) : (
            <>
              <Film size={9} /> Movie
            </>
          )}
        </span>
      </div>
      {/* action buttons */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavorite();
          }}
          className="p-1 rounded-md bg-black/60 text-white hover:bg-black/80"
          title={favorited ? "Unfavorite" : "Favorite"}
        >
          <Heart
            size={11}
            className={favorited ? "fill-rose-500 text-rose-500" : ""}
          />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onWatchlist();
          }}
          className="p-1 rounded-md bg-black/60 text-white hover:bg-black/80"
          title={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
        >
          {watchlisted ? (
            <BookmarkCheck size={11} className="text-blue-400" />
          ) : (
            <Bookmark size={11} />
          )}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400">
        {movie.name}
      </p>
      {movie.year && <p className="text-[10px] text-gray-400">{movie.year}</p>}
    </div>
  );
}
