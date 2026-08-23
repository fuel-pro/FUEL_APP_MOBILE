import type { ReactNode } from "react";

/**
 * Gradient Metric Card (from design spec file 2).
 *
 * Renders a KPI/stat card with one of 6 premium gradient backgrounds.
 * Text is always white with a dark overlay for readability.
 *
 * Palettes:
 *   ocean-rose, cyber-bloom, neon-pulse, mint-eclipse,
 *   sunrise-sorbet, aurora-dust
 */
export type GradientPalette =
  | "ocean-rose"
  | "cyber-bloom"
  | "neon-pulse"
  | "mint-eclipse"
  | "sunrise-sorbet"
  | "aurora-dust";

export interface GradientMetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  gradient?: GradientPalette;
  /** Extra className */
  className?: string;
}

export default function GradientMetricCard({
  title,
  value,
  subtitle,
  icon,
  gradient = "aurora-dust",
  className = "",
}: GradientMetricCardProps) {
  const gradientClass = `bg-${gradient}`;

  return (
    <div
      className={`fp-gradient-card ${gradientClass} ${className}`}
      role="figure"
      aria-label={`${title}: ${value}`}
    >
      <div className="fp-gradient-overlay" aria-hidden="true" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-medium text-white/85">
            {title}
          </span>
          {icon && (
            <span className="text-white/90" aria-hidden="true">
              {icon}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-white drop-shadow-sm">{value}</p>
        {subtitle && (
          <p className="text-[11px] text-white/70 mt-1.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
