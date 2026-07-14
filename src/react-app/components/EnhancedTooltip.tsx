import { ReactNode } from "react";

interface EnhancedTooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export default function EnhancedTooltip({
  content,
  children,
  position = "top",
}: EnhancedTooltipProps) {
  const positionStyles = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative group">
      {children}
      <div
        className={`absolute ${positionStyles[position]} px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10`}
      >
        {content}
      </div>
    </div>
  );
}
