import { useEffect, useRef } from "react";

/**
 * useVLCKeyboardShortcuts — the complete VLC media-player hotkey set for the
 * Live TV/Radio player. Wired to the currently-playing <video>/<audio>
 * element + channel navigation.
 *
 *   Space / k        play-pause
 *   f                fullscreen
 *   m                mute
 *   ↑ / ↓            volume up/down (5%)
 *   ← / →            seek -/+ 10s
 *   Shift+← / Shift+→ seek -/+ 3s
 *   n / p            next / previous channel
 *   l                loop toggle
 *   [ / ]            speed down/up (0.25x steps)
 *   =                reset speed to 1x
 *   Home / End       seek to start / end
 *   0-9              seek to 0-90% of the media
 *
 * Ignored while typing in any form field. Works globally in fullscreen.
 */
export interface VLCHotkeyHandlers {
  onToggleFullscreen: () => void;
  onNextChannel: () => void;
  onPrevChannel: () => void;
}

export function useVLCKeyboardShortcuts(
  mediaElRef: { current: HTMLMediaElement | null },
  handlers: VLCHotkeyHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const media = mediaElRef.current;
      const { onToggleFullscreen, onNextChannel, onPrevChannel } =
        handlersRef.current;

      switch (e.key) {
        case " ":
        case "k":
          if (media) {
            e.preventDefault();
            if (media.paused) void media.play();
            else media.pause();
          }
          break;
        case "f":
          e.preventDefault();
          onToggleFullscreen();
          break;
        case "m":
          if (media) media.muted = !media.muted;
          break;
        case "ArrowUp":
          if (media) {
            e.preventDefault();
            media.volume = Math.min(1, media.volume + 0.05);
            if (media.volume > 0) media.muted = false;
          }
          break;
        case "ArrowDown":
          if (media) {
            e.preventDefault();
            media.volume = Math.max(0, media.volume - 0.05);
          }
          break;
        case "ArrowLeft":
          if (media) {
            e.preventDefault();
            media.currentTime = Math.max(
              0,
              media.currentTime - (e.shiftKey ? 3 : 10),
            );
          }
          break;
        case "ArrowRight":
          if (media) {
            e.preventDefault();
            media.currentTime = Math.min(
              media.duration || Infinity,
              media.currentTime + (e.shiftKey ? 3 : 10),
            );
          }
          break;
        case "n":
          e.preventDefault();
          onNextChannel();
          break;
        case "p":
          e.preventDefault();
          onPrevChannel();
          break;
        case "l":
          if (media) media.loop = !media.loop;
          break;
        case "[":
          if (media)
            media.playbackRate = Math.max(0.25, media.playbackRate - 0.25);
          break;
        case "]":
          if (media)
            media.playbackRate = Math.min(4, media.playbackRate + 0.25);
          break;
        case "=":
          if (media) media.playbackRate = 1;
          break;
        case "Home":
          if (media) media.currentTime = 0;
          break;
        case "End":
          if (media && Number.isFinite(media.duration))
            media.currentTime = media.duration;
          break;
        default:
          if (/^[0-9]$/.test(e.key) && media) {
            const frac = parseInt(e.key, 10) / 10;
            if (Number.isFinite(media.duration))
              media.currentTime = media.duration * frac;
          }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaElRef]);
}
