/**
 * ExpensesManagement.tsx
 * Expense tracking with auto-seeded categories.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  X,
  Loader2,
  CheckCircle,
  Receipt,
  Trash2,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { supabase } from "@/supabase/client";
import {
  fetchExpenses,
  fetchExpenseCategories,
} from "@/react-app/lib/pos-service";
import {
  getCurrencySymbol,
  getDetectedCurrency,
  isKenyaStation,
  getLocaleForCountry,
} from "@/react-app/lib/currency";

const formatMoney = (amount: number) =>
  new Intl.NumberFormat(getLocaleForCountry(), {
    style: "currency",
    currency: getDetectedCurrency(),
    minimumFractionDigits: 0,
  }).format(amount);

const DEFAULT_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Supplies",
  "Marketing",
  "Transport",
  "Maintenance",
  "Insurance",
  "Taxes",
  "Other",
];

export default function ExpensesManagement() {
  const { currentStation } = useStations();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const loadData = useCallback(async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      const [expensesData, categoriesData] = await Promise.all([
        fetchExpenses(currentStation.id, categoryFilter || undefined),
        fetchExpenseCategories(currentStation.id),
      ]);
      setExpenses(expensesData);
      setCategories(
        categoriesData.length > 0
          ? categoriesData
          : DEFAULT_CATEGORIES.map((c) => ({ name: c })),
      );
      setTotalExpenses(
        expensesData.reduce((sum, e) => sum + (e.amount || 0), 0),
      );
    } catch (error) {
      console.error("Failed:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (data: any) => {
    if (!currentStation?.id) return;
    const { data: userData } = await supabase.auth.getUser();
    try {
      const { error } = await supabase.from("expenses").insert({
        ...data,
        station_id: currentStation.id,
        owner_id: userData?.user?.id,
      });
      if (error) throw error;
      loadData();
      setShowModal(false);
    } catch (error: any) {
      console.error("Failed:", error);
      alert("Failed to save expense: " + (error?.message || error));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      alert("Failed to delete expense: " + error.message);
      return;
    }
    loadData();
  };

  const categoryTotals = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const filteredExpenses = expenses.filter(
    (e) =>
      !search || e.description?.toLowerCase().includes(search.toLowerCase()),
  );

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
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-gray-400 text-sm mt-1">
            Total: {formatMoney(totalExpenses)}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
        >
          <Plus size={20} /> Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search expenses..."
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
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Object.entries(categoryTotals).map(([cat, total]) => (
          <div
            key={cat}
            className="bg-white/5 border border-white/10 rounded-xl p-4"
          >
            <p className="text-gray-400 text-xs mb-1">{cat}</p>
            <p className="text-white font-semibold">
              {formatMoney(total as number)}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">
                Date
              </th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">
                Category
              </th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">
                Description
              </th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">
                Payment
              </th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">
                Amount
              </th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No expenses</p>
                </td>
              </tr>
            ) : (
              filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="px-4 py-4 text-gray-300 text-sm">
                    {new Date(expense.expense_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-white">
                    {expense.description}
                  </td>
                  <td className="px-4 py-4 text-gray-300 text-sm">
                    {expense.payment_method}
                  </td>
                  <td className="px-4 py-4 text-right text-red-400 font-medium">
                    {formatMoney(expense.amount)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ExpenseModal
          categories={categories}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function ExpenseModal({
  categories,
  onSave,
  onClose,
}: {
  categories: any[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    category: categories[0]?.name || "Other",
    description: "",
    amount: 0,
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-white/10">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">Add Expense</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
          className="p-6 space-y-4"
        >
          <div>
            <label className="text-gray-400 text-xs mb-2 block">
              Category *
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
            >
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">
              Description *
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Amount *</label>
            <input
              type="number"
              value={form.amount ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  amount:
                    e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
              min="0"
              required
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Date</label>
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) =>
                setForm({ ...form, expense_date: e.target.value })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-2 block">
              Payment Method
            </label>
            <select
              value={form.payment_method}
              onChange={(e) =>
                setForm({ ...form, payment_method: e.target.value })
              }
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
            >
              <option value="cash">Cash</option>
              {isKenyaStation() && <option value="mpesa">M-PESA</option>}
              <option value="card">Card</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
