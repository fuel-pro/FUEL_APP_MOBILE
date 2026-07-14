/**
 * FuelPro Admin Dashboard
 * Comprehensive admin interface for managing the entire platform
 */

import { useState, useEffect, useMemo } from "react";
import {
  Shield,
  Users,
  Settings,
  Activity,
  Database,
  Key,
  Webhook,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  LogOut,
  ChevronRight,
  Search,
  Filter,
  Download,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Server,
  Wifi,
  WifiOff,
  BarChart3,
  PieChart,
  LineChart,
  Calendar,
} from "lucide-react";
import { AdminUser, useAdminAuth, PERMISSIONS } from "../lib/adminAuth";
import { AuditLogger, AuditLogEntry } from "../lib/auditLogger";
import { AdminAPI, AdminSettingsAPI, AdminUsersAPI } from "../lib/adminAPI";

interface AdminDashboardProps {
  user: AdminUser;
}

// ─── Tab Definitions ───
type Tab =
  | "overview"
  | "users"
  | "stations"
  | "settings"
  | "audit"
  | "api"
  | "system";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "Users", icon: Users },
  { id: "stations", label: "Stations", icon: Server },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "audit", label: "Audit Log", icon: Shield },
  { id: "api", label: "API Keys", icon: Key },
  { id: "system", label: "System", icon: Database },
];

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const { logout, hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const canAccessTab = (tabId: string): boolean => {
    switch (tabId) {
      case "users":
        return hasPermission(PERMISSIONS.USERS_VIEW);
      case "stations":
        return hasPermission(PERMISSIONS.STATIONS_VIEW);
      case "settings":
        return hasPermission(PERMISSIONS.SETTINGS_VIEW);
      case "audit":
        return hasPermission(PERMISSIONS.ADMIN_AUDIT);
      case "api":
        return hasPermission(PERMISSIONS.API_ADMIN);
      case "system":
        return hasPermission(PERMISSIONS.ADMIN_SETTINGS);
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside
        className={`${sidebarCollapsed ? "w-16" : "w-64"} bg-gray-900 text-white flex flex-col transition-all duration-300`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold">FuelPro Admin</h1>
                <p className="text-xs text-gray-400">
                  {user.role.toUpperCase()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {TABS.filter(tab => canAccessTab(tab.id)).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-amber-500 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <tab.icon size={18} />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">{tab.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
              <span className="font-bold">{user.name.charAt(0)}</span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={logout}
              className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
            >
              <LogOut size={16} /> Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-gray-500">Welcome back, {user.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={14} /> {new Date().toLocaleString()}
              </span>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronRight
                  size={18}
                  className={`transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
                />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {activeTab === "overview" && <OverviewTab user={user} />}
          {activeTab === "users" && hasPermission(PERMISSIONS.USERS_VIEW) && (
            <UsersTab />
          )}
          {activeTab === "stations" &&
            hasPermission(PERMISSIONS.STATIONS_VIEW) && <StationsTab />}
          {activeTab === "settings" &&
            hasPermission(PERMISSIONS.SETTINGS_VIEW) && <SettingsTab />}
          {activeTab === "audit" && hasPermission(PERMISSIONS.ADMIN_AUDIT) && (
            <AuditTab />
          )}
          {activeTab === "api" && hasPermission(PERMISSIONS.API_ADMIN) && (
            <APIKeysTab />
          )}
          {activeTab === "system" &&
            hasPermission(PERMISSIONS.ADMIN_SETTINGS) && <SystemTab />}
        </div>
      </main>
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ user }: { user: AdminUser }) {
  const auditLogger = AuditLogger.getInstance();
  const recentLogs = auditLogger.getRecentLogs(5);
  const stats = auditLogger.getStats();
  const [health, setHealth] = useState({
    status: "healthy",
    uptime: 99.9,
    services: { api: "up", db: "up", cache: "up" },
  });

  const statCards = [
    {
      label: "Total Users",
      value: AdminAPI.getMockUsers().length,
      icon: Users,
      color: "blue",
    },
    {
      label: "Active Stations",
      value: AdminAPI.getMockStations().length,
      icon: Server,
      color: "green",
    },
    {
      label: "API Calls Today",
      value: "12.5K",
      icon: Activity,
      color: "amber",
    },
    {
      label: "System Uptime",
      value: `${health.uptime}%`,
      icon: TrendingUp,
      color: "purple",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`p-2 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30`}
              >
                <stat.icon
                  size={20}
                  className={`text-${stat.color}-600 dark:text-${stat.color}-400`}
                />
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  health.status === "healthy"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {health.status}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Chart (Placeholder) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Activity Overview
            </h3>
            <select className="text-sm px-3 py-1 border rounded-lg dark:bg-gray-700">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <div className="h-48 flex items-center justify-center text-gray-400">
            <BarChart3 size={48} className="mb-2" />
            <p>Activity chart placeholder</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
            <button className="text-sm text-amber-600 hover:underline">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentLogs.map(log => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 ${
                    log.severity === "critical"
                      ? "bg-red-500"
                      : log.severity === "warning"
                        ? "bg-amber-500"
                        : log.severity === "error"
                          ? "bg-red-400"
                          : "bg-blue-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {log.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    {log.userEmail} • {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <p className="text-center text-gray-400 py-4">
                No recent activity
              </p>
            )}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          System Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(health.services).map(([service, status]) => (
            <div
              key={service}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {status === "up" ? (
                  <Wifi size={20} className="text-green-500" />
                ) : (
                  <WifiOff size={20} className="text-red-500" />
                )}
                <span className="font-medium capitalize">{service}</span>
              </div>
              <span
                className={`text-sm ${status === "up" ? "text-green-600" : "text-red-600"}`}
              >
                {status === "up" ? "Operational" : "Down"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ───
function UsersTab() {
  const [users] = useState(AdminAPI.getMockUsers());
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredUsers = users.filter(
    u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 w-64 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                User
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                Role
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                Last Login
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr
                key={user.id}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-semibold">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === "founder"
                        ? "bg-purple-100 text-purple-700"
                        : user.role === "admin"
                          ? "bg-blue-100 text-blue-700"
                          : user.role === "manager"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      user.isActive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {user.isActive ? (
                      <CheckCircle size={12} />
                    ) : (
                      <AlertTriangle size={12} />
                    )}
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {user.lastLogin
                    ? new Date(user.lastLogin).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <Edit2 size={14} />
                  </button>
                  <button className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded ml-1">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Stations Tab ───
function StationsTab() {
  const [stations] = useState(AdminAPI.getMockStations());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map(station => (
          <div
            key={station.id}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Server size={20} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {station.name}
                  </h3>
                  <p className="text-xs text-gray-500">{station.location}</p>
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  station.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {station.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <button className="text-sm text-amber-600 hover:underline">
                View Details
              </button>
              <button className="text-sm text-gray-500 hover:text-gray-700">
                <Settings size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Tab ───
function SettingsTab() {
  const [settings] = useState(AdminAPI.getMockSettings());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Company
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Name</label>
              <p className="font-medium">{settings.company.name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Email</label>
              <p className="font-medium">{settings.company.email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Phone</label>
              <p className="font-medium">{settings.company.phone}</p>
            </div>
          </div>
          <button className="mt-4 text-sm text-amber-600 hover:underline">
            Edit
          </button>
        </div>

        {/* Business Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Business
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Currency</label>
              <p className="font-medium">
                {settings.localization.currency} (
                {settings.localization.currencySymbol})
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Timezone</label>
              <p className="font-medium">{settings.localization.timezone}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Tax Rate</label>
              <p className="font-medium">
                {(settings.business.taxRate * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          <button className="mt-4 text-sm text-amber-600 hover:underline">
            Edit
          </button>
        </div>

        {/* Integrations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Integrations
          </h3>
          <div className="space-y-3">
            {Object.entries(settings.integrations).map(([key, config]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="capitalize">{key}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    config.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {config.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
          <button className="mt-4 text-sm text-amber-600 hover:underline">
            Configure
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Audit Tab ───
function AuditTab() {
  const auditLogger = AuditLogger.getInstance();
  const [logs, setLogs] = useState<AuditLogEntry[]>(auditLogger.getLogs());
  const [filter, setFilter] = useState<string>("");

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm">
            <option value="">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="USER_CREATE">User Created</option>
            <option value="SETTINGS_UPDATE">Settings Changed</option>
          </select>
          <input
            type="date"
            className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
          <Download size={14} /> Export
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                Timestamp
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                Action
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                User
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                Details
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                Severity
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr
                key={log.id}
                className="border-b border-gray-100 dark:border-gray-700"
              >
                <td className="px-4 py-3 text-gray-500">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium">{log.action}</td>
                <td className="px-4 py-3">{log.userEmail}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                  {log.description}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      log.severity === "critical"
                        ? "bg-red-100 text-red-700"
                        : log.severity === "warning"
                          ? "bg-amber-100 text-amber-700"
                          : log.severity === "error"
                            ? "bg-red-50 text-red-600"
                            : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {log.severity}
                  </span>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No audit logs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── API Keys Tab ───
function APIKeysTab() {
  const [apiKeys] = useState([
    {
      id: "1",
      name: "Production API",
      createdAt: "2024-01-15",
      lastUsed: "2024-06-06",
      permissions: ["read", "write"],
    },
    {
      id: "2",
      name: "Mobile App",
      createdAt: "2024-03-20",
      lastUsed: "2024-06-06",
      permissions: ["read"],
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-500">
          Manage API keys for external integrations
        </p>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg">
          <Plus size={16} /> Create API Key
        </button>
      </div>

      <div className="space-y-4">
        {apiKeys.map(key => (
          <div
            key={key.id}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {key.name}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>Created: {key.createdAt}</span>
                  <span>Last used: {key.lastUsed}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {key.permissions.map(p => (
                    <span
                      key={p}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <Eye size={16} />
                </button>
                <button className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── System Tab ───
function SystemTab() {
  const [metrics] = useState({
    cpu: 45,
    memory: 62,
    disk: 38,
    uptime: "15 days",
    version: "1.0.0",
  });

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "CPU Usage", value: metrics.cpu, color: "blue" },
          { label: "Memory", value: metrics.memory, color: "purple" },
          { label: "Disk", value: metrics.disk, color: "green" },
          { label: "Uptime", value: metrics.uptime, color: "amber" },
        ].map((metric, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
          >
            <p className="text-sm text-gray-500 mb-2">{metric.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {metric.value}
            </p>
            {typeof metric.value === "number" && (
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-${metric.color}-500`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700">
          <RefreshCw size={18} /> Clear Cache
        </button>
        <button className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700">
          <Download size={18} /> Create Backup
        </button>
        <button className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 rounded-xl hover:bg-amber-200">
          <Settings size={18} /> System Config
        </button>
      </div>

      {/* Version Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Version Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Application Version</span>
            <p className="font-medium">{metrics.version}</p>
          </div>
          <div>
            <span className="text-gray-500">Environment</span>
            <p className="font-medium">Production</p>
          </div>
          <div>
            <span className="text-gray-500">Last Deployed</span>
            <p className="font-medium">June 6, 2026</p>
          </div>
          <div>
            <span className="text-gray-500">Node Version</span>
            <p className="font-medium">20.x</p>
          </div>
        </div>
      </div>
    </div>
  );
}
