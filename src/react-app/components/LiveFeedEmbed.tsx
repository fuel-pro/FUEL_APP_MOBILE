import { useState, useEffect, useMemo } from "react";
import {
  getLiveFeedEmbedUrl,
  getLiveFeedAllEmbedUrl,
  LIVE_FEED_CATEGORIES,
  type LiveCategory,
  type LiveFeedCategory,
  type LiveFeedSubCategory,
} from "@/react-app/services/LiveStreamService";
import { ALL_COUNTRIES } from "@/react-app/lib/world-country-utils";
import { Tv, Radio, Globe, Grid3x3, Maximize2 } from "lucide-react";

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
 * TV/radio/content channels organized in a 2-LEVEL TAXONOMY:
 *
 *  LEVEL 1 — TOP-LEVEL CATEGORY (e.g. Movies, News, Sports, Documentaries,
 *  Music TV, Kids, Entertainment, Business, Education, Religious, Live TV,
 *  Live Radio). The full breadth of available live content.
 *
 *  LEVEL 2 — SUB-CATEGORY (e.g. Movies → Action, Adventure, Comedy, Drama,
 *  Horror, Family, Animation, Classics, Real-Life Stories, Historical,
 *  Romance, Sci-Fi & Fantasy; News → Breaking, International, Business &
 *  Markets, Politics, Weather; Sports → Football, Motorsport, Outdoor,
 *  Classic; etc.). Each sub-category maps to a real upstream category id so
 *  it always surfaces REAL live channels — never dead streams.
 *
 * The upstream header bar is masked by an overlay (the provider's header
 * carries its own branding/source links which we never surface to the user).
 * Only live, available channels ever appear — the provider manages channel
 * availability internally.
 */
export default function LiveFeedEmbed({
  defaultCategory = "tv",
  defaultSubCategory,
  defaultCountry = "",
  showCategorySwitcher = true,
  showSubCategorySwitcher = true,
  family,
  accent = "blue",
  compact = false,
}: LiveFeedEmbedProps) {
  const [category, setCategory] = useState<LiveCategory>(defaultCategory);
  const [subCategoryId, setSubCategoryId] = useState<string>(
    defaultSubCategory || "all",
  );
  const [country, setCountry] = useState<string>(defaultCountry);
  const [showAll, setShowAll] = useState(false);

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

  // When the top-level category changes, reset the sub-category to "all"
  // (or to the first sub-category if the new category has no "all").
  const handleCategoryChange = (newCat: LiveCategory) => {
    setCategory(newCat);
    const newCatDef = LIVE_FEED_CATEGORIES.find((c) => c.id === newCat);
    const hasAll = newCatDef?.subCategories.some((s) => s.id === "all");
    setSubCategoryId(hasAll ? "all" : newCatDef?.subCategories[0]?.id || "all");
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

  // Overlay masks the upstream provider's header bar (3.5rem / 56px). The
  // overlay carries a FuelPro-styled bar so the embed looks native.
  const overlayHeight = 56;
  const iframeHeight = compact ? 420 : 560;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header: category switcher + country filter */}
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
        <div className="flex items-center gap-2">
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
            // Nudge the iframe up so the upstream header (3.5rem) is cropped
            // by the overflow-hidden container. The overlay then covers the
            // residual sliver so no upstream branding is ever visible.
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
