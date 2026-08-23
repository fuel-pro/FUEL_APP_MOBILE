import type { ReactNode } from "react";

/**
 * HALO hover card (from design spec file 9).
 *
 * Features:
 * - Ambient radial glow that appears on hover
 * - 3D lift (translateY) on hover with spring easing
 * - Optional accent color (cobalt / amber / sage)
 *
 * Drop-in wrapper: wraps existing card content with the halo effect.
 * The children keep their original styling; only the hover glow + lift
 * are added.
 */
export interface HaloCardProps {
  children: ReactNode;
  /** Accent color for the hover glow. "theme" follows the active color theme (99.txt). */
  accent?: "cobalt" | "amber" | "sage" | "theme";
  /** Extra className on the outer wrapper */
  className?: string;
  /** Disable the lift animation (glow still shows) */
  disableLift?: boolean;
}

export default function HaloCard({
  children,
  accent = "cobalt",
  className = "",
  disableLift = false,
}: HaloCardProps) {
  const glowBg =
    accent === "theme"
      ? "radial-gradient(circle at 50% 40%, rgba(var(--fp-accent-rgb), 0.22), transparent 70%)"
      : accent === "amber"
        ? "radial-gradient(circle at 50% 40%, rgba(246,137,31,0.15), transparent 70%)"
        : accent === "sage"
          ? "radial-gradient(circle at 50% 40%, rgba(141,207,116,0.15), transparent 70%)"
          : "radial-gradient(circle at 50% 40%, rgba(3,91,254,0.15), transparent 70%)";

  const hoverBorder =
    accent === "theme"
      ? "rgba(var(--fp-accent-rgb), 0.55)"
      : accent === "amber"
        ? "rgba(246,137,31,0.4)"
        : accent === "sage"
          ? "rgba(141,207,116,0.4)"
          : "rgba(3,91,254,0.4)";

  const hoverShadow =
    accent === "theme"
      ? "0 20px 40px -15px rgba(var(--fp-accent-rgb), 0.35)"
      : accent === "amber"
        ? "0 20px 40px -15px rgba(246,137,31,0.25)"
        : accent === "sage"
          ? "0 20px 40px -15px rgba(141,207,116,0.25)"
          : "0 20px 40px -15px rgba(3,91,254,0.25)";

  return (
    <div
      className={`fp-halo-card ${className}`}
      style={
        {
          // CSS custom props consumed by the .fp-halo-card:hover rules,
          // overridden inline so each accent works without extra CSS classes.
          "--halo-glow": glowBg,
          "--halo-border": hoverBorder,
          "--halo-shadow": hoverShadow,
        } as React.CSSProperties
      }
    >
      <div
        className="fp-halo-glow"
        style={{ background: glowBg }}
        aria-hidden="true"
      />
      <div className={disableLift ? "" : "fp-halo-lift"}>{children}</div>
    </div>
  );
}
