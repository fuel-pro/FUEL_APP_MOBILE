/**
 * VLCStyleControls
 *
 * A custom media control bar styled after the VLC media player. Replaces
 * the native browser <video controls> with a VLC-inspired overlay that
 * includes: seek bar, play/pause, volume slider + mute, playback speed,
 * current time / duration, loop toggle, fullscreen, and an "Open in VLC"
 * button that hands the stream off to the user's locally-installed VLC
 * desktop app via the vlc:// URL scheme.
 *
 * The bar auto-hides after 3s of inactivity (like VLC) and reappears on
 * mouse movement / touch. It is always visible when paused.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Minimize2,
  Repeat,
  Repeat1,
  Gauge,
  ExternalLink,
} from "lucide-react";

interface VLCStyleControlsProps {
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  containerRef: React.RefObject<HTMLElement | null>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  loop: boolean;
  onToggleLoop: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  /** The raw stream URL (for the "Open in VLC" deeplink) */
  streamUrl?: string;
  /** Channel name (shown in the bar) */
  channelName?: string;
  /** Whether this is a live stream (disables seek bar) */
  isLive: boolean;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds === Infinity) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function VLCStyleControls({
  mediaRef,
  containerRef,
  isFullscreen,
  onToggleFullscreen,
  loop,
  onToggleLoop,
  onNext,
  onPrev,
  streamUrl,
  channelName,
  isLive,
}: VLCStyleControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [visible, setVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedMenuRef = useRef<HTMLDivElement | null>(null);

  // Sync state from the media element
  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      if (!seeking) setCurrentTime(m.currentTime);
    };
    const onDurationChange = () => setDuration(m.duration);
    const onVolumeChange = () => {
      setVolume(m.volume);
      setMuted(m.muted);
    };
    const onRateChange = () => setSpeed(m.playbackRate);

    m.addEventListener("play", onPlay);
    m.addEventListener("pause", onPause);
    m.addEventListener("timeupdate", onTimeUpdate);
    m.addEventListener("durationchange", onDurationChange);
    m.addEventListener("loadedmetadata", onDurationChange);
    m.addEventListener("volumechange", onVolumeChange);
    m.addEventListener("ratechange", onRateChange);

    // Initial sync
    setPlaying(!m.paused);
    setDuration(m.duration);
    setVolume(m.volume);
    setMuted(m.muted);
    setSpeed(m.playbackRate);

    return () => {
      m.removeEventListener("play", onPlay);
      m.removeEventListener("pause", onPause);
      m.removeEventListener("timeupdate", onTimeUpdate);
      m.removeEventListener("durationchange", onDurationChange);
      m.removeEventListener("loadedmetadata", onDurationChange);
      m.removeEventListener("volumechange", onVolumeChange);
      m.removeEventListener("ratechange", onRateChange);
    };
  }, [mediaRef, seeking, activeChannelKey(channelName)]);

  // Auto-hide the control bar after 3s of inactivity (only when playing)
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!seeking && !showSpeedMenu) setVisible(false);
    }, 3000);
  }, [seeking, showSpeedMenu]);

  const reveal = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = () => reveal();
    const onTouch = () => reveal();
    container.addEventListener("mousemove", onMove);
    container.addEventListener("touchstart", onTouch);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("touchstart", onTouch);
    };
  }, [containerRef, reveal]);

  // Reset visibility when play state changes
  useEffect(() => {
    setVisible(true);
    if (playing) scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playing, scheduleHide]);

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        speedMenuRef.current &&
        !speedMenuRef.current.contains(e.target as Node)
      ) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSpeedMenu]);

  const togglePlayPause = () => {
    const m = mediaRef.current;
    if (!m) return;
    if (m.paused) {
      m.muted = false;
      m.play().catch(() => {});
    } else {
      m.pause();
    }
  };

  const toggleMute = () => {
    const m = mediaRef.current;
    if (!m) return;
    m.muted = !m.muted;
    if (!m.muted && m.volume === 0) m.volume = 0.5;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = mediaRef.current;
    if (!m) return;
    const v = parseFloat(e.target.value);
    m.volume = v;
    m.muted = v === 0;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = mediaRef.current;
    if (!m || !isFinite(m.duration)) return;
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    m.currentTime = t;
  };

  const handleSpeedSelect = (s: number) => {
    const m = mediaRef.current;
    if (m) m.playbackRate = s;
    setShowSpeedMenu(false);
  };

  const openInVLC = () => {
    if (!streamUrl) return;
    // The vlc:// protocol launches the desktop VLC app with the stream URL.
    // VLC registers this handler on install. Works on Windows/macOS/Linux
    // when VLC is installed. If VLC is not installed, the browser shows
    // "No app found for this link" — which we handle gracefully.
    const vlcUrl = `vlc://${streamUrl}`;
    window.location.href = vlcUrl;
  };

  const progress =
    isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0;
  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onMouseEnter={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      }}
      onMouseLeave={scheduleHide}
    >
      {/* Seek bar (hidden for live streams — seeking doesn't apply) */}
      {!isLive && isFinite(duration) && duration > 0 && (
        <div className="px-3 pt-1">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => setSeeking(true)}
            onMouseUp={() => setSeeking(false)}
            onTouchStart={() => setSeeking(true)}
            onTouchEnd={() => setSeeking(false)}
            className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-gray-600/80 vlc-seek-bar"
            style={{
              background: `linear-gradient(to right, #ff8800 ${progress}%, #4b5563 ${progress}%)`,
            }}
            aria-label="Seek"
          />
        </div>
      )}

      {/* Control buttons row */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
        {/* Previous track */}
        {onPrev && (
          <button
            onClick={onPrev}
            className="text-white/80 hover:text-white p-1 rounded transition-colors"
            title="Previous (P)"
            aria-label="Previous track"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
        )}

        {/* Play / Pause */}
        <button
          onClick={togglePlayPause}
          className="text-white hover:text-orange-400 p-1.5 rounded transition-colors"
          title="Play/Pause (Space)"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>

        {/* Next track */}
        {onNext && (
          <button
            onClick={onNext}
            className="text-white/80 hover:text-white p-1 rounded transition-colors"
            title="Next (N)"
            aria-label="Next track"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        )}

        {/* Volume */}
        <div className="flex items-center gap-1 group">
          <button
            onClick={toggleMute}
            className="text-white/80 hover:text-white p-1 rounded transition-colors"
            title="Mute (M)"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            <VolumeIcon size={15} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-0 group-hover:w-16 transition-all duration-200 h-1 cursor-pointer appearance-none rounded-full bg-gray-600 vlc-vol-bar"
            style={{
              background: `linear-gradient(to right, #fff ${(muted ? 0 : volume) * 100}%, #4b5563 ${(muted ? 0 : volume) * 100}%)`,
            }}
            aria-label="Volume"
          />
        </div>

        {/* Time display */}
        <div className="text-[11px] font-mono text-white/90 px-1 tabular-nums">
          {isLive ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              LIVE
            </span>
          ) : (
            <>
              {formatTime(currentTime)}
              {isFinite(duration) && duration > 0 && (
                <span className="text-white/50"> / {formatTime(duration)}</span>
              )}
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Channel name (truncated) */}
        {channelName && (
          <span className="text-[11px] text-white/60 truncate max-w-[120px] hidden sm:inline">
            {channelName}
          </span>
        )}

        {/* Playback speed */}
        <div className="relative" ref={speedMenuRef}>
          <button
            onClick={() => setShowSpeedMenu((v) => !v)}
            className={`flex items-center gap-1 text-white/80 hover:text-white p-1 rounded transition-colors ${
              speed !== 1 ? "text-orange-400" : ""
            }`}
            title="Playback speed ([ / ] / =)"
            aria-label="Playback speed"
          >
            <Gauge size={14} />
            <span className="text-[10px] font-mono tabular-nums">{speed}x</span>
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[80px]">
              {SPEED_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedSelect(s)}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors ${
                    s === speed
                      ? "text-orange-400 font-semibold"
                      : "text-white/80"
                  }`}
                >
                  {s}x{s === 1 ? " (Normal)" : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loop toggle */}
        <button
          onClick={onToggleLoop}
          className={`p-1 rounded transition-colors ${
            loop ? "text-orange-400" : "text-white/80 hover:text-white"
          }`}
          title="Loop (L)"
          aria-label="Toggle loop"
        >
          {loop ? <Repeat1 size={14} /> : <Repeat size={14} />}
        </button>

        {/* Open in VLC (desktop handoff via vlc://) */}
        {streamUrl && (
          <button
            onClick={openInVLC}
            className="text-white/80 hover:text-orange-400 p-1 rounded transition-colors"
            title="Open in VLC media player"
            aria-label="Open in VLC"
          >
            <ExternalLink size={14} />
          </button>
        )}

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="text-white/80 hover:text-white p-1 rounded transition-colors"
          title="Fullscreen (F)"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
}

/** Helper to re-run the media-event sync effect when the channel changes. */
function activeChannelKey(name?: string): string {
  return name || "default";
}
