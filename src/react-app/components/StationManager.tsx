import { useState, useMemo, useCallback } from "react";
import { useStations } from "@/react-app/context/StationContext";
import { useNavigate } from "react-router";
import {
  Plus,
  X,
  ChevronRight,
  Lock,
  Users,
  Globe,
  Trash2,
  Edit3,
  Check,
  ArrowLeft,
  Fuel,
  MapPin,
  Phone,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Layers,
  Share2,
  Copy,
  AlertTriangle,
  RefreshCw,
  LogIn,
  Search,
  Cloud,
  CloudOff,
  ArrowUpDown,
  TrendingUp,
  Calendar,
  Download,
  MoreHorizontal,
} from "lucide-react";
import {
  formatMoney,
  stationTotalRevenue,
  stationRevenueSince,
  stationSalesCount,
  stationStatus,
  relativeTime,
  initialsOf,
  avatarColor,
  downloadJson,
  startOfToday,
  startOfMonth,
  getCurrencySymbol,
} from "@/react-app/lib/station-stats";

interface StationManagerProps {
  onClose?: () => void;
}

// ============================================================
// Module-scope subcomponents (UPDATE-4 rule)
// ============================================================

const GLASS_CARD =
  "bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl";

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "text-amber-400",
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className={`${GLASS_CARD} p-4 flex items-center gap-3`}>
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
        <Icon size={18} className={accent} />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="font-bold text-white text-sm">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "active" | "inactive" | "maintenance";
}) {
  const styles = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    inactive: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    maintenance: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  const labels = {
    active: "Active",
    inactive: "Inactive",
    maintenance: "Maintenance",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className={`${GLASS_CARD} p-5 animate-pulse`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10" />
          <div>
            <div className="h-4 w-32 bg-white/10 rounded mb-2" />
            <div className="h-3 w-24 bg-white/10 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-white/10 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-white/10 rounded" />
        <div className="h-3 w-3/4 bg-white/10 rounded" />
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className={`${GLASS_CARD} p-12 text-center`}>
      <Layers size={48} className="text-gray-600 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-white mb-2">No stations yet</h3>
      <p className="text-gray-400 text-sm mb-6">
        Create your first fuel station to get started
      </p>
      <button
        onClick={onCreate}
        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 mx-auto"
      >
        <Plus size={18} />
        Create Station
      </button>
    </div>
  );
}

// Station card subcomponent
function StationCard({
  station,
  isCurrent,
  onOpen,
  onEdit,
  onShare,
  onExport,
  onDelete,
  onToggleStatus,
}: {
  station: any;
  isCurrent: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onShare: () => void;
  onExport: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const data = station.data || {};
  const totalRev = stationTotalRevenue(data);
  const todayRev = stationRevenueSince(data, startOfToday());
  const monthRev = stationRevenueSince(data, startOfMonth());
  const salesCount = stationSalesCount(data);
  const status = stationStatus(data);
  const sharedUsers = data.sharedUsers || [];
  const updated = relativeTime(station.updatedAt);
  const isCloudBacked =
    station.id.includes("backend_") || station.id.includes("-");

  return (
    <div
      className={`${GLASS_CARD} p-5 hover:bg-white/10 transition-all group relative ${
        isCurrent ? "ring-2 ring-amber-400/50" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl ${avatarColor(
              station.name,
            )} flex items-center justify-center text-white font-bold text-sm`}
          >
            {initialsOf(station.name)}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              {station.name}
              {isCurrent && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded">
                  Active
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400">{updated}</p>
          </div>
        </div>
        <button
          onClick={onToggleStatus}
          className="text-gray-400 hover:text-white"
          title="Toggle status"
        >
          <StatusBadge status={status} />
        </button>
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 mb-0.5">Today</p>
          <p className="font-semibold text-emerald-400 text-xs">
            {formatMoney(todayRev)}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 mb-0.5">Month</p>
          <p className="font-semibold text-sky-400 text-xs">
            {formatMoney(monthRev)}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 mb-0.5">Total</p>
          <p className="font-semibold text-white text-xs">
            {formatMoney(totalRev)}
          </p>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 mb-4">
        {station.location && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <MapPin size={12} className="text-gray-500" />
            <span className="truncate">{station.location}</span>
          </div>
        )}
        {station.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Phone size={12} className="text-gray-500" />
            <span>{station.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          {isCloudBacked ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <Cloud size={12} />
              Cloud synced
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-500">
              <CloudOff size={12} />
              Local only
            </span>
          )}
          {sharedUsers.length > 0 && (
            <span className="flex items-center gap-1 text-purple-400 ml-2">
              <Users size={12} />
              {sharedUsers.length} shared
            </span>
          )}
          <span className="text-gray-500 ml-auto">{salesCount} sales</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
        <button
          onClick={onOpen}
          className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors"
        >
          Open
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs transition-colors"
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={onShare}
          className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-xs transition-colors"
        >
          <Share2 size={14} />
        </button>
        <button
          onClick={onExport}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs transition-colors"
        >
          <Download size={14} />
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// Create/Edit Modal
function StationFormModal({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial: any;
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!form.name?.trim()) {
      setError("Station name is required");
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${GLASS_CARD} w-full max-w-md p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Station Name *
            </label>
            <input
              type="text"
              value={form.name || ""}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., downtown_branch"
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={form.location || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, location: e.target.value }))
              }
              placeholder="e.g., Downtown, Nairobi"
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+1 555 000 0000"
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={form.taxRate ?? 16}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    taxRate: parseFloat(e.target.value) || 16,
                  }))
                }
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Email / Manager
            </label>
            <input
              type="email"
              value={form.email || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="manager@station.com"
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
          >
            {submitLabel}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Share Modal
function ShareModal({
  station,
  onShare,
  onRevoke,
  onClose,
}: {
  station: any;
  onShare: (email: string, password: string) => void;
  onRevoke: (email: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const sharedUsers = station?.data?.sharedUsers || [];

  const handleShare = () => {
    if (!email.trim() || !password) {
      return;
    }
    onShare(email, password);
    setEmail("");
    setPassword("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${GLASS_CARD} w-full max-w-md p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Share Station Access</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-sm text-purple-300">
            Sharing: <span className="font-semibold">{station?.name}</span>
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="User email address"
            className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set access password"
              className="w-full px-4 py-2.5 pr-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            onClick={handleShare}
            disabled={!email.trim() || !password}
            className="w-full px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Share2 size={16} />
            Grant Access
          </button>
        </div>

        {sharedUsers.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Shared Users ({sharedUsers.length})
            </h3>
            <div className="space-y-2">
              {sharedUsers.map((user: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">
                      {user.email?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm text-gray-300">{user.email}</span>
                  </div>
                  <button
                    onClick={() => onRevoke(user.email)}
                    className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Access Station Modal
function AccessModal({
  stations,
  onAccess,
  onClose,
}: {
  stations: any[];
  onAccess: (stationId: string, password: string) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(stations[0]?.id || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleAccess = () => {
    if (!selectedId || !password) {
      setError("Both station and password are required");
      return;
    }
    onAccess(selectedId, password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${GLASS_CARD} w-full max-w-md p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">
            Access Shared Station
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Select Station
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="" className="bg-gray-800">
                Choose a station...
              </option>
              {stations.map((s) => (
                <option key={s.id} value={s.id} className="bg-gray-800">
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Station Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter the access password"
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAccess}
            className="flex-1 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            Access Station
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Combined View Modal
function CombinedViewModal({
  stations,
  combined,
  onClose,
}: {
  stations: any[];
  combined: any;
  onClose: () => void;
}) {
  const totalRevenue = stations.reduce(
    (sum, s) => sum + stationTotalRevenue(s.data || {}),
    0,
  );
  const todayRevenue = stations.reduce(
    (sum, s) => sum + stationRevenueSince(s.data || {}, startOfToday()),
    0,
  );
  const monthRevenue = stations.reduce(
    (sum, s) => sum + stationRevenueSince(s.data || {}, startOfMonth()),
    0,
  );
  const totalSales = stations.reduce(
    (sum, s) => sum + stationSalesCount(s.data || {}),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${GLASS_CARD} w-full max-w-lg p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers size={20} className="text-amber-400" />
            Combined Station View
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`${GLASS_CARD} p-4 text-center`}>
            <p className="text-xs text-gray-400 mb-1">Today's Revenue</p>
            <p className="text-xl font-bold text-emerald-400">
              {formatMoney(todayRevenue)}
            </p>
          </div>
          <div className={`${GLASS_CARD} p-4 text-center`}>
            <p className="text-xs text-gray-400 mb-1">This Month</p>
            <p className="text-xl font-bold text-sky-400">
              {formatMoney(monthRevenue)}
            </p>
          </div>
          <div className={`${GLASS_CARD} p-4 text-center`}>
            <p className="text-xs text-gray-400 mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-white">
              {formatMoney(totalRevenue)}
            </p>
          </div>
          <div className={`${GLASS_CARD} p-4 text-center`}>
            <p className="text-xs text-gray-400 mb-1">Total Sales</p>
            <p className="text-xl font-bold text-purple-400">{totalSales}</p>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            {stations.length} Stations Combined
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {stations.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg ${avatarColor(s.name)} flex items-center justify-center text-white text-xs font-bold`}
                  >
                    {initialsOf(s.name)}
                  </div>
                  <span className="text-sm text-gray-200">{s.name}</span>
                </div>
                <span className="text-sm text-emerald-400 font-medium">
                  {formatMoney(stationTotalRevenue(s.data || {}))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Confirm Dialog
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${GLASS_CARD} w-full max-w-sm p-6`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
        <p className="text-gray-300 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

const EMPTY_FORM = {
  name: "",
  location: "",
  phone: "",
  email: "",
  kraPin: "",
  etrSerial: "",
  taxRate: 16,
  theme: "dark",
  description: "",
};

type FilterStatus = "all" | "active" | "inactive" | "maintenance";
type SortBy = "name" | "revenue" | "recent" | "oldest";

export default function StationManager({ onClose }: StationManagerProps) {
  const {
    stations,
    currentStation,
    createStation,
    updateStation,
    deleteStation,
    switchStation,
    shareStation,
    revokeAccess,
    changeStationPassword,
    combineStations,
    addUpdateRecord,
    isAdmin,
    isStationLoading,
    isBackendSyncing,
    lastBackendSync,
    syncToBackend,
    syncFromBackend,
  } = useStations();

  const navigate = useNavigate();

  // UI state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{
    type: "create" | "edit" | "share" | "access" | "combined" | "delete";
    station?: any;
  } | null>(null);

  // Form state
  const [editForm, setEditForm] = useState<any>(EMPTY_FORM);

  // Show notice
  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }, []);

  // Computed stats
  const stats = useMemo(() => {
    const totalRev = stations.reduce(
      (sum, s) => sum + stationTotalRevenue(s.data || {}),
      0,
    );
    const todayRev = stations.reduce(
      (sum, s) => sum + stationRevenueSince(s.data || {}, startOfToday()),
      0,
    );
    const sharedUsers = new Set(
      stations.flatMap((s) =>
        (s.data?.sharedUsers || []).map((u: any) => u.email),
      ),
    ).size;
    return {
      totalRevenue: totalRev,
      todayRevenue: todayRev,
      sharedUsers,
    };
  }, [stations]);

  // Filtered & sorted stations
  const visibleStations = useMemo(() => {
    let result = [...stations];

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.location?.toLowerCase().includes(q) ||
          s.phone?.includes(q) ||
          s.email?.toLowerCase().includes(q),
      );
    }

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter((s) => stationStatus(s.data) === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "revenue")
        return (
          stationTotalRevenue(b.data || {}) - stationTotalRevenue(a.data || {})
        );
      if (sortBy === "recent")
        return (
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime()
        );
      return (
        new Date(a.updatedAt || 0).getTime() -
        new Date(b.updatedAt || 0).getTime()
      );
    });

    return result;
  }, [stations, search, filterStatus, sortBy]);

  // Handlers
  const openCreate = useCallback(() => setModal({ type: "create" }), []);
  const closeModal = useCallback(() => setModal(null), []);

  const handleOpenStation = useCallback(
    (station: any) => {
      switchStation(station.id);
      showNotice(`Switched to ${station.name}`);
      if (onClose) onClose();
    },
    [switchStation, showNotice, onClose],
  );

  const handleEdit = useCallback((station: any) => {
    setEditForm({
      name: station.name,
      location: station.location || "",
      phone: station.phone || "",
      email: station.email || "",
      kraPin: station.kraPin || "",
      etrSerial: station.etrSerial || "",
      taxRate: station.taxRate ?? 16,
      theme: station.theme || "dark",
      description: station.description || "",
    });
    setModal({ type: "edit", station });
  }, []);

  const handleSaveStation = useCallback(
    (formData: any) => {
      if (modal?.type === "create") {
        const station = createStation(formData);
        showNotice(`Station "${station.name}" created`);
        closeModal();
      } else if (modal?.type === "edit" && modal.station) {
        updateStation(modal.station.id, formData);
        showNotice(`Station "${formData.name}" updated`);
        closeModal();
      }
    },
    [modal, createStation, updateStation, showNotice, closeModal],
  );

  const handleShareOpen = useCallback((station: any) => {
    setModal({ type: "share", station });
  }, []);

  const handleShare = useCallback(
    (email: string, password: string) => {
      if (modal?.station && email && password) {
        shareStation(modal.station.id, email, password);
        showNotice(`Access shared with ${email}`);
        closeModal();
      }
    },
    [modal, shareStation, showNotice, closeModal],
  );

  const handleRevoke = useCallback(
    (email: string) => {
      if (modal?.station) {
        revokeAccess(modal.station.id, email);
        showNotice(`Access revoked for ${email}`);
      }
    },
    [modal, revokeAccess, showNotice],
  );

  const handleAccessStation = useCallback(
    (stationId: string, password: string) => {
      switchStation(stationId);
      showNotice("Station accessed successfully");
      closeModal();
      if (onClose) onClose();
    },
    [switchStation, showNotice, closeModal, onClose],
  );

  const handleExport = useCallback(
    (station: any) => {
      downloadJson(`${station.name.replace(/\s+/g, "_")}_export.json`, station);
      showNotice("Station data exported");
    },
    [showNotice],
  );

  const handleDeleteOpen = useCallback((station: any) => {
    setModal({ type: "delete", station });
  }, []);

  const handleDeleteConfirmed = useCallback(() => {
    if (modal?.station) {
      deleteStation(modal.station.id);
      showNotice(`Station "${modal.station.name}" deleted`);
      closeModal();
    }
  }, [modal, deleteStation, showNotice, closeModal]);

  const handleToggleStatus = useCallback(
    (station: any) => {
      const current = stationStatus(station.data);
      const next: "active" | "inactive" | "maintenance" =
        current === "active"
          ? "inactive"
          : current === "inactive"
            ? "maintenance"
            : "active";
      updateStation(station.id, {
        ...station,
        data: { ...station.data, status: next },
      });
      showNotice(`Status changed to ${next}`);
    },
    [updateStation, showNotice],
  );

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await syncToBackend();
      await syncFromBackend();
      showNotice("Sync completed");
    } catch (e) {
      showNotice("Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [syncToBackend, syncFromBackend, showNotice]);

  const combined = combineStations();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onClose && (
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold font-serif flex items-center gap-2">
                <Layers size={20} className="text-amber-400" />
                Station Manager
              </h1>
              <p className="text-xs text-gray-400">
                {stations.length} station(s) | Manage access & data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stations.length > 0 && (
              <>
                <button
                  onClick={() => setModal({ type: "combined" })}
                  className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg text-sm flex items-center gap-2 hover:bg-amber-500/30 transition-colors"
                >
                  <Layers size={14} />
                  Combined View
                </button>
                <button
                  onClick={handleSyncNow}
                  disabled={syncing || isBackendSyncing}
                  className="px-4 py-2 bg-sky-500/20 text-sky-300 rounded-lg text-sm flex items-center gap-2 hover:bg-sky-500/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={
                      syncing || isBackendSyncing ? "animate-spin" : ""
                    }
                  />
                  Sync Now
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Stations"
            value={String(stations.length)}
            icon={Layers}
            accent="text-amber-400"
          />
          <StatCard
            label="Combined Revenue"
            value={formatMoney(stats.totalRevenue)}
            icon={TrendingUp}
            accent="text-emerald-400"
          />
          <StatCard
            label="Today's Revenue"
            value={formatMoney(stats.todayRevenue)}
            icon={Calendar}
            accent="text-sky-400"
          />
          <StatCard
            label="Shared Users"
            value={String(stats.sharedUsers)}
            icon={Users}
            accent="text-purple-400"
          />
        </div>

        {/* Sync status bar */}
        {lastBackendSync && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {isBackendSyncing || syncing ? (
              <>
                <RefreshCw size={12} className="animate-spin text-sky-400" />
                <span className="text-sky-400">Syncing...</span>
              </>
            ) : (
              <>
                <Cloud size={12} className="text-emerald-400" />
                <span>Last sync: {relativeTime(lastBackendSync)}</span>
              </>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stations..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
            {(
              ["all", "active", "inactive", "maintenance"] as FilterStatus[]
            ).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-amber-500/30 text-amber-300"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="recent">Recent first</option>
            <option value="name">Name A–Z</option>
            <option value="revenue">Revenue (high → low)</option>
            <option value="oldest">Oldest first</option>
          </select>

          {/* Create button */}
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Create Station
          </button>
        </div>

        {/* Station grid */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">
            Your Stations{" "}
            <span className="text-sm text-gray-400 font-normal">
              · Combined Revenue: {formatMoney(stats.totalRevenue)}
            </span>
          </h2>

          {isStationLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : stations.length === 0 ? (
            <EmptyState onCreate={openCreate} />
          ) : visibleStations.length === 0 ? (
            <div className={`${GLASS_CARD} p-8 text-center`}>
              <Search className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-300 text-sm">
                No stations match your search/filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleStations.map((s) => (
                <StationCard
                  key={s.id}
                  station={s}
                  isCurrent={currentStation?.id === s.id}
                  onOpen={() => handleOpenStation(s)}
                  onEdit={() => handleEdit(s)}
                  onShare={() => handleShareOpen(s)}
                  onExport={() => handleExport(s)}
                  onDelete={() => handleDeleteOpen(s)}
                  onToggleStatus={() => handleToggleStatus(s)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notice toast */}
      {notice ? (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
          {notice}
        </div>
      ) : null}

      {/* Modals */}
      {modal?.type === "create" ? (
        <StationFormModal
          title="Create Station"
          submitLabel="Create"
          initial={EMPTY_FORM}
          onSubmit={handleSaveStation}
          onClose={closeModal}
        />
      ) : null}

      {modal?.type === "edit" ? (
        <StationFormModal
          title={`Edit — ${modal.station.name}`}
          submitLabel="Save Changes"
          initial={editForm}
          onSubmit={handleSaveStation}
          onClose={closeModal}
        />
      ) : null}

      {modal?.type === "share" ? (
        <ShareModal
          station={modal.station}
          onShare={handleShare}
          onRevoke={handleRevoke}
          onClose={closeModal}
        />
      ) : null}

      {modal?.type === "access" ? (
        <AccessModal
          stations={stations}
          onAccess={handleAccessStation}
          onClose={closeModal}
        />
      ) : null}

      {modal?.type === "combined" ? (
        <CombinedViewModal
          stations={stations}
          combined={combined}
          onClose={closeModal}
        />
      ) : null}

      {modal?.type === "delete" ? (
        <ConfirmDialog
          title="Delete station"
          message={`This permanently deletes "${modal.station?.name}" and its cloud record (station data blob included). This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirmed}
          onCancel={closeModal}
        />
      ) : null}
    </div>
  );
}
