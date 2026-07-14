import { useState, useEffect } from "react";
import {
  logAudit,
  getAuditLog,
  getAuditLogByCategory,
  clearOldAudit,
  type AuditEntry,
} from "@/react-app/services/CloudStorageService";
import {
  ClipboardList,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Database,
  User,
  ShoppingCart,
  Settings,
  Shield,
  Package,
  Fuel,
  ArrowUpDown,
} from "lucide-react";

const categoryConfig: Record<
  string,
  { icon: typeof Fuel; color: string; label: string }
> = {
  data: {
    icon: Database,
    color: "text-blue-600 dark:text-blue-400",
    label: "Data",
  },
  sale: {
    icon: ShoppingCart,
    color: "text-green-600 dark:text-green-400",
    label: "Sale",
  },
  payment: {
    icon: ArrowUpDown,
    color: "text-purple-600 dark:text-purple-400",
    label: "Payment",
  },
  inventory: {
    icon: Package,
    color: "text-amber-600 dark:text-amber-400",
    label: "Inventory",
  },
  auth: {
    icon: Shield,
    color: "text-red-600 dark:text-red-400",
    label: "Auth",
  },
  config: {
    icon: Settings,
    color: "text-gray-600 dark:text-gray-400",
    label: "Config",
  },
  sync: {
    icon: RefreshCw,
    color: "text-cyan-600 dark:text-cyan-400",
    label: "Sync",
  },
};

interface AuditTrailProps {
  stationId: string;
}

export default function AuditTrail({ stationId }: AuditTrailProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const data =
        category === "all"
          ? await getAuditLog(stationId, 200)
          : await getAuditLogByCategory(stationId, category, 100);
      setEntries(data);

      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime();
      const weekStart = todayStart - now.getDay() * 86400000;
      setStats({
        total: data.length,
        today: data.filter(e => new Date(e.timestamp).getTime() >= todayStart)
          .length,
        thisWeek: data.filter(e => new Date(e.timestamp).getTime() >= weekStart)
          .length,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [stationId, category]);

  const filtered = entries.filter(
    e =>
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.details.toLowerCase().includes(search.toLowerCase()) ||
      e.user?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ["Timestamp", "Action", "Category", "User", "Details"];
    const rows = filtered.map(e => [
      e.timestamp,
      e.action,
      e.category,
      e.user || "-",
      e.details,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_trail_${stationId}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <ClipboardList
            size={24}
            className="text-indigo-600 dark:text-indigo-400"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Audit Trail
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Complete activity log for compliance
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Total Events</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.total}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Today</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.today}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">This Week</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.thisWeek}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search audit log..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
        >
          <option value="all">All Categories</option>
          <option value="data">Data</option>
          <option value="sale">Sales</option>
          <option value="payment">Payments</option>
          <option value="inventory">Inventory</option>
          <option value="auth">Auth</option>
          <option value="config">Config</option>
          <option value="sync">Sync</option>
        </select>
        <button
          onClick={exportCSV}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
        >
          <Download size={16} /> Export
        </button>
        <button
          onClick={async () => {
            await clearOldAudit(90);
            load();
          }}
          className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium flex items-center gap-2"
        >
          <Trash2 size={16} /> Clean Old
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const cfg = categoryConfig[e.category] || categoryConfig.data;
                const Icon = cfg.icon;
                return (
                  <tr
                    key={e.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-medium dark:text-white">
                      {e.action}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`flex items-center gap-1 ${cfg.color}`}>
                        <Icon size={12} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {e.user || "System"}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {e.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !loading && (
          <p className="text-center text-sm text-gray-500 py-8">
            No audit entries found. Activities will be logged automatically as
            you use the system.
          </p>
        )}
      </div>
    </div>
  );
}
