import React from "react";

/**
 * Floating dark navigation header with glassmorphism blur and seamless
 * button styling. Framer-inspired dark-mode aesthetic.
 *
 * This is a self-contained, reusable navbar component for marketing /
 * landing surfaces. The main FuelPro app shell uses its own integrated
 * Header.tsx (station switcher, auth, tabs) which already inherits the
 * dark-theme tokens from styles/dark-theme.css.
 */
export const DarkNavbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#1f1f1f] px-6 py-4 flex items-center justify-between">
      {/* Brand Logo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white text-black font-extrabold text-lg flex items-center justify-center">
          ⬡
        </div>
        <span className="font-bold text-white tracking-tight text-base">
          Commerce
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="hidden md:flex items-center gap-6 text-xs text-[#a1a1aa]">
        <a href="#templates" className="hover:text-white transition-colors">
          Templates
        </a>
        <a href="#backgrounds" className="hover:text-white transition-colors">
          Backgrounds
        </a>
        <a href="#mockups" className="hover:text-white transition-colors">
          Mockups
        </a>
        <a href="#fonts" className="hover:text-white transition-colors">
          Fonts
        </a>
      </nav>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button className="text-xs text-[#a1a1aa] hover:text-white px-3 py-1.5 transition-colors">
          Sign In
        </button>
        <button className="text-xs font-semibold text-black bg-white hover:bg-neutral-200 px-4 py-2 rounded-xl transition-all shadow-md">
          All-Access Pass →
        </button>
      </div>
    </header>
  );
};

export default DarkNavbar;
