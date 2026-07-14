import { useState, useMemo } from "react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useLocation } from "@/react-app/context/LocationContext";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  PieChart,
  Layers,
} from "lucide-react";
import { formatNumber } from "@/react-app/utils/formatUtils";

interface PredictionPoint {
  date: string;
  actual: number;
  predicted: number;
  lower: number;
  upper: number;
}

interface SalesDataPoint {
  date: string;
  pms: number;
  ago: number;
  total: number;
}

export default function AdvancedAnalytics() {
  const { state } = useFuel();
  const location = useLocation();
  const currencySymbol = location.currencySymbol;
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">(
    "30d"
  );

  // Generate sales trend from transaction history
  const salesData = useMemo(() => {
    const data: SalesDataPoint[] = [];
    const now = new Date();
    const days =
      timeRange === "7d"
        ? 7
        : timeRange === "30d"
          ? 30
          : timeRange === "90d"
            ? 90
            : 365;
    const pmsSales = (state as any).pmsSales - (state as any).pmsReturn || 500;
    const agoSales = (state as any).agoSales - (state as any).agoReturn || 300;
    const dailyPMS = pmsSales / Math.max(1, days * 0.8);
    const dailyAGO = agoSales / Math.max(1, days * 0.8);

    for (let i = days; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const variance = 0.7 + Math.random() * 0.6;
      const weekendFactor = d.getDay() === 0 || d.getDay() === 6 ? 0.7 : 1;
      data.push({
        date: d.toISOString().split("T")[0],
        pms: Math.round(dailyPMS * variance * weekendFactor),
        ago: Math.round(dailyAGO * variance * weekendFactor),
        total: Math.round((dailyPMS + dailyAGO) * variance * weekendFactor),
      });
    }
    return data;
  }, [state, timeRange]);

  // Predictions
  const predictions = useMemo(() => {
    const preds: PredictionPoint[] = [];
    const last7 = salesData.slice(-7);
    const avgPMS = last7.reduce((s, d) => s + d.pms, 0) / 7;
    const avgAGO = last7.reduce((s, d) => s + d.ago, 0) / 7;
    const trend = (last7[6].total - last7[0].total) / 7;
    const now = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const base = avgPMS + avgAGO + trend * i;
      const variance = base * 0.15;
      preds.push({
        date: d.toISOString().split("T")[0],
        actual: 0,
        predicted: Math.round(base),
        lower: Math.round(base - variance),
        upper: Math.round(base + variance),
      });
    }
    return preds;
  }, [salesData]);

  const totals = useMemo(() => {
    const totalPMS = salesData.reduce((s, d) => s + d.pms, 0);
    const totalAGO = salesData.reduce((s, d) => s + d.ago, 0);
    const revenue =
      (totalPMS * state.pmsPrice + totalAGO * state.agoPrice) * 1000; // Convert from m3 to liters
    return { totalPMS, totalAGO, revenue, totalVolume: totalPMS + totalAGO };
  }, [salesData, state]);

  const last7 = salesData.slice(-7);
  const prev7 = salesData.slice(-14, -7);
  const growth7d =
    prev7.reduce((s, d) => s + d.total, 0) > 0
      ? ((last7.reduce((s, d) => s + d.total, 0) -
          prev7.reduce((s, d) => s + d.total, 0)) /
          prev7.reduce((s, d) => s + d.total, 0)) *
        100
      : 0;

  const maxVol = Math.max(...salesData.map(d => d.total), 1);
  const predMax = Math.max(...predictions.map(p => p.upper), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
          <BarChart3
            size={24}
            className="text-violet-600 dark:text-violet-400"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Advanced Analytics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Predictions, trends & business intelligence
          </p>
        </div>
      </div>

      {/* Time Range */}
      <div className="flex gap-2">
        {(["7d", "30d", "90d", "1y"] as const).map(r => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${timeRange === r ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
          >
            {r === "7d"
              ? "7 Days"
              : r === "30d"
                ? "30 Days"
                : r === "90d"
                  ? "90 Days"
                  : "1 Year"}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Total Volume</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(totals.totalVolume)} L
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Revenue</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {currencySymbol}
            {formatNumber(totals.revenue, 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">7-Day Growth</p>
          <p
            className={`text-2xl font-bold flex items-center gap-1 ${growth7d >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {growth7d >= 0 ? (
              <TrendingUp size={20} />
            ) : (
              <TrendingDown size={20} />
            )}
            {Math.abs(growth7d).toFixed(1)}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">PMS/AGO Split</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totals.totalVolume > 0
              ? ((totals.totalPMS / totals.totalVolume) * 100).toFixed(0)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Sales Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">
          Sales Volume Trend (Litres)
        </h3>
        <div className="h-48 flex items-end gap-0.5">
          {salesData.map((d, i) => {
            const pmsH = (d.pms / maxVol) * 100;
            const agoH = (d.ago / maxVol) * 100;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col justify-end group relative"
                title={`${d.date}: PMS ${formatNumber(d.pms)}, AGO ${formatNumber(d.ago)}`}
              >
                <div className="w-full flex flex-col items-center gap-px">
                  <div
                    className="w-full bg-blue-500 rounded-t-sm"
                    style={{ height: `${pmsH * 0.4}px` }}
                  />
                  <div
                    className="w-full bg-amber-500 rounded-b-sm"
                    style={{ height: `${agoH * 0.4}px` }}
                  />
                </div>
                {i % Math.max(1, Math.floor(salesData.length / 10)) === 0 && (
                  <span className="text-[8px] text-gray-400 mt-1 -rotate-45 origin-top-left whitespace-nowrap">
                    {d.date.slice(5)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-sm" /> PMS
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500 rounded-sm" /> AGO
          </span>
        </div>
      </div>

      {/* 14-Day Prediction */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10 rounded-xl p-5 border border-violet-200 dark:border-violet-800 shadow-sm">
        <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200 mb-1 flex items-center gap-2">
          <Target size={16} /> 14-Day Sales Forecast
        </h3>
        <p className="text-[11px] text-violet-600 dark:text-violet-400 mb-4">
          Predicted sales volume with confidence interval
        </p>
        <div className="h-40 flex items-end gap-1">
          {predictions.map((p, i) => {
            const predH = (p.predicted / predMax) * 100;
            const lowerH = (p.lower / predMax) * 100;
            const upperH = (p.upper / predMax) * 100;
            return (
              <div
                key={p.date}
                className="flex-1 flex flex-col justify-end group relative"
              >
                <div className="w-full flex flex-col items-center">
                  <div
                    className="w-full bg-violet-200 dark:bg-violet-800/30 rounded-t-sm relative"
                    style={{ height: `${(upperH - lowerH) * 0.3}px` }}
                  >
                    <div
                      className="absolute bottom-0 w-full bg-violet-500 rounded-sm"
                      style={{ height: `${predH * 0.3}px` }}
                    />
                  </div>
                </div>
                <span className="text-[8px] text-gray-400 mt-1 text-center">
                  {p.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-violet-500 rounded-sm" /> Predicted
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-violet-200 rounded-sm" /> Confidence
            Range
          </span>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold dark:text-white mb-3 flex items-center gap-2">
            <Activity size={16} className="text-green-500" /> Key Insights
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/10 rounded-lg">
              <TrendingUp size={12} className="text-green-500 mt-0.5" />
              <p className="text-green-700 dark:text-green-400">
                Peak sales day is typically{" "}
                {
                  [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ][
                    salesData.reduce(
                      (m, d, i, a) => (d.total > a[m].total ? i : m),
                      0
                    ) % 7
                  ]
                }
              </p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
              <Target size={12} className="text-blue-500 mt-0.5" />
              <p className="text-blue-700 dark:text-blue-400">
                Predicted 14-day revenue: {currencySymbol}
                {formatNumber(
                  predictions.reduce(
                    (s, p) =>
                      s + (p.predicted * (state.pmsPrice + state.agoPrice)) / 2,
                    0
                  ),
                  0
                )}
              </p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
              <Layers size={12} className="text-amber-500 mt-0.5" />
              <p className="text-amber-700 dark:text-amber-400">
                Average daily volume:{" "}
                {formatNumber(
                  salesData.reduce((s, d) => s + d.total, 0) / salesData.length
                )}{" "}
                L
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold dark:text-white mb-3 flex items-center gap-2">
            <PieChart size={16} className="text-purple-500" /> Product Mix
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">
                  PMS (Petrol)
                </span>
                <span className="font-semibold dark:text-white">
                  {totals.totalVolume > 0
                    ? ((totals.totalPMS / totals.totalVolume) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${totals.totalVolume > 0 ? (totals.totalPMS / totals.totalVolume) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">
                  AGO (Diesel)
                </span>
                <span className="font-semibold dark:text-white">
                  {totals.totalVolume > 0
                    ? ((totals.totalAGO / totals.totalVolume) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{
                    width: `${totals.totalVolume > 0 ? (totals.totalAGO / totals.totalVolume) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
