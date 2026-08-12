/**
 * ProductsManagement.tsx
 * Full product management with CRUD, categories, and stock visibility.
 * All subcomponents are module-scoped (UPDATE-4 rule).
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Filter,
  ChevronDown,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { supabase } from "@/supabase/client";
import {
  getCurrencySymbol,
  getDetectedCurrency,
} from "@/react-app/lib/currency";

// Format currency
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: getDetectedCurrency(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Default categories
const DEFAULT_CATEGORIES = [
  "Fuel",
  "Lubricants",
  "Accessories",
  "Services",
  "Other",
];

// Product form initial state
const INITIAL_PRODUCT = {
  sku: "",
  name: "",
  description: "",
  category: "Fuel",
  unit: "pcs",
  barcode: "",
  cost_price: 0,
  selling_price: 0,
  reorder_level: 10,
  stock_quantity: 0,
  tax_rate: 16,
  is_active: true,
  is_taxable: true,
};

// Module-scoped subcomponents (UPDATE-4 rule)
const TableHeader = ({
  columns,
}: {
  columns: { label: string; className?: string }[];
}) => (
  <thead>
    <tr className="border-b border-white/10">
      {columns.map((col) => (
        <th
          key={col.label}
          className={`text-left text-xs font-semibold text-gray-400 px-4 py-3 ${col.className || ""}`}
        >
          {col.label}
        </th>
      ))}
    </tr>
  </thead>
);

const ProductRow = ({
  product,
  onEdit,
  onDelete,
}: {
  product: any;
  onEdit: (product: any) => void;
  onDelete: (product: any) => void;
}) => (
  <tr className="border-b border-white/5 hover:bg-white/5">
    <td className="px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
          <Package size={18} className="text-amber-400" />
        </div>
        <div>
          <p className="text-white font-medium">{product.name}</p>
          <p className="text-gray-500 text-xs">{product.sku}</p>
        </div>
      </div>
    </td>
    <td className="px-4 py-4">
      <span className="text-gray-300 text-sm">{product.category || "-"}</span>
    </td>
    <td className="px-4 py-4">
      <span
        className={`text-sm font-medium ${
          (product.stock_quantity || 0) <= (product.reorder_level || 10)
            ? "text-red-400"
            : "text-emerald-400"
        }`}
      >
        {product.stock_quantity ?? 0}
      </span>
    </td>
    <td className="px-4 py-4">
      <span className="text-white">{formatMoney(product.cost_price || 0)}</span>
    </td>
    <td className="px-4 py-4">
      <span className="text-amber-400 font-medium">
        {formatMoney(product.selling_price || 0)}
      </span>
    </td>
    <td className="px-4 py-4">
      <span
        className={`text-xs px-2 py-1 rounded-full ${
          product.is_active
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-gray-500/20 text-gray-400"
        }`}
      >
        {product.is_active ? "Active" : "Inactive"}
      </span>
    </td>
    <td className="px-4 py-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onEdit(product)}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={() => onDelete(product)}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </td>
  </tr>
);

const ProductModal = ({
  product,
  categories,
  onSave,
  onClose,
  isLoading,
}: {
  product: any | null;
  categories: string[];
  onSave: (data: any) => void;
  onClose: () => void;
  isLoading: boolean;
}) => {
  const [formData, setFormData] = useState(product || INITIAL_PRODUCT);
  const [newCategory, setNewCategory] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const allCategories = useMemo(() => {
    const cats = new Set([...DEFAULT_CATEGORIES, ...categories]);
    return Array.from(cats);
  }, [categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addCategory = () => {
    if (newCategory.trim()) {
      setFormData({ ...formData, category: newCategory.trim() });
      setNewCategory("");
      setShowCategoryDropdown(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">
            {product ? "Edit Product" : "Add Product"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-2 block">SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-2 block">
                Barcode
              </label>
              <input
                type="text"
                value={formData.barcode || ""}
                onChange={(e) =>
                  setFormData({ ...formData, barcode: e.target.value })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-2 block">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              required
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-2 block">
              Description
            </label>
            <textarea
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
              rows={3}
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-gray-400 text-xs mb-2 block">
                Category *
              </label>
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left"
              >
                <span className="text-white">
                  {formData.category || "Select Category"}
                </span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
              {showCategoryDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden">
                  <div className="p-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="New category"
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm"
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addCategory())
                        }
                      />
                      <button
                        type="button"
                        onClick={addCategory}
                        className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {allCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, category: cat });
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-gray-300 hover:bg-white/5"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-2 block">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              >
                <option value="pcs">Pieces</option>
                <option value="liters">Liters</option>
                <option value="kg">Kilograms</option>
                <option value="boxes">Boxes</option>
              </select>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-2 block">
                Cost Price *
              </label>
              <input
                type="number"
                value={formData.cost_price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cost_price: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-2 block">
                Selling Price *
              </label>
              <input
                type="number"
                value={formData.selling_price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    selling_price: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          {/* Stock & Tax */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-2 block">
                Initial Stock
              </label>
              <input
                type="number"
                value={formData.stock_quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stock_quantity: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-2 block">
                Reorder Level
              </label>
              <input
                type="number"
                value={formData.reorder_level}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reorder_level: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-2 block">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={formData.tax_rate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tax_rate: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-gray-400 text-xs mb-2 block">
                Options
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_taxable}
                  onChange={(e) =>
                    setFormData({ ...formData, is_taxable: e.target.checked })
                  }
                  className="w-5 h-5 bg-white/10 border border-white/20 rounded"
                />
                <span className="text-gray-300 text-sm">Taxable</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-5 h-5 bg-white/10 border border-white/20 rounded"
                />
                <span className="text-gray-300 text-sm">Active</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  {product ? "Update Product" : "Add Product"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmModal = ({
  product,
  onConfirm,
  onCancel,
  isLoading,
}: {
  product: any;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-white/10">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Delete Product
        </h3>
        <p className="text-gray-400 mb-6">
          Are you sure you want to delete{" "}
          <span className="text-white font-medium">{product.name}</span>? This
          action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Trash2 size={18} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Main Component
export default function ProductsManagement() {
  const { currentStation } = useStations();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!currentStation?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("station_id", currentStation.id)
        .order("name");

      if (error) throw error;

      setProducts(data || []);

      // Extract unique categories
      const cats = new Set(data?.map((p) => p.category).filter(Boolean) || []);
      setCategories(Array.from(cats));
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        !search ||
        product.name?.toLowerCase().includes(search.toLowerCase()) ||
        product.sku?.toLowerCase().includes(search.toLowerCase()) ||
        product.barcode?.includes(search);

      const matchesCategory =
        !categoryFilter || product.category === categoryFilter;

      const matchesLowStock =
        !showLowStock ||
        (product.stock_quantity || 0) <= (product.reorder_level || 10);

      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [products, search, categoryFilter, showLowStock]);

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleSave = async (formData: any) => {
    if (!currentStation?.id) return;

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData.user?.id;

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from("products")
          .update(formData)
          .eq("id", editingProduct.id);

        if (error) throw error;
        showNotice("Product updated successfully");
      } else {
        // Create new product
        const { error } = await supabase.from("products").insert({
          ...formData,
          station_id: currentStation.id,
          owner_id: ownerId,
        });

        if (error) throw error;
        showNotice("Product added successfully");
      }

      setShowModal(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      console.error("Failed to save product:", error);
      alert("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", deleteProduct.id);

      if (error) throw error;

      setDeleteProduct(null);
      loadProducts();
      showNotice("Product deleted successfully");
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert("Failed to delete product");
    } finally {
      setSaving(false);
    }
  };

  const allCategories = useMemo(() => {
    const cats = new Set([...DEFAULT_CATEGORIES, ...categories]);
    return Array.from(cats);
  }, [categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-gray-400 text-sm mt-1">
            {filteredProducts.length} product
            {filteredProducts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors"
        >
          <Plus size={20} />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
        >
          <option value="">All Categories</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={showLowStock}
            onChange={(e) => setShowLowStock(e.target.checked)}
            className="w-5 h-5 bg-white/10 border border-white/20 rounded"
          />
          <span className="text-gray-300 text-sm">Low Stock</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full">
          <TableHeader
            columns={[
              { label: "Product" },
              { label: "Category" },
              { label: "Stock" },
              { label: "Cost" },
              { label: "Price" },
              { label: "Status" },
              { label: "Actions" },
            ]}
          />
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No products found</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {search || categoryFilter || showLowStock
                      ? "Try adjusting your filters"
                      : "Add your first product to get started"}
                  </p>
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onEdit={() => {
                    setEditingProduct(product);
                    setShowModal(true);
                  }}
                  onDelete={() => setDeleteProduct(product)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
          isLoading={saving}
        />
      )}

      {/* Delete Confirmation */}
      {deleteProduct && (
        <DeleteConfirmModal
          product={deleteProduct}
          onConfirm={handleDelete}
          onCancel={() => setDeleteProduct(null)}
          isLoading={saving}
        />
      )}

      {/* Notice */}
      {notice && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}
