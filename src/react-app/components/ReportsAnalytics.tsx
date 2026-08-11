/**
 * ReportsAnalytics.tsx
 * Reports: P&L, payment breakdown, top products, inventory valuation, CSV exports.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Loader2,
  TrendingUp,
  DollarSign,
  Package,
  BarChart3,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { useFuel } from "@/react-app/context/FuelContext";
import {
  fetchSalesReport,
  fetchExpensesReport,
  fetchInventoryValuation,
} from "@/react-app/lib/pos-service";

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "This Week", days: 7 },
  { label: "This Month", days: 30 },
  { label: "This Year", days: 365 },
];

export default function ReportsAnalytics() {
  const { currentStation } = useStations();
  const { state } = useFuel();
  // Wire: use station-configured currency instead of hardcoded "KES"
  const stationCurrency = state.companyData.currency || "KSh";
  const stationCurrencyCode =
    stationCurrency === "KSh" || stationCurrency === "KES" ? "KES" :
    stationCurrency === "$" || stationCurrency === "USD" ? "USD" : "KES";

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: stationCurrencyCode,
    minimumFractionDigits: 0,
  }).format(amount);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState("month");
  const [reportData, setReportData] = useState<any>({
    sales: [],
    totalRevenue: 0,
    totalTax: 0,
    paymentBreakdown: {},
    expenses: [],
    totalExpenses: 0,
    categoryBreakdown: {},
    inventory: { products: [], totalValue: 0 },
  });

  const getDateRange = (preset: string) => {
    const end = new Date().toISOString();
    let start: string;
    const now = new Date();
    switch (preset) {
      case "today":
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ).toISOString();
        break;
      case "week":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1).toISOString();
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    return { start, end };
  };

  const loadReport = useCallback(async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      const { start, end } = getDateRange(datePreset);
      const [salesData, expensesData, inventoryData] = await Promise.all([
        fetchSalesReport(currentStation.id, start, end),
        fetchExpensesReport(currentStation.id, start, end),
        fetchInventoryValuation(currentStation.id),
      ]);
      setReportData({
        ...salesData,
        ...expensesData,
        inventory: inventoryData,
      });
    } catch (error) {
      console.error("Failed:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id, datePreset]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const netProfit = reportData.totalRevenue - reportData.totalExpenses;
  const topProducts = reportData.sales.reduce(
    (acc: Record<string, any>, sale: any) => {
      sale.sale_items?.forEach((item: any) => {
        if (!acc[item.product_name])
          acc[item.product_name] = {
            name: item.product_name,
            quantity: 0,
            revenue: 0,
          };
        acc[item.product_name].quantity += item.quantity;
        acc[item.product_name].revenue += item.total_amount;
      });
      return acc;
    },
    {},
  );

  const exportCSV = (type: string) => {
    let csv = "";
    if (type === "sales") {
      csv = "Invoice,Date,Customer,Payment,Subtotal,Tax,Total\n";
      reportData.sales.forEach((s: any) => {
        csv += `${s.invoice_number || ""},${s.created_at},${s.customers?.name || "Walk-in"},${s.payment_method},${s.subtotal},${s.tax_amount},${s.total_amount}\n`;
      });
    } else if (type === "expenses") {
      csv = "Date,Category,Description,Amount,Payment\n";
      reportData.expenses.forEach((e: any) => {
        csv += `${e.expense_date},${e.category},${e.description},${e.amount},${e.payment_method}\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
        <div className="flex gap-2">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() =>
                setDatePreset(preset.label.toLowerCase().replace(" ", "-"))
              }
              className={`px-4 py-2 rounded-xl text-sm font-medium ${datePreset === preset.label.toLowerCase().replace(" ", "-") ? "bg-amber-500 text-white" : "bg-white/5 text-gray-400"}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="text-emerald-400" size={20} />
            <span className="text-gray-400 text-sm">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatMoney(reportData.totalRevenue)}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-red-400" size={20} />
            <span className="text-gray-400 text-sm">Total Expenses</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatMoney(reportData.totalExpenses)}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="text-amber-400" size={20} />
            <span className="text-gray-400 text-sm">Net Profit</span>
          </div>
          <p
            className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {formatMoney(netProfit)}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Package className="text-blue-400" size={20} />
            <span className="text-gray-400 text-sm">Inventory Value</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatMoney(reportData.inventory?.totalValue || 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Breakdown */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Payment Breakdown</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(reportData.paymentBreakdown).map(
              ([method, amount]) => (
                <div key={method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 capitalize">{method}</span>
                    <span className="text-white font-medium">
                      {formatMoney(amount as number)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${method === "cash" ? "bg-emerald-500" : method === "mpesa" ? "bg-blue-500" : "bg-purple-500"}`}
                      style={{
                        width: `${reportData.totalRevenue > 0 ? ((amount as number) / reportData.totalRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
          <button
            onClick={() => exportCSV("sales")}
            className="w-full mt-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm flex items-center justify-center gap-2"
          >
            <Download size={16} /> Export Sales CSV
          </button>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Expense Breakdown</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(reportData.categoryBreakdown).map(
              ([category, amount]) => (
                <div key={category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{category}</span>
                    <span className="text-white font-medium">
                      {formatMoney(amount as number)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{
                        width: `${reportData.totalExpenses > 0 ? ((amount as number) / reportData.totalExpenses) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
          <button
            onClick={() => exportCSV("expenses")}
            className="w-full mt-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm flex items-center justify-center gap-2"
          >
            <Download size={16} /> Export Expenses CSV
          </button>
        </div>

        {/* Top Products */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4">
            Top Selling Products
          </h3>
          <div className="space-y-3">
            {Object.values(topProducts)
              .slice(0, 5)
              .map((product: any, index) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400 font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-white text-sm">{product.name}</p>
                      <p className="text-gray-500 text-xs">
                        {product.quantity} sold
                      </p>
                    </div>
                  </div>
                  <span className="text-amber-400 font-medium">
                    {formatMoney(product.revenue)}
                  </span>
                </div>
              ))}
            {Object.keys(topProducts).length === 0 && (
              <p className="text-gray-400 text-center py-4">No sales data</p>
            )}
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4">Inventory Valuation</h3>
          <div className="space-y-2">
            {reportData.inventory?.products
              ?.slice(0, 10)
              .map((product: any) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div>
                    <p className="text-white text-sm">{product.name}</p>
                    <p className="text-gray-500 text-xs">
                      {product.stock_quantity} units
                    </p>
                  </div>
                  <span className="text-gray-300">
                    {formatMoney(
                      (product.stock_quantity || 0) * (product.cost_price || 0),
                    )}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
