import { useFuel } from "@/react-app/context/FuelContext";
import { useLocation } from "@/react-app/context/LocationContext";
import { useStations } from "@/react-app/context/StationContext";
import { useAutoSync } from "@/react-app/hooks/useAutoSync";
import { getPriceForCity } from "@/react-app/services/DataSyncService";
// Demo imports removed
import RegulatoryAlerts from "@/react-app/components/RegulatoryAlerts";
import SyncStatusIndicator from "@/react-app/components/SyncStatusIndicator";
import WeatherWidget from "@/react-app/components/WeatherWidget";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Fuel,
  Users,
  AlertTriangle,
  BarChart3,
  Clock,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  ShoppingCart,
  Droplets,
  CreditCard,
  Wallet,
  Globe,
  Zap,
  TrendingUpIcon,
  FileText,
  Info,
} from "lucide-react";
import { formatNumber } from "@/react-app/utils/formatUtils";
import { useState, useEffect, useMemo, useCallback } from "react";

// Lazy API base URL getter using dynamic import to avoid circular deps
let _apiBase: string | null = null;
let _apiPromise: Promise<string> | null = null;
function getApiBase(): string {
  if (!_apiPromise) {
    _apiPromise = import("@/utils/apiConfig").then(m => m.getBackendUrl());
  }
  if (_apiBase) return _apiBase;
  // Synchronous fallback for existing calls
  return "https://fuel-pro-backend-v2-production-7c2b.up.railway.app";
}
// Async version for callers that can await
async function getApiBaseAsync(): Promise<string> {
  if (_apiBase) return _apiBase;
  if (!_apiPromise) {
    _apiPromise = import("@/utils/apiConfig").then(m => m.getBackendUrl());
  }
  _apiBase = await _apiPromise;
  return _apiBase;
}

// Import chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const { state } = useFuel();
  const location = useLocation();
  const { currentStation } = useStations();
  const { fuelPrice, taxRates, exchangeRates, isSyncing, lastSync, syncNow, locationPrice, currentLocation, refreshLocation, refreshPrices } =
    useAutoSync(location.currentCountry.id);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Backend data state
  const [backendStats, setBackendStats] = useState<{
    totalRevenue: number;
    netProfit: number;
    fuelSold: number;
    balanceDue: number;
  } | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const [hasBackendData, setHasBackendData] = useState(false);
  // Demo mode removed

  // Use precise location-based fuel prices (auto-synced with GPS)
  const stationCity = currentStation?.location || "Nairobi";
  const regionalPrice = getPriceForCity(fuelPrice, stationCity);
  // Prefer location-based price from GPS, then fall back to regional, then national, then default
  const displayPmsPrice = locationPrice?.petrolPrice 
    ?? (regionalPrice.isRegional ? regionalPrice.petrol : null)
    ?? fuelPrice?.petrolPrice 
    ?? state.pmsPrice;
  const displayAgoPrice = locationPrice?.dieselPrice
    ?? (regionalPrice.isRegional ? regionalPrice.diesel : null)
    ?? fuelPrice?.dieselPrice
    ?? state.agoPrice;
  const displayKerosenePrice = locationPrice?.kerosenePrice 
    ?? fuelPrice?.kerosenePrice 
    ?? 0; // Kerosene price not in base state
  // Show the detected city for location-based pricing
  const priceCityName = locationPrice?.cityName || regionalPrice.cityName || "Nairobi";
  const isLocationBased = !!locationPrice;
  const currencySymbol = location.currencySymbol;
  const [animatedValues, setAnimatedValues] = useState({
    revenue: 0,
    profit: 0,
    fuelSold: 0,
    debt: 0,
  });

  // Fetch dashboard stats from backend
  const fetchBackendStats = useCallback(async () => {
    // Get auth token
    let token: string | null = null;
    try {
      const sessionJson = localStorage.getItem("fuelpro_founder_session");
      if (sessionJson) {
        const session = JSON.parse(sessionJson);
        if (session.active && session.token) {
          token = session.token;
        }
      }
    } catch { /* no session */ }
    
    if (!token) return;
    
    setBackendLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setBackendStats(data.data);
          setHasBackendData(true);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch backend stats:', e);
    } finally {
      setBackendLoading(false);
    }
  }, []);

  // Fetch on mount and periodically
  useEffect(() => {
    fetchBackendStats();
    const interval = setInterval(fetchBackendStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchBackendStats]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Animate KPI values on mount - use backend data if available, then local, then demo
  useEffect(() => {
    // Prefer backend stats over local calculation, then demo data
    let targets = {
      revenue: 0,
      profit: 0,
      fuelSold: 0,
      debt: 0,
    };
    
    if (hasBackendData && backendStats) {
      targets = {
        revenue: backendStats.totalRevenue,
        profit: backendStats.netProfit,
        fuelSold: backendStats.fuelSold,
        debt: backendStats.balanceDue,
      };
    } else if (totalRevenue > 0 || totalFuelSold > 0) {
      targets = {
        revenue: totalRevenue,
        profit: netProfit,
        fuelSold: totalFuelSold,
        debt: totalDebt,
      };
    } else {
      // Production mode: no demo data
      targets = {
        revenue: 0,
        profit: 0,
        fuelSold: 0,
        debt: 0,
      };
    }
    
    const duration = 1000;
    const steps = 30;
    const interval = duration / steps;
    let step = 0;

    const animTimer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setAnimatedValues({
        revenue: targets.revenue * eased,
        profit: targets.profit * eased,
        fuelSold: targets.fuelSold * eased,
        debt: targets.debt * eased,
      });
      if (step >= steps) clearInterval(animTimer);
    }, interval);

    return () => clearInterval(animTimer);
  }, [hasBackendData, backendStats]);

  // Calculate totals from sales history
  const {
    totalRevenue,
    netProfit,
    totalFuelSold,
    totalDebt,
    totalExpenses,
    todaySales,
  } = useMemo(() => {
    const history = Object.values(state.salesHistory);
    let revenue = 0;
    let expenses = 0;
    let fuel = 0;
    let profit = 0;

    history.forEach((entry: any) => {
      // Read from pump readings (Sales Tracking)
      const pmsTotal = (entry.pmsPumps || []).reduce(
        (s: number, p: any) => s + (p.salesKsh || 0),
        0
      );
      const agoTotal = (entry.agoPumps || []).reduce(
        (s: number, p: any) => s + (p.salesKsh || 0),
        0
      );
      // Read from POS sales (Point of Sale)
      const posSales = entry.posSales || {};
      const posPmsAmount = posSales.pmsAmount || 0;
      const posAgoAmount = posSales.agoAmount || 0;
      const posPmsLitres = posSales.pmsLitres || 0;
      const posAgoLitres = posSales.agoLitres || 0;
      // Total revenue = pump readings + POS sales
      revenue += pmsTotal + agoTotal + posPmsAmount + posAgoAmount;
      // Total fuel = pump readings + POS sales
      fuel += (entry.pmsPumps || []).reduce(
        (s: number, p: any) => s + (p.salesL || 0),
        0
      ) + (entry.agoPumps || []).reduce(
        (s: number, p: any) => s + (p.salesL || 0),
        0
      ) + posPmsLitres + posAgoLitres;
      expenses += (entry.expenses || []).reduce(
        (s: number, e: any) => s + (e.amount || 0),
        0
      );
    });

    profit = revenue - expenses;
    const debt = state.deliveryData.totals.balanceDue;

    // Get today's sales
    const today = new Date().toISOString().split("T")[0];
    const todayEntry: any = Object.entries(state.salesHistory).find(([k]) =>
      k.startsWith(today)
    );
    const tSales = todayEntry
      ? (() => {
          const e = todayEntry[1] as any;
          // Read from pump readings
          const pms = (e.pmsPumps || []).reduce(
            (s: number, p: any) => s + (p.salesKsh || 0),
            0
          );
          const ago = (e.agoPumps || []).reduce(
            (s: number, p: any) => s + (p.salesKsh || 0),
            0
          );
          // Read from POS sales
          const posSales = e.posSales || {};
          const posPmsAmount = posSales.pmsAmount || 0;
          const posAgoAmount = posSales.agoAmount || 0;
          return pms + ago + posPmsAmount + posAgoAmount;
        })()
      : 0;

    return {
      totalRevenue: revenue,
      netProfit: profit,
      totalFuelSold: fuel,
      totalDebt: debt,
      totalExpenses: expenses,
      todaySales: tSales,
    };
  }, [state.salesHistory, state.deliveryData.totals]);

  // Chart data - Sales over last 7 days
  const salesChartData = useMemo(() => {
    const days: string[] = [];
    const pmsData: number[] = [];
    const agoData: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      days.push(d.toLocaleDateString("en-US", { weekday: "short" }));

      let pms = 0,
        ago = 0;
      Object.entries(state.salesHistory).forEach(
        ([key, entry]: [string, any]) => {
          if (key.startsWith(dateStr)) {
            // Read from pump readings
            pms += (entry.pmsPumps || []).reduce(
              (s: number, p: any) => s + (p.salesKsh || 0),
              0
            );
            ago += (entry.agoPumps || []).reduce(
              (s: number, p: any) => s + (p.salesKsh || 0),
              0
            );
            // Read from POS sales
            const posSales = entry.posSales || {};
            pms += posSales.pmsAmount || 0;
            ago += posSales.agoAmount || 0;
          }
        }
      );
      pmsData.push(pms);
      agoData.push(ago);
    }

    return {
      labels: days,
      datasets: [
        {
          label: "Petrol (PMS)",
          data: pmsData,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: "Diesel (AGO)",
          data: agoData,
          borderColor: "rgb(234, 179, 8)",
          backgroundColor: "rgba(234, 179, 8, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [state.salesHistory]);

  // Fuel type distribution
  const fuelDistData = useMemo(() => {
    const history = Object.values(state.salesHistory);
    let pms = 0,
      ago = 0;
    history.forEach((entry: any) => {
      // Read from pump readings
      pms += (entry.pmsPumps || []).reduce(
        (s: number, p: any) => s + (p.salesL || 0),
        0
      );
      ago += (entry.agoPumps || []).reduce(
        (s: number, p: any) => s + (p.salesL || 0),
        0
      );
      // Read from POS sales
      const posSales = entry.posSales || {};
      pms += posSales.pmsLitres || 0;
      ago += posSales.agoLitres || 0;
    });
    if (pms === 0 && ago === 0) {
      pms = 1;
      ago = 1;
    } // default for empty state
    return {
      labels: ["Petrol (PMS)", "Diesel (AGO)"],
      datasets: [
        {
          data: [pms, ago],
          backgroundColor: ["rgba(34, 197, 94, 0.8)", "rgba(234, 179, 8, 0.8)"],
          borderColor: ["rgb(34, 197, 94)", "rgb(234, 179, 8)"],
          borderWidth: 2,
        },
      ],
    };
  }, [state.salesHistory]);

  // Expense breakdown
  const expenseData = useMemo(() => {
    const expenseMap: Record<string, number> = {};
    Object.values(state.salesHistory).forEach((entry: any) => {
      (entry.expenses || []).forEach((e: any) => {
        const key = e.desc || "Other";
        expenseMap[key] = (expenseMap[key] || 0) + (e.amount || 0);
      });
    });
    const labels = Object.keys(expenseMap).slice(0, 6);
    const data = labels.map(l => expenseMap[l]);
    if (labels.length === 0) {
      labels.push("No Data");
      data.push(0);
    }
    return {
      labels,
      datasets: [
        {
          label: "Amount (Ksh)",
          data,
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(239, 68, 68, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(236, 72, 153, 0.8)",
          ],
          borderRadius: 6,
        },
      ],
    };
  }, [state.salesHistory]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: state.theme === "dark" ? "#9ca3af" : "#374151",
          usePointStyle: true,
          padding: 16,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color:
            state.theme === "dark"
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.05)",
        },
        ticks: { color: state.theme === "dark" ? "#9ca3af" : "#6b7280" },
      },
      y: {
        grid: {
          color:
            state.theme === "dark"
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.05)",
        },
        ticks: { color: state.theme === "dark" ? "#9ca3af" : "#6b7280" },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: state.theme === "dark" ? "#9ca3af" : "#374151",
          usePointStyle: true,
          padding: 16,
        },
      },
    },
    cutout: "60%",
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: state.theme === "dark" ? "#9ca3af" : "#6b7280" },
      },
      y: {
        grid: {
          color:
            state.theme === "dark"
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.05)",
        },
        ticks: { color: state.theme === "dark" ? "#9ca3af" : "#6b7280" },
      },
    },
  };

  const quickActions = [
    {
      label: "Point of Sale",
      icon: ShoppingCart,
      tab: "pos",
      color: "bg-blue-500 hover:bg-blue-600",
      desc: "Quick fuel sale",
    },
    {
      label: "Sales Tracking",
      icon: BarChart3,
      tab: "sales",
      color: "bg-green-500 hover:bg-green-600",
      desc: "Record pump readings",
    },
    {
      label: "Delivery",
      icon: Fuel,
      tab: "delivery",
      color: "bg-amber-500 hover:bg-amber-600",
      desc: "Track deliveries",
    },
    {
      label: "Invoice",
      icon: Receipt,
      tab: "invoice",
      color: "bg-purple-500 hover:bg-purple-600",
      desc: "Create invoice",
    },
    {
      label: "M-PESA",
      icon: CreditCard,
      tab: "mpesa",
      color: "bg-emerald-500 hover:bg-emerald-600",
      desc: "Analyze payments",
    },
    {
      label: "Reports",
      icon: Activity,
      tab: "reports",
      color: "bg-rose-500 hover:bg-rose-600",
      desc: "View reports",
    },
  ];

  const switchToTab = (tabId: string) => {
    window.dispatchEvent(new CustomEvent("changeTab", { detail: tabId }));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {state.companyData.name || "Dashboard"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Welcome back! Here's your business overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatusIndicator
            countryCode={location.currentCountry.id}
            compact
          />
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 shadow-sm border border-gray-200 dark:border-gray-700">
            <Clock size={18} className="text-blue-500" />
            <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
              {currentTime.toLocaleString("en-KE", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Revenue
            </span>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign
                size={18}
                className="text-green-600 dark:text-green-400"
              />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            Ksh {formatNumber(animatedValues.revenue, 0)}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowUpRight size={14} className="text-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400">
              {todaySales > 0
                ? `Ksh ${formatNumber(todaySales)} today`
                : "No sales today"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Net Profit
            </span>
            <div
              className={`p-2 rounded-lg ${netProfit >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}
            >
              {netProfit >= 0 ? (
                <TrendingUp
                  size={18}
                  className="text-green-600 dark:text-green-400"
                />
              ) : (
                <TrendingDown
                  size={18}
                  className="text-red-600 dark:text-red-400"
                />
              )}
            </div>
          </div>
          <p
            className={`text-2xl font-bold ${netProfit >= 0 ? "text-gray-900 dark:text-white" : "text-red-600 dark:text-red-400"}`}
          >
            Ksh {formatNumber(animatedValues.profit, 0)}
          </p>
          <div className="flex items-center gap-1 mt-2">
            {netProfit >= 0 ? (
              <ArrowUpRight size={14} className="text-green-500" />
            ) : (
              <ArrowDownRight size={14} className="text-red-500" />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {totalExpenses > 0
                ? `Ksh ${formatNumber(totalExpenses)} expenses`
                : "No expenses recorded"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Fuel Sold
            </span>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Droplets
                size={18}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(animatedValues.fuelSold, 0)} L
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Fuel size={14} className="text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              PMS: {currencySymbol} {displayPmsPrice}/L | AGO: {currencySymbol}{" "}
              {displayAgoPrice}/L
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Balance Due
            </span>
            <div
              className={`p-2 rounded-lg ${totalDebt > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}
            >
              {totalDebt > 0 ? (
                <AlertTriangle
                  size={18}
                  className="text-red-600 dark:text-red-400"
                />
              ) : (
                <Wallet
                  size={18}
                  className="text-green-600 dark:text-green-400"
                />
              )}
            </div>
          </div>
          <p
            className={`text-2xl font-bold ${totalDebt > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}
          >
            Ksh {formatNumber(animatedValues.debt, 0)}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Users size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {Object.keys(state.clients).length} client(s)
            </span>
          </div>
        </div>
      </div>

      {/* Auto-Synced Fuel Prices + Tax Info + Regulatory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Current Pump Prices */}
        <div
          className={`rounded-xl p-3 border shadow-sm ${fuelPrice ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 border-blue-200 dark:border-blue-800" : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Globe
                size={14}
                className={
                  isSyncing ? "text-blue-500 animate-pulse" : "text-blue-500"
                }
              />
              Current Pump Prices
            </h3>
            <span className="text-[9px] bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
              {fuelPrice?.priceSettingBody ||
                location.currentCountry.fuelRegulations.priceSettingBody}
            </span>
          </div>
          {/* Location-based price indicator */}
          <div className="mb-2 flex items-center gap-2">
            {currentLocation && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                📍 {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
              </span>
            )}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isLocationBased ? "bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}
            >
              {isLocationBased
                ? `📍 GPS: ${priceCityName} (${locationPrice.transportSurcharge >= 0 ? '+' : ''}${locationPrice.transportSurcharge.toFixed(2)})`
                : regionalPrice.isRegional
                ? `EPRA ${regionalPrice.cityName} Price`
                : `${stationCity} - National Average`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Super Petrol
              </p>
              <p className="text-xl font-bold text-green-700 dark:text-green-400">
                {currencySymbol} {displayPmsPrice.toFixed(2)}
              </p>
              <p className="text-[9px] text-gray-400">per litre</p>
              {regionalPrice.isRegional && (
                <p className="text-[9px] text-green-600 dark:text-green-400 mt-0.5">
                  {regionalPrice.cityName}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Diesel
              </p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                {currencySymbol} {displayAgoPrice.toFixed(2)}
              </p>
              <p className="text-[9px] text-gray-400">per litre</p>
              {regionalPrice.isRegional && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">
                  {regionalPrice.cityName}
                </p>
              )}
            </div>
          </div>
          {fuelPrice?.breakdown && (
            <div className="mt-3 pt-3 border-t border-blue-200/50 dark:border-blue-800/30">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-gray-500">Landed Cost</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {currencySymbol} {fuelPrice.breakdown.landedCost.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">Taxes</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {currencySymbol} {fuelPrice.breakdown.taxes.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">Margins</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {currencySymbol} {fuelPrice.breakdown.margins.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            {fuelPrice ? (
              <p className="text-[9px] text-gray-500 dark:text-gray-500">
                Source:{" "}
                <a
                  href={fuelPrice.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {fuelPrice.sourceName}
                </a>
                {isSyncing && (
                  <span className="ml-1 text-blue-400 animate-pulse">
                    syncing...
                  </span>
                )}
              </p>
            ) : (
              <button
                onClick={syncNow}
                className="text-[9px] text-blue-500 hover:underline flex items-center gap-1"
              >
                <Zap size={8} /> Click to sync latest prices
              </button>
            )}
            <p className="text-[9px] text-gray-400">
              {fuelPrice
                ? new Date(fuelPrice.lastUpdated).toLocaleDateString()
                : "Not synced"}
            </p>
          </div>
        </div>

        {/* Tax Rates Summary */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/10 rounded-xl p-3 border border-purple-200 dark:border-purple-800 shadow-sm">
          <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2 flex items-center gap-2">
            <FileText size={14} className="text-purple-500" />
            Tax & Statutory Rates
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">VAT Rate</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {(taxRates || location.revenueAuthority).vatRate}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">
                {(taxRates || location.payrollConfig).nssfLabel} (Employee)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {(
                  (taxRates || location.payrollConfig).nssfEmployeeRate * 100
                ).toFixed(0)}
                %
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">
                {(taxRates || location.payrollConfig).nssfLabel} (Employer)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {(
                  (taxRates || location.payrollConfig).nssfEmployerRate * 100
                ).toFixed(0)}
                %
              </span>
            </div>
            {(taxRates?.housingLevyApplicable ??
              location.payrollConfig.housingLevy) && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  Housing Levy
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {(
                    (taxRates?.housingLevyRate ??
                      location.payrollConfig.housingLevyRate) * 100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">
                Excise Duty/L
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {currencySymbol}{" "}
                {(taxRates
                  ? taxRates.exciseDutyPerLiter
                  : location.revenueAuthority.exciseDuty
                ).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">
                Min. Wage (monthly)
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {currencySymbol}{" "}
                {(
                  taxRates || location.payrollConfig
                ).minimumWage.toLocaleString()}
              </span>
            </div>
          </div>
          <p className="text-[9px] text-gray-400 mt-3 text-right">
            {taxRates
              ? `Last updated: ${new Date(taxRates.lastUpdated).toLocaleDateString()}`
              : "Using default rates - click sync to update"}
          </p>
        </div>

        {/* Weather Widget */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm">
          <WeatherWidget />
        </div>

        {/* Regulatory Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm">
          <RegulatoryAlerts countryCode={location.currentCountry.id} />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Sales Trend */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500" />
              Sales Trend (Last 7 Days)
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              Ksh
            </span>
          </div>
          <div className="h-64">
            <Line data={salesChartData} options={chartOptions} />
          </div>
        </div>

        {/* Fuel Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Droplets size={18} className="text-green-500" />
            Fuel Distribution
          </h3>
          <div className="h-48">
            <Doughnut data={fuelDistData} options={doughnutOptions} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div
              className={`rounded-lg p-2 ${fuelPrice ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" : "bg-gray-50 dark:bg-gray-700/30"}`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PMS Price
              </p>
              <p className="font-semibold text-green-700 dark:text-green-300">
                {currencySymbol} {displayPmsPrice}/L
              </p>
              {fuelPrice && (
                <p className="text-[9px] text-green-600 dark:text-green-400 mt-0.5 flex items-center justify-center gap-0.5">
                  <Globe size={8} /> Auto-synced
                </p>
              )}
            </div>
            <div
              className={`rounded-lg p-2 ${fuelPrice ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "bg-gray-50 dark:bg-gray-700/30"}`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AGO Price
              </p>
              <p className="font-semibold text-amber-700 dark:text-amber-300">
                {currencySymbol} {displayAgoPrice}/L
              </p>
              {fuelPrice && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center justify-center gap-0.5">
                  <Globe size={8} /> Auto-synced
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Second Charts Row + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Expense Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Activity size={18} className="text-rose-500" />
            Expense Breakdown
          </h3>
          <div className="h-48">
            <Bar data={expenseData} options={barOptions} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-500" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={() => switchToTab(action.tab)}
                className={`${action.color} text-white rounded-xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm`}
              >
                <action.icon size={24} className="mb-2 opacity-90" />
                <p className="font-semibold text-sm">{action.label}</p>
                <p className="text-xs opacity-75 mt-0.5">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tank Levels */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Fuel size={18} className="text-blue-500" />
          Tank Levels
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* PMS Tank */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Petrol (PMS) Tank
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatNumber(state.pmsTankClosing - state.pmsTankOpening, 0)} L
                dispensed
              </span>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, state.pmsTankClosing > 0 ? (state.pmsTankClosing / (state.pmsTankClosing + 5000)) * 100 : 0)}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Opening: {formatNumber(state.pmsTankOpening)} L</span>
              <span>Closing: {formatNumber(state.pmsTankClosing)} L</span>
            </div>
          </div>

          {/* AGO Tank */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Diesel (AGO) Tank
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatNumber(state.agoTankClosing - state.agoTankOpening, 0)} L
                dispensed
              </span>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, state.agoTankClosing > 0 ? (state.agoTankClosing / (state.agoTankClosing + 5000)) * 100 : 0)}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Opening: {formatNumber(state.agoTankOpening)} L</span>
              <span>Closing: {formatNumber(state.agoTankClosing)} L</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Pumps Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Activity size={18} className="text-purple-500" />
          Pump Status
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {state.pmsPumps.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PMS Pumps
            </p>
          </div>
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {state.agoPumps.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AGO Pumps
            </p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {Object.keys(state.invoices).length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Invoices</p>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {state.employees.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Employees
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
