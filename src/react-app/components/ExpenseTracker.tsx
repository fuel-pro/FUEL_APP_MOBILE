import { useState, useEffect } from "react";
import {
  Receipt,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Calendar,
  Tag,
  TrendingDown,
  TrendingUp,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  Download,
  PieChart,
  DollarSign,
  FileText,
  Zap,
  Users,
  Wrench,
  Truck,
  Building2,
  ShoppingCart,
} from "lucide-react";

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  receiptUrl?: string;
  approvedBy: string;
  status: "pending" | "approved" | "rejected";
  stationId: string;
  createdAt: string;
}

const STORAGE_KEY = "fuelpro_expenses_v2";

const EXPENSE_CATEGORIES = [
  { value: "fuel_purchase", label: "Fuel Purchase", icon: Zap },
  { value: "salaries", label: "Salaries & Wages", icon: Users },
  { value: "maintenance", label: "Maintenance", icon: Wrench },
  { value: "transport", label: "Transport & Logistics", icon: Truck },
  { value: "rent", label: "Rent & Utilities", icon: Building2 },
  { value: "supplies", label: "Office Supplies", icon: ShoppingCart },
  { value: "taxes", label: "Taxes & Licenses", icon: Receipt },
  { value: "other", label: "Other", icon: FileText },
];

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "M-PESA", "Card", "Cheque"];

function loadExpenses(): Expense[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return [];
}

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState<Expense[]>(loadExpenses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "warning";
  } | null>(null);
  const [activeView, setActiveView] = useState<"list" | "analytics">("list");

  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().slice(0, 10),
    category: "fuel_purchase",
    description: "",
    amount: 0,
    paymentMethod: "Bank Transfer",
    reference: "",
    approvedBy: "",
    status: "pending",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);

  const showNotification = (
    message: string,
    type: "success" | "warning" = "success"
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const filtered = expenses.filter(e => {
    const matchesSearch =
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || e.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    const matchesFrom = !dateRange.from || e.date >= dateRange.from;
    const matchesTo = !dateRange.to || e.date <= dateRange.to;
    return (
      matchesSearch &&
      matchesCategory &&
      matchesStatus &&
      matchesFrom &&
      matchesTo
    );
  });

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const approvedTotal = filtered
    .filter(e => e.status === "approved")
    .reduce((s, e) => s + e.amount, 0);
  const pendingTotal = filtered
    .filter(e => e.status === "pending")
    .reduce((s, e) => s + e.amount, 0);

  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: filtered
      .filter(e => e.category === cat.value)
      .reduce((s, e) => s + e.amount, 0),
    count: filtered.filter(e => e.category === cat.value).length,
  }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const handleSave = () => {
    if (!formData.description || !formData.amount) {
      showNotification("Description and amount are required", "warning");
      return;
    }
    if (editingId) {
      setExpenses(prev =>
        prev.map(e =>
          e.id === editingId ? ({ ...e, ...formData } as Expense) : e
        )
      );
      showNotification("Expense updated");
    } else {
      setExpenses(prev => [
        {
          ...(formData as Expense),
          id: `exp_${Date.now()}`,
          stationId: "default",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      showNotification("Expense added");
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this expense?")) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      showNotification("Expense deleted");
    }
  };

  const updateStatus = (id: string, newStatus: Expense["status"]) => {
    setExpenses(prev =>
      prev.map(e => (e.id === id ? { ...e, status: newStatus } : e))
    );
    showNotification(`Expense ${newStatus}`);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  const catColors: Record<string, string> = {
    fuel_purchase: "text-amber-500",
    salaries: "text-blue-500",
    maintenance: "text-red-500",
    transport: "text-purple-500",
    rent: "text-green-500",
    supplies: "text-gray-500",
    taxes: "text-orange-500",
    other: "text-gray-400",
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
            <Receipt size={22} className="text-amber-500" /> Expense Tracker
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Track operational expenses and approvals
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeView === "list" ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
          >
            Records
          </button>
          <button
            onClick={() => setActiveView("analytics")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeView === "analytics" ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-500" />
            <span className="text-xs text-gray-500">Total Expenses</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            KES {totalExpenses.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-xs text-gray-500">Approved</span>
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            KES {approvedTotal.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-xs text-gray-500">Pending</span>
          </div>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
            KES {pendingTotal.toLocaleString()}
          </p>
        </div>
      </div>

      {activeView === "list" ? (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search expenses..."
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-gray-300 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-gray-300 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setFormData({
                  date: new Date().toISOString().slice(0, 10),
                  category: "fuel_purchase",
                  description: "",
                  amount: 0,
                  paymentMethod: "Bank Transfer",
                  reference: "",
                  approvedBy: "",
                  status: "pending",
                });
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
            >
              <Plus size={16} /> Add Expense
            </button>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      Ref
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(exp => {
                    const CatIcon =
                      EXPENSE_CATEGORIES.find(c => c.value === exp.category)
                        ?.icon || FileText;
                    return (
                      <tr
                        key={exp.id}
                        className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/20"
                      >
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {new Date(exp.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <CatIcon
                              size={12}
                              className={
                                catColors[exp.category] || "text-gray-500"
                              }
                            />
                            <span className="text-gray-700 dark:text-gray-300">
                              {EXPENSE_CATEGORIES.find(
                                c => c.value === exp.category
                              )?.label || exp.category}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white max-w-[200px] truncate">
                          {exp.description}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          KES {exp.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[exp.status]}`}
                          >
                            {exp.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                          {exp.reference}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            {exp.status === "pending" && (
                              <button
                                onClick={() => updateStatus(exp.id, "approved")}
                                className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded text-[10px] hover:bg-emerald-500/20"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingId(exp.id);
                                setFormData(exp);
                                setShowForm(true);
                              }}
                              className="p-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded transition-colors"
                            >
                              <Edit3 size={10} />
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded transition-colors"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No expenses found
              </div>
            )}
          </div>
        </>
      ) : (
        /* Analytics View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <PieChart size={14} className="text-amber-500" /> By Category
            </h3>
            <div className="space-y-3">
              {byCategory.map(cat => {
                const CatIcon = cat.icon;
                const pct =
                  totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                return (
                  <div key={cat.value}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <CatIcon size={12} /> {cat.label}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        KES {cat.total.toLocaleString()} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {byCategory.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No data
                </p>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign size={14} className="text-emerald-500" /> Summary
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500">Total Records</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {filtered.length}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                <p className="text-xs text-gray-500">Approved</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  KES {approvedTotal.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                <p className="text-xs text-gray-500">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  KES {pendingTotal.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg">
                <p className="text-xs text-gray-500">Average per Expense</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  KES{" "}
                  {filtered.length > 0
                    ? Math.round(
                        totalExpenses / filtered.length
                      ).toLocaleString()
                    : "0"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingId ? "Edit" : "New"} Expense
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
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={e =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Amount (KES) *
                    </label>
                    <input
                      type="number"
                      value={formData.amount || ""}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          amount: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={e =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {EXPENSE_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Payment Method
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          paymentMethod: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Reference #
                    </label>
                    <input
                      value={formData.reference}
                      onChange={e =>
                        setFormData({ ...formData, reference: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Approved By
                    </label>
                    <input
                      value={formData.approvedBy}
                      onChange={e =>
                        setFormData({ ...formData, approvedBy: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
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
    </div>
  );
}
