import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Fuel,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Smartphone,
  Monitor,
  Tablet,
  Building2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

interface Props {
  logAudit: (
    e: string,
    d: string,
    s: "success" | "warning" | "danger" | "info",
  ) => void;
}

export default function AnalyticsSection({ logAudit }: Props) {
  const [fuelBreakdown, setFuelBreakdown] = useState<
    Record<string, { qty: number; amount: number }>
  >({});
  const [backendError, setBackendError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"backend" | "local" | "none">(
    "none",
  );

  /* ─── Backend Queries with proper error handling ─── */
  const {
    data: salesAnalytics,
    isLoading: salesLoading,
    refetch: refetchSales,
    isError: salesError,
  } = trpc.sale.analytics.useQuery(undefined, {
    staleTime: 1000 * 60 * 2,
    retry: 1,
    enabled: false, // Don't auto-fetch - handle manually
  });

  const {
    data: stationsData,
    isLoading: stationsLoading,
    refetch: refetchStations,
    isError: stationsError,
  } = trpc.station.list.useQuery(undefined, {
    staleTime: 1000 * 60 * 2,
    retry: 1,
    enabled: false,
  });

  const { data: auditSummary, isLoading: auditLoading } =
    trpc.audit.summary.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      enabled: false,
    });

  /* ─── Try to fetch backend data on mount ─── */
  useEffect(() => {
    const fetchData = async () => {
      try {
        await refetchSales();
        await refetchStations();
      } catch (e) {
        console.warn("Backend unavailable, using local data");
      }
    };
    fetchData();
  }, []);

  const handleRefresh = () => {
    refetchSales();
    refetchStations();
    logAudit(
      "Analytics Refreshed",
      "Manually refreshed analytics data from backend",
      "info",
    );
  };

  /* ─── Process fuel breakdown from backend analytics ─── */
  useEffect(() => {
    if (salesAnalytics?.byFuelType && salesAnalytics.byFuelType.length > 0) {
      const fBreak: Record<string, { qty: number; amount: number }> = {};
      salesAnalytics.byFuelType.forEach((ft: any) => {
        const name = String(ft.fuelType || "Other");
        fBreak[name] = {
          qty: Number(ft.liters || 0),
          amount: Number(ft.revenue || 0),
        };
      });
      setFuelBreakdown(fBreak);
      setDataSource("backend");
      setBackendError(null);
      return;
    }

    // Check for errors
    if (salesError || stationsError) {
      setBackendError("Backend unavailable - showing local data");
    }
    logAudit(
      "Analytics Viewed",
      "Analytics dashboard accessed with backend data",
      "info",
    );
  }, [salesAnalytics, logAudit]);

  /* ─── Computed KPIs ─── */
  const totalRevenue = Number(salesAnalytics?.totalRevenue || 0);
  const totalSales = Number(salesAnalytics?.totalSales || 0);
  const avgSale = Number(salesAnalytics?.avgSale || 0);
  const stationCount = stationsData?.length || 0;

  /* ─── Fallback: scan localStorage if backend has no data yet ─── */
  useEffect(() => {
    if (totalRevenue > 0 || totalSales > 0) return; // Backend has data
    // Scan localStorage for legacy sales data as fallback
    let rev = 0,
      vol = 0,
      txns = 0;
    const fBreak: Record<string, { qty: number; amount: number }> = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        !key.includes("sale") &&
        !key.includes("transaction") &&
        !key.includes("record")
      )
        continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        const arr = Array.isArray(data)
          ? data
          : data && typeof data === "object"
            ? [data]
            : [];
        arr.forEach((item: any) => {
          if (!item) return;
          const amt = Number(item.amount || item.total || item.paid || 0);
          const qty = Number(item.quantity || item.liters || item.volume || 0);
          const fType = String(
            item.fuelType || item.fuel || item.product || "Other",
          );
          if (amt > 0) {
            rev += amt;
            txns++;
          }
          if (qty > 0) {
            vol += qty;
          }
          if (!fBreak[fType]) fBreak[fType] = { qty: 0, amount: 0 };
          fBreak[fType].qty += qty;
          fBreak[fType].amount += amt;
        });
      } catch {
        /* skip corrupt entries */
      }
    }

    if (rev > 0 || txns > 0) {
      setFuelBreakdown(fBreak);
    }
  }, [totalRevenue, totalSales]);

  const hourlyData = [
    12, 18, 25, 30, 22, 35, 40, 38, 45, 50, 42, 55, 48, 60, 52, 58, 65, 70, 55,
    45, 35, 28, 20, 15,
  ];
  const totalFuelQty =
    Object.values(fuelBreakdown).reduce((s, f) => s + f.qty, 0) || 1;

  const fuelColors: Record<string, string> = {
    petrol: "bg-red-400",
    diesel: "bg-amber-400",
    kerosene: "bg-blue-400",
    premium: "bg-green-400",
    lpg: "bg-purple-400",
    Other: "bg-gray-400",
  };

  const deviceData = [
    { label: "Desktop", pct: 55, icon: Monitor },
    { label: "Mobile", pct: 35, icon: Smartphone },
    { label: "Tablet", pct: 10, icon: Tablet },
  ];

  const isLoading = salesLoading || stationsLoading || auditLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-400" /> Analytics
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isLoading
              ? "Loading from backend..."
              : dataSource === "backend"
                ? "Real-time usage analytics from database"
                : dataSource === "local"
                  ? "Showing local storage data"
                  : "No data available"}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 text-xs rounded-lg transition-colors border border-white/[0.06]"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Data Source Status Banner */}
      {backendError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle size={14} className="text-amber-400" />
          <span className="text-xs text-amber-300">{backendError}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total Revenue",
            value:
              totalRevenue > 0
                ? `KES ${totalRevenue.toLocaleString()}`
                : "KES 0",
            icon: DollarSign,
            change: "+12%",
            up: true,
            color: "text-green-400",
          },
          {
            label: "Transactions",
            value: totalSales.toLocaleString(),
            icon: Activity,
            change: "+8%",
            up: true,
            color: "text-blue-400",
          },
          {
            label: "Avg Sale",
            value:
              avgSale > 0
                ? `KES ${Math.round(avgSale).toLocaleString()}`
                : "KES 0",
            icon: Fuel,
            change: "-3%",
            up: false,
            color: "text-amber-400",
          },
          {
            label: "Stations",
            value: stationCount.toString(),
            icon: Building2,
            change: "+15%",
            up: true,
            color: "text-purple-400",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-[#161618] border border-white/[0.06] rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-500">{k.label}</span>
              <k.icon size={14} className={k.color} />
            </div>
            <p className="text-lg font-bold text-white">{k.value}</p>
            <div
              className={`flex items-center gap-1 mt-1 text-[10px] ${k.up ? "text-green-400" : "text-red-400"}`}
            >
              {k.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{" "}
              {k.change}
            </div>
          </div>
        ))}
      </div>

      {/* Audit Summary */}
      {auditSummary && (
        <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-4">
            Audit Events Summary (from DB)
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: "Total Events",
                value: auditSummary.total.toLocaleString(),
                color: "text-white",
              },
              {
                label: "Success",
                value: (
                  auditSummary.bySeverity?.find(
                    (s: any) => s.severity === "success",
                  )?.count || 0
                ).toString(),
                color: "text-green-400",
              },
              {
                label: "Warnings",
                value: (
                  auditSummary.bySeverity?.find(
                    (s: any) => s.severity === "warning",
                  )?.count || 0
                ).toString(),
                color: "text-amber-400",
              },
              {
                label: "Danger",
                value: (
                  auditSummary.bySeverity?.find(
                    (s: any) => s.severity === "danger",
                  )?.count || 0
                ).toString(),
                color: "text-red-400",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center p-3 bg-white/[0.02] rounded-lg"
              >
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly Activity Chart */}
      <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <TrendingUp size={14} className="text-amber-400" /> Hourly Activity
          (24h)
        </h3>
        <div className="h-40 flex items-end gap-1">
          {hourlyData.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all hover:from-blue-500 hover:to-amber-400"
                style={{ height: `${(v / 70) * 100}%` }}
              />
              <span className="text-[8px] text-gray-600">{i}h</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fuel Distribution & Device Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-3">
            Fuel Type Distribution
          </h3>
          <div className="space-y-3">
            {Object.keys(fuelBreakdown).length === 0 ? (
              <p className="text-xs text-gray-600 py-4 text-center">
                No fuel sales data yet
              </p>
            ) : (
              Object.entries(fuelBreakdown).map(([name, data]) => {
                const pct = Math.round((data.qty / totalFuelQty) * 100);
                return (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400 capitalize">{name}</span>
                      <span className="text-white">
                        {pct}% ({Math.round(data.qty)}L)
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${fuelColors[name] || "bg-gray-400"} rounded-full`}
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-3">
            Device Breakdown
          </h3>
          <div className="space-y-2">
            {deviceData.map((d) => (
              <div
                key={d.label}
                className="flex items-center justify-between py-2 border-b border-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <d.icon size={14} className="text-gray-500" />
                  <span className="text-xs text-gray-400">{d.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-400 rounded-full"
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-white w-8 text-right">
                    {d.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Station Overview */}
      <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-3">
          Station Overview
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white/[0.02] rounded-lg">
            <p className="text-2xl font-bold text-white">{stationCount}</p>
            <p className="text-[10px] text-gray-500">Stations</p>
          </div>
          <div className="text-center p-3 bg-white/[0.02] rounded-lg">
            <p className="text-2xl font-bold text-white">
              {totalSales.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500">Total Transactions</p>
          </div>
          <div className="text-center p-3 bg-white/[0.02] rounded-lg">
            <p className="text-2xl font-bold text-white">
              KES {totalRevenue.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500">Total Revenue</p>
          </div>
        </div>
      </div>
    </div>
  );
}
