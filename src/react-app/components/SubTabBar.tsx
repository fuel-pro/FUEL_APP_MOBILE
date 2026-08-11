import React from "react";

export interface SubTab {
  id: string;
  label: string;
  icon?: React.ElementType;
}

interface SubTabBarProps {
  tabs: SubTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Lightweight, reusable horizontal sub-tab bar used by merged tabs that
 * host multiple formerly-standalone features as inner views. Styled to match
 * the existing FuelPro dark/light tab chrome.
 */
export default function SubTabBar({
  tabs,
  active,
  onChange,
  className = "",
}: SubTabBarProps) {
  return (
    <div
      className={`flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              isActive
                ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
            }`}
          >
            {Icon && <Icon size={16} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
