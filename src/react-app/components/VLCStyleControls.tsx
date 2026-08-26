import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Repeat,
  ExternalLink,
  Gauge,
} from "lucide-react";

/**
 * VLCStyleControls — a VLC media-player–style custom control bar for the Live
 * TV/Radio player. Orange VLC accent (#FF8800), auto-hides after 3 s of
 * inactivity (like desktop VLC), play/pause, seek bar (LIVE badge for live
 * streams), time display, volume + mute, playback-speed menu, loop toggle,
 * fullscreen, channel name, and an "Open in VLC" deeplink (vlc://<stream>)
 * that launches the desktop VLC app when installed.
 *
 * Replaces the browser-native <video controls> for a consistent, professional
 * multimedia-player experience (VideoLAN VLC look & feel).
 */
export interface VLCStyleControlsProps {
  mediaEl: HTMLMediaElement | null;
  containerEl: HTMLElement | null;
  channelName: string;
  streamUrl?: string;
  isLive?: boolean;
  onToggleFullscreen: () => void;
}

export default function VLCStyleControls({
  mediaEl,
  containerEl,
  channelName,
  streamUrl,
  isLive = true,
  onToggleFullscreen,
}: VLCStyleControlsProps) {
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    const onMove = () => resetHideTimer();
    const el = containerEl;
    el?.addEventListener("mousemove", onMove);
    el?.addEventListener("touchstart", onMove);
    return () => {
      el?.removeEventListener("mousemove", onMove);
      el?.removeEventListener("touchstart", onMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [containerEl, resetHideTimer]);

  useEffect(() => {
    if (!mediaEl) return;
    const onTime = () => {
      setCurrentTime(mediaEl.currentTime);
      if (Number.isFinite(mediaEl.duration)) setDuration(mediaEl.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    mediaEl.addEventListener("timeupdate", onTime);
    mediaEl.addEventListener("play", onPlay);
    mediaEl.addEventListener("pause", onPause);
    mediaEl.addEventListener("durationchange", onTime);
    setPlaying(!mediaEl.paused);
    return () => {
      mediaEl.removeEventListener("timeupdate", onTime);
      mediaEl.removeEventListener("play", onPlay);
      mediaEl.removeEventListener("pause", onPause);
      mediaEl.removeEventListener("durationchange", onTime);
    };
  }, [mediaEl]);

  const togglePlay = () => {
    if (!mediaEl) return;
    if (mediaEl.paused) void mediaEl.play();
    else mediaEl.pause();
  };

  const toggleMute = () => {
    if (!mediaEl) return;
    mediaEl.muted = !mediaEl.muted;
    setMuted(mediaEl.muted);
  };

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (mediaEl) {
      mediaEl.volume = v;
      if (v > 0) mediaEl.muted = false;
      setMuted(false);
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (mediaEl && Number.isFinite(duration)) {
      mediaEl.currentTime = t;
      setCurrentTime(t);
    }
  };

  const setRate = (rate: number) => {
    if (mediaEl) mediaEl.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const toggleLoop = () => {
    if (mediaEl) mediaEl.loop = !mediaEl.loop;
    setLoop((l) => !l);
  };

  const openInVlc = () => {
    if (!streamUrl) return;
    // vlc:// scheme launches the desktop VLC app when installed (VideoLAN).
    window.location.href = `vlc://${streamUrl}`;
  };

  const fmt = (t: number) => {
    if (!Number.isFinite(t)) return "0:00";
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pb-2 pt-6 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onMouseMove={resetHideTimer}
    >
      {/* Seek bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <input
          type="range"
          min={0}
          max={Number.isFinite(duration) && duration > 0 ? duration : 100}
          value={currentTime}
          onChange={onSeek}
          disabled={isLive}
          className="vlc-seek-bar flex-1 h-1 accent-[#FF8800] disabled:opacity-50"
          aria-label="Seek"
        />
        {isLive ? (
          <span className="text-[9px] font-bold text-red-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-[10px] text-gray-300 tabular-nums">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        )}
      </div>
      {/* Controls row */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={togglePlay}
          className="p-1.5 rounded hover:bg-white/10 text-white"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={toggleMute}
          className="p-1.5 rounded hover:bg-white/10 text-white"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={onVolume}
          className="vlc-vol-bar w-16 h-1 accent-[#FF8800]"
          aria-label="Volume"
        />
        {/* Speed */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu((v) => !v)}
            className="p-1.5 rounded hover:bg-white/10 text-white text-[10px] font-bold flex items-center gap-0.5"
            aria-label="Playback speed"
          >
            <Gauge size={14} />
            {playbackRate}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full left-0 mb-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-30">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(r)}
                  className={`block w-full px-3 py-1 text-left text-[11px] ${
                    r === playbackRate
                      ? "bg-[#FF8800]/20 text-[#FF8800]"
                      : "text-gray-200 hover:bg-white/10"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={toggleLoop}
          className={`p-1.5 rounded hover:bg-white/10 ${loop ? "text-[#FF8800]" : "text-white"}`}
          aria-label="Loop"
          aria-pressed={loop}
        >
          <Repeat size={14} />
        </button>
        {/* Channel name */}
        <span className="flex-1 truncate text-[11px] text-gray-300 ml-1">
          {channelName}
        </span>
        {streamUrl && (
          <button
            onClick={openInVlc}
            title="Open in desktop VLC (VideoLAN)"
            className="p-1.5 rounded hover:bg-white/10 text-white text-[10px] flex items-center gap-1"
            aria-label="Open in VLC"
          >
            <ExternalLink size={13} />
            VLC
          </button>
        )}
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 rounded hover:bg-white/10 text-white"
          aria-label="Fullscreen"
        >
          <Maximize size={15} />
        </button>
      </div>
    </div>
  );
}
