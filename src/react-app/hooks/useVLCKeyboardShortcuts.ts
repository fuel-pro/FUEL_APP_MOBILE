/**
 * useVLCKeyboardShortcuts
 *
 * Implements the full VLC media player keyboard shortcut set on a
 * <video> / <audio> element. This gives the in-browser player the
 * exact same keyboard UX as the desktop VLC media player, so users
 * who are accustomed to VLC can control playback without learning
 * new shortcuts.
 *
 * Mirrors VLC's default hotkeys (VideoLAN Wiki: Hotkeys table):
 *   Space / k      Play / Pause
 *   f / F          Toggle Fullscreen
 *   m / M          Toggle Mute
 *   ↑ / ↓          Volume Up / Down (5%)
 *   ← / →          Seek -10s / +10s
 *   Shift + ← / →  Seek -3s / +3s  (VLC "Very short jump")
 *   n / N          Next track
 *   p / P          Previous track
 *   l / L          Toggle Loop
 *   [ / ]          Decrease / Increase playback speed
 *   =              Reset speed to 1x
 *   Home / End     Seek to start / end
 *   0 - 9          Seek to 0% - 90%
 *
 * Shortcuts are ignored when the user is typing in an input/textarea/select
 * or when the player container is not the active focus.
 */
import { useEffect, useCallback } from "react";

interface VLCShortcutsOptions {
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  loop: boolean;
  onToggleLoop?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
}

export function useVLCKeyboardShortcuts({
  mediaRef,
  containerRef,
  onToggleFullscreen,
  onNext,
  onPrev,
  loop,
  onToggleLoop,
}: VLCShortcutsOptions): void {
  const seekBy = useCallback(
    (delta: number) => {
      const m = mediaRef.current;
      if (!m || !isFinite(m.duration) || m.duration === Infinity) {
        // Live streams have Infinity duration — seeking doesn't apply.
        return;
      }
      m.currentTime = Math.max(0, Math.min(m.duration, m.currentTime + delta));
    },
    [mediaRef],
  );

  const adjustVolume = useCallback(
    (delta: number) => {
      const m = mediaRef.current;
      if (!m) return;
      m.volume = Math.max(0, Math.min(1, m.volume + delta));
      if (m.volume > 0 && m.muted) {
        m.muted = false;
      }
    },
    [mediaRef],
  );

  const adjustSpeed = useCallback(
    (factor: "up" | "down" | "reset") => {
      const m = mediaRef.current;
      if (!m) return;
      if (factor === "reset") {
        m.playbackRate = 1;
      } else {
        // VLC cycles through discrete speeds. We use 0.25x increments.
        const step = 0.25;
        const next =
          factor === "up" ? m.playbackRate + step : m.playbackRate - step;
        m.playbackRate = Math.max(
          0.25,
          Math.min(4, Math.round(next * 100) / 100),
        );
      }
    },
    [mediaRef],
  );

  const seekToPercent = useCallback(
    (percent: number) => {
      const m = mediaRef.current;
      if (!m || !isFinite(m.duration) || m.duration === Infinity) return;
      m.currentTime = (m.duration * percent) / 100;
    },
    [mediaRef],
  );

  const togglePlayPause = useCallback(() => {
    const m = mediaRef.current;
    if (!m) return;
    if (m.paused) {
      m.muted = false;
      m.play().catch(() => {});
    } else {
      m.pause();
    }
  }, [mediaRef]);

  const toggleMute = useCallback(() => {
    const m = mediaRef.current;
    if (!m) return;
    m.muted = !m.muted;
  }, [mediaRef]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in a form field
      if (isTypingTarget(e.target)) return;

      const container = containerRef?.current;
      // If a container is specified, only react when focus is inside it OR
      // when fullscreen (so shortcuts work globally in fullscreen mode).
      if (container) {
        const active = document.activeElement;
        const inside = container.contains(active);
        if (!inside && !document.fullscreenElement) return;
      }

      const key = e.key;
      const shift = e.shiftKey;

      // Don't intercept modifier combos (Ctrl/Cmd/Meta + key) — those are
      // browser shortcuts (Ctrl+W close tab, etc.) we must not swallow.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlayPause();
          break;
        case "f":
        case "F":
          e.preventDefault();
          onToggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "ArrowUp":
          e.preventDefault();
          adjustVolume(0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          adjustVolume(-0.05);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(shift ? -3 : -10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(shift ? 3 : 10);
          break;
        case "n":
        case "N":
          if (onNext) {
            e.preventDefault();
            onNext();
          }
          break;
        case "p":
        case "P":
          if (onPrev) {
            e.preventDefault();
            onPrev();
          }
          break;
        case "l":
        case "L":
          if (onToggleLoop) {
            e.preventDefault();
            onToggleLoop();
          }
          break;
        case "[":
          e.preventDefault();
          adjustSpeed("down");
          break;
        case "]":
          e.preventDefault();
          adjustSpeed("up");
          break;
        case "=":
          e.preventDefault();
          adjustSpeed("reset");
          break;
        case "Home":
          e.preventDefault();
          seekToPercent(0);
          break;
        case "End":
          e.preventDefault();
          seekToPercent(100);
          break;
        default:
          // 0-9 → seek to 0%-90%
          if (key >= "0" && key <= "9") {
            e.preventDefault();
            seekToPercent(parseInt(key, 10) * 10);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    togglePlayPause,
    onToggleFullscreen,
    toggleMute,
    adjustVolume,
    seekBy,
    onNext,
    onPrev,
    onToggleLoop,
    adjustSpeed,
    seekToPercent,
    containerRef,
    loop,
  ]);
}
