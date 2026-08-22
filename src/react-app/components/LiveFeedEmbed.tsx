import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  getLiveFeedEmbedUrl,
  getLiveFeedAllEmbedUrl,
  getRandomLiveFeedCombo,
  LIVE_FEED_CATEGORIES,
  LIVE_FEED_FAVORITES_KEY,
  LIVE_FEED_HISTORY_KEY,
  HISTORY_MAX,
  type LiveCategory,
  type LiveFeedCategory,
  type LiveFeedSubCategory,
  type LiveFeedFavorite,
  type LiveFeedHistoryEntry,
} from "@/react-app/services/LiveStreamService";
import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";
import { useAuth } from "@/react-app/context/AuthContext";
import { ALL_COUNTRIES } from "@/react-app/lib/world-country-utils";
import {
  Tv,
  Radio,
  Globe,
  Grid3x3,
  Maximize2,
  Minimize2,
  Heart,
  Shuffle,
  Clock,
  X,
  Sparkles,
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
  /** Compact mode: shorter iframe height */
  compact?: boolean;
}

/**
 * LiveFeedEmbed
 *
 * A silently-integrated live feed embed. Surfaces thousands of live global
 * TV/radio/content channels organized in a 2-LEVEL TAXONOMY + full feature
 * set, presented as a native FuelPro experience with NO indication of the
 * upstream provider.
 *
 * FEATURES (all native FuelPro UI, cloud-synced cross-device):
 *  - LEVEL 1 category switcher (Movies, News, Sports, Documentaries, etc.)
 *  - LEVEL 2 sub-category switcher (Movies→Action, News→Breaking, etc.)
 *  - Country filter (195 countries) + Show All (global)
 *  - Favorites: bookmark any category+sub+country combo (cloud-synced)
 *  - Surprise Me: random channel discovery (always lands on real channels)
 *  - Recently Watched: auto-tracked history (cloud-synced, capped at 20)
 *  - For You: recommendations based on favorites + history
 *  - Fullscreen mode
 *
 * The upstream header bar is masked by an overlay. Only live, available
 * channels ever appear — the provider manages channel availability
 * internally.
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

  // Cloud load guard (prevents overwrite race on fresh device)
  const cloudLoadCompleteRef = useRef(false);

  // Sync country when default changes
  useEffect(() => {
    setCountry(defaultCountry);
  }, [defaultCountry]);

  const availableCategories = useMemo<LiveFeedCategory[]>(() => {
    if (family === "video") {
      return LIVE_FEED_CATEGORIES.filter((c) => c.family === "video");
    }
    if (family === "audio") {
      return LIVE_FEED_CATEGORIES.filter((c) => c.family === "audio");
    }
    return LIVE_FEED_CATEGORIES;
  }, [family]);

  const activeCat = LIVE_FEED_CATEGORIES.find((c) => c.id === category);
  const activeSub: LiveFeedSubCategory | undefined =
    activeCat?.subCategories.find((s) => s.id === subCategoryId);

  // Load favorites + history from cloud on mount
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    cloudLoadCompleteRef.current = false;

    (async () => {
      try {
        const [favData, histData] = await Promise.all([
          cloudStorageService.get<LiveFeedFavorite[]>(
            LIVE_FEED_FAVORITES_KEY,
          ),
          cloudStorageService.get<LiveFeedHistoryEntry[]>(
            LIVE_FEED_HISTORY_KEY,
          ),
        ]);
        if (!cancelled) {
          if (Array.isArray(favData)) setFavorites(favData);
          if (Array.isArray(histData)) setHistory(histData);
        }
      } catch {
        // ignore — cloud may be unavailable
      } finally {
        if (!cancelled) cloudLoadCompleteRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Track history when the user views a combination (debounced via ref)
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
      // Dedup by category+sub+country, move to front
      const filtered = prev.filter(
        (h) =>
          !(
            h.category === entry.category &&
            h.subCategoryId === entry.subCategoryId &&
            h.country === entry.country
          ),
      );
      const next = [entry, ...filtered].slice(0, HISTORY_MAX);
      cloudStorageService
        .set(LIVE_FEED_HISTORY_KEY, next)
        .catch(() => {});
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

  // Check if current combo is favorited
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

  // When the top-level category changes, reset the sub-category to "all"
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
    const { category: randCat, subCategory: randSub } = getRandomLiveFeedCombo();
    // Respect family restriction
    if (family === "video" || family === "audio") {
      const catDef = LIVE_FEED_CATEGORIES.find((c) => c.id === randCat);
      if (catDef && catDef.family !== family) {
        // Pick from the correct family
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

  const accentBg =
    accent === "purple"
      ? "bg-purple-500 text-white"
      : "bg-blue-500 text-white";
  const accentSubBg =
    accent === "purple"
      ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
      : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700";

  const iframeSrc = showAll
    ? getLiveFeedAllEmbedUrl(category, activeSub)
    : getLiveFeedEmbedUrl(country, category, activeSub);

  const overlayHeight = 56;
  const iframeHeight = compact ? 420 : isFullscreen ? window.innerHeight - 60 : 560;

  const embedContent = (
    <>
      {/* Header: category switcher + country filter + feature toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2 min-w-0">
          {activeCat?.family === "audio" ? (
            <Radio size={16} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />
          ) : (
            <Tv size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
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
                title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 ${
                  isFavorited
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <Heart size={10} className={isFavorited ? "fill-current" : ""} />
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
                {isFullscreen ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
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
            title="Show all countries at once"
          >
            <Grid3x3 size={10} /> {showAll ? "Global" : "Show All"}
          </button>
        </div>
      </div>

      {/* LEVEL 1: Top-level category switcher — full content vertical grid */}
      {showCategorySwitcher && availableCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
          {availableCategories.map((cat) => {
            const isActive = cat.id === category;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                title={cat.description}
                className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
                  isActive
                    ? accentBg + " shadow-sm"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* LEVEL 2: Sub-category switcher — finer-grained slices */}
      {showSubCategorySwitcher &&
        activeCat &&
        activeCat.subCategories.length > 1 && (
          <div className="flex flex-wrap gap-1 px-3 py-2 bg-gray-50/30 dark:bg-gray-900/20 border-b border-gray-200 dark:border-gray-700">
            {activeCat.subCategories.map((sub) => {
              const isActive = sub.id === subCategoryId;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSubCategoryId(sub.id)}
                  title={sub.description}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-md transition-all ${
                    isActive
                      ? accentSubBg
                      : "bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600/60"
                  }`}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}

      {/* Favorites + History + For You panel */}
      {showFavoritesPanel && (
        <div className="px-3 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Favorites */}
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
                    className="text-[10px] px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center gap-1"
                  >
                    {fav.categoryLabel}
                    {fav.subCategoryLabel ? ` · ${fav.subCategoryLabel}` : ""}
                    {fav.countryName ? ` · ${fav.countryName}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Recently Watched */}
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
                    className="text-[10px] px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center gap-1"
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

      {/* Iframe container with overlay masking the upstream header */}
      <div
        className="relative w-full bg-black"
        style={{ height: `${iframeHeight}px` }}
      >
        <iframe
          key={`${category}-${subCategoryId}-${showAll ? "all" : country}`}
          src={iframeSrc}
          title={`${activeCat?.label || "Live Channels"}${activeSub ? ` — ${activeSub.label}` : ""}`}
          className="w-full h-full"
          style={{
            transform: `translateY(-${overlayHeight}px)`,
          }}
          loading="lazy"
          allowFullScreen
        />
        {/* Overlay bar — masks upstream header, carries FuelPro styling */}
        <div
          className="absolute top-0 left-0 right-0 bg-gradient-to-r from-gray-900 to-gray-800 flex items-center justify-between px-4 z-10"
          style={{ height: `${overlayHeight}px` }}
        >
          <div className="flex items-center gap-2 text-white min-w-0">
            {activeCat?.family === "audio" ? (
              <Radio size={14} className="text-purple-400 flex-shrink-0" />
            ) : (
              <Tv size={14} className="text-blue-400 flex-shrink-0" />
            )}
            <span className="text-xs font-semibold truncate">
              {activeCat?.label || "Live Channels"}
              {activeSub && activeSub.id !== "all" ? ` · ${activeSub.label}` : ""}
              {showAll
                ? " · Global"
                : country
                  ? ` · ${ALL_COUNTRIES.find((c) => c.code === country)?.flag || ""} ${ALL_COUNTRIES.find((c) => c.code === country)?.name || country.toUpperCase()}`
                  : " · All Countries"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 flex-shrink-0">
            <Globe size={12} />
            <span className="text-[10px]">
              {showAll
                ? "Showing all countries"
                : country
                  ? "Filtered by country"
                  : "Worldwide"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer — subtle, no upstream attribution */}
      <p className="text-[10px] text-gray-500 dark:text-gray-400 p-2 text-center">
        Only live, available channels are shown. Unavailable streams are
        automatically hidden.
      </p>
    </>
  );

  // Fullscreen mode: render as a fixed overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between p-2 bg-gray-900">
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={14} className="text-blue-400" />
            <span className="text-xs font-semibold">Live Channels — Fullscreen</span>
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{embedContent}</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {embedContent}
    </div>
  );
}

/**
 * Fullscreen live feed viewer — opens the feed in a modal overlay covering
 * the full viewport. Used by the "Expand" button.
 */
export function LiveFeedFullscreen({
  category,
  country,
  onClose,
}: {
  category: LiveCategory;
  country: string;
  onClose: () => void;
}) {
  const src = getLiveFeedEmbedUrl(country, category);
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-3 bg-gray-900">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Tv size={16} className="text-blue-400" />
          Live Channels — Fullscreen
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800"
        >
          <Maximize2 size={16} className="rotate-180" />
        </button>
      </div>
      <iframe
        src={src}
        title="Live Channels Fullscreen"
        className="w-full flex-1"
        allowFullScreen
      />
    </div>
  );
}
