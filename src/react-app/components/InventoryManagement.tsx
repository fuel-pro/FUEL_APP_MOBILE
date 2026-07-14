import { useState, useMemo } from "react";
import { useFuel } from "@/react-app/context/FuelContext";
import { useLocation } from "@/react-app/context/LocationContext";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  History,
  Settings,
  Download,
  Search,
  Filter,
  ChevronDown,
  BarChart3,
  Trash2,
  Edit3,
} from "lucide-react";
import { formatNumber } from "@/react-app/utils/formatUtils";

interface StockItem {
  id: string;
  name: string;
  category: "fuel" | "lubricant" | "accessory" | "service" | "other";
  quantity: number;
  unit: string;
  reorderLevel: number;
  maxStock: number;
  unitCost: number;
  sellingPrice: number;
  supplier: string;
  lastRestocked: string;
  expiryDate?: string;
  notes: string;
}

interface StockMovement {
  id: string;
  itemId: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  reason: string;
  timestamp: string;
  user: string;
}

export default function InventoryManagement() {
  const { state } = useFuel();
  const location = useLocation();
  const [items, setItems] = useState<StockItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fuelpro_inventory") || "[]");
    } catch {
      return defaultItems();
    }
  });
  const [movements, setMovements] = useState<StockMovement[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("fuelpro_inventory_movements") || "[]"
      );
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [showMovements, setShowMovements] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    itemId: "",
    qty: 0,
    reason: "",
    type: "in" as "in" | "out",
  });

  const currencySymbol = location.currencySymbol;

  // Save to localStorage
  const saveItems = (newItems: StockItem[]) => {
    setItems(newItems);
    localStorage.setItem("fuelpro_inventory", JSON.stringify(newItems));
  };
  const saveMovements = (newMovs: StockMovement[]) => {
    setMovements(newMovs);
    localStorage.setItem(
      "fuelpro_inventory_movements",
      JSON.stringify(newMovs.slice(-200))
    );
  };

  // Fuel tank inventory from main state
  const fuelInventory = useMemo(
    () => [
      {
        id: "pms_tank",
        name: "Petrol (PMS) - Tank",
        category: "fuel" as const,
        quantity: state.pmsTankClosing - state.pmsTankOpening,
        unit: "Litres",
        reorderLevel: 500,
        maxStock: 20000,
        unitCost: state.pmsPrice * 0.7,
        sellingPrice: state.pmsPrice,
        supplier: "Main Supplier",
        lastRestocked: state.salesDate,
        notes: "Underground tank",
      },
      {
        id: "ago_tank",
        name: "Diesel (AGO) - Tank",
        category: "fuel" as const,
        quantity: state.agoTankClosing - state.agoTankOpening,
        unit: "Litres",
        reorderLevel: 500,
        maxStock: 20000,
        unitCost: state.agoPrice * 0.7,
        sellingPrice: state.agoPrice,
        supplier: "Main Supplier",
        lastRestocked: state.salesDate,
        notes: "Underground tank",
      },
    ],
    [state]
  );

  const allItems = useMemo(
    () => [...fuelInventory, ...items],
    [fuelInventory, items]
  );

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.supplier.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        filterCategory === "all" || item.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allItems, search, filterCategory]);

  const lowStock = filtered.filter(i => i.quantity <= i.reorderLevel);
  const totalValue = filtered.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  function addMovement(
    itemId: string,
    type: "in" | "out" | "adjustment",
    quantity: number,
    reason: string
  ) {
    const mov: StockMovement = {
      id: `mov_${Date.now()}`,
      itemId,
      type,
      quantity,
      reason,
      timestamp: new Date().toISOString(),
      user: "Current User",
    };
    saveMovements([mov, ...movements]);
  }

  function adjustStock(
    itemId: string,
    qty: number,
    type: "in" | "out",
    reason: string
  ) {
    const updated = items.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          quantity:
            type === "in" ? i.quantity + qty : Math.max(0, i.quantity - qty),
          lastRestocked: new Date().toISOString().split("T")[0],
        };
      }
      return i;
    });
    saveItems(updated);
    addMovement(itemId, type, qty, reason);
    setAdjustForm({ itemId: "", qty: 0, reason: "", type: "in" });
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Package size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Inventory Management
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track stock, manage reorders, monitor levels
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500">Total SKUs</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {allItems.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500">Inventory Value</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {currencySymbol} {formatNumber(totalValue, 0)}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-200 dark:border-red-800 shadow-sm">
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertTriangle size={12} /> Low Stock Alerts
          </p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {lowStock.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500">Fuel Available</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatNumber(
              fuelInventory.reduce((s, f) => s + f.quantity, 0),
              0
            )}{" "}
            L
          </p>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle size={16} /> Low Stock Alerts
          </h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(item => (
              <span
                key={item.id}
                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium"
              >
                {item.name}: {formatNumber(item.quantity)} {item.unit} (reorder
                at {item.reorderLevel})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search inventory..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
        >
          <option value="all">All Categories</option>
          <option value="fuel">Fuel</option>
          <option value="lubricant">Lubricants</option>
          <option value="accessory">Accessories</option>
          <option value="service">Services</option>
          <option value="other">Other</option>
        </select>
        <button
          onClick={() => setShowMovements(!showMovements)}
          className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-sm flex items-center gap-2 transition-colors dark:text-white"
        >
          <History size={16} /> Movements
        </button>
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Item
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Category
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Stock
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Unit Cost
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Selling Price
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Value
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const pct = Math.min(
                  100,
                  (item.quantity / item.maxStock) * 100
                );
                const isLow = item.quantity <= item.reorderLevel;
                const isCrit = item.quantity <= item.reorderLevel * 0.5;
                return (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {item.supplier}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-[11px] capitalize dark:text-gray-300">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold dark:text-white">
                        {formatNumber(item.quantity)}
                      </p>
                      <p className="text-[11px] text-gray-500">{item.unit}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {currencySymbol} {formatNumber(item.unitCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {currencySymbol} {formatNumber(item.sellingPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                      {currencySymbol}{" "}
                      {formatNumber(item.quantity * item.unitCost, 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                        <div
                          className={`h-full rounded-full ${isCrit ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-green-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={`text-[10px] ${isCrit ? "text-red-600" : isLow ? "text-amber-600" : "text-green-600"}`}
                      >
                        {isCrit ? "Critical" : isLow ? "Low" : "OK"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() =>
                            setAdjustForm({ ...adjustForm, itemId: item.id })
                          }
                          className="p-1.5 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 rounded-lg text-green-600"
                          title="Adjust Stock"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Form */}
      {adjustForm.itemId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">
            Stock Adjustment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={adjustForm.type}
              onChange={e =>
                setAdjustForm({
                  ...adjustForm,
                  type: e.target.value as "in" | "out",
                })
              }
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            >
              <option value="in">Stock In (Received)</option>
              <option value="out">Stock Out (Issued)</option>
            </select>
            <input
              type="number"
              placeholder="Quantity"
              value={adjustForm.qty || ""}
              onChange={e =>
                setAdjustForm({
                  ...adjustForm,
                  qty: parseFloat(e.target.value) || 0,
                })
              }
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="Reason (e.g., delivery, damage)"
              value={adjustForm.reason}
              onChange={e =>
                setAdjustForm({ ...adjustForm, reason: e.target.value })
              }
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={() =>
                adjustStock(
                  adjustForm.itemId,
                  adjustForm.qty,
                  adjustForm.type,
                  adjustForm.reason || "Manual adjustment"
                )
              }
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Apply Adjustment
            </button>
          </div>
        </div>
      )}

      {/* Stock Movements */}
      {showMovements && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">
            Stock Movements (Last 50)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-3 py-2">Time</th>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-left px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 50).map(m => {
                  const item = allItems.find(i => i.id === m.itemId);
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-3 py-2 text-gray-500">
                        {new Date(m.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 dark:text-white">
                        {item?.name || m.itemId}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded ${m.type === "in" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {m.type === "in" ? "IN" : "OUT"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold dark:text-white">
                        {formatNumber(m.quantity)}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{m.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultItems(): StockItem[] {
  return [];
}
