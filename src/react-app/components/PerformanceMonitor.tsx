import { useEffect, useState, useCallback } from "react";
import {
  initVitalsTracking,
  getVitalsSnapshot,
  checkPerformanceTargets,
  getMemoryUsage,
  type WebVitals,
} from "@/react-app/lib/performance";
import { Activity, Gauge, Cpu, HardDrive, Wifi } from "lucide-react";

export default function PerformanceMonitor() {
  const [vitals, setVitals] = useState<WebVitals>({});
  const [memory, setMemory] = useState(getMemoryUsage());
  const [resourceCount, setResourceCount] = useState(0);
  const [pageWeight, setPageWeight] = useState(0);

  useEffect(() => {
    initVitalsTracking(v => setVitals({ ...v }));
    setResourceCount(performance.getEntriesByType("resource").length);

    // Calculate total page weight
    const resources = performance.getEntriesByType("resource");
    const total = resources.reduce(
      (s, r) => s + (r as PerformanceResourceTiming).transferSize,
      0
    );
    setPageWeight(total);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMemory(getMemoryUsage());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const targets = checkPerformanceTargets(vitals);
  const allPass = targets.every(t => t.pass);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-[#161618] border border-white/[0.12] rounded-xl shadow-2xl p-3 space-y-2 w-56">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Gauge
              size={12}
              className={allPass ? "text-emerald-400" : "text-amber-400"}
            />
            <span className="text-[10px] text-gray-400 font-medium">
              Core Web Vitals
            </span>
          </div>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded ${allPass ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
          >
            {allPass ? "Pass" : "Check"}
          </span>
        </div>

        {targets.map(t => (
          <div key={t.metric} className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{t.metric}</span>
            <div className="flex items-center gap-1">
              <span
                className={`text-[10px] font-mono ${t.pass ? "text-emerald-400" : "text-amber-400"}`}
              >
                {t.metric === "CLS"
                  ? t.value.toFixed(3)
                  : `${Math.round(t.value)}ms`}
              </span>
            </div>
          </div>
        ))}

        {memory && (
          <div className="border-t border-white/[0.06] pt-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <HardDrive size={10} className="text-blue-400" />
              <span className="text-[10px] text-gray-400">Memory</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: `${(memory.used / memory.limit) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-gray-600">{memory.used}MB</span>
              <span className="text-[9px] text-gray-600">{memory.limit}MB</span>
            </div>
          </div>
        )}

        <div className="border-t border-white/[0.06] pt-1.5 flex items-center justify-between text-[9px] text-gray-600">
          <span className="flex items-center gap-1">
            <Wifi size={8} /> {(pageWeight / 1024 / 1024).toFixed(2)}MB
          </span>
          <span>{resourceCount} resources</span>
        </div>
      </div>
    </div>
  );
}

/** Inline performance badge for page headers */
export function PerformanceBadge() {
  const [vitals, setVitals] = useState<WebVitals>({});

  useEffect(() => {
    initVitalsTracking(v => setVitals({ ...v }));
  }, []);

  const targets = checkPerformanceTargets(vitals);
  const allPass = targets.every(t => t.pass);
  const lcp = vitals.lcp ? `${Math.round(vitals.lcp)}ms` : "--";

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${allPass ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
    >
      <Activity size={10} />
      LCP {lcp}
    </div>
  );
}
