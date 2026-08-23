import React from "react";

interface DarkCardProps {
  title: string;
  subtitle?: string;
  priceTag?: string;
  badgeText?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

/**
 * Reusable dark-mode card with hover elevation, subtle borders, and
 * visual hierarchy for pump telemetry or product showcase cards.
 *
 * Uses the design tokens defined in styles/dark-theme.css. The sleek
 * aesthetic is achieved through layered dark surfaces (#121212 base,
 * #161616 hover), low-contrast borders (#222 -> #333 on hover), and a
 * subtle inner gradient glow that fades in on hover.
 */
export const DarkCard: React.FC<DarkCardProps> = ({
  title,
  subtitle,
  priceTag,
  badgeText,
  children,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="group relative bg-[#121212] hover:bg-[#161616] border border-[#222222] hover:border-[#333333] rounded-2xl p-5 transition-all duration-300 cursor-pointer shadow-lg overflow-hidden flex flex-col justify-between"
    >
      {/* Subtle Inner Gradient Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div>
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {badgeText && (
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-[#1e1e1e] border border-[#2d2d2d] text-[#a1a1aa]">
              {badgeText}
            </span>
          )}
          {priceTag && (
            <span className="text-xs font-medium text-white/90 bg-[#1a1a1a] px-2 py-0.5 rounded-md border border-[#2a2a2a]">
              {priceTag}
            </span>
          )}
        </div>

        {/* Content Body */}
        <h3 className="text-base font-bold text-white group-hover:text-[#035bfe] transition-colors">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[#a1a1aa] mt-1 line-clamp-2 leading-relaxed">
            {subtitle}
          </p>
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>

      {/* Footer Accent Indicator */}
      <div className="mt-5 pt-3 border-t border-[#1f1f1f] flex items-center justify-between text-[11px] text-[#71717a]">
        <span>Explore details</span>
        <span className="group-hover:translate-x-1 transition-transform text-white">
          →
        </span>
      </div>
    </div>
  );
};

export default DarkCard;
