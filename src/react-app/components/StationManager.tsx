import { useState, useMemo, useCallback, useEffect } from "react";
import { useStations } from "@/react-app/context/StationContext";
import { useAuth } from "@/react-app/context/AuthContext";
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
  Building2,
  UserCheck,
  Link as LinkIcon,
  MailOpen,
  ShieldCheck,
  Clock,
  Inbox,
  Loader2,
  LogOut,
  BarChart3,
  Activity,
  Settings,
  Zap,
  Gauge,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Star,
  History,
  Crown,
  MailX,
  Search as SearchIcon,
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
import { getDetectedCountryCode } from "@/react-app/lib/currency";
import { getVATRate } from "@/react-app/config/pricing";
import {
  getSharedStations,
  getPendingInvites,
  getStationActivity,
  getFavorites,
  toggleFavorite,
  acceptInvite,
  rejectInvite,
  revokeMember,
  leaveStation,
  subscribeToMyMemberships,
  type StationMember,
  type StationActivityEntry,
} from "@/react-app/lib/station-share-service";

interface StationManagerProps {
  onClose?: () => void;
}

// ============================================================
// Module-scope subcomponents (UPDATE-4 rule)
// ============================================================

const GLASS_CARD =
  "bg-gray-50 dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-gray-200 dark:border-white/10 rounded-xl";

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
      <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center">
        <Icon size={18} className={accent} />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="font-bold text-gray-900 dark:text-gray-900 dark:text-white text-sm">
          {value}
        </p>
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
    inactive:
      "bg-gray-500/20 text-gray-500 dark:text-gray-500 dark:text-gray-400 border-gray-500/30",
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
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/10" />
          <div>
            <div className="h-4 w-32 bg-gray-100 dark:bg-white/10 rounded mb-2" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-white/10 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-gray-100 dark:bg-white/10 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-100 dark:bg-white/10 rounded" />
        <div className="h-3 w-3/4 bg-gray-100 dark:bg-white/10 rounded" />
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className={`${GLASS_CARD} p-12 text-center`}>
      <Layers size={48} className="text-gray-600 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-900 dark:text-white mb-2">
        No stations yet
      </h3>
      <p className="text-gray-500 dark:text-gray-500 dark:text-gray-400 text-sm mb-6">
        Create your first fuel station to get started
      </p>
      <button
        onClick={onCreate}
        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-gray-900 dark:text-gray-900 dark:text-white font-semibold rounded-xl transition-all flex items-center gap-2 mx-auto"
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
      className={`${GLASS_CARD} p-5 hover:bg-gray-100 dark:bg-white/10 transition-all group relative ${
        isCurrent ? "ring-2 ring-amber-400/50" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl ${avatarColor(
              station.name,
            )} flex items-center justify-center text-gray-900 dark:text-gray-900 dark:text-white font-bold text-sm`}
          >
            {initialsOf(station.name)}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-900 dark:text-white text-sm flex items-center gap-2">
              {station.name}
              {isCurrent && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded">
                  Active
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400">
              {updated}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleStatus}
          className="text-gray-500 dark:text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-900 dark:text-white"
          title="Toggle status"
        >
          <StatusBadge status={status} />
        </button>
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 dark:bg-gray-50 dark:bg-white/5 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-0.5">
            Today
          </p>
          <p className="font-semibold text-emerald-400 text-xs">
            {formatMoney(todayRev)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-50 dark:bg-white/5 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-0.5">
            Month
          </p>
          <p className="font-semibold text-sky-400 text-xs">
            {formatMoney(monthRev)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-50 dark:bg-white/5 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-0.5">
            Total
          </p>
          <p className="font-semibold text-gray-900 dark:text-gray-900 dark:text-white text-xs">
            {formatMoney(totalRev)}
          </p>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 mb-4">
        {station.location && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400">
            <MapPin size={12} className="text-gray-500" />
            <span className="truncate">{station.location}</span>
          </div>
        )}
        {station.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400">
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
          className="px-3 py-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 text-gray-300 rounded-lg text-xs transition-colors"
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
          className="px-3 py-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 text-gray-300 rounded-lg text-xs transition-colors"
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center"
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
            <label className="block text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1.5">
              Station Name *
            </label>
            <input
              type="text"
              value={form.name || ""}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., downtown_branch"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={form.location || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, location: e.target.value }))
              }
              placeholder="e.g., Downtown, [Your City]"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder={getPhonePlaceholder()}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1.5">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={form.taxRate ?? getDefaultTaxRate()}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    taxRate: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1.5">
              Email / Manager
            </label>
            <input
              type="email"
              value={form.email || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="manager@station.com"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-gray-900 dark:text-gray-900 dark:text-white font-semibold rounded-xl transition-colors"
          >
            {submitLabel}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-gray-900 dark:text-white rounded-xl transition-colors"
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 dark:text-white">
            Share Station Access
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center"
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
            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set access password"
              className="w-full px-4 py-2.5 pr-10 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-900 dark:text-white"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            onClick={handleShare}
            disabled={!email.trim() || !password}
            className="w-full px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-gray-900 dark:text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-50 dark:bg-white/5 rounded-lg"
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 dark:text-white">
            Access Shared Station
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center"
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
            <label className="block text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1.5">
              Select Station
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="" className="bg-white dark:bg-gray-800">
                Choose a station...
              </option>
              {stations.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  className="bg-white dark:bg-gray-800"
                >
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1.5">
              Station Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter the access password"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAccess}
            className="flex-1 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-gray-900 dark:text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            Access Station
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-gray-900 dark:text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Access Another Station — RESTRUCTURED (2026-08-23).
//
// A complete redesign of the invite-based station sharing flow. Built on the
// `station_members` DB table (migrations 015/016/017/023/025). Four tabs:
//
//   1. Network   — every station shared with you (accepted memberships) +
//                  your favorites. Search + role filter + favorite toggle.
//                  Each card shows role, inviter, last-accessed, and a
//                  detail drawer (activity feed, tab grants, leave).
//   2. Invites   — pending invites awaiting your acceptance + a "Join by
//                  invite link/token" entry. Accept / reject per invite.
//   3. Activity  — a live cross-device activity feed for the selected
//                  shared station (invite sent/accepted, role changes,
//                  ownership transfers, member left).
//   4. Help      — a short explainer of roles, permissions, and security.
//
// New capabilities vs. the scrapped version:
//   - Favorites (cloud-backed, cross-device) with a dedicated filter.
//   - Search across station name / inviter / role.
//   - Role filter (All / Manager / Staff / Auditor / Custom).
//   - Per-station activity feed (station_activity_<id> app_kv key).
//   - Accept + Reject for pending invites (reject marks the invite rejected).
//   - Leave station uses the dedicated `leaveStation` service function.
//   - Real-time: subscribes to the user's memberships so new invites +
//     accept/revoke events appear instantly without a manual refresh.
//   - Last-accessed timestamp displayed per shared station.
// ============================================================

interface SharedStationInfo {
  stationId: string;
  stationName: string;
  role: string;
  invitedBy: string;
  status: string;
  member: StationMember | null;
  lastAccessedAt?: string | null;
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    manager: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    staff: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    auditor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  const label = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member";
  const cls =
    styles[role?.toLowerCase()] ||
    "bg-gray-500/20 text-gray-500 dark:text-gray-400 border-gray-500/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border ${cls}`}>
      {label}
    </span>
  );
}

function formatLastAccessed(iso?: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Never";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    invite_sent: "sent an invite",
    invite_accepted: "accepted an invite",
    invite_rejected: "rejected an invite",
    invite_revoked: "revoked an invite",
    member_left: "left the station",
    role_changed: "changed a member's role",
    ownership_transferred: "transferred ownership",
    access_recorded: "accessed the station",
  };
  return map[action] || action.replace(/_/g, " ");
}

function AccessSharedStationModal({
  ownedStations,
  sharedStations,
  pendingInvites,
  onAccess,
  onClose,
  onInvitesChanged,
  currentStationId,
  userId,
  invitesVersion,
}: {
  ownedStations: any[];
  sharedStations: SharedStationInfo[];
  pendingInvites: SharedStationInfo[];
  onAccess: (stationId: string) => void;
  onClose: () => void;
  onInvitesChanged: () => void;
  currentStationId?: string;
  userId?: string;
  invitesVersion?: number;
}) {
  const [tab, setTab] = useState<"network" | "invites" | "activity" | "help">(
    sharedStations.length > 0
      ? "network"
      : pendingInvites.length > 0
        ? "invites"
        : "network",
  );
  const [inviteInput, setInviteInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");

  // Network tab: search + role filter + favorites filter
  const [networkSearch, setNetworkSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    sharedStations[0]?.stationId || null,
  );
  const [activity, setActivity] = useState<StationActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [detailStationId, setDetailStationId] = useState<string | null>(null);

  // Load favorites on mount
  useEffect(() => {
    getFavorites()
      .then(setFavorites)
      .catch(() => {});
  }, []);

  // Real-time: subscribe to the user's memberships so new invites / accept /
  // revoke events refresh the lists instantly.
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToMyMemberships(userId, () => {
      onInvitesChanged();
    });
    return () => unsub();
  }, [userId, onInvitesChanged]);

  // Load activity for the selected station on the Activity tab (and whenever
  // invites refresh — an accept generates a new activity entry).
  useEffect(() => {
    if (tab !== "activity" || !selectedStationId) return;
    setActivityLoading(true);
    getStationActivity(selectedStationId)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [tab, selectedStationId, invitesVersion]);

  const extractToken = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed);
      const token = url.searchParams.get("invite");
      if (token) return token;
    } catch {
      // Not a URL — treat as raw token
    }
    return trimmed;
  };

  const handleJoin = async () => {
    const token = extractToken(inviteInput);
    if (!token) {
      setJoinError("Please paste an invite link or token");
      return;
    }
    setJoining(true);
    setJoinError("");
    setJoinSuccess("");
    try {
      const result = await acceptInvite(token);
      if (result.success && result.stationId) {
        setJoinSuccess("Invite accepted! Switching to station...");
        onInvitesChanged();
        setTimeout(() => {
          onAccess(result.stationId!);
        }, 1000);
      } else {
        setJoinError(
          result.error ||
            "Failed to accept invite. The link may be invalid or expired.",
        );
      }
    } catch (e: any) {
      setJoinError(
        e?.message || "An error occurred while accepting the invite",
      );
    } finally {
      setJoining(false);
    }
  };

  const handleToggleFavorite = async (stationId: string) => {
    const res = await toggleFavorite(stationId);
    setFavorites((prev) =>
      res.favorite
        ? [...prev, stationId]
        : prev.filter((id) => id !== stationId),
    );
  };

  // Filtered network list
  const filteredNetwork = useMemo(() => {
    let list = [...sharedStations];
    if (favoritesOnly)
      list = list.filter((s) => favorites.includes(s.stationId));
    if (roleFilter !== "all")
      list = list.filter((s) => (s.role || "").toLowerCase() === roleFilter);
    if (networkSearch.trim()) {
      const q = networkSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.stationName.toLowerCase().includes(q) ||
          (s.invitedBy || "").toLowerCase().includes(q) ||
          (s.role || "").toLowerCase().includes(q),
      );
    }
    // Favorites first, then by name
    list.sort((a, b) => {
      const af = favorites.includes(a.stationId) ? 0 : 1;
      const bf = favorites.includes(b.stationId) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.stationName.localeCompare(b.stationName);
    });
    return list;
  }, [sharedStations, favoritesOnly, roleFilter, networkSearch, favorites]);

  const tabs = [
    {
      id: "network" as const,
      label: "Network",
      icon: Building2,
      count: sharedStations.length,
    },
    {
      id: "invites" as const,
      label: "Invites",
      icon: Inbox,
      count: pendingInvites.length,
    },
    {
      id: "activity" as const,
      label: "Activity",
      icon: History,
      count: null,
    },
    {
      id: "help" as const,
      label: "Help",
      icon: ShieldCheck,
      count: null,
    },
  ];

  const detailStation = detailStationId
    ? sharedStations.find((s) => s.stationId === detailStationId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`${GLASS_CARD} w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 size={20} className="text-sky-400" />
              Access Another Station
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Switch to a shared station, accept an invite, join by link, or
              review activity
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                tab === t.id
                  ? "bg-sky-500/30 text-sky-300"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <t.icon size={15} />
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 rounded-full text-[10px] font-bold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ============ NETWORK TAB ============ */}
          {tab === "network" && (
            <div className="space-y-4">
              {/* Search + filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <SearchIcon
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={networkSearch}
                    onChange={(e) => setNetworkSearch(e.target.value)}
                    placeholder="Search stations, inviters, roles..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <option value="all">All Roles</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                  <option value="auditor">Auditor</option>
                  <option value="owner">Owner</option>
                </select>
                <button
                  onClick={() => setFavoritesOnly((v) => !v)}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors border ${
                    favoritesOnly
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:text-gray-900 dark:text-white"
                  }`}
                >
                  <Star
                    size={14}
                    fill={favoritesOnly ? "currentColor" : "none"}
                  />
                  Favorites
                </button>
              </div>

              {filteredNetwork.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 size={40} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
                    {sharedStations.length === 0
                      ? "No stations shared with you yet"
                      : "No stations match your filters"}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {sharedStations.length === 0
                      ? "When a station owner invites you, the station will appear here"
                      : "Try clearing the search or role filter"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredNetwork.map((s) => {
                    const isFav = favorites.includes(s.stationId);
                    const isActive = currentStationId === s.stationId;
                    return (
                      <div
                        key={s.stationId}
                        className={`bg-gray-50 dark:bg-white/5 border rounded-xl p-4 transition-colors group ${
                          isActive
                            ? "border-sky-400/50 ring-1 ring-sky-400/30"
                            : "border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl ${avatarColor(s.stationName)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}
                            >
                              {initialsOf(s.stationName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate flex items-center gap-1.5">
                                {s.stationName}
                                {isActive && (
                                  <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-400 text-[10px] rounded">
                                    Active
                                  </span>
                                )}
                              </h3>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <RoleBadge role={s.role} />
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleFavorite(s.stationId)}
                            title={
                              isFav
                                ? "Remove from favorites"
                                : "Add to favorites"
                            }
                            className={`flex-shrink-0 p-1 rounded transition-colors ${
                              isFav
                                ? "text-amber-400"
                                : "text-gray-500 hover:text-amber-400"
                            }`}
                          >
                            <Star
                              size={16}
                              fill={isFav ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3 flex-wrap">
                          {s.invitedBy && (
                            <span className="flex items-center gap-1">
                              <UserCheck size={11} />
                              {s.invitedBy}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatLastAccessed(s.lastAccessedAt)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onAccess(s.stationId)}
                            className="flex-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <LogIn size={13} />
                            {isActive ? "Currently Active" : "Access"}
                          </button>
                          <button
                            onClick={() => setDetailStationId(s.stationId)}
                            title="View details & activity"
                            className="px-3 py-1.5 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 rounded-lg text-xs transition-colors"
                          >
                            <History size={13} />
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                !confirm(
                                  `Leave "${s.stationName}"? You will no longer have access to this shared station.`,
                                )
                              )
                                return;
                              const res = await leaveStation(s.stationId);
                              if (res.success) {
                                onInvitesChanged();
                              } else {
                                alert(res.error || "Failed to leave station");
                              }
                            }}
                            title="Leave this shared station"
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors"
                          >
                            <LogOut size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============ INVITES TAB ============ */}
          {tab === "invites" && (
            <div className="space-y-5">
              {/* Pending invites */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Inbox size={15} className="text-amber-400" />
                  Pending Invites
                  {pendingInvites.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold">
                      {pendingInvites.length}
                    </span>
                  )}
                </h3>
                {pendingInvites.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                    <Inbox size={32} className="text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No pending invites
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingInvites.map((s) => (
                      <PendingInviteRow
                        key={s.stationId + (s.member?.id || "")}
                        info={s}
                        onAccept={(stationId) => {
                          onInvitesChanged();
                          onAccess(stationId);
                        }}
                        onReject={() => {
                          if (s.member?.invite_token) {
                            rejectInvite(s.member.invite_token).then(() =>
                              onInvitesChanged(),
                            );
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Join by link */}
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-white/10">
                <div className="text-center py-2">
                  <LinkIcon size={28} className="text-sky-400 mx-auto mb-2" />
                  <h3 className="text-gray-900 dark:text-white font-semibold text-sm mb-1">
                    Join by Invite Link
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    Paste an invite link or token you received from a station
                    owner
                  </p>
                </div>

                {joinError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{joinError}</span>
                  </div>
                )}
                {joinSuccess && (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-start gap-2">
                    <Check size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{joinSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    Invite Link or Token
                  </label>
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="https://fuel-app-mobile.pages.dev/?invite=abc123... or just abc123..."
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !joining) handleJoin();
                    }}
                  />
                </div>

                <button
                  onClick={handleJoin}
                  disabled={joining || !inviteInput.trim()}
                  className="w-full px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {joining ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Accepting Invite...
                    </>
                  ) : (
                    <>
                      <MailOpen size={16} />
                      Accept Invite & Access Station
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============ ACTIVITY TAB ============ */}
          {tab === "activity" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  Select Station
                </label>
                <select
                  value={selectedStationId || ""}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  {sharedStations.length === 0 && (
                    <option value="">No shared stations</option>
                  )}
                  {sharedStations.map((s) => (
                    <option key={s.stationId} value={s.stationId}>
                      {s.stationName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStationId ? (
                activityLoading ? (
                  <div className="text-center py-8">
                    <Loader2
                      size={24}
                      className="animate-spin text-sky-400 mx-auto"
                    />
                  </div>
                ) : activity.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                    <History size={32} className="text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No activity recorded yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activity.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10"
                      >
                        <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
                          <Activity size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-white">
                            <span className="font-medium">
                              {entry.actorName}
                            </span>{" "}
                            <span className="text-gray-500 dark:text-gray-400">
                              {actionLabel(entry.action)}
                            </span>
                          </p>
                          {entry.detail && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {entry.detail}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-8">
                  <Building2 size={40} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Select a shared station to view its activity feed
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============ HELP TAB ============ */}
          {tab === "help" && (
            <div className="space-y-4 text-sm">
              <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                <h3 className="font-semibold text-sky-300 mb-2 flex items-center gap-2">
                  <ShieldCheck size={16} />
                  How Station Sharing Works
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">
                  A station owner invites you by email. Once you accept, the
                  station appears in your Network tab and you can switch to it
                  anytime. Your access level depends on the role assigned by the
                  owner. All data is stored in the cloud (Supabase) and syncs
                  across your devices.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wide">
                  Roles
                </h4>
                <RoleHelpRow
                  icon={<Crown size={14} className="text-amber-400" />}
                  label="Owner"
                  desc="Full control — manage members, settings, and data (only the station creator)."
                />
                <RoleHelpRow
                  icon={<Users size={14} className="text-sky-400" />}
                  label="Manager"
                  desc="Read-write access to most tabs; can manage shifts, sales, and reports."
                />
                <RoleHelpRow
                  icon={<UserCheck size={14} className="text-emerald-400" />}
                  label="Staff"
                  desc="Day-to-day operations — POS, sales tracking, stock adjustments."
                />
                <RoleHelpRow
                  icon={<ShieldCheck size={14} className="text-purple-400" />}
                  label="Auditor"
                  desc="Read-only access for review and compliance auditing."
                />
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Only accept invites from station owners you trust. You can
                    leave a shared station at any time from the Network tab.
                    Leaving removes your membership permanently (you'll need a
                    new invite to regain access).
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {ownedStations.length} owned · {sharedStations.length} shared ·{" "}
            {pendingInvites.length} pending
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-white rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Member detail drawer */}
      {detailStation && (
        <StationDetailDrawer
          info={detailStation}
          onClose={() => setDetailStationId(null)}
          onAccess={(id) => {
            setDetailStationId(null);
            onAccess(id);
          }}
        />
      )}
    </div>
  );
}

function RoleHelpRow({
  icon,
  label,
  desc,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

// Pending invite row with Accept + Reject
function PendingInviteRow({
  info,
  onAccept,
  onReject,
}: {
  info: SharedStationInfo;
  onAccept: (stationId: string) => void;
  onReject: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!info.member?.invite_token) {
      setError("No invite token found");
      return;
    }
    setAccepting(true);
    setError("");
    try {
      const result = await acceptInvite(info.member.invite_token);
      if (result.success && result.stationId) {
        onAccept(result.stationId);
      } else {
        setError(result.error || "Failed to accept invite");
      }
    } catch (e: any) {
      setError(e?.message || "An error occurred");
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!info.member?.invite_token) return;
    setRejecting(true);
    try {
      await rejectInvite(info.member.invite_token);
      onReject();
    } catch {
      /* */
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl ${avatarColor(info.stationName)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}
        >
          {initialsOf(info.stationName)}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {info.stationName}
          </h4>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <RoleBadge role={info.role} />
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <Clock size={11} />
              Awaiting acceptance
            </span>
            {info.invitedBy && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                from {info.invitedBy}
              </span>
            )}
          </div>
          {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          {accepting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} />
          )}
          Accept
        </button>
        <button
          onClick={handleReject}
          disabled={rejecting}
          className="px-3 py-1.5 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-600 dark:text-gray-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
        >
          {rejecting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <MailX size={13} />
          )}
          Reject
        </button>
      </div>
    </div>
  );
}

// Slide-over detail drawer for a shared station
function StationDetailDrawer({
  info,
  onClose,
  onAccess,
}: {
  info: SharedStationInfo;
  onClose: () => void;
  onAccess: (stationId: string) => void;
}) {
  const [drawerActivity, setDrawerActivity] = useState<StationActivityEntry[]>(
    [],
  );
  useEffect(() => {
    getStationActivity(info.stationId)
      .then(setDrawerActivity)
      .catch(() => {});
  }, [info.stationId]);

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl ${avatarColor(info.stationName)} flex items-center justify-center text-white font-bold text-xs`}
            >
              {initialsOf(info.stationName)}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                {info.stationName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <RoleBadge role={info.role} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Membership details */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
              Membership
            </h4>
            <DetailRow label="Invited by" value={info.invitedBy || "Owner"} />
            <DetailRow label="Role" value={info.role || "Member"} />
            <DetailRow label="Status" value={info.status || "accepted"} />
            <DetailRow
              label="Last accessed"
              value={formatLastAccessed(info.lastAccessedAt)}
            />
            {info.member?.expires_at && (
              <DetailRow
                label="Expires"
                value={new Date(info.member.expires_at).toLocaleDateString()}
              />
            )}
            {info.member?.tab_grants &&
              Array.isArray(info.member.tab_grants) &&
              info.member.tab_grants.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Allowed tabs
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {info.member.tab_grants.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded text-[10px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            {info.member?.notes && (
              <DetailRow label="Notes" value={info.member.notes} />
            )}
          </div>

          <button
            onClick={() => onAccess(info.stationId)}
            className="w-full px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn size={15} />
            Access Station
          </button>

          {/* Activity */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1.5">
              <History size={12} />
              Recent Activity
            </h4>
            {drawerActivity.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No activity recorded
              </p>
            ) : (
              <div className="space-y-2">
                {drawerActivity.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="text-xs p-2 bg-gray-50 dark:bg-white/5 rounded-lg"
                  >
                    <p className="text-gray-900 dark:text-white">
                      <span className="font-medium">{entry.actorName}</span>{" "}
                      <span className="text-gray-500 dark:text-gray-400">
                        {actionLabel(entry.action)}
                      </span>
                    </p>
                    {entry.detail && (
                      <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                        {entry.detail}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-white font-medium text-right max-w-[60%] truncate">
        {value}
      </span>
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 dark:text-white flex items-center gap-2">
            <Layers size={20} className="text-amber-400" />
            Combined Station View
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`${GLASS_CARD} p-4 text-center`}>
            <p className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1">
              Today's Revenue
            </p>
            <p className="text-xl font-bold text-emerald-400">
              {formatMoney(todayRevenue)}
            </p>
          </div>
          <div className={`${GLASS_CARD} p-4 text-center`}>
            <p className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1">
              This Month
            </p>
            <p className="text-xl font-bold text-sky-400">
              {formatMoney(monthRevenue)}
            </p>
          </div>
          <div className={`${GLASS_CARD} p-4 text-center`}>
            <p className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1">
              Total Revenue
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-900 dark:text-white">
              {formatMoney(totalRevenue)}
            </p>
          </div>
          <div className={`${GLASS_CARD} p-4 text-center`}>
            <p className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-1">
              Total Sales
            </p>
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
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-50 dark:bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg ${avatarColor(s.name)} flex items-center justify-center text-gray-900 dark:text-gray-900 dark:text-white text-xs font-bold`}
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
          className="w-full px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-gray-900 dark:text-white rounded-xl transition-colors"
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 dark:text-white">
            {title}
          </h2>
        </div>
        <p className="text-gray-300 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-gray-900 dark:text-gray-900 dark:text-white font-semibold rounded-xl transition-colors"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-gray-900 dark:text-white rounded-xl transition-colors"
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

/** Country-aware default tax rate (e.g. 16% Kenya, 0% US) */
function getDefaultTaxRate(): number {
  try {
    return Math.round(getVATRate(getDetectedCountryCode()) * 100);
  } catch {
    return 0;
  }
}

/** Country-aware phone placeholder */
function getPhonePlaceholder(): string {
  const cc = getDetectedCountryCode();
  if (cc === "KE") return "+254 700 000 000";
  if (cc === "UG") return "+256 700 000 000";
  if (cc === "TZ") return "+255 700 000 000";
  if (cc === "NG") return "+234 800 000 0000";
  if (cc === "ZA") return "+27 82 000 0000";
  if (cc === "GB") return "+44 7700 000000";
  return "Enter phone number";
}

const EMPTY_FORM = {
  name: "",
  location: "",
  phone: "",
  email: "",
  kraPin: "",
  etrSerial: "",
  taxRate: getDefaultTaxRate(),
  theme: "dark",
  description: "",
};

type FilterStatus = "all" | "active" | "inactive" | "maintenance";
type SortBy = "name" | "revenue" | "recent" | "oldest";
type SubTab = "stations" | "shared" | "analytics" | "activity";

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

  const { user, bindings } = useAuth();

  const navigate = useNavigate();

  // UI state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("stations");
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedStationIds, setSelectedStationIds] = useState<Set<string>>(
    new Set(),
  );

  // Modal state
  const [modal, setModal] = useState<{
    type:
      | "create"
      | "edit"
      | "share"
      | "access"
      | "access-shared"
      | "combined"
      | "delete";
    station?: any;
  } | null>(null);

  // Form state
  const [editForm, setEditForm] = useState<any>(EMPTY_FORM);

  // Shared/pending station data for the "Access Another Station" modal.
  // SharedStations: stations the user is an accepted member of (from the
  // station_members DB table). pendingInvites: invites awaiting acceptance
  // (invited_email = user.email, status = pending). Both are loaded async
  // from Supabase and refreshed on demand (onInvitesChanged).
  const [sharedStations, setSharedStations] = useState<SharedStationInfo[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SharedStationInfo[]>([]);
  const [invitesVersion, setInvitesVersion] = useState(0);

  const loadSharedAndPending = useCallback(async () => {
    if (!user?.id) return;
    // Shared (accepted) stations — from station_members DB + AuthContext bindings
    const members = await getSharedStations();
    const fromBindings: SharedStationInfo[] = bindings
      .filter((b) => b.active)
      .map((b) => ({
        stationId: b.stationId,
        stationName: b.stationName,
        role: b.role,
        invitedBy: b.invitedBy,
        status: "accepted",
        member: members.find((m) => m.station_id === b.stationId) || null,
        lastAccessedAt:
          members.find((m) => m.station_id === b.stationId)?.last_accessed_at ||
          null,
      }));
    const fromMembers: SharedStationInfo[] = members
      .filter((m) => !fromBindings.some((b) => b.stationId === m.station_id))
      .map((m) => ({
        stationId: m.station_id,
        stationName: m.name || "Shared Station",
        role: m.role,
        invitedBy: m.invited_by_name || m.invited_by_unique_id || "Owner",
        status: m.status,
        member: m,
        lastAccessedAt: m.last_accessed_at || null,
      }));
    // Deduplicate by stationId
    const seen = new Set<string>();
    const shared = [...fromBindings, ...fromMembers].filter((s) => {
      if (seen.has(s.stationId)) return false;
      seen.add(s.stationId);
      return true;
    });
    setSharedStations(shared);

    // Pending invites — via the dedicated service function (returns rows with
    // the station name joined so the UI can render it without an extra fetch).
    try {
      const pendingRows = await getPendingInvites();
      const pending: SharedStationInfo[] = pendingRows.map((row) => ({
        stationId: row.station_id,
        stationName:
          (row as any).stations?.name || row.name || "Shared Station",
        role: row.role || "staff",
        invitedBy: row.invited_by_name || row.invited_by_unique_id || "Owner",
        status: "pending",
        member: row,
        lastAccessedAt: row.last_accessed_at || null,
      }));
      setPendingInvites(pending);
    } catch (err) {
      console.warn("[StationManager] Failed to load pending invites:", err);
    }
  }, [user?.id, user?.email, bindings]);

  // Load shared/pending station data when the modal opens or invites are refreshed
  useEffect(() => {
    if (modal?.type === "access-shared" || invitesVersion > 0) {
      loadSharedAndPending();
    }
  }, [modal?.type, invitesVersion, loadSharedAndPending]);

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
      taxRate: station.taxRate ?? getDefaultTaxRate(),
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

  // Access a shared/member station — switches to it (the station is already
  // loaded into StationContext.stations by the member-stations query).
  const handleAccessSharedStation = useCallback(
    (stationId: string) => {
      const station = stations.find((s) => s.id === stationId);
      switchStation(stationId);
      // Record last-accessed-at on the membership row so the Network tab can
      // show "last active" + log an activity entry for the shared station.
      if (station?.ownerId && user?.id && station.ownerId !== user.id) {
        import("@/react-app/lib/station-share-service").then(
          ({ recordStationActivity }) => {
            recordStationActivity(stationId, {
              actorId: user.id,
              actorName: user.email || "Member",
              action: "access_recorded",
              detail: `Accessed ${station.name}`,
            }).catch(() => {});
          },
        );
      }
      showNotice(
        station
          ? `Switched to ${station.name}${station.ownerId && station.ownerId !== user?.id ? " (shared)" : ""}`
          : "Station accessed successfully",
      );
      closeModal();
      if (onClose) onClose();
    },
    [
      stations,
      switchStation,
      showNotice,
      closeModal,
      onClose,
      user?.id,
      user?.email,
    ],
  );

  // Derived: split stations into owned vs shared (member) stations using the
  // ownerId field (set by stationRowToStation) or the AuthContext bindings.
  const ownedStations = useMemo(() => {
    return stations.filter((s) => {
      // If ownerId is known and matches the current user, it's owned
      if (s.ownerId && user?.id && s.ownerId === user.id) return true;
      // If there's a binding for this station with role "owner", it's owned
      const binding = bindings.find((b) => b.stationId === s.id);
      if (binding && binding.role === "owner") return true;
      // If there's no binding at all AND ownerId is falsy, assume owned
      // (member stations have a non-matching ownerId or a non-owner binding)
      if (!binding && !s.ownerId) return true;
      // If ownerId is set but doesn't match the user, it's shared (not owned)
      if (s.ownerId && user?.id && s.ownerId !== user.id) return false;
      // If there's a binding with a non-owner role, it's shared
      if (binding && binding.role !== "owner") return false;
      return true;
    });
  }, [stations, user?.id, bindings]);

  const sharedStationsFromContext = useMemo(() => {
    return stations.filter((s) => !ownedStations.includes(s));
  }, [stations, ownedStations]);

  // Leave a shared station — removes the user's membership from station_members
  const handleLeaveSharedStation = useCallback(
    async (stationId: string, stationName: string) => {
      if (
        !confirm(
          `Leave "${stationName}"? You will no longer have access to this shared station.`,
        )
      ) {
        return;
      }
      try {
        // Find the membership record to revoke
        const members = await getSharedStations();
        const member = members.find((m) => m.station_id === stationId);
        if (member) {
          const result = await revokeMember(member.id);
          if (!result.success) {
            showNotice(`Failed to leave: ${result.error}`);
            return;
          }
        }
        // If we're currently on the station being left, switch to the first owned station
        if (currentStation?.id === stationId) {
          const firstOwned = ownedStations[0];
          if (firstOwned) {
            switchStation(firstOwned.id);
          }
        }
        showNotice(`Left "${stationName}"`);
        setInvitesVersion((v) => v + 1);
      } catch (e: any) {
        showNotice(`Failed to leave station: ${e?.message || "error"}`);
      }
    },
    [currentStation?.id, ownedStations, switchStation, showNotice],
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

  // Bulk actions
  const toggleStationSelection = useCallback((stationId: string) => {
    setSelectedStationIds((prev) => {
      const next = new Set(prev);
      if (next.has(stationId)) next.delete(stationId);
      else next.add(stationId);
      return next;
    });
  }, []);

  const handleBulkExport = useCallback(() => {
    const selected = stations.filter((s) => selectedStationIds.has(s.id));
    downloadJson(
      `stations_export_${Date.now()}.json`,
      selected.map((s) => ({
        id: s.id,
        name: s.name,
        location: s.location,
        data: s.data,
      })),
    );
    showNotice(`Exported ${selected.length} stations`);
    setBulkSelectMode(false);
    setSelectedStationIds(new Set());
  }, [stations, selectedStationIds, showNotice]);

  const handleBulkSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncToBackend();
      await syncFromBackend();
      showNotice(`Synced ${selectedStationIds.size} stations`);
    } catch {
      showNotice("Bulk sync failed");
    } finally {
      setSyncing(false);
      setBulkSelectMode(false);
      setSelectedStationIds(new Set());
    }
  }, [syncToBackend, syncFromBackend, selectedStationIds.size, showNotice]);

  const handleBulkActivate = useCallback(() => {
    selectedStationIds.forEach((id) => {
      const station = stations.find((s) => s.id === id);
      if (station) {
        updateStation(id, {
          ...station,
          data: { ...station.data, status: "active" },
        });
      }
    });
    showNotice(`Activated ${selectedStationIds.size} stations`);
    setBulkSelectMode(false);
    setSelectedStationIds(new Set());
  }, [selectedStationIds, stations, updateStation, showNotice]);

  // Analytics: per-station health + comparison
  const stationAnalytics = useMemo(() => {
    return stations
      .map((s) => {
        const data = s.data || {};
        const totalRev = stationTotalRevenue(data);
        const todayRev = stationRevenueSince(data, startOfToday());
        const monthRev = stationRevenueSince(data, startOfMonth());
        const sales = stationSalesCount(data);
        const status = stationStatus(data);
        const sharedCount = (data.sharedUsers || []).length;
        // Health score: simple heuristic based on sales + revenue recency
        let healthScore = 50;
        if (status === "active") healthScore += 20;
        if (status === "maintenance") healthScore += 5;
        if (sales > 0) healthScore += 15;
        if (todayRev > 0) healthScore += 15;
        healthScore = Math.min(100, healthScore);
        const healthLabel =
          healthScore >= 80
            ? "Excellent"
            : healthScore >= 60
              ? "Good"
              : healthScore >= 40
                ? "Fair"
                : "Needs Attention";
        return {
          station: s,
          totalRev,
          todayRev,
          monthRev,
          sales,
          status,
          sharedCount,
          healthScore,
          healthLabel,
        };
      })
      .sort((a, b) => b.totalRev - a.totalRev);
  }, [stations]);

  // Top performing station
  const topStation = stationAnalytics[0] || null;
  const avgRevenue =
    stations.length > 0 ? stats.totalRevenue / stations.length : 0;
  const totalSales = stationAnalytics.reduce((sum, a) => sum + a.sales, 0);
  const activeCount = stationAnalytics.filter(
    (a) => a.status === "active",
  ).length;
  const avgHealth =
    stationAnalytics.length > 0
      ? Math.round(
          stationAnalytics.reduce((sum, a) => sum + a.healthScore, 0) /
            stationAnalytics.length,
        )
      : 0;

  const combined = combineStations();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-gray-900 dark:text-gray-900 dark:text-white">
      {/* Header */}
      <header className="bg-gray-50 dark:bg-white/5 backdrop-blur-lg border-b border-gray-200 dark:border-white/10 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onClose && (
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold font-serif flex items-center gap-2">
                <Layers size={20} className="text-amber-400" />
                Station Manager
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400">
                {ownedStations.length} owned ·{" "}
                {sharedStationsFromContext.length} shared | Manage access & data
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
        {/* Sub-tab navigation */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
          {[
            { id: "stations" as const, label: "My Stations", icon: Layers },
            {
              id: "shared" as const,
              label: "Shared With Me",
              icon: Building2,
              count: sharedStationsFromContext.length,
            },
            { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
            {
              id: "activity" as const,
              label: "Activity & Health",
              icon: Activity,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Stat cards (always visible) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Your Stations"
            value={String(ownedStations.length)}
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
            label="Shared With You"
            value={String(sharedStationsFromContext.length)}
            icon={Building2}
            accent="text-sky-400"
          />
        </div>

        {/* Sync status bar */}
        {lastBackendSync && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400">
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

        {/* ===================== STATIONS SUB-TAB ===================== */}
        {activeSubTab === "stations" && (
          <>
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
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                />
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-50 dark:bg-white/5 rounded-xl p-1">
                {(
                  ["all", "active", "inactive", "maintenance"] as FilterStatus[]
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterStatus === s
                        ? "bg-amber-500/30 text-amber-300"
                        : "text-gray-500 dark:text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-900 dark:text-white"
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
                className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-200 dark:border-white/10 text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="recent">Recent first</option>
                <option value="name">Name A–Z</option>
                <option value="revenue">Revenue (high → low)</option>
                <option value="oldest">Oldest first</option>
              </select>

              {/* Bulk select toggle */}
              {ownedStations.length > 0 && (
                <button
                  onClick={() => {
                    setBulkSelectMode((v) => !v);
                    setSelectedStationIds(new Set());
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                    bulkSelectMode
                      ? "bg-purple-500/30 text-purple-300"
                      : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
                  }`}
                  title="Select multiple stations for bulk actions"
                >
                  <CheckCircle2 size={16} />
                  {bulkSelectMode ? "Cancel Bulk" : "Bulk Select"}
                </button>
              )}

              {/* Create button */}
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-gray-900 dark:text-gray-900 dark:text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Create Station
              </button>

              {/* Access Another Station button */}
              <button
                onClick={() => setModal({ type: "access-shared" })}
                className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors relative"
              >
                <Building2 size={16} />
                Access Another Station
                {(pendingInvites.length > 0 || sharedStations.length > 0) && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-[10px] font-bold flex items-center justify-center text-gray-900 dark:text-gray-900 dark:text-white">
                    {pendingInvites.length + sharedStations.length}
                  </span>
                )}
              </button>
            </div>

            {/* Bulk actions bar */}
            {bulkSelectMode && selectedStationIds.size > 0 && (
              <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <span className="text-sm text-purple-300 font-medium">
                  {selectedStationIds.size} selected
                </span>
                <button
                  onClick={handleBulkExport}
                  className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download size={13} /> Export
                </button>
                <button
                  onClick={handleBulkSync}
                  disabled={syncing}
                  className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    size={13}
                    className={syncing ? "animate-spin" : ""}
                  />{" "}
                  Sync
                </button>
                <button
                  onClick={handleBulkActivate}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 size={13} /> Activate All
                </button>
                <button
                  onClick={() => setSelectedStationIds(new Set())}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-300"
                >
                  Clear selection
                </button>
              </div>
            )}

            {/* Station grid */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-900 dark:text-white mb-3">
                Your Stations{" "}
                <span className="text-sm text-gray-500 dark:text-gray-500 dark:text-gray-400 font-normal">
                  · Combined Revenue: {formatMoney(stats.totalRevenue)}
                </span>
              </h2>

              {isStationLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : ownedStations.length === 0 &&
                sharedStationsFromContext.length === 0 ? (
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
                  {visibleStations
                    .filter((s) => ownedStations.includes(s))
                    .map((s) => (
                      <div key={s.id} className="relative">
                        {bulkSelectMode && (
                          <button
                            onClick={() => toggleStationSelection(s.id)}
                            className={`absolute -top-2 -left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              selectedStationIds.has(s.id)
                                ? "bg-purple-500 text-white"
                                : "bg-gray-300 dark:bg-gray-600 text-gray-500"
                            }`}
                          >
                            {selectedStationIds.has(s.id) && (
                              <Check size={14} />
                            )}
                          </button>
                        )}
                        <StationCard
                          station={s}
                          isCurrent={currentStation?.id === s.id}
                          onOpen={() => handleOpenStation(s)}
                          onEdit={() => handleEdit(s)}
                          onShare={() => handleShareOpen(s)}
                          onExport={() => handleExport(s)}
                          onDelete={() => handleDeleteOpen(s)}
                          onToggleStatus={() => handleToggleStatus(s)}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================== ANALYTICS SUB-TAB ===================== */}
        {activeSubTab === "analytics" && (
          <div className="space-y-6">
            {/* Aggregate analytics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Sales"
                value={String(totalSales)}
                icon={BarChart3}
                accent="text-purple-400"
              />
              <StatCard
                label="Avg Revenue / Station"
                value={formatMoney(avgRevenue)}
                icon={TrendingUp}
                accent="text-emerald-400"
              />
              <StatCard
                label="Active Stations"
                value={`${activeCount}/${stations.length}`}
                icon={CheckCircle2}
                accent="text-emerald-400"
              />
              <StatCard
                label="Avg Health Score"
                value={`${avgHealth}%`}
                icon={Gauge}
                accent={avgHealth >= 60 ? "text-emerald-400" : "text-amber-400"}
              />
            </div>

            {/* Top performer */}
            {topStation && (
              <div className={`${GLASS_CARD} p-5`}>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={18} className="text-emerald-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Top Performing Station
                  </h3>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-xl ${avatarColor(topStation.station.name)} flex items-center justify-center text-gray-900 dark:text-white font-bold`}
                  >
                    {initialsOf(topStation.station.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {topStation.station.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {topStation.sales} sales ·{" "}
                      {formatMoney(topStation.todayRev)} today ·{" "}
                      {formatMoney(topStation.monthRev)} this month
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">
                      {formatMoney(topStation.totalRev)}
                    </p>
                    <p className="text-[10px] text-gray-500">Total Revenue</p>
                  </div>
                </div>
              </div>
            )}

            {/* Station comparison table */}
            <div className={`${GLASS_CARD} overflow-hidden`}>
              <div className="p-4 border-b border-gray-200 dark:border-white/10">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 size={16} className="text-blue-400" />
                  Station Comparison
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-white/5">
                    <tr>
                      <th className="text-left p-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Station
                      </th>
                      <th className="text-right p-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Today
                      </th>
                      <th className="text-right p-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Month
                      </th>
                      <th className="text-right p-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Total
                      </th>
                      <th className="text-right p-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Sales
                      </th>
                      <th className="text-center p-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Health
                      </th>
                      <th className="text-center p-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stationAnalytics.map((a) => (
                      <tr
                        key={a.station.id}
                        className="border-t border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg ${avatarColor(a.station.name)} flex items-center justify-center text-[10px] font-bold text-gray-900 dark:text-white`}
                            >
                              {initialsOf(a.station.name)}
                            </div>
                            <span className="text-gray-900 dark:text-white font-medium truncate max-w-[120px]">
                              {a.station.name}
                            </span>
                          </div>
                        </td>
                        <td className="text-right p-3 text-emerald-400 text-xs">
                          {formatMoney(a.todayRev)}
                        </td>
                        <td className="text-right p-3 text-sky-400 text-xs">
                          {formatMoney(a.monthRev)}
                        </td>
                        <td className="text-right p-3 text-gray-900 dark:text-white font-medium text-xs">
                          {formatMoney(a.totalRev)}
                        </td>
                        <td className="text-right p-3 text-gray-500 dark:text-gray-400 text-xs">
                          {a.sales}
                        </td>
                        <td className="text-center p-3">
                          <span
                            className={`text-xs font-medium ${a.healthScore >= 80 ? "text-emerald-400" : a.healthScore >= 60 ? "text-sky-400" : a.healthScore >= 40 ? "text-amber-400" : "text-red-400"}`}
                          >
                            {a.healthScore}%
                          </span>
                        </td>
                        <td className="text-center p-3">
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                    {stationAnalytics.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm"
                        >
                          No stations to compare yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export analytics */}
            <button
              onClick={() => {
                downloadJson(
                  `station_analytics_${Date.now()}.json`,
                  stationAnalytics.map((a) => ({
                    station: a.station.name,
                    todayRevenue: a.todayRev,
                    monthRevenue: a.monthRev,
                    totalRevenue: a.totalRev,
                    sales: a.sales,
                    healthScore: a.healthScore,
                    healthLabel: a.healthLabel,
                    status: a.status,
                  })),
                );
                showNotice("Analytics exported");
              }}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl text-sm flex items-center gap-2 transition-colors"
            >
              <Download size={14} /> Export Analytics
            </button>
          </div>
        )}

        {/* ===================== ACTIVITY & HEALTH SUB-TAB ===================== */}
        {activeSubTab === "activity" && (
          <div className="space-y-6">
            {/* Health overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Avg Health"
                value={`${avgHealth}%`}
                icon={Gauge}
                accent={avgHealth >= 60 ? "text-emerald-400" : "text-amber-400"}
              />
              <StatCard
                label="Active"
                value={String(activeCount)}
                icon={CheckCircle2}
                accent="text-emerald-400"
              />
              <StatCard
                label="Needs Attention"
                value={String(
                  stationAnalytics.filter((a) => a.healthScore < 60).length,
                )}
                icon={AlertCircle}
                accent="text-red-400"
              />
              <StatCard
                label="Cloud Synced"
                value={String(
                  stationAnalytics.filter(
                    (a) =>
                      a.station.id.includes("-") ||
                      a.station.id.includes("backend_"),
                  ).length,
                )}
                icon={Cloud}
                accent="text-emerald-400"
              />
            </div>

            {/* Per-station health cards */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Activity size={16} className="text-amber-400" />
                Station Health Dashboard
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {stationAnalytics.map((a) => {
                  const HealthIcon =
                    a.healthScore >= 80
                      ? CheckCircle2
                      : a.healthScore >= 60
                        ? Gauge
                        : a.healthScore >= 40
                          ? AlertCircle
                          : XCircle;
                  const healthColor =
                    a.healthScore >= 80
                      ? "text-emerald-400"
                      : a.healthScore >= 60
                        ? "text-sky-400"
                        : a.healthScore >= 40
                          ? "text-amber-400"
                          : "text-red-400";
                  return (
                    <div key={a.station.id} className={`${GLASS_CARD} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-lg ${avatarColor(a.station.name)} flex items-center justify-center text-[10px] font-bold text-gray-900 dark:text-white`}
                          >
                            {initialsOf(a.station.name)}
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[100px]">
                            {a.station.name}
                          </span>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <HealthIcon size={16} className={healthColor} />
                        <span className={`text-sm font-medium ${healthColor}`}>
                          {a.healthLabel}
                        </span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {a.healthScore}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            a.healthScore >= 80
                              ? "bg-emerald-500"
                              : a.healthScore >= 60
                                ? "bg-sky-500"
                                : a.healthScore >= 40
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                          }`}
                          style={{ width: `${a.healthScore}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">
                            Today
                          </p>
                          <p className="text-emerald-400 font-medium">
                            {formatMoney(a.todayRev)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">
                            Sales
                          </p>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {a.sales}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">
                            Shared
                          </p>
                          <p className="text-purple-400 font-medium">
                            {a.sharedCount}
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">
                        Updated {relativeTime(a.station.updatedAt)}
                      </p>
                    </div>
                  );
                })}
                {stationAnalytics.length === 0 && (
                  <div className={`${GLASS_CARD} p-8 text-center col-span-2`}>
                    <Activity
                      size={32}
                      className="text-gray-500 mx-auto mb-2"
                    />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No station activity yet
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sync status */}
            <div className={`${GLASS_CARD} p-4`}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Cloud size={16} className="text-emerald-400" />
                Cloud Sync Status
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    Backend Syncing
                  </span>
                  <span
                    className={
                      isBackendSyncing ? "text-sky-400" : "text-emerald-400"
                    }
                  >
                    {isBackendSyncing ? "In progress..." : "Idle"}
                  </span>
                </div>
                {lastBackendSync && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Last Sync
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {relativeTime(lastBackendSync)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    Admin Mode
                  </span>
                  <span
                    className={isAdmin ? "text-emerald-400" : "text-gray-500"}
                  >
                    {isAdmin ? "Yes" : "No"}
                  </span>
                </div>
                <button
                  onClick={handleSyncNow}
                  disabled={syncing || isBackendSyncing}
                  className="mt-2 px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    size={13}
                    className={syncing ? "animate-spin" : ""}
                  />{" "}
                  Sync Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== SHARED SUB-TAB ===================== */}
        {activeSubTab === "shared" && (
          <>
            {/* Shared With You section — stations owned by OTHER users that this
                user has been invited to access (read or read-write based on role). */}
            {sharedStationsFromContext.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Building2 size={18} className="text-sky-400" />
                  Shared With You
                  <span className="text-sm text-gray-500 dark:text-gray-500 dark:text-gray-400 font-normal">
                    · {sharedStationsFromContext.length} station(s)
                  </span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {sharedStationsFromContext.map((s) => {
                    const binding = bindings.find((b) => b.stationId === s.id);
                    const role =
                      s.memberRole || s.userRole || binding?.role || "member";
                    const invitedBy =
                      s.invitedBy || binding?.invitedBy || "Owner";
                    return (
                      <div
                        key={s.id}
                        className={`${
                          currentStation?.id === s.id
                            ? "ring-2 ring-sky-400/50"
                            : ""
                        } ${GLASS_CARD} p-5 hover:bg-gray-100 dark:bg-white/10 transition-all relative`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-xl ${avatarColor(
                                s.name,
                              )} flex items-center justify-center text-gray-900 dark:text-gray-900 dark:text-white font-bold text-sm`}
                            >
                              {initialsOf(s.name)}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 dark:text-gray-900 dark:text-white text-sm flex items-center gap-2">
                                {s.name}
                                {currentStation?.id === s.id && (
                                  <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-400 text-[10px] rounded">
                                    Active
                                  </span>
                                )}
                              </h3>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <RoleBadge role={role} />
                                <span className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <UserCheck size={11} />
                                  {invitedBy}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {s.location && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400 mb-3">
                            <MapPin size={12} className="text-gray-500" />
                            <span className="truncate">{s.location}</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccessSharedStation(s.id)}
                            className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-gray-900 dark:text-gray-900 dark:text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                          >
                            <LogIn size={15} />
                            {currentStation?.id === s.id
                              ? "Currently Active"
                              : "Access Station"}
                          </button>
                          <button
                            onClick={() =>
                              handleLeaveSharedStation(s.id, s.name)
                            }
                            title="Leave this shared station"
                            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
                          >
                            <LogOut size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Empty state for shared tab */}
            {sharedStationsFromContext.length === 0 && (
              <div className={`${GLASS_CARD} p-12 text-center`}>
                <Building2 size={48} className="text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  No stations shared with you
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  When a station owner invites you, the station will appear
                  here.
                </p>
                <button
                  onClick={() => setModal({ type: "access-shared" })}
                  className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 mx-auto"
                >
                  <Building2 size={18} />
                  Access Another Station
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Notice toast */}
      {notice ? (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-gray-900 dark:text-gray-900 dark:text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
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

      {modal?.type === "access-shared" ? (
        <AccessSharedStationModal
          ownedStations={ownedStations}
          sharedStations={sharedStations}
          pendingInvites={pendingInvites}
          onAccess={handleAccessSharedStation}
          onClose={closeModal}
          onInvitesChanged={() => setInvitesVersion((v) => v + 1)}
          currentStationId={currentStation?.id}
          userId={user?.id}
          invitesVersion={invitesVersion}
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
