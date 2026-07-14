import { Activity } from "lucide-react";

/** Skeleton pulse animation wrapper */
export function SkeletonPulse({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`animate-pulse bg-white/[0.06] rounded-lg ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/** Text line skeleton */
export function SkeletonText({
  width = "100%",
  height = "0.75rem",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-white/[0.06] rounded ${className}`}
      style={{ width, height }}
    />
  );
}

/** Card skeleton for dashboard/grid items */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-[#161618] border border-white/[0.06] rounded-xl p-5 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <SkeletonPulse className="w-8 h-8 rounded-lg" />
        <SkeletonText width="40%" />
      </div>
      <SkeletonText width="60%" height="1.5rem" className="mb-2" />
      <SkeletonText width="80%" />
    </div>
  );
}

/** Table row skeleton */
export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04]">
      {Array.from({ length: cols }, (_, i) => (
        <SkeletonText
          key={i}
          width={`${30 + Math.random() * 40}%`}
          className="flex-1"
        />
      ))}
    </div>
  );
}

/** Full page skeleton for dashboard */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <SkeletonText width="200px" height="1.5rem" className="mb-1" />
          <SkeletonText width="120px" />
        </div>
        <SkeletonPulse className="w-10 h-10 rounded-lg" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
        <SkeletonText width="150px" height="1rem" className="mb-4" />
        <div className="h-40 flex items-end gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <SkeletonPulse
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${30 + Math.random() * 60}%` } as any}
            />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
        <SkeletonText width="120px" height="1rem" className="mb-3" />
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonTableRow key={i} cols={4} />
        ))}
      </div>
    </div>
  );
}

/** Paywall skeleton */
export function SkeletonPaywall() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg animate-pulse">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 shadow-2xl text-center">
          <SkeletonPulse className="w-20 h-20 rounded-2xl mx-auto mb-6" />
          <SkeletonText width="60%" height="1.5rem" className="mx-auto mb-2" />
          <SkeletonText width="80%" className="mx-auto mb-6" />
          <SkeletonPulse className="w-full h-12 rounded-xl mb-3" />
          <SkeletonText width="40%" className="mx-auto" />
        </div>
      </div>
    </div>
  );
}

/** Founder Access skeleton */
export function SkeletonFounder() {
  return (
    <div className="min-h-screen bg-[#0c0c0e] flex animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-60 bg-[#111113] border-r border-white/[0.06] p-5 space-y-4">
        <SkeletonPulse className="w-32 h-8 rounded-lg" />
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonText
            key={i}
            width={`${60 + Math.random() * 30}%`}
            className="py-1"
          />
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 p-6">
        <SkeletonDashboard />
      </div>
    </div>
  );
}

/** Compact loading spinner (used when skeleton isn't appropriate) */
export function LoadingSpinner({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
  return (
    <div
      className={`${sizes[size]} border-2 border-amber-500 border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}

/** Inline loading indicator */
export function InlineLoading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <Activity size={12} className="animate-spin" />
      {text}
    </div>
  );
}
