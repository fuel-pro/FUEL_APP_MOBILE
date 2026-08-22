import { useState, useEffect, useMemo } from "react";
import {
  getLiveFeedEmbedUrl,
  getLiveFeedAllEmbedUrl,
  LIVE_FEED_CATEGORIES,
  type LiveCategory,
  type LiveFeedCategory,
} from "@/react-app/services/LiveStreamService";
import { ALL_COUNTRIES } from "@/react-app/lib/world-country-utils";
import { Tv, Radio, Globe, Grid3x3, Maximize2 } from "lucide-react";

interface LiveFeedEmbedProps {
  /** Initial category (default: "tv") */
  defaultCategory?: LiveCategory;
  /** Initial country code (ISO-2, lowercased). Empty = all countries */
  defaultCountry?: string;
  /** Whether to show the category switcher (multi-category mode) */
  showCategorySwitcher?: boolean;
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
 * TV/radio/content channels filtered by country + category, presented as a
 * native FuelPro experience with NO indication of the upstream provider.
 *
 * The upstream header bar is masked by an overlay (the provider's header
 * carries its own branding/source links which we never surface to the user).
 * Only live, available channels ever appear — the provider manages channel
 * availability internally.
 *
 * Category grid gives access to ALL content verticals (TV, News, Movies,
 * Sports, Music, Kids, Entertainment, Business, Documentaries, Religious,
 * Education, Radio) — the full breadth of available live content.
 */
export default function LiveFeedEmbed({
  defaultCategory = "tv",
  defaultCountry = "",
  showCategorySwitcher = true,
  family,
  accent = "blue",
  compact = false,
}: LiveFeedEmbedProps) {
  const [category, setCategory] = useState<LiveCategory>(defaultCategory);
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
  const accentBg =
    accent === "purple"
      ? "bg-purple-500 text-white"
      : "bg-blue-500 text-white";

  const iframeSrc = showAll
    ? getLiveFeedAllEmbedUrl(category)
    : getLiveFeedEmbedUrl(country, category);

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

      {/* Category switcher — full content vertical grid */}
      {showCategorySwitcher && availableCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
          {availableCategories.map((cat) => {
            const isActive = cat.id === category;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
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

      {/* Iframe container with overlay masking the upstream header */}
      <div
        className="relative w-full bg-black"
        style={{ height: `${iframeHeight}px` }}
      >
        <iframe
          key={`${category}-${showAll ? "all" : country}`}
          src={iframeSrc}
          title={activeCat?.label || "Live Channels"}
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
          <div className="flex items-center gap-2 text-white">
            {activeCat?.family === "audio" ? (
              <Radio size={14} className="text-purple-400" />
            ) : (
              <Tv size={14} className="text-blue-400" />
            )}
            <span className="text-xs font-semibold">
              {activeCat?.label || "Live Channels"}
              {showAll
                ? " · Global"
                : country
                  ? ` · ${ALL_COUNTRIES.find((c) => c.code === country)?.flag || ""} ${ALL_COUNTRIES.find((c) => c.code === country)?.name || country.toUpperCase()}`
                  : " · All Countries"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
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
