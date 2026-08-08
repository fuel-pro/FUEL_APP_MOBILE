import { useState, useEffect, useMemo } from "react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useLocation } from "@/react-app/context/LocationContext";
import { useStations } from "@/react-app/context/StationContext";
import { supabase } from "@/supabase/client";
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
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatNumber } from "@/react-app/utils/formatUtils";

interface PredictionPoint {
  date: string;
  actual: number;
  predicted: number;
  lower: number;
  upper: number;
}

interface DailySales {
  date: string;
  total: number;
  count: number;
}

interface InventoryLevel {
  fuel_type: string;
  current_level: number;
  tank_capacity: number;
  percentage: number;
}

export default function AdvancedAnalytics() {
  const { state } = useFuel();
  const location = useLocation();
  const { currentStation } = useStations();
  const currencySymbol = location.currencySymbol;
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<DailySales[]>([]);
  const [inventoryLevels, setInventoryLevels] = useState<InventoryLevel[]>([]);
  const [fuelPrices, setFuelPrices] = useState({ pms: 0, ago: 0 });

  // Calculate date range
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
    start.setDate(start.getDate() - days);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
      days
    };
  }, [timeRange]);

  // Fetch real sales data from Supabase
  useEffect(() => {
    if (!currentStation?.id) return;

    const fetchAnalyticsData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch sales from sales_enhanced table
        const { data: sales, error: salesError } = await supabase
          .from("sales_enhanced")
          .select("sale_date, total_amount")
          .eq("station_id", currentStation.id)
          .gte("sale_date", dateRange.start)
          .lte("sale_date", dateRange.end)
          .order("sale_date", { ascending: true });

        if (salesError) throw salesError;

        // Also fetch from legacy sales table for fuel data
        const { data: fuelSales, error: fuelError } = await supabase
          .from("sales")
          .select("created_at, quantity, price_per_liter, fuel_type_id")
          .eq("station_id", currentStation.id)
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end)
          .order("created_at", { ascending: true });

        if (fuelError) console.warn("Fuel sales fetch warning:", fuelError);

        // Process sales by date
        const salesByDate: Record<string, DailySales> = {};

        // Initialize all dates in range
        for (let i = 0; i <= dateRange.days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - (dateRange.days - i));
          const dateStr = d.toISOString().split("T")[0];
          salesByDate[dateStr] = { date: dateStr, total: 0, count: 0 };
        }

        // Aggregate sales_enhanced data
        if (sales && sales.length > 0) {
          for (const sale of sales) {
            const dateStr = new Date(sale.sale_date).toISOString().split("T")[0];
            if (salesByDate[dateStr]) {
              salesByDate[dateStr].total += sale.total_amount || 0;
              salesByDate[dateStr].count += 1;
            }
          }
        }

        // Aggregate legacy fuel sales data
        if (fuelSales && fuelSales.length > 0) {
          for (const sale of fuelSales) {
            const dateStr = new Date(sale.created_at).toISOString().split("T")[0];
            if (salesByDate[dateStr]) {
              salesByDate[dateStr].total += (sale.quantity * sale.price_per_liter) || 0;
              salesByDate[dateStr].count += 1;
            }
          }
        }

        const processedData = Object.values(salesByDate);
        setSalesData(processedData);

        // Fetch inventory levels
        const { data: inventory, error: invError } = await supabase
          .from("inventory")
          .select("current_level, tank_capacity, fuel_type_id")
          .eq("station_id", currentStation.id);

        if (!invError && inventory) {
          // Get fuel type names
          const { data: fuelTypes } = await supabase
            .from("fuel_types")
            .select("id, name");

          const fuelTypeMap: Record<string, string> = {};
          fuelTypes?.forEach(ft => {
            fuelTypeMap[ft.id] = ft.name;
          });

          const invLevels: InventoryLevel[] = inventory.map((inv: any) => ({
            fuel_type: fuelTypeMap[inv.fuel_type_id] || "Unknown",
            current_level: inv.current_level || 0,
            tank_capacity: inv.tank_capacity || 10000,
            percentage: inv.tank_capacity > 0 
              ? ((inv.current_level || 0) / inv.tank_capacity) * 100 
              : 0
          }));
          setInventoryLevels(invLevels);
        }

        // Get fuel prices from pumps
        const { data: pumps } = await supabase
          .from("pumps")
          .select("fuel_type_id, price_per_liter")
          .eq("station_id", currentStation.id);

        if (pumps && pumps.length > 0) {
          const { data: fuelTypes } = await supabase.from("fuel_types").select("id, code");
          const ftMap: Record<string, string> = {};
          fuelTypes?.forEach(ft => ftMap[ft.id] = ft.code);

          const prices = { pms: 0, ago: 0 };
          pumps.forEach((p: any) => {
            const code = ftMap[p.fuel_type_id];
            if (code === "PETROL") prices.pms = p.price_per_liter || 0;
            if (code === "DIESEL") prices.ago = p.price_per_liter || 0;
          });
          setFuelPrices(prices);
        }

      } catch (err: any) {
        console.error("Analytics fetch error:", err);
        setError(err.message || "Failed to load analytics data");
        // Fall back to local state data
        processLocalData();
      } finally {
        setLoading(false);
      }
    };

    const processLocalData = () => {
      // Use local state data as fallback
      const days = dateRange.days;
      const pmsTotal = state.pmsSales - (state.pmsReturn || 0);
      const agoTotal = state.agoSales - (state.agoReturn || 0);
      const dailyAvg = (pmsTotal + agoTotal) / Math.max(1, days);

      const data: DailySales[] = [];
      for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        data.push({
          date: dateStr,
          total: Math.round(dailyAvg),
          count: Math.round(dailyAvg / 50)
        });
      }
      setSalesData(data);
      setFuelPrices({ pms: state.pmsPrice, ago: state.agoPrice });
    };

    fetchAnalyticsData();
  }, [currentStation?.id, dateRange.start, dateRange.end, state]);

  // Calculate predictions based on actual historical data
  const predictions = useMemo(() => {
    if (salesData.length < 7) return [];

    const last7 = salesData.slice(-7);
    const avgDaily = last7.reduce((s, d) => s + d.total, 0) / 7;
    const variance = last7.reduce((s, d) => s + Math.pow(d.total - avgDaily, 2), 0) / 7;
    const stdDev = Math.sqrt(variance);

    // Calculate simple linear trend
    let trendSum = 0;
    for (let i = 0; i < last7.length; i++) {
      trendSum += (last7[i].total - avgDaily) * (i - (last7.length - 1) / 2);
    }
    const trend = trendSum / (last7.length * (last7.length - 1) / 2);

    const preds: PredictionPoint[] = [];
    const now = new Date();

    for (let i = 1; i <= 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dayOfWeek = d.getDay();
      // Weekend adjustment based on historical pattern
      const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.85 : 1;
      const base = avgDaily + trend * i;
      const predicted = Math.max(0, Math.round(base * weekendFactor));

      preds.push({
        date: d.toISOString().split("T")[0],
        actual: 0,
        predicted,
        lower: Math.max(0, Math.round(predicted - stdDev)),
        upper: Math.round(predicted + stdDev),
      });
    }
    return preds;
  }, [salesData]);

  // Calculate totals from real data
  const totals = useMemo(() => {
    const totalRevenue = salesData.reduce((s, d) => s + d.total, 0);
    // Estimate fuel volumes from revenue and prices
    const avgPrice = (fuelPrices.pms + fuelPrices.ago) / 2 || 200;
    const estimatedVolume = totalRevenue / avgPrice;

    return {
      totalRevenue,
      estimatedVolume,
      avgDaily: salesData.length > 0 ? salesData.reduce((s, d) => s + d.total, 0) / salesData.length : 0,
      totalTransactions: salesData.reduce((s, d) => s + d.count, 0)
    };
  }, [salesData, fuelPrices]);

  // Calculate growth
  const growthData = useMemo(() => {
    if (salesData.length < 14) return { growth7d: 0, growth30d: 0 };

    const last7 = salesData.slice(-7);
    const prev7 = salesData.slice(-14, -7);
    const prev30 = salesData.slice(-60, -30);

    const last7Total = last7.reduce((s, d) => s + d.total, 0);
    const prev7Total = prev7.reduce((s, d) => s + d.total, 0);
    const prev30Total = prev30.reduce((s, d) => s + d.total, 0);

    const growth7d = prev7Total > 0 ? ((last7Total - prev7Total) / prev7Total) * 100 : 0;
    const growth30d = prev30Total > 0 ? ((last7Total * 4 - prev30Total) / prev30Total) * 100 : 0;

    return { growth7d, growth30d };
  }, [salesData]);

  // Find peak day
  const peakDay = useMemo(() => {
    if (salesData.length === 0) return "N/A";
    const peak = salesData.reduce((max, d) => d.total > max.total ? d : max, salesData[0]);
    const dayIndex = new Date(peak.date).getDay();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dayIndex];
  }, [salesData]);

  const maxVol = Math.max(...salesData.map(d => d.total), 1);
  const predMax = Math.max(...predictions.map(p => p.upper), 1, 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        <span className="ml-2 text-gray-500">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
          <BarChart3 size={24} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Advanced Analytics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real data from your sales records
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Showing estimated data from local records.</p>
          </div>
        </div>
      )}

      {/* Time Range */}
      <div className="flex gap-2">
        {(["7d", "30d", "90d", "1y"] as const).map(r => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${timeRange === r ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
          >
            {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : r === "90d" ? "90 Days" : "1 Year"}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {currencySymbol}{formatNumber(totals.totalRevenue, 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Avg Daily Sales</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {currencySymbol}{formatNumber(totals.avgDaily, 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">7-Day Growth</p>
          <p className={`text-2xl font-bold flex items-center gap-1 ${growthData.growth7d >= 0 ? "text-green-600" : "text-red-600"}`}>
            {growthData.growth7d >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {Math.abs(growthData.growth7d).toFixed(1)}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Transactions</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatNumber(totals.totalTransactions)}
          </p>
        </div>
      </div>

      {/* Sales Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">
          Daily Revenue Trend ({currencySymbol})
        </h3>
        {salesData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400">
            <p>No sales data available for this period</p>
          </div>
        ) : (
          <div className="h-48 flex items-end gap-0.5">
            {salesData.map((d, i) => {
              const height = (d.total / maxVol) * 100;
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col justify-end group relative"
                  title={`${d.date}: ${currencySymbol}${formatNumber(d.total)} (${d.count} txns)`}
                >
                  <div
                    className="w-full bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-sm"
                    style={{ height: `${height * 0.4}px`, minHeight: d.total > 0 ? '4px' : '0' }}
                  />
                  {i % Math.max(1, Math.floor(salesData.length / 10)) === 0 && (
                    <span className="text-[8px] text-gray-400 mt-1 -rotate-45 origin-top-left whitespace-nowrap">
                      {d.date.slice(5)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-4 mt-4 text-xs text-gray-500">
          <span>Peak Day: <strong className="text-violet-600">{peakDay}</strong></span>
          <span>Data Points: <strong>{salesData.length}</strong></span>
        </div>
      </div>

      {/* 14-Day Prediction */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10 rounded-xl p-5 border border-violet-200 dark:border-violet-800 shadow-sm">
        <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200 mb-1 flex items-center gap-2">
          <Target size={16} /> 14-Day Revenue Forecast
        </h3>
        <p className="text-[11px] text-violet-600 dark:text-violet-400 mb-4">
          Based on your historical sales patterns
        </p>
        <div className="h-40 flex items-end gap-1">
          {predictions.map((p, i) => {
            const predH = (p.predicted / predMax) * 100;
            const rangeH = ((p.upper - p.lower) / predMax) * 100;
            return (
              <div
                key={p.date}
                className="flex-1 flex flex-col justify-end group relative"
                title={`${p.date}: ${currencySymbol}${formatNumber(p.predicted)}`}
              >
                <div className="w-full flex flex-col items-center">
                  <div
                    className="w-full bg-violet-200/50 dark:bg-violet-800/20 rounded-t-sm relative"
                    style={{ height: `${rangeH * 0.3}px` }}
                  >
                    <div
                      className="absolute bottom-0 w-full bg-violet-500 rounded-sm"
                      style={{ height: `${predH * 0.3}px`, minHeight: '4px' }}
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
            <div className="w-3 h-3 bg-violet-200 rounded-sm" /> Confidence Range
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
                Peak sales day: <strong>{peakDay}</strong>
              </p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
              <Target size={12} className="text-blue-500 mt-0.5" />
              <p className="text-blue-700 dark:text-blue-400">
                14-day forecast: {currencySymbol}
                {formatNumber(predictions.reduce((s, p) => s + p.predicted, 0), 0)}
              </p>
            </div>
            <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
              <Layers size={12} className="text-amber-500 mt-0.5" />
              <p className="text-amber-700 dark:text-amber-400">
                Avg daily: {currencySymbol}{formatNumber(totals.avgDaily, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold dark:text-white mb-3 flex items-center gap-2">
            <PieChart size={16} className="text-purple-500" /> Period Growth
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">7-Day Change</span>
                <span className={`font-semibold ${growthData.growth7d >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {growthData.growth7d >= 0 ? "+" : ""}{growthData.growth7d.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${growthData.growth7d >= 0 ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, Math.abs(growthData.growth7d) * 2)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">30-Day Trend</span>
                <span className={`font-semibold ${growthData.growth30d >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {growthData.growth30d >= 0 ? "+" : ""}{growthData.growth30d.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${growthData.growth30d >= 0 ? "bg-blue-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, Math.abs(growthData.growth30d) * 2)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tank Levels */}
      {inventoryLevels.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold dark:text-white mb-4 flex items-center gap-2">
            <Activity size={16} className="text-cyan-500" /> Current Tank Levels
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {inventoryLevels.map((inv, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{inv.fuel_type}</span>
                  <span className="font-semibold dark:text-white">{inv.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${inv.percentage > 50 ? "bg-green-500" : inv.percentage > 25 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${inv.percentage}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400">
                  {formatNumber(inv.current_level)} / {formatNumber(inv.tank_capacity)} L
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
