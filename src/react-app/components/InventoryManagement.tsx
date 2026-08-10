/**
 * InventoryManagement.tsx
 * Handles stock adjustments, transfers, counts, and wastage.
 * All subcomponents are module-scoped (UPDATE-4 rule).
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  X,
  Loader2,
  CheckCircle,
  ArrowUpDown,
  Package,
  ArrowRight,
  Scale,
  Trash2,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { supabase } from "@/supabase/client";
import {
  adjustStock,
  createStockTransfer,
  completeStockTransfer,
  processStockCount,
  recordWastage,
  fetchProducts,
  fetchInventoryTransactions,
} from "@/react-app/lib/pos-service";

// Tab types
type InventoryTab =
  "adjustments" | "transfers" | "counts" | "wastage" | "history";

const TABS = [
  { id: "adjustments", label: "Adjustments" },
  { id: "transfers", label: "Transfers" },
  { id: "counts", label: "Counts" },
  { id: "wastage", label: "Wastage" },
  { id: "history", label: "History" },
] as const;

// Module-scoped subcomponents (UPDATE-4 rule)
const AdjustmentForm = ({
  products,
  onSubmit,
  isLoading,
}: {
  products: any[];
  onSubmit: (
    data: { productId: string; newQuantity: number; reason: string }[],
  ) => void;
  isLoading: boolean;
}) => {
  const [adjustments, setAdjustments] = useState<
    { productId: string; newQuantity: number; reason: string }[]
  >([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()),
  );

  const addAdjustment = () => {
    if (!selectedProduct) return;
    if (adjustments.some((a) => a.productId === selectedProduct.id)) return;
    setAdjustments([
      ...adjustments,
      {
        productId: selectedProduct.id,
        newQuantity: selectedProduct.stock_quantity || 0,
        reason: "",
      },
    ]);
    setSelectedProduct(null);
    setSearch("");
  };

  const updateAdjustment = (index: number, field: string, value: any) => {
    setAdjustments(
      adjustments.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  };

  const removeAdjustment = (index: number) => {
    setAdjustments(adjustments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h4 className="text-white font-medium mb-4">Add Adjustment</h4>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
            />
            {search && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                {filteredProducts.slice(0, 10).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0"
                  >
                    <p className="text-white text-sm">{product.name}</p>
                    <p className="text-gray-500 text-xs">
                      Current: {product.stock_quantity || 0}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={addAdjustment}
            disabled={!selectedProduct}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white rounded-xl"
          >
            <Plus size={20} />
          </button>
        </div>
        {selectedProduct && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-white text-sm">
              Selected:{" "}
              <span className="font-medium">{selectedProduct.name}</span>
            </p>
            <p className="text-gray-400 text-xs">
              Current: {selectedProduct.stock_quantity || 0}
            </p>
          </div>
        )}
      </div>

      {adjustments.length > 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h4 className="text-white font-medium">
              Adjustments ({adjustments.length})
            </h4>
          </div>
          {adjustments.map((adj, index) => {
            const product = products.find((p) => p.id === adj.productId);
            return (
              <div key={adj.productId} className="p-4 border-b border-white/5">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-white font-medium">{product?.name}</p>
                    <p className="text-gray-500 text-xs mb-3">
                      Current: {product?.stock_quantity || 0}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">
                          New Quantity
                        </label>
                        <input
                          type="number"
                          value={adj.newQuantity}
                          onChange={(e) =>
                            updateAdjustment(
                              index,
                              "newQuantity",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">
                          Reason
                        </label>
                        <input
                          type="text"
                          value={adj.reason}
                          onChange={(e) =>
                            updateAdjustment(index, "reason", e.target.value)
                          }
                          placeholder="e.g., Damaged"
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeAdjustment(index)}
                    className="p-2 text-red-400 hover:text-red-300"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => onSubmit(adjustments)}
              disabled={isLoading || adjustments.some((a) => !a.reason)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle size={18} />
              )}
              Apply All Adjustments
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <ArrowUpDown className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No adjustments</p>
          <p className="text-gray-500 text-sm">
            Search products to adjust stock
          </p>
        </div>
      )}
    </div>
  );
};

const TransferForm = ({
  products,
  stations,
  onSubmit,
  isLoading,
}: {
  products: any[];
  stations: any[];
  onSubmit: (data: {
    productId: string;
    toStationId: string;
    quantity: number;
    notes: string;
  }) => void;
  isLoading: boolean;
}) => {
  const [formData, setFormData] = useState({
    productId: "",
    toStationId: "",
    quantity: 1,
    notes: "",
  });
  const [search, setSearch] = useState("");
  const { currentStation } = useStations();
  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedProduct = products.find((p) => p.id === formData.productId);
  const otherStations = stations.filter((s) => s.id !== currentStation?.id);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h4 className="text-white font-medium mb-4">New Transfer</h4>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Product</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              />
              {search && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setFormData({ ...formData, productId: product.id });
                        setSearch(product.name);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <p className="text-white text-sm">{product.name}</p>
                      <p className="text-gray-500 text-xs">
                        Available: {product.stock_quantity || 0}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedProduct && (
              <p className="text-gray-400 text-xs mt-2">
                Available: {selectedProduct.stock_quantity || 0}
              </p>
            )}
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">
              Transfer To
            </label>
            <select
              value={formData.toStationId}
              onChange={(e) =>
                setFormData({ ...formData, toStationId: e.target.value })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
            >
              <option value="">Select station</option>
              {otherStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Quantity</label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  quantity: parseFloat(e.target.value) || 1,
                })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              min="1"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
              rows={2}
            />
          </div>
          <button
            onClick={() => onSubmit(formData)}
            disabled={isLoading || !formData.productId || !formData.toStationId}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            Create Transfer
          </button>
        </div>
      </div>
      <TransfersList />
    </div>
  );
};

const TransfersList = () => {
  const { currentStation } = useStations();
  const [transfers, setTransfers] = useState<any[]>([]);
  useEffect(() => {
    const loadTransfers = async () => {
      if (!currentStation?.id) return;
      const { data } = await supabase
        .from("stock_transfers")
        .select("*")
        .eq("from_station_id", currentStation.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setTransfers(data || []);
    };
    loadTransfers();
  }, [currentStation?.id]);

  const handleComplete = async (id: string) => {
    const result = await completeStockTransfer(id);
    if (!result.success) {
      alert(
        "Failed to complete transfer: " + (result.error || "Unknown error"),
      );
      return;
    }
    setTransfers(transfers.filter((t) => t.id !== id));
  };

  if (transfers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No pending transfers</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h4 className="text-white font-medium">Pending</h4>
      </div>
      {transfers.map((t) => (
        <div
          key={t.id}
          className="p-4 border-b border-white/5 flex items-center justify-between"
        >
          <div>
            <p className="text-white text-sm">{t.transfer_number}</p>
            <p className="text-gray-500 text-xs">{t.quantity} units</p>
          </div>
          <button
            onClick={() => handleComplete(t.id)}
            className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm"
          >
            Complete
          </button>
        </div>
      ))}
    </div>
  );
};

const CountForm = ({
  products,
  onSubmit,
  isLoading,
}: {
  products: any[];
  onSubmit: (
    data: { productId: string; countedQuantity: number; variance: number }[],
  ) => void;
  isLoading: boolean;
}) => {
  const [counts, setCounts] = useState<
    { productId: string; countedQuantity: number }[]
  >([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()),
  );

  const addCount = () => {
    if (!selectedProduct) return;
    if (counts.some((c) => c.productId === selectedProduct.id)) return;
    setCounts([
      ...counts,
      {
        productId: selectedProduct.id,
        countedQuantity: selectedProduct.stock_quantity || 0,
      },
    ]);
    setSelectedProduct(null);
    setSearch("");
  };

  const updateCount = (index: number, qty: number) =>
    setCounts(
      counts.map((c, i) => (i === index ? { ...c, countedQuantity: qty } : c)),
    );
  const removeCount = (index: number) =>
    setCounts(counts.filter((_, i) => i !== index));
  const getVariance = (productId: string, counted: number) =>
    counted - (products.find((p) => p.id === productId)?.stock_quantity || 0);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h4 className="text-white font-medium mb-4">Add Count</h4>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
            />
            {search && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                {filteredProducts.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0"
                  >
                    <p className="text-white text-sm">{p.name}</p>
                    <p className="text-gray-500 text-xs">
                      System: {p.stock_quantity || 0}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={addCount}
            disabled={!selectedProduct}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white rounded-xl"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {counts.length > 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h4 className="text-white font-medium">Count ({counts.length})</h4>
          </div>
          {counts.map((count, index) => {
            const product = products.find((p) => p.id === count.productId);
            const variance = getVariance(
              count.productId,
              count.countedQuantity,
            );
            return (
              <div
                key={count.productId}
                className="p-4 border-b border-white/5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-white font-medium">{product?.name}</p>
                    <p className="text-gray-500 text-xs mb-3">
                      System: {product?.stock_quantity || 0}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">
                          Actual
                        </label>
                        <input
                          type="number"
                          value={count.countedQuantity}
                          onChange={(e) =>
                            updateCount(index, parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">
                          Variance
                        </label>
                        <div
                          className={`px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-center font-medium ${variance > 0 ? "text-emerald-400" : variance < 0 ? "text-red-400" : "text-gray-400"}`}
                        >
                          {variance > 0 ? "+" : ""}
                          {variance}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeCount(index)}
                    className="p-2 text-red-400 hover:text-red-300"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() =>
                onSubmit(
                  counts.map((c) => ({
                    productId: c.productId,
                    countedQuantity: c.countedQuantity,
                    variance: getVariance(c.productId, c.countedQuantity),
                  })),
                )
              }
              disabled={isLoading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle size={18} />
              )}
              Submit Count
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Scale className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No items</p>
        </div>
      )}
    </div>
  );
};

const WastageForm = ({
  products,
  onSubmit,
  isLoading,
}: {
  products: any[];
  onSubmit: (data: {
    productId: string;
    quantity: number;
    notes: string;
  }) => void;
  isLoading: boolean;
}) => {
  const [formData, setFormData] = useState({
    productId: "",
    quantity: 1,
    notes: "",
  });
  const [search, setSearch] = useState("");
  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedProduct = products.find((p) => p.id === formData.productId);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h4 className="text-white font-medium mb-4">Record Wastage</h4>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Product</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              />
              {search && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setFormData({ ...formData, productId: p.id });
                        setSearch(p.name);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <p className="text-white text-sm">{p.name}</p>
                      <p className="text-gray-500 text-xs">
                        Avail: {p.stock_quantity || 0}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Quantity</label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  quantity: parseFloat(e.target.value) || 1,
                })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              min="1"
              max={selectedProduct?.stock_quantity || 1}
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Reason</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="e.g., Expired, Spillage..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
              rows={3}
            />
          </div>
          <button
            onClick={() => onSubmit(formData)}
            disabled={isLoading || !formData.productId || !formData.notes}
            className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} />
            )}
            Record Wastage
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryTable = () => {
  const { currentStation } = useStations();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTransactions = async () => {
      if (!currentStation?.id) return;
      setLoading(true);
      const data = await fetchInventoryTransactions(
        currentStation.id,
        undefined,
        100,
      );
      setTransactions(data);
      setLoading(false);
    };
    loadTransactions();
  }, [currentStation?.id]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  if (transactions.length === 0)
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No transactions</p>
      </div>
    );

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {[
              "Date",
              "Product",
              "Type",
              "Change",
              "Before",
              "After",
              "Notes",
            ].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-semibold text-gray-400 px-4 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              className="border-b border-white/5 hover:bg-white/5"
            >
              <td className="px-4 py-3 text-sm text-gray-300">
                {new Date(tx.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <div className="text-sm text-white">
                  {tx.products?.name || "Unknown"}
                </div>
                <div className="text-xs text-gray-500">{tx.products?.sku}</div>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 capitalize">
                  {tx.transaction_type.replace("_", " ")}
                </span>
              </td>
              <td
                className={`px-4 py-3 text-sm font-bold ${tx.quantity_change >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {tx.quantity_change >= 0 ? "+" : ""}
                {tx.quantity_change}
              </td>
              <td className="px-4 py-3 text-sm text-gray-300">
                {tx.previous_quantity}
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-white">
                {tx.new_quantity}
              </td>
              <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                {tx.notes || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main Component
export default function InventoryManagement() {
  const { currentStation } = useStations();
  const [activeTab, setActiveTab] = useState<InventoryTab>("adjustments");
  const [products, setProducts] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      const [productsData, stationsData] = await Promise.all([
        fetchProducts(currentStation.id),
        supabase
          .from("stations")
          .select("id, name")
          .neq("id", currentStation.id),
      ]);
      setProducts(productsData);
      setStations(stationsData.data || []);
    } catch (error) {
      console.error("Failed to load:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleAdjustment = async (
    adjustments: { productId: string; newQuantity: number; reason: string }[],
  ) => {
    if (!currentStation?.id) return;
    setProcessing(true);
    try {
      const result = await adjustStock(
        currentStation.id,
        adjustments.map((a) => ({
          productId: a.productId,
          previousQuantity:
            products.find((p) => p.id === a.productId)?.stock_quantity || 0,
          newQuantity: a.newQuantity,
          reason: a.reason,
        })),
      );
      if (!result.success) {
        alert("Failed to adjust stock: " + (result.error || "Unknown error"));
        return;
      }
      showNotice("Adjustments applied");
      loadData();
    } catch (error: any) {
      alert("Failed: " + (error?.message || error));
    } finally {
      setProcessing(false);
    }
  };

  const handleTransfer = async (data: {
    productId: string;
    toStationId: string;
    quantity: number;
    notes: string;
  }) => {
    if (!currentStation?.id) return;
    setProcessing(true);
    try {
      await createStockTransfer({
        productId: data.productId,
        fromStationId: currentStation.id,
        toStationId: data.toStationId,
        quantity: data.quantity,
        notes: data.notes,
      });
      showNotice("Transfer created");
    } catch {
      alert("Failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleCount = async (
    counts: { productId: string; countedQuantity: number; variance: number }[],
  ) => {
    if (!currentStation?.id) return;
    setProcessing(true);
    try {
      const result = await processStockCount(
        currentStation.id,
        counts.filter((c) => c.variance !== 0),
      );
      if (!result.success) {
        alert("Failed to submit count: " + (result.error || "Unknown error"));
        return;
      }
      showNotice("Count submitted");
      loadData();
    } catch (error: any) {
      alert("Failed: " + (error?.message || error));
    } finally {
      setProcessing(false);
    }
  };

  const handleWastage = async (data: {
    productId: string;
    quantity: number;
    notes: string;
  }) => {
    if (!currentStation?.id) return;
    setProcessing(true);
    try {
      const result = await recordWastage(
        currentStation.id,
        data.productId,
        data.quantity,
        data.notes,
      );
      if (!result.success) {
        alert("Failed to record wastage: " + (result.error || "Unknown error"));
        return;
      }
      showNotice("Wastage recorded");
      loadData();
    } catch (error: any) {
      alert("Failed: " + (error?.message || error));
    } finally {
      setProcessing(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Stock Management</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage adjustments, transfers, counts, wastage
        </p>
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === tab.id ? "bg-amber-500 text-white" : "bg-white/5 text-gray-400 hover:text-white"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="max-w-2xl">
        {activeTab === "adjustments" && (
          <AdjustmentForm
            products={products}
            onSubmit={handleAdjustment}
            isLoading={processing}
          />
        )}
        {activeTab === "transfers" && (
          <TransferForm
            products={products}
            stations={stations}
            onSubmit={handleTransfer}
            isLoading={processing}
          />
        )}
        {activeTab === "counts" && (
          <CountForm
            products={products}
            onSubmit={handleCount}
            isLoading={processing}
          />
        )}
        {activeTab === "wastage" && (
          <WastageForm
            products={products}
            onSubmit={handleWastage}
            isLoading={processing}
          />
        )}
        {activeTab === "history" && <HistoryTable />}
      </div>
      {notice && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-white text-sm font-medium px-4 py-2 rounded-xl">
          {notice}
        </div>
      )}
    </div>
  );
}
