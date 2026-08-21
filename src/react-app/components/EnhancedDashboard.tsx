/**
 * EnhancedDashboard.tsx
 * SalesZote-style dashboard with KPI cards, sales chart, and recent activity.
 * All subcomponents are module-scoped (UPDATE-4 rule).
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Fuel,
  Calendar,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import {
  fetchSalesReport,
  fetchInventoryValuation,
  fetchExpensesReport,
} from "@/react-app/lib/pos-service";
import { supabase } from "@/supabase/client";
import {
  getCurrencySymbol,
  getDetectedCurrency,
  getLocaleForCountry,
} from "@/react-app/lib/currency";

// Format currency
const formatMoney = (amount: number, currency = getDetectedCurrency()) => {
  return new Intl.NumberFormat(getLocaleForCountry(), {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Date range options
const DATE_RANGES = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "This Year", value: "year" },
];

// Module-scoped subcomponents (UPDATE-4 rule)
const KPICard = ({
  title,
  value,
  change,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
  trend: "up" | "down" | "neutral";
}) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
    <div className="flex items-start justify-between mb-4">
      <div
        className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div
        className={`flex items-center gap-1 text-sm font-medium ${
          trend === "up"
            ? "text-emerald-400"
            : trend === "down"
              ? "text-red-400"
              : "text-gray-400"
        }`}
      >
        {trend === "up" ? (
          <ArrowUpRight size={16} />
        ) : trend === "down" ? (
          <ArrowDownRight size={16} />
        ) : null}
        {Math.abs(change).toFixed(1)}%
      </div>
    </div>
    <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
    <p className="text-gray-400 text-sm">{title}</p>
  </div>
);

const SalesChart = ({ data }: { data: { label: string; value: number }[] }) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
    <h3 className="text-lg font-semibold text-white mb-4">Sales Trend</h3>
    <div className="h-64 flex items-end gap-2">
      {data.map((item, index) => {
        const maxValue = Math.max(...data.map((d) => d.value), 1);
        const height = (item.value / maxValue) * 100;
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-full bg-amber-500/30 hover:bg-amber-500/50 rounded-t-lg transition-colors cursor-pointer"
              style={{ height: `${Math.max(height, 4)}%` }}
              title={`${item.label}: ${formatMoney(item.value)}`}
            />
            <span className="text-xs text-gray-500">{item.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const TopProducts = ({
  products,
}: {
  products: { name: string; quantity: number; revenue: number }[];
}) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
    <h3 className="text-lg font-semibold text-white mb-4">
      Top Selling Products
    </h3>
    <div className="space-y-4">
      {products.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          No sales data yet
        </p>
      ) : (
        products.map((product, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 font-semibold text-sm">
                {index + 1}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{product.name}</p>
                <p className="text-gray-400 text-xs">{product.quantity} sold</p>
              </div>
            </div>
            <p className="text-amber-400 font-semibold text-sm">
              {formatMoney(product.revenue)}
            </p>
          </div>
        ))
      )}
    </div>
  </div>
);

const RecentActivity = ({
  activities,
}: {
  activities: {
    type: string;
    description: string;
    time: string;
    amount?: number;
  }[];
}) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
    <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
    <div className="space-y-4">
      {activities.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          No recent activity
        </p>
      ) : (
        activities.map((activity, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-2 h-2 bg-amber-400 rounded-full mt-2" />
            <div className="flex-1">
              <p className="text-white text-sm">{activity.description}</p>
              <p className="text-gray-500 text-xs">{activity.time}</p>
            </div>
            {activity.amount && (
              <p className="text-emerald-400 font-medium text-sm">
                {formatMoney(activity.amount)}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  </div>
);

const PaymentBreakdown = ({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) => {
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const methods = [
    { key: "cash", label: "Cash", color: "bg-emerald-500" },
    { key: "mpesa", label: "M-PESA", color: "bg-blue-500" },
    { key: "card", label: "Card", color: "bg-purple-500" },
    { key: "credit", label: "Credit", color: "bg-amber-500" },
  ];

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Payment Methods</h3>
      <div className="space-y-3">
        {methods.map(({ key, label, color }) => {
          const value = breakdown[key] || 0;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">{label}</span>
                <span className="text-white font-medium">
                  {formatMoney(value)}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Main Component
export default function EnhancedDashboard() {
  const { currentStation } = useStations();
  const [dateRange, setDateRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    inventoryValue: 0,
    totalCustomers: 0,
    totalOrders: 0,
    salesChange: 0,
    expensesChange: 0,
    salesTrend: [] as { label: string; value: number }[],
    topProducts: [] as { name: string; quantity: number; revenue: number }[],
    paymentBreakdown: {} as Record<string, number>,
    recentActivity: [] as {
      type: string;
      description: string;
      time: string;
      amount?: number;
    }[],
  });

  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate: Date;
    const endDate = now.toISOString();

    switch (dateRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      startDate: startDate.toISOString(),
      endDate,
    };
  }, [dateRange]);

  const loadDashboardData = useCallback(async () => {
    if (!currentStation?.id) return;

    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      const [salesData, expensesData, inventoryData] = await Promise.all([
        fetchSalesReport(currentStation.id, startDate, endDate),
        fetchExpensesReport(currentStation.id, startDate, endDate),
        fetchInventoryValuation(currentStation.id),
      ]);

      // Calculate real sales trend from actual data
      const trendEnd = new Date();
      const trendStart = new Date();
      trendStart.setDate(trendStart.getDate() - 6);

      const { data: dailySales } = await supabase
        .from("sales_enhanced")
        .select("sale_date, total_amount")
        .eq("station_id", currentStation.id)
        .gte("sale_date", trendStart.toISOString().split("T")[0])
        .lte("sale_date", trendEnd.toISOString().split("T")[0])
        .order("sale_date", { ascending: true });

      // Initialize all 7 days
      const salesByDay: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split("T")[0];
        salesByDay[key] = 0;
      }

      // Fill in actual sales
      if (dailySales) {
        dailySales.forEach((sale: any) => {
          const key = new Date(sale.sale_date).toISOString().split("T")[0];
          if (salesByDay[key] !== undefined) {
            salesByDay[key] += sale.total_amount || 0;
          }
        });
      }

      const salesTrend = Object.entries(salesByDay).map(([date, value]) => ({
        label: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
        value: value,
      }));

      // Calculate previous period for comparison
      const prevEnd = new Date(trendStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 7);

      const { data: prevSales } = await supabase
        .from("sales_enhanced")
        .select("total_amount")
        .eq("station_id", currentStation.id)
        .gte("sale_date", prevStart.toISOString().split("T")[0])
        .lte("sale_date", prevEnd.toISOString().split("T")[0]);

      const currentTotal = salesData.totalRevenue || 0;
      const prevTotal =
        prevSales?.reduce(
          (sum: number, s: any) => sum + (s.total_amount || 0),
          0,
        ) || 0;
      const salesChange =
        prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

      const { data: prevExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .eq("station_id", currentStation.id)
        .gte("expense_date", prevStart.toISOString().split("T")[0])
        .lte("expense_date", prevEnd.toISOString().split("T")[0]);

      const currentExpenses = expensesData.totalExpenses || 0;
      const prevExpensesTotal =
        prevExpenses?.reduce(
          (sum: number, e: any) => sum + (e.amount || 0),
          0,
        ) || 0;
      const expensesChange =
        prevExpensesTotal > 0
          ? ((currentExpenses - prevExpensesTotal) / prevExpensesTotal) * 100
          : 0;

      // Fetch top products from POS sales
      const { data: productSales } = await supabase
        .from("pos_sales_items")
        .select("product_id, quantity, unit_price, products(name)")
        .eq("station_id", currentStation.id)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      const productTotals: Record<
        string,
        { name: string; quantity: number; revenue: number }
      > = {};
      if (productSales) {
        productSales.forEach((item: any) => {
          const key = item.product_id;
          if (!productTotals[key]) {
            productTotals[key] = {
              name: item.products?.name || "Unknown Product",
              quantity: 0,
              revenue: 0,
            };
          }
          productTotals[key].quantity += item.quantity || 0;
          productTotals[key].revenue +=
            (item.quantity || 0) * (item.unit_price || 0);
        });
      }
      const topProducts = Object.values(productTotals)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Fetch customer count
      const { count: customerCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("station_id", currentStation.id);

      setDashboardData({
        totalSales: currentTotal,
        totalExpenses: currentExpenses,
        netProfit: currentTotal - currentExpenses,
        inventoryValue: inventoryData.totalValue,
        totalCustomers: customerCount || 0,
        totalOrders: salesData.sales.length,
        salesChange,
        expensesChange,
        salesTrend,
        topProducts,
        paymentBreakdown: salesData.paymentBreakdown,
        recentActivity: salesData.sales.slice(0, 5).map((sale: any) => ({
          type: "sale",
          description: `Sale #${sale.invoice_number || sale.id}`,
          time: new Date(sale.created_at || sale.sale_date).toLocaleString(),
          amount: sale.total_amount,
        })),
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      // Set fallback data on error
      setDashboardData((prev) => ({
        ...prev,
        salesTrend: Array(7).fill({ label: "", value: 0 }),
        salesChange: 0,
        expensesChange: 0,
        topProducts: [],
      }));
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id, getDateRange]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const kpis = useMemo(
    () => [
      {
        title: "Total Sales",
        value: formatMoney(dashboardData.totalSales),
        change: dashboardData.salesChange,
        icon: DollarSign,
        color: "bg-emerald-500",
        trend: "up" as const,
      },
      {
        title: "Total Expenses",
        value: formatMoney(dashboardData.totalExpenses),
        change: dashboardData.expensesChange,
        icon: ShoppingCart,
        color: "bg-red-500",
        trend: "down" as const,
      },
      {
        title: "Net Profit",
        value: formatMoney(dashboardData.netProfit),
        change: dashboardData.netProfit >= 0 ? 8.2 : -8.2,
        icon: TrendingUp,
        color: "bg-amber-500",
        trend:
          dashboardData.netProfit >= 0 ? ("up" as const) : ("down" as const),
      },
      {
        title: "Inventory Value",
        value: formatMoney(dashboardData.inventoryValue),
        change: 0,
        icon: Package,
        color: "bg-blue-500",
        trend: "neutral" as const,
      },
    ],
    [dashboardData],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Welcome back! Here&apos;s what&apos;s happening with your business.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
          {DATE_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setDateRange(range.value)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                dateRange === range.value
                  ? "bg-amber-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart data={dashboardData.salesTrend} />
        </div>
        <div>
          <PaymentBreakdown breakdown={dashboardData.paymentBreakdown} />
        </div>
      </div>

      {/* Products & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProducts products={dashboardData.topProducts} />
        <RecentActivity activities={dashboardData.recentActivity} />
      </div>
    </div>
  );
}
