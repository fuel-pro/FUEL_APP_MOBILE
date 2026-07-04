import { useState, useEffect } from "react";
import {
  Monitor,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  History,
  RefreshCw,
  Fuel,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useAutoSync } from "@/react-app/hooks/useAutoSync";
import { useLocation } from "@/react-app/context/LocationContext";

interface PriceEntry {
  id: string;
  fuelType: string;
  grade: string;
  price: number;
  previousPrice: number;
  currency: string;
  displayOrder: number;
  isActive: boolean;
  effectiveDate: string;
  updatedBy: string;
  updatedAt: string;
}

interface PriceHistory {
  id: string;
  priceEntryId: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason: string;
  changedAt: string;
}

const STORAGE_KEY = "fuelpro_priceboard_v2";
const HISTORY_KEY = "fuelpro_price_history_v2";

const FUEL_GRADES: Record<string, string[]> = {
  Petrol: ["Regular", "Premium", "V-Power"],
  Diesel: ["Regular", "Premium", "Bio-Diesel"],
  Kerosene: ["Standard", "Premium"],
  LPG: ["3kg", "6kg", "13kg", "25kg"],
};

function loadPrices(): PriceEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return [];
}

function loadHistory(): PriceHistory[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return [];
}

export default function PriceBoard() {
  const location = useLocation();
  const { fuelPrice, isSyncing, syncNow, refreshPrices, arePricesStale } = useAutoSync(location.currentCountry.id);
  const [prices, setPrices] = useState<PriceEntry[]>(loadPrices);
  const [history, setHistory] = useState<PriceHistory[]>(loadHistory);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "warning";
  } | null>(null);
  const [formData, setFormData] = useState<Partial<PriceEntry>>({
    fuelType: "Petrol",
    grade: "Regular",
    price: 0,
    currency: "KES",
    displayOrder: 0,
    isActive: true,
    effectiveDate: new Date().toISOString().slice(0, 10),
  });
  const [changeReason, setChangeReason] = useState("");
  const [showAutoUpdateNotice, setShowAutoUpdateNotice] = useState(false);

  // Update prices when fuelPrice syncs (daily EPRA prices)
  useEffect(() => {
    if (!fuelPrice) return;
    
    // Check if we should auto-update from synced prices
    const autoUpdateEnabled = localStorage.getItem("fuelpro_price_auto_update") !== "disabled";
    if (!autoUpdateEnabled) return;
    
    // Get current local prices
    const currentPrices = loadPrices();
    const today = new Date().toISOString().slice(0, 10);
    
    // Only auto-update if fuel price effective date is today or more recent
    if (fuelPrice.effectiveDate >= today) {
      // Check if prices need updating
      let needsUpdate = false;
      const newPrices = [...currentPrices];
      
      // Map EPRA prices to our entries
      if (fuelPrice.petrolPrice > 0) {
        const petrolEntry = newPrices.find(p => p.fuelType === "Petrol" && p.isActive);
        if (petrolEntry && petrolEntry.price !== fuelPrice.petrolPrice) {
          // Log history before updating
          const historyEntry: PriceHistory = {
            id: `ph_${Date.now()}_auto`,
            priceEntryId: petrolEntry.id,
            oldPrice: petrolEntry.price,
            newPrice: fuelPrice.petrolPrice,
            changedBy: "System (EPRA Auto-Sync)",
            reason: `Auto-updated from EPRA Kenya - ${fuelPrice.sourceName}`,
            changedAt: new Date().toISOString(),
          };
          setHistory(prev => [...prev, historyEntry]);
          
          petrolEntry.previousPrice = petrolEntry.price;
          petrolEntry.price = fuelPrice.petrolPrice;
          petrolEntry.effectiveDate = fuelPrice.effectiveDate;
          petrolEntry.updatedAt = new Date().toISOString();
          petrolEntry.updatedBy = "System";
          needsUpdate = true;
        }
      }
      
      if (fuelPrice.dieselPrice > 0) {
        const dieselEntry = newPrices.find(p => p.fuelType === "Diesel" && p.isActive);
        if (dieselEntry && dieselEntry.price !== fuelPrice.dieselPrice) {
          // Log history
          const historyEntry: PriceHistory = {
            id: `ph_${Date.now()}_auto_d`,
            priceEntryId: dieselEntry.id,
            oldPrice: dieselEntry.price,
            newPrice: fuelPrice.dieselPrice,
            changedBy: "System (EPRA Auto-Sync)",
            reason: `Auto-updated from EPRA Kenya - ${fuelPrice.sourceName}`,
            changedAt: new Date().toISOString(),
          };
          setHistory(prev => [...prev, historyEntry]);
          
          dieselEntry.previousPrice = dieselEntry.price;
          dieselEntry.price = fuelPrice.dieselPrice;
          dieselEntry.effectiveDate = fuelPrice.effectiveDate;
          dieselEntry.updatedAt = new Date().toISOString();
          dieselEntry.updatedBy = "System";
          needsUpdate = true;
        }
      }
      
      if (fuelPrice.kerosenePrice && fuelPrice.kerosenePrice > 0) {
        const keroseneEntry = newPrices.find(p => p.fuelType === "Kerosene" && p.isActive);
        if (keroseneEntry && keroseneEntry.price !== fuelPrice.kerosenePrice) {
          // Log history
          const historyEntry: PriceHistory = {
            id: `ph_${Date.now()}_auto_k`,
            priceEntryId: keroseneEntry.id,
            oldPrice: keroseneEntry.price,
            newPrice: fuelPrice.kerosenePrice!,
            changedBy: "System (EPRA Auto-Sync)",
            reason: `Auto-updated from EPRA Kenya - ${fuelPrice.sourceName}`,
            changedAt: new Date().toISOString(),
          };
          setHistory(prev => [...prev, historyEntry]);
          
          keroseneEntry.previousPrice = keroseneEntry.price;
          keroseneEntry.price = fuelPrice.kerosenePrice!;
          keroseneEntry.effectiveDate = fuelPrice.effectiveDate;
          keroseneEntry.updatedAt = new Date().toISOString();
          keroseneEntry.updatedBy = "System";
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        setPrices(newPrices);
        setShowAutoUpdateNotice(true);
        setTimeout(() => setShowAutoUpdateNotice(false), 5000);
      }
    }
  }, [fuelPrice]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
  }, [prices]);
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const showNotification = (
    message: string,
    type: "success" | "warning" = "success"
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = () => {
    if (!formData.fuelType || !formData.grade || !formData.price) {
      showNotification("Fuel type, grade, and price are required", "warning");
      return;
    }
    if (editingId) {
      const old = prices.find(p => p.id === editingId);
      setPrices(prev =>
        prev.map(p =>
          p.id === editingId
            ? {
                ...p,
                ...(formData as PriceEntry),
                previousPrice: old?.price || p.price,
                updatedAt: new Date().toISOString(),
                updatedBy: "Manager",
              }
            : p
        )
      );
      // Log history
      if (old && old.price !== formData.price) {
        const newHistory: PriceHistory = {
          id: `ph_${Date.now()}`,
          priceEntryId: editingId,
          oldPrice: old.price,
          newPrice: formData.price!,
          changedBy: "Manager",
          reason: changeReason || "Price update",
          changedAt: new Date().toISOString(),
        };
        setHistory(prev => [newHistory, ...prev]);
      }
      showNotification("Price updated");
    } else {
      const newEntry: PriceEntry = {
        ...(formData as PriceEntry),
        id: `pb_${Date.now()}`,
        previousPrice: formData.price!,
        updatedBy: "Manager",
        updatedAt: new Date().toISOString(),
      };
      setPrices(prev => [...prev, newEntry]);
      showNotification("Price entry added");
    }
    setShowForm(false);
    setEditingId(null);
    setChangeReason("");
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this price entry?")) {
      setPrices(prev => prev.filter(p => p.id !== id));
      showNotification("Price entry deleted");
    }
  };

  const toggleActive = (id: string) => {
    setPrices(prev =>
      prev.map(p => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const sortedPrices = [...prices].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const priceChange = (current: number, previous: number) => {
    const diff = current - previous;
    const pct = previous > 0 ? (diff / previous) * 100 : 0;
    return { diff, pct, up: diff >= 0 };
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2 ${notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span className="text-sm">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Monitor size={22} className="text-amber-500" /> Price Board
            {isSyncing && <RefreshCw size={16} className="text-blue-500 animate-spin" />}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {fuelPrice ? (
              <>EPRA prices as of {fuelPrice.effectiveDate} • Auto-updates daily</>
            ) : (
              <>Manage fuel prices displayed to customers</>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Auto-update status indicator */}
          <div className="flex items-center gap-1.5 mr-2">
            <div className={`w-2 h-2 rounded-full ${arePricesStale ? 'bg-amber-500' : 'bg-green-500'}`}></div>
            <span className="text-xs text-gray-500">{arePricesStale ? 'Prices need update' : 'Prices current'}</span>
          </div>
          <button
            onClick={() => refreshPrices()}
            disabled={isSyncing}
            className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> Refresh Prices
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all"
          >
            <History size={14} /> History
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all"
          >
            {showPreview ? (
              <>
                <EyeOff size={14} /> Hide Preview
              </>
            ) : (
              <>
                <Eye size={14} /> Preview
              </>
            )}
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData({
                fuelType: "Petrol",
                grade: "Regular",
                price: 0,
                currency: "KES",
                displayOrder: prices.length + 1,
                isActive: true,
                effectiveDate: new Date().toISOString().slice(0, 10),
              });
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} /> Add Price
          </button>
        </div>
      </div>
      
      {/* Auto-update notification */}
      {showAutoUpdateNotice && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-500" />
          <div>
            <p className="text-sm font-medium text-green-400">Prices Auto-Updated from EPRA</p>
            <p className="text-xs text-green-400/70">Fuel prices have been synced with the latest government rates</p>
          </div>
        </div>
      )}

      {/* Digital Price Board Preview */}
      {showPreview && (
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Fuel size={16} className="text-white" />
              </div>
              <span className="text-white font-bold text-lg">FuelPro</span>
            </div>
            <span className="text-gray-400 text-xs">
              {new Date().toLocaleDateString()}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sortedPrices
              .filter(p => p.isActive)
              .map(price => {
                const change = priceChange(price.price, price.previousPrice);
                return (
                  <div
                    key={price.id}
                    className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center"
                  >
                    <p className="text-xs text-gray-400 uppercase tracking-wider">
                      {price.fuelType} {price.grade}
                    </p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {price.currency} {price.price.toFixed(2)}
                    </p>
                    <div
                      className={`flex items-center justify-center gap-1 mt-1 text-xs ${change.up ? "text-red-400" : "text-emerald-400"}`}
                    >
                      {change.up ? (
                        <ArrowUpRight size={12} />
                      ) : (
                        <ArrowDownRight size={12} />
                      )}
                      <span>
                        {change.pct.toFixed(1)}% ({change.diff >= 0 ? "+" : ""}
                        {change.diff.toFixed(2)})
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="text-center text-[10px] text-gray-500 mt-3">
            Prices per liter | Subject to change without notice
          </p>
        </div>
      )}

      {/* Price Management Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Fuel Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Grade
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Previous
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Change
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPrices.map(price => {
                const change = priceChange(price.price, price.previousPrice);
                return (
                  <tr
                    key={price.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/20"
                  >
                    <td className="px-4 py-3 text-gray-500">
                      {price.displayOrder}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {price.fuelType}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {price.grade}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {price.currency} {price.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {price.currency} {price.previousPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`flex items-center justify-center gap-1 text-xs ${change.up ? "text-red-500" : "text-emerald-500"}`}
                      >
                        {change.up ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )}
                        {change.pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(price.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${price.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-500/10 text-gray-500"}`}
                      >
                        {price.isActive ? "Active" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(price.id);
                            setFormData(price);
                            setChangeReason("");
                            setShowForm(true);
                          }}
                          className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg transition-colors"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(price.id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {prices.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No price entries
          </div>
        )}
      </div>

      {/* Price Change Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingId ? "Update" : "Add"} Price
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Fuel Type
                    </label>
                    <select
                      value={formData.fuelType}
                      onChange={e =>
                        setFormData({ ...formData, fuelType: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {Object.keys(FUEL_GRADES).map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Grade
                    </label>
                    <select
                      value={formData.grade}
                      onChange={e =>
                        setFormData({ ...formData, grade: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {(
                        FUEL_GRADES[
                          formData.fuelType as keyof typeof FUEL_GRADES
                        ] || []
                      ).map(g => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price || ""}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          price: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={e =>
                        setFormData({ ...formData, currency: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {[
                        "KES",
                        "UGX",
                        "TZS",
                        "NGN",
                        "ZAR",
                        "GHS",
                        "RWF",
                        "ETB",
                        "USD",
                        "GBP",
                        "EUR",
                        "INR",
                        "BRL",
                        "CNY",
                        "JPY",
                        "AUD",
                        "CAD",
                      ].map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {editingId && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Reason for Change
                    </label>
                    <input
                      value={changeReason}
                      onChange={e => setChangeReason(e.target.value)}
                      placeholder="e.g. Monthly price review"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        effectiveDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        displayOrder: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleSave}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <History size={18} /> Price Change History
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {history.map(h => {
                  const entry = prices.find(p => p.id === h.priceEntryId);
                  const diff = h.newPrice - h.oldPrice;
                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry?.fuelType} {entry?.grade}
                        </p>
                        <p className="text-xs text-gray-500">
                          {h.reason} &middot; {h.changedBy}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 line-through">
                            {h.oldPrice.toFixed(2)}
                          </span>
                          <ArrowUpRight size={12} className="text-gray-400" />
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {h.newPrice.toFixed(2)}
                          </span>
                        </div>
                        <span
                          className={`text-xs ${diff >= 0 ? "text-red-500" : "text-emerald-500"}`}
                        >
                          {diff >= 0 ? "+" : ""}
                          {diff.toFixed(2)}
                        </span>
                        <p className="text-[10px] text-gray-400">
                          {new Date(h.changedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {history.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No price changes recorded
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
