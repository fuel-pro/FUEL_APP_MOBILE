/**
 * FuelVideoMiniPlayer - Fixed-position mini player for Fuel Industry News
 * Requirements: Auto-play muted, no redirect, location-aware, always available
 * Uses YouTube embed with playlist rotation and IP-based location detection
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Monitor,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Radio,
  X,
  Tv,
  MapPin,
} from "lucide-react";
import { getCountryByCode } from "@/react-app/lib/world-country-utils";

// Video source database - tagged by country/region
// All are embedded YouTube videos that stay within the website
interface VideoSource {
  id: string;
  name: string;
  embedId: string; // YouTube embed ID
  type: "live" | "playlist" | "video";
  region: string; // country code or 'GLOBAL'
  desc: string;
}

const VIDEO_DATABASE: VideoSource[] = [
  // Global / International
  {
    id: "v1",
    name: "Bloomberg Energy",
    embedId: "gCNeDWCIQvo",
    type: "live",
    region: "GLOBAL",
    desc: "Global Energy Markets & Fuel Prices",
  },
  {
    id: "v2",
    name: "CNBC Oil & Gas",
    embedId: "9NyxcX3rhQs",
    type: "playlist",
    region: "GLOBAL",
    desc: "Oil Industry Updates",
  },
  {
    id: "v3",
    name: "Reuters Business",
    embedId: "Z5umnGydW1g",
    type: "live",
    region: "GLOBAL",
    desc: "Global Business & Commodities",
  },
  {
    id: "v4",
    name: "Al Jazeera Business",
    embedId: "bNyUyrR0PHo",
    type: "live",
    region: "GLOBAL",
    desc: "International Energy Coverage",
  },
  {
    id: "v5",
    name: "Energy Central",
    embedId: "JGz7hAwp2wQ",
    type: "playlist",
    region: "GLOBAL",
    desc: "Energy Industry Analysis",
  },
  {
    id: "v6",
    name: "WION Energy",
    embedId: "1dA_nzBzBgE",
    type: "playlist",
    region: "GLOBAL",
    desc: "World Energy News",
  },
  // Kenya & East Africa
  {
    id: "v7",
    name: "KBC Business",
    embedId: "tP6nTBnZE0k",
    type: "playlist",
    region: "KE",
    desc: "Kenya Business & Fuel Updates",
  },
  {
    id: "v8",
    name: "NTV Kenya",
    embedId: "HGOh5X5t-N0",
    type: "live",
    region: "KE",
    desc: "Kenya Live News",
  },
  {
    id: "v9",
    name: "Citizen TV Kenya",
    embedId: "aEVjcbFM6SU",
    type: "live",
    region: "KE",
    desc: "Kenya Current Affairs",
  },
  // Nigeria
  {
    id: "v10",
    name: "Channels TV",
    embedId: "LbXe6QLrtdA",
    type: "live",
    region: "NG",
    desc: "Nigeria Business News",
  },
  {
    id: "v11",
    name: "Arise News",
    embedId: "xX-F4o7c1s4",
    type: "live",
    region: "NG",
    desc: "African Business & Energy",
  },
  // South Africa
  {
    id: "v12",
    name: "SABC News",
    embedId: "Gj4yQqBs5P0",
    type: "live",
    region: "ZA",
    desc: "SA Business & Energy News",
  },
  {
    id: "v13",
    name: "eNCA",
    embedId: "_aPkNSWGLVk",
    type: "live",
    region: "ZA",
    desc: "South Africa News Live",
  },
  // UK
  {
    id: "v14",
    name: "BBC Business",
    embedId: "xGpsJeL9VjI",
    type: "live",
    region: "GB",
    desc: "UK Business & Energy",
  },
  {
    id: "v15",
    name: "Sky News",
    embedId: "9Auq9mYxFEE",
    type: "live",
    region: "GB",
    desc: "UK & Global Energy News",
  },
  // US
  {
    id: "v16",
    name: "Bloomberg TV",
    embedId: "gCNeDWCIQvo",
    type: "live",
    region: "US",
    desc: "US Energy Markets",
  },
  {
    id: "v17",
    name: "Fox Business",
    embedId: "w_F6N_qXMuA",
    type: "live",
    region: "US",
    desc: "US Business & Fuel",
  },
  // India
  {
    id: "v18",
    name: "CNBC TV18",
    embedId: "qNpB9GfSZwk",
    type: "live",
    region: "IN",
    desc: "India Energy & Markets",
  },
  {
    id: "v19",
    name: "NDTV Profit",
    embedId: "VGzx-HG8aHY",
    type: "live",
    region: "IN",
    desc: "India Business News",
  },
  // Uganda
  {
    id: "v20",
    name: "NBS TV Uganda",
    embedId: "4IJ9R2R7CXw",
    type: "live",
    region: "UG",
    desc: "Uganda Business News",
  },
  // Tanzania
  {
    id: "v21",
    name: "TBC1 Tanzania",
    embedId: "O-5uvUGPRg0",
    type: "live",
    region: "TZ",
    desc: "Tanzania Business Updates",
  },
  // Ghana
  {
    id: "v22",
    name: "Citi Newsroom",
    embedId: "yKbaTAF8fVY",
    type: "live",
    region: "GH",
    desc: "Ghana Business & Energy",
  },
  // Middle East
  {
    id: "v23",
    name: "Sky News Arabia",
    embedId: "HGT90wDqL7c",
    type: "live",
    region: "AE",
    desc: "Gulf Energy News",
  },
  // Fallback
  {
    id: "v24",
    name: "DW Business",
    embedId: "ts-1C1jwIVY",
    type: "live",
    region: "GLOBAL",
    desc: "European Business & Energy",
  },
];

/** Get videos filtered by detected country + global fallback */
function getVideosForLocation(): {
  countryCode: string;
  countryName: string;
  videos: VideoSource[];
} {
  // Detect country
  let countryCode = "GLOBAL";
  try {
    const saved = localStorage.getItem("fuelpro_location_country");
    if (saved) {
      const parsed = JSON.parse(saved);
      countryCode = (
        parsed.currentCountry ||
        parsed.country ||
        "GLOBAL"
      ).toUpperCase();
    }
  } catch {
    /* */
  }

  // Fallback to timezone
  if (countryCode === "GLOBAL") {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("Nairobi") || tz.includes("Kampala")) countryCode = "KE";
    else if (tz.includes("Lagos")) countryCode = "NG";
    else if (tz.includes("Johannesburg")) countryCode = "ZA";
    else if (tz.includes("London")) countryCode = "GB";
    else if (tz.includes("New_York") || tz.includes("Los_Angeles"))
      countryCode = "US";
    else if (tz.includes("Kolkata") || tz.includes("Mumbai"))
      countryCode = "IN";
    else if (tz.includes("Accra")) countryCode = "GH";
    else if (tz.includes("Dar")) countryCode = "TZ";
  }

  const country = getCountryByCode(countryCode);
  const countryName = country?.name || countryCode;

  // Get local videos + global videos
  const local = VIDEO_DATABASE.filter(v => v.region === countryCode);
  const global = VIDEO_DATABASE.filter(v => v.region === "GLOBAL");

  // If no local videos, just show global
  const videos = local.length > 0 ? [...local, ...global] : global;

  return { countryCode, countryName, videos };
}

export default function FuelVideoMiniPlayer() {
  const [{ countryName, videos }, setLocationVideos] = useState(() =>
    getVideosForLocation()
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Required for autoplay
  const [isPlaying, setIsPlaying] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const currentVideo = videos[currentIndex];

  // Re-detect location on mount
  useEffect(() => {
    setLocationVideos(getVideosForLocation());
  }, []);

  // Build YouTube embed URL with autoplay params
  const embedUrl = useCallback(() => {
    if (!currentVideo) return "";
    const params = new URLSearchParams({
      autoplay: isPlaying ? "1" : "0",
      mute: isMuted ? "1" : "0",
      rel: "0", // No related videos from other channels
      modestbranding: "1",
      controls: "1",
      enablejsapi: "1",
      playsinline: "1",
    });
    return `https://www.youtube.com/embed/${currentVideo.embedId}?${params.toString()}`;
  }, [currentVideo, isPlaying, isMuted]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Navigate to next/previous
  const goNext = useCallback(() => {
    setCurrentIndex(i => (i + 1) % videos.length);
  }, [videos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + videos.length) % videos.length);
  }, [videos.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && !isMinimized) goNext();
      if (e.key === "ArrowLeft" && !isMinimized) goPrev();
      if (e.key === "m") setIsMuted(m => !m);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, isMinimized]);

  if (isClosed) return null;

  return (
    <div
      className={`fixed z-[9999] transition-all duration-300 ${
        isMinimized
          ? "bottom-4 right-4 w-[200px] h-[130px] rounded-xl"
          : "bottom-4 right-4 w-[380px] sm:w-[420px] rounded-2xl"
      }`}
      style={{
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.1)",
        background: "#0a0a0f",
        overflow: "hidden",
      }}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => {
        if (controlsTimeoutRef.current)
          clearTimeout(controlsTimeoutRef.current);
        setShowControls(false);
      }}
    >
      {/* Header bar (always visible) */}
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer"
        style={{
          background: "linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)",
        }}
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Tv size={12} className="text-amber-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-white truncate">
            {currentVideo?.name}
          </span>
          {currentVideo?.type === "live" && (
            <span className="flex items-center gap-0.5 text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded-full flex-shrink-0">
              <Radio size={7} className="animate-pulse" /> LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="hidden sm:flex items-center gap-0.5 text-[9px] text-gray-500">
            <MapPin size={8} /> {countryName}
          </span>
          <button
            onClick={e => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="p-0.5 text-gray-400 hover:text-white transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              setIsClosed(true);
            }}
            className="p-0.5 text-gray-400 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Video iframe */}
      {!isMinimized && (
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe
            ref={iframeRef}
            src={embedUrl()}
            title={currentVideo?.name || "Fuel News"}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="eager"
          />

          {/* Hover controls overlay */}
          <div
            className={`absolute inset-0 flex flex-col justify-between p-2 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.3) 100%)",
            }}
          >
            {/* Top: description */}
            <div className="flex items-start justify-between">
              <p className="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm max-w-[80%]">
                {currentVideo?.desc}
              </p>
              <span className="text-[9px] text-gray-400 bg-black/40 px-1.5 py-0.5 rounded">
                {currentIndex + 1}/{videos.length}
              </span>
            </div>

            {/* Bottom: controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={goPrev}
                  className="p-1.5 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-all"
                  title="Previous station (←)"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1.5 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-all"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  onClick={goNext}
                  className="p-1.5 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-all"
                  title="Next station (→)"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                {/* Station dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-1 px-2 py-1 bg-black/50 hover:bg-black/70 rounded-lg text-white text-[10px] transition-all"
                  >
                    <Monitor size={10} /> Stations <ChevronDown size={8} />
                  </button>
                  {showDropdown && (
                    <div
                      className="absolute bottom-full right-0 mb-1 w-56 rounded-xl shadow-2xl overflow-hidden z-[10000]"
                      style={{
                        background: "#1a1a2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div className="px-3 py-1.5 border-b border-white/10">
                        <span className="text-[9px] text-gray-500 flex items-center gap-1">
                          <MapPin size={8} /> {countryName} Fuel News
                        </span>
                      </div>
                      {videos.map((v, i) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setCurrentIndex(i);
                            setShowDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] text-left transition-all ${
                            i === currentIndex
                              ? "bg-amber-500/15 text-amber-400"
                              : "text-gray-300 hover:bg-white/5"
                          }`}
                        >
                          {v.type === "live" ? (
                            <Radio
                              size={9}
                              className="text-red-400 flex-shrink-0"
                            />
                          ) : (
                            <Play
                              size={9}
                              className="text-gray-500 flex-shrink-0"
                            />
                          )}
                          <span className="flex-1 truncate">{v.name}</span>
                          <span className="text-[8px] text-gray-600 flex-shrink-0">
                            {v.region}
                          </span>
                          {i === currentIndex && (
                            <span className="text-[7px] bg-amber-500 text-black px-1 rounded font-bold">
                              ON
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-all"
                  title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minimized indicator */}
      {isMinimized && (
        <div className="relative">
          <iframe
            src={`https://www.youtube.com/embed/${currentVideo?.embedId}?autoplay=1&mute=1&rel=0&modestbranding=1&controls=0&playsinline=1`}
            title={currentVideo?.name || "Fuel News"}
            className="w-full h-[105px] border-0"
            allow="autoplay; muted"
            loading="eager"
          />
          {/* Muted badge */}
          <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] text-gray-300">
            <VolumeX size={8} /> Muted
          </div>
        </div>
      )}
    </div>
  );
}
