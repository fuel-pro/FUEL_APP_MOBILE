import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  LIVE_FEED_CATEGORIES,
  LIVE_FEED_FAVORITES_KEY,
  LIVE_FEED_HISTORY_KEY,
  HISTORY_MAX,
  fetchLiveChannels,
  resolveChannelFetchParams,
  getRandomLiveFeedCombo,
  type LiveCategory,
  type LiveFeedCategory,
  type LiveFeedFavorite,
  type LiveFeedHistoryEntry,
  type LiveChannel,
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
  Search,
  Volume2,
  VolumeX,
  AlertCircle,
  Play,
  Layers,
  Tag,
  Monitor,
} from "lucide-react";
import Hls from "hls.js";

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
 * A NATIVE live channel grid + player. Fetches channel data directly from
 * the provider's JSON API and renders a clean FuelPro-styled grid —
 * EXACTLY like "Live News Streams" does with YouTube embeds. NO iframe
 * pointing to the provider's website is ever used. The user sees ONLY
 * FuelPro UI: channel cards, a player, category/country filters, and the
 * feature toolbar. Zero upstream attribution.
 *
 * PLAYBACK:
 *  - TV channels with .m3u8 stream URLs → HLS.js (or native HLS on Safari)
 *  - TV channels with YouTube URLs → YouTube iframe embed
 *  - Radio channels → direct <audio> element
 *
 * FEATURES (all cloud-synced cross-device):
 *  - 2-LEVEL taxonomy (category + sub-category)
 *  - Country filter (195 countries) + Show All (global)
 *  - Favorites, Surprise Me, Recently Watched, For You
 *  - Search within loaded channels
 *  - Fullscreen mode
 */
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

  // Channel state
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState<LiveChannel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const [playbackError, setPlaybackError] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [ytIframeHidden, setYtIframeHidden] = useState(false);

  // Cloud load guard
  const cloudLoadCompleteRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Track recovery attempts so we don't loop forever on a dead stream
  const hlsRecoveryRef = useRef(0);
  // Auto-advance guard: prevents infinite skip loops when every channel fails
  const autoAdvanceTriedRef = useRef<Set<string>>(new Set());

  // Sync the video element's muted DOM property with React state.
  // React has a known bug where the `muted` JSX attribute does not reliably
  // update the DOM property — we must set it imperatively.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted, activeChannel]);

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

  // Load favorites + history from cloud
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    cloudLoadCompleteRef.current = false;
    (async () => {
      try {
        const [favData, histData] = await Promise.all([
          cloudStorageService.get<LiveFeedFavorite[]>(LIVE_FEED_FAVORITES_KEY),
          cloudStorageService.get<LiveFeedHistoryEntry[]>(
            LIVE_FEED_HISTORY_KEY,
          ),
        ]);
        if (!cancelled) {
          if (Array.isArray(favData)) setFavorites(favData);
          if (Array.isArray(histData)) setHistory(histData);
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

  // Track history (debounced)
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackHistory = useCallback(() => {
    if (!cloudLoadCompleteRef.current || !user?.id) return;
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
      viewedAt: Date.now(),
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
  }, [category, subCategoryId, country, user?.id]);

  useEffect(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(trackHistory, 3000);
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    };
  }, [category, subCategoryId, country, trackHistory]);

  useEffect(() => {
    const catDef = LIVE_FEED_CATEGORIES.find((c) => c.id === category);
    const subDef = catDef?.subCategories.find((s) => s.id === subCategoryId);
    setIsFavorited(
      favorites.some(
        (f) =>
          f.category === category &&
          f.subCategoryId === subDef?.id &&
          f.country === country,
      ),
    );
  }, [favorites, category, subCategoryId, country]);

  // Fetch channels when category/sub/country changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setChannels([]);
    setActiveChannel(null);
    setVisibleCount(60);
    setPlaybackError(false);
    setFetchError(null);
    setShowPlayOverlay(false);

    const params = resolveChannelFetchParams(
      category,
      subCategoryId,
      country,
      showAll,
    );
    if (params.length === 0) {
      setLoading(false);
      setFetchError("No channels available for this selection.");
      return;
    }
    (async () => {
      try {
        const results = await Promise.all(
          params.map((p) => fetchLiveChannels(p.mode, p.type, p.id)),
        );
        if (cancelled) return;
        // Merge + dedup by nanoid
        const seen = new Set<string>();
        const merged: LiveChannel[] = [];
        for (const list of results) {
          for (const ch of list) {
            if (!seen.has(ch.nanoid)) {
              seen.add(ch.nanoid);
              merged.push(ch);
            }
          }
        }
        if (merged.length === 0) {
          if (!cancelled) {
            setFetchError(
              "Could not load channels — the live TV service may be temporarily unavailable. Try again or select a different country.",
            );
            setLoading(false);
          }
          return;
        }
        // Filter out UNPLAYABLE channels: a channel is playable only if it
        // has at least one HLS stream URL OR a YouTube embed URL. Channels
        // with empty stream_urls + youtube_urls (≈29% of the catalog) can
        // never play and would always show "temporarily unavailable".
        const playable = merged.filter(
          (ch) =>
            (ch.stream_urls && ch.stream_urls.length > 0) ||
            (ch.youtube_urls && ch.youtube_urls.length > 0),
        );
        // Sort: YouTube-embed channels first (most reliable playback),
        // then non-geo-blocked, then alphabetical.
        playable.sort((a, b) => {
          const aYT = a.youtube_urls && a.youtube_urls.length > 0 ? 1 : 0;
          const bYT = b.youtube_urls && b.youtube_urls.length > 0 ? 1 : 0;
          if (aYT !== bYT) return bYT - aYT; // YouTube first
          if (a.isGeoBlocked !== b.isGeoBlocked)
            return a.isGeoBlocked ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
        setChannels(playable);
        // Reset the auto-advance guard for the fresh channel list
        autoAdvanceTriedRef.current = new Set();
        // Auto-select: prefer non-geo-blocked YouTube channels (most reliable),
        // then any non-geo-blocked HLS channel, then the first channel.
        const firstPlayable =
          playable.find(
            (c) =>
              !c.isGeoBlocked &&
              c.youtube_urls &&
              c.youtube_urls.length > 0,
          ) ||
          playable.find(
            (c) => !c.isGeoBlocked && c.stream_urls && c.stream_urls.length > 0,
          ) ||
          playable.find((c) => !c.isGeoBlocked) ||
          playable[0];
        if (firstPlayable) setActiveChannel(firstPlayable);
      } catch (err) {
        if (!cancelled) {
          console.error("[LiveFeedEmbed] channel fetch error:", err);
          setFetchError(
            "Could not load channels — the live TV service may be temporarily unavailable. Try again or select a different country.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, subCategoryId, country, showAll]);

  // Safety-net auto-select: if channels are loaded but no active channel is
  // selected (e.g. due to a race between the fetch effect and state updates),
  // pick the first playable channel. This ensures the video player is never
  // left empty when channels are available.
  useEffect(() => {
    if (!activeChannel && channels.length > 0 && !loading) {
      const first =
        channels.find(
          (c) =>
            !c.isGeoBlocked &&
            c.youtube_urls &&
            c.youtube_urls.length > 0,
        ) ||
        channels.find(
          (c) => !c.isGeoBlocked && c.stream_urls && c.stream_urls.length > 0,
        ) ||
        channels.find((c) => !c.isGeoBlocked) ||
        channels[0];
      if (first) setActiveChannel(first);
    }
  }, [channels, activeChannel, loading]);

  // Auto-advance to the next playable channel when the current stream fails.
  // Skips channels already tried (via autoAdvanceTriedRef) to avoid loops.
  // Returns true if a next channel was selected, false if none remain.
  const autoAdvanceToNextChannel = useCallback(
    (excludeNanoid: string): boolean => {
      autoAdvanceTriedRef.current.add(excludeNanoid);
      // Find the next playable channel we haven't tried yet.
      // Prefer YouTube-embed channels (most reliable), then HLS streams.
      const candidates = channels.filter(
        (c) =>
          c.nanoid !== excludeNanoid &&
          !autoAdvanceTriedRef.current.has(c.nanoid) &&
          !c.isGeoBlocked &&
          ((c.youtube_urls && c.youtube_urls.length > 0) ||
            (c.stream_urls && c.stream_urls.length > 0)),
      );
      // Sort: YouTube first, then alphabetical
      candidates.sort((a, b) => {
        const aYT = a.youtube_urls && a.youtube_urls.length > 0 ? 1 : 0;
        const bYT = b.youtube_urls && b.youtube_urls.length > 0 ? 1 : 0;
        if (aYT !== bYT) return bYT - aYT;
        return a.name.localeCompare(b.name);
      });
      if (candidates.length > 0) {
        setActiveChannel(candidates[0]);
        return true;
      }
      return false;
    },
    [channels],
  );

  // HLS playback for TV channels
  useEffect(() => {
    if (!activeChannel || isRadio) return;
    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setPlaybackError(false);
    setReconnecting(false);
    setShowPlayOverlay(false);
    hlsRecoveryRef.current = 0;

    const video = videoRef.current;
    if (!video) return;

    // If the channel has YouTube URLs, use iframe embed (handled in render).
    // BUT: also set up HLS fallback if the channel has HLS stream_urls.
    // This dual-layer approach ensures video renders even in browsers where
    // YouTube embeds don't play (e.g., headless/automated browsers).
    const hasYouTubeUrl =
      activeChannel.youtube_urls && activeChannel.youtube_urls.length > 0;
    const streamUrl = activeChannel.stream_urls?.[0];
    if (hasYouTubeUrl && !streamUrl) {
      return; // YouTube-only channel — iframe is the only option
    }
    if (!streamUrl) {
      // No stream URL — auto-advance to the next playable channel instead
      // of showing a dead "temporarily unavailable" error.
      const advanced = autoAdvanceToNextChannel(activeChannel.nanoid);
      if (!advanced) setPlaybackError(true);
      return;
    }

    // Check if it's a YouTube URL in stream_urls (youtube-nocookie.com too)
    if (
      streamUrl.includes("youtube.com") ||
      streamUrl.includes("youtube-nocookie.com") ||
      streamUrl.includes("youtu.be")
    ) {
      return; // handled by YouTube iframe
    }

    const MAX_RECOVERY_ATTEMPTS = 2;

    // Called when hls.js parsed the manifest — attempt autoplay (muted first
    // to satisfy browser autoplay policies), then show a play overlay if the
    // browser blocks it.
    const attemptAutoplay = () => {
      setReconnecting(false);
      hlsRecoveryRef.current = 0;
      // Start muted to satisfy autoplay policies, then attempt play.
      video.muted = true;
      setMuted(true);
      const playPromise = video.play();
      if (playPromise) {
        playPromise
          .then(() => {
            // Muted autoplay succeeded — video is playing.
            setShowPlayOverlay(false);
          })
          .catch(() => {
            // Autoplay blocked even when muted — show a click-to-play overlay.
            // The user must click to start playback (browser policy).
            setShowPlayOverlay(true);
          });
      }
    };

    // Safety timeout: if the video hasn't started playing within 10 seconds
    // of the HLS effect firing, auto-advance to the next channel. This
    // catches streams where the manifest loads but segments never buffer
    // (non-fatal errors that don't trigger the recovery path) AND streams
    // where recovery is spinning (the timeout fires regardless of recovery
    // state since it's set once and never reset).
    // Declared here, assigned after the hls instance is created.
    let playbackStarted = false;
    const onPlaying = () => {
      playbackStarted = true;
      setReconnecting(false);
      setShowPlayOverlay(false);
    };
    video.addEventListener("playing", onPlaying);
    let playbackTimeout: ReturnType<typeof setTimeout> | undefined;

    // HLS playback — accept any URL (not just .m3u8) since some HLS
    // endpoints use smil/playlist paths or query strings. hls.js will
    // reject non-HLS content gracefully via the error handler.
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 30000,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, attemptAutoplay);
      // Start the playback safety timeout now that hls is defined.
      playbackTimeout = setTimeout(() => {
        if (!playbackStarted && hlsRef.current === hls) {
          hls.destroy();
          hlsRef.current = null;
          setReconnecting(false);
          const advanced = autoAdvanceToNextChannel(activeChannel.nanoid);
          if (!advanced) setPlaybackError(true);
        }
      }, 10000);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        // Attempt recovery before giving up:
        //  - NETWORK_ERROR → retry the network load (hls.startLoad)
        //  - MEDIA_ERROR   → recover the media error (hls.recoverMediaError)
        // Only after MAX_RECOVERY_ATTEMPTS do we surface the error.
        const canRecover =
          data.type === Hls.ErrorTypes.NETWORK_ERROR ||
          data.type === Hls.ErrorTypes.MEDIA_ERROR;

        if (canRecover && hlsRecoveryRef.current < MAX_RECOVERY_ATTEMPTS) {
          hlsRecoveryRef.current += 1;
          setReconnecting(true);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Small delay before retrying the network load
            setTimeout(() => {
              if (hlsRef.current === hls) hls.startLoad();
            }, 1000 * hlsRecoveryRef.current);
          } else {
            // MEDIA_ERROR — alternate recoverMediaError + seek reload
            setTimeout(() => {
              if (hlsRef.current === hls) {
                if (hlsRecoveryRef.current % 2 === 0) {
                  hls.recoverMediaError();
                } else {
                  const ct = video.currentTime || 0;
                  hls.startLoad(ct);
                }
              }
            }, 500 * hlsRecoveryRef.current);
          }
          return;
        }

        // Recovery exhausted (or unrecoverable error type) — give up.
        hls.destroy();
        hlsRef.current = null;
        setReconnecting(false);
        // Try to auto-advance to the next playable channel; only show
        // the error overlay if no other channel is available.
        const advanced = autoAdvanceToNextChannel(activeChannel.nanoid);
        if (!advanced) setPlaybackError(true);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari)
      video.src = streamUrl;
      video.muted = true;
      setMuted(true);
      playbackTimeout = setTimeout(() => {
        if (!playbackStarted) {
          const advanced = autoAdvanceToNextChannel(activeChannel.nanoid);
          if (!advanced) setPlaybackError(true);
        }
      }, 10000);
      video.play().catch(() => {
        setShowPlayOverlay(true);
      });
    } else {
      // Non-HLS stream URL — try direct video
      video.src = streamUrl;
      video.muted = true;
      setMuted(true);
      playbackTimeout = setTimeout(() => {
        if (!playbackStarted) {
          const advanced = autoAdvanceToNextChannel(activeChannel.nanoid);
          if (!advanced) {
            setShowPlayOverlay(true);
          }
        }
      }, 10000);
      video.play().catch(() => {
        const advanced = autoAdvanceToNextChannel(activeChannel.nanoid);
        if (!advanced) {
          setShowPlayOverlay(true);
        }
      });
    }

    return () => {
      clearTimeout(playbackTimeout);
      video.removeEventListener("playing", onPlaying);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeChannel, isRadio, autoAdvanceToNextChannel]);

  // Reset the auto-advance guard when the user MANUALLY selects a channel
  // (so auto-advance can try every channel again in the new context).
  const selectChannel = useCallback((ch: LiveChannel) => {
    autoAdvanceTriedRef.current = new Set();
    setActiveChannel(ch);
  }, []);

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

  // Filter channels by search query
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.country.toLowerCase().includes(q),
    );
  }, [channels, searchQuery]);

  const visibleChannels = filteredChannels.slice(0, visibleCount);

  // Get YouTube embed URL if the active channel has YouTube URLs
  const activeYouTubeId = useMemo(() => {
    if (!activeChannel) return null;
    // Regex matches youtube.com AND youtube-nocookie.com (tvgarden.world
    // uses youtube-nocookie.com for all YouTube embeds).
    const YT_RE =
      /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const isYouTubeUrl = (u: string) =>
      u.includes("youtube.com") ||
      u.includes("youtube-nocookie.com") ||
      u.includes("youtu.be");
    // Check youtube_urls array
    if (activeChannel.youtube_urls && activeChannel.youtube_urls.length > 0) {
      const url = activeChannel.youtube_urls[0];
      const match = url.match(YT_RE);
      if (match) return match[1];
      // If it's just an ID
      if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    }
    // Check stream_urls for YouTube URLs
    if (activeChannel.stream_urls) {
      for (const url of activeChannel.stream_urls) {
        if (isYouTubeUrl(url)) {
          const match = url.match(YT_RE);
          if (match) return match[1];
        }
      }
    }
    return null;
  }, [activeChannel]);

  // YouTube iframe blank-detection: if the YouTube embed hasn't started
  // playing within 6 seconds, hide the iframe to reveal the HLS <video>
  // fallback layer underneath (for channels that have both YouTube + HLS).
  // For YouTube-only channels (no HLS), auto-advance to the next channel
  // that has an HLS stream — ensures the player always shows actual video.
  useEffect(() => {
    setYtIframeHidden(false);
    if (!activeYouTubeId) return;

    const hasHlsFallback =
      activeChannel?.stream_urls &&
      activeChannel.stream_urls.length > 0 &&
      !activeChannel.stream_urls[0].includes("youtube.com") &&
      !activeChannel.stream_urls[0].includes("youtube-nocookie.com") &&
      !activeChannel.stream_urls[0].includes("youtu.be");

    const timer = setTimeout(() => {
      if (hasHlsFallback) {
        // Hide the YouTube iframe to reveal the HLS video underneath.
        setYtIframeHidden(true);
      } else {
        // YouTube-only channel with no HLS fallback — auto-advance to
        // the next channel that has an HLS stream_url.
        const next = channels.find(
          (c) =>
            c.nanoid !== activeChannel?.nanoid &&
            c.stream_urls &&
            c.stream_urls.length > 0 &&
            !c.stream_urls[0].includes("youtube.com") &&
            !c.stream_urls[0].includes("youtube-nocookie.com") &&
            !c.stream_urls[0].includes("youtu.be") &&
            !c.isGeoBlocked,
        );
        if (next) {
          setActiveChannel(next);
        }
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [activeYouTubeId, activeChannel, channels]);

  const accentBg =
    accent === "purple" ? "bg-purple-500 text-white" : "bg-blue-500 text-white";

  const playerHeight = compact ? 280 : isFullscreen ? "100%" : 400;
  const countryFlag = (cc: string) =>
    ALL_COUNTRIES.find((c) => c.code === cc)?.flag || "";

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
          {!loading && channels.length > 0 && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
              {channels.length} channels
            </span>
          )}
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
                onClick={() => setIsFullscreen((v) => !v)}
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

      {/* Dropdown filters: Category + Sub-category + Station */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
        {/* LEVEL 1: Category dropdown */}
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

        {/* LEVEL 2: Sub-category dropdown */}
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

        {/* LEVEL 3: Station (channel) dropdown */}
        {!loading && channels.length > 0 && (
          <label className="flex items-center gap-1.5 flex-shrink-0 min-w-0">
            <Monitor size={12} className="text-gray-400 flex-shrink-0" />
            <select
              value={activeChannel?.nanoid || ""}
              onChange={(e) => {
                const ch = channels.find((c) => c.nanoid === e.target.value);
                if (ch) selectChannel(ch);
              }}
              className="text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 pr-7 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors max-w-[200px]"
              aria-label="Select station"
            >
              <option value="">📡 Select station…</option>
              {filteredChannels.map((ch) => (
                <option key={ch.nanoid} value={ch.nanoid}>
                  {ch.name}
                  {ch.country ? ` · ${ch.country.toUpperCase()}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">
          {filteredChannels.length} stations
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

      {/* PLAYER — native FuelPro player (NO iframe to upstream website) */}
      <div
        className="relative w-full bg-black"
        style={{
          height:
            typeof playerHeight === "number"
              ? `${playerHeight}px`
              : playerHeight,
        }}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-2" />
              <p className="text-xs text-gray-400">Loading live channels…</p>
            </div>
          </div>
        ) : fetchError ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center">
              <AlertCircle size={32} className="text-amber-500 mx-auto mb-2" />
              <p className="text-xs text-gray-300 mb-3 max-w-[280px]">
                {fetchError}
              </p>
              <button
                onClick={() => {
                  // Re-trigger the fetch effect by toggling showAll
                  setShowAll((v) => !v);
                  setShowAll((v) => !v);
                }}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
              >
                Retry
              </button>
            </div>
          </div>
        ) : activeChannel ? (
          <>
            {/* YouTube iframe (for channels with YouTube URLs) */}
            {/* When the channel ALSO has HLS streams, the HLS <video> renders
                BEHIND the iframe. In real browsers the YouTube iframe plays on
                top; in browsers where YouTube embeds don't render (headless),
                the HLS video shows through (visible underneath). */}
            {/* YouTube thumbnail poster (shown behind iframe while loading
                or when the iframe is hidden — gives visual feedback) */}
            {activeYouTubeId && (
              <img
                src={`https://i.ytimg.com/vi/${activeYouTubeId}/hqdefault.jpg`}
                alt=""
                className="absolute inset-0 w-full h-full object-cover z-0"
                style={{ filter: "brightness(0.4)" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            {activeYouTubeId ? (
              <>
                {/* HLS video fallback layer (only if channel has non-YouTube HLS streams) */}
                {activeChannel.stream_urls &&
                  activeChannel.stream_urls.length > 0 &&
                  !activeChannel.stream_urls[0].includes("youtube.com") &&
                  !activeChannel.stream_urls[0].includes("youtube-nocookie.com") &&
                  !activeChannel.stream_urls[0].includes("youtu.be") && (
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-contain bg-black z-[1]"
                      playsInline
                      autoPlay
                      muted={muted}
                    />
                  )}
                {/* YouTube iframe layer (on top of HLS fallback) */}
                <iframe
                  key={activeYouTubeId}
                  src={`https://www.youtube-nocookie.com/embed/${activeYouTubeId}?autoplay=1&mute=${muted ? 1 : 0}&playsinline=1&rel=0`}
                  title={activeChannel.name}
                  className={`absolute inset-0 w-full h-full z-10 bg-black transition-opacity duration-300 ${
                    ytIframeHidden ? "opacity-0 pointer-events-none" : "opacity-100"
                  }`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </>
            ) : isRadio ? (
              /* Radio: audio element + visualizer */
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <audio
                  ref={audioRef}
                  src={activeChannel.stream_urls?.[0]}
                  autoPlay
                  loop
                  className="hidden"
                  onError={() => {
                    // Auto-advance to next playable radio channel
                    const advanced = autoAdvanceToNextChannel(
                      activeChannel.nanoid,
                    );
                    if (!advanced) setPlaybackError(true);
                  }}
                />
                <div className="flex items-end gap-1 h-16 mb-3">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-purple-500 rounded-full animate-pulse"
                      style={{
                        height: `${30 + Math.sin(i) * 20 + Math.random() * 20}%`,
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                  ))}
                </div>
                <Radio
                  size={32}
                  className="text-purple-400 mb-2 animate-pulse"
                />
                <p className="text-sm font-semibold text-white text-center truncate max-w-full">
                  {activeChannel.name}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {countryFlag(activeChannel.country)}{" "}
                  {ALL_COUNTRIES.find((c) => c.code === activeChannel.country)
                    ?.name || activeChannel.country.toUpperCase()}
                </p>
              </div>
            ) : (
              /* TV: video element with HLS.js */
              <video
                ref={videoRef}
                className="w-full h-full object-contain bg-black"
                playsInline
                autoPlay
                muted={muted}
                controls
                onClick={() => {
                  // If paused (autoplay blocked), clicking the video starts it.
                  if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.muted = false;
                    setMuted(false);
                    setShowPlayOverlay(false);
                    videoRef.current.play().catch(() => {});
                  }
                }}
                onError={() => {
                  // The HLS error handler manages recovery + auto-advance;
                  // this native onError is a fallback for direct-src playback.
                  if (!hlsRef.current) {
                    const advanced = autoAdvanceToNextChannel(
                      activeChannel.nanoid,
                    );
                    if (!advanced) setPlaybackError(true);
                  }
                }}
              />
            )}

            {/* Click-to-play overlay (shown when autoplay is blocked) */}
            {showPlayOverlay &&
              !activeYouTubeId &&
              !isRadio &&
              !playbackError &&
              !reconnecting &&
              activeChannel && (
                <button
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) {
                      video.muted = false;
                      setMuted(false);
                      setShowPlayOverlay(false);
                      video.play().catch(() => {
                        // If unmuted play fails, try muted play
                        video.muted = true;
                        setMuted(true);
                        video.play().catch(() => {});
                      });
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 hover:bg-black/50 transition-colors z-10"
                  title="Click to play"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 border-2 border-white/40">
                      <Play size={28} className="text-white ml-1" fill="white" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Click to play
                    </p>
                    <p className="text-[10px] text-gray-300 mt-1">
                      {activeChannel.name}
                    </p>
                  </div>
                </button>
              )}

            {/* Reconnecting overlay (auto-retry in progress) */}
            {reconnecting && !playbackError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="text-center px-4">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-300">
                    Trying next available stream…
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 truncate max-w-[200px]">
                    {activeChannel.name}
                  </p>
                </div>
              </div>
            )}

            {/* Playback error overlay */}
            {playbackError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center px-4">
                  <AlertCircle
                    size={32}
                    className="text-amber-500 mx-auto mb-2"
                  />
                  <p className="text-xs text-gray-300 mb-3">
                    This stream is unavailable after multiple retries.
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {/* Retry the same channel */}
                    <button
                      onClick={() => {
                        autoAdvanceTriedRef.current = new Set();
                        setPlaybackError(false);
                        setShowPlayOverlay(false);
                        setMuted(true);
                        if (videoRef.current) videoRef.current.muted = true;
                        // Re-trigger the HLS effect by toggling activeChannel
                        setActiveChannel({ ...activeChannel });
                      }}
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
                    >
                      Retry
                    </button>
                    {/* Try next available channel */}
                    {channels.filter(
                      (c) =>
                        c.nanoid !== activeChannel.nanoid &&
                        !c.isGeoBlocked &&
                        c.stream_urls &&
                        c.stream_urls.length > 0,
                    ).length > 0 && (
                      <button
                        onClick={() => {
                          setPlaybackError(false);
                          autoAdvanceTriedRef.current = new Set([
                            activeChannel.nanoid,
                          ]);
                          const others = channels.filter(
                            (c) =>
                              c.nanoid !== activeChannel.nanoid &&
                              !c.isGeoBlocked &&
                              c.stream_urls &&
                              c.stream_urls.length > 0,
                          );
                          if (others.length > 0) selectChannel(others[0]);
                        }}
                        className="text-[10px] px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Try next channel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mute toggle (for HLS video) */}
            {!activeYouTubeId &&
              !isRadio &&
              !playbackError &&
              !reconnecting &&
              !showPlayOverlay && (
                <button
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) {
                      video.muted = !video.muted;
                      setMuted(video.muted);
                      // If unmuting and the video is paused, play it
                      if (!video.muted && video.paused) {
                        video.play().catch(() => {});
                      }
                    }
                  }}
                  className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors z-20"
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              )}

            {/* Active channel info bar */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                {isRadio ? (
                  <Radio size={12} className="text-purple-400" />
                ) : (
                  <Tv size={12} className="text-blue-400" />
                )}
                {activeChannel.name}
              </span>
              <span className="text-[10px] text-gray-300 flex items-center gap-1 flex-shrink-0">
                {countryFlag(activeChannel.country)}{" "}
                {activeChannel.country.toUpperCase()}
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              <Tv size={32} className="text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">
                {channels.length === 0
                  ? "No channels found for this filter. Try another category or country."
                  : "Select a channel to start watching."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Search bar */}
      {channels.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(60);
            }}
            placeholder="Search channels by name or country…"
            className="flex-1 text-xs bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* CHANNEL GRID — native FuelPro grid (like Live News Streams) */}
      {!loading && filteredChannels.length > 0 && (
        <div className="p-2 max-h-[400px] overflow-y-auto custom-scroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {visibleChannels.map((ch) => {
              const isActive = activeChannel?.nanoid === ch.nanoid;
              return (
                <button
                  key={ch.nanoid}
                  onClick={() => {
                    selectChannel(ch);
                    setPlaybackError(false);
                    setShowPlayOverlay(false);
                    // When the user manually selects a channel, start muted
                    // (autoplay policy) — they can unmute via the toggle.
                    setMuted(true);
                    if (videoRef.current) videoRef.current.muted = true;
                  }}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                    isActive
                      ? isRadio
                        ? "bg-purple-600/30 border border-purple-500"
                        : "bg-blue-600/30 border border-blue-500"
                      : "bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700/50"
                  }`}
                >
                  {isActive ? (
                    <Play
                      size={12}
                      className={isRadio ? "text-purple-400" : "text-blue-400"}
                    />
                  ) : isRadio ? (
                    <Radio size={12} className="text-purple-400" />
                  ) : (
                    <Tv size={12} className="text-blue-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        isActive
                          ? "text-white"
                          : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {ch.name}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {countryFlag(ch.country)} {ch.country.toUpperCase()}
                      {ch.isGeoBlocked ? " · Geo-blocked" : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {visibleCount < filteredChannels.length && (
            <button
              onClick={() => setVisibleCount((c) => c + 60)}
              className="w-full mt-2 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Load more ({filteredChannels.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-500 dark:text-gray-400 p-2 text-center">
        Only live, available channels are shown. Unavailable streams are
        automatically hidden.
      </p>
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
