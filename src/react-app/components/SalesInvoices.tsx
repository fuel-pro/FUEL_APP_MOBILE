/**
 * SalesInvoices.tsx
 * Sales listing with search, date filter, and invoice detail modal.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Search, Calendar, Download, X, FileText, Loader2 } from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { fetchSales } from "@/react-app/lib/pos-service";

const formatMoney = (amount: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(amount);

export default function SalesInvoices() {
  const { currentStation } = useStations();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);

  const loadSales = useCallback(async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      const data = await fetchSales(currentStation.id, startDate || undefined, endDate || undefined);
      setSales(data);
    } catch (error) {
      console.error("Failed to load sales:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id, startDate, endDate]);

  useEffect(() => { loadSales(); }, [loadSales]);

  const filteredSales = sales.filter((s) => !search || s.invoice_number?.toLowerCase().includes(search.toLowerCase()));

  const totalSales = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center h-full">
        <div className="text-center"><Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" /><p className="text-gray-400">Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales & Invoices</h1>
          <p className="text-gray-400 text-sm mt-1">{filteredSales.length} sales • {formatMoney(totalSales)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search by invoice..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
        </div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Invoice</th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Date</th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Customer</th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Payment</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">Amount</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12"><FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No sales found</p></td></tr>
            ) : filteredSales.map((sale) => (
              <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-4"><span className="text-white font-medium">{sale.invoice_number || "N/A"}</span></td>
                <td className="px-4 py-4 text-gray-300 text-sm">{new Date(sale.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-4 text-gray-300 text-sm">{sale.customers?.name || "Walk-in"}</td>
                <td className="px-4 py-4"><span className={`text-xs px-2 py-1 rounded-full ${sale.payment_method === "cash" ? "bg-emerald-500/20 text-emerald-400" : sale.payment_method === "mpesa" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>{sale.payment_method}</span></td>
                <td className="px-4 py-4 text-right text-amber-400 font-medium">{formatMoney(sale.total_amount)}</td>
                <td className="px-4 py-4 text-right"><button onClick={() => setSelectedSale(sale)} className="text-gray-400 hover:text-white">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSale(null)}>
          <div className="bg-gray-800 rounded-2xl w-full max-w-lg border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">Invoice {selectedSale.invoice_number}</h3>
              <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between"><span className="text-gray-400">Date</span><span className="text-white">{new Date(selectedSale.created_at).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Customer</span><span className="text-white">{selectedSale.customers?.name || "Walk-in"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Payment</span><span className="text-white">{selectedSale.payment_method}</span></div>
              {selectedSale.payment_reference && <div className="flex justify-between"><span className="text-gray-400">Reference</span><span className="text-white">{selectedSale.payment_reference}</span></div>}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-gray-400 text-sm mb-2">Items</h4>
                {selectedSale.sale_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-white">{item.product_name} x{item.quantity}</span>
                    <span className="text-amber-400">{formatMoney(item.total_amount)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="text-white">{formatMoney(selectedSale.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Tax</span><span className="text-white">{formatMoney(selectedSale.tax_amount)}</span></div>
                {selectedSale.discount_amount > 0 && <div className="flex justify-between"><span className="text-gray-400">Discount</span><span className="text-emerald-400">-{formatMoney(selectedSale.discount_amount)}</span></div>}
                <div className="flex justify-between text-lg"><span className="text-white font-semibold">Total</span><span className="text-amber-400 font-bold">{formatMoney(selectedSale.total_amount)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
