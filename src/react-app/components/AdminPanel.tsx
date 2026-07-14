import { useState, useEffect, useRef } from "react";
import { useStations } from "@/react-app/context/StationContext";
import { useAuth } from "@/react-app/context/AuthContext";
import { useNavigate } from "react-router";
import {
  Shield,
  Settings,
  KeyRound,
  FolderOpen,
  History,
  BarChart3,
  Users,
  Lock,
  ChevronLeft,
  Save,
  Upload,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  FileText,
  Database,
  Globe,
  Mail,
  MessageSquare,
  CreditCard,
  Brain,
  Cloud,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Plus,
  X,
  Search,
  ArrowLeft,
  ChevronRight,
  LogOut,
  Layers,
  Zap,
  Receipt,
  Fuel,
  Truck,
  Bell,
  ShoppingCart,
  Activity,
  TrendingUp,
  FileBarChart,
  LayoutDashboard,
  Folder,
  MessageCircle,
  Edit3,
  Undo2,
  Monitor,
  Smartphone,
  Code,
  HardDrive,
  Wifi,
  Printer,
  QrCode,
  Package,
  Puzzle,
  Wrench,
  Terminal,
  Server,
  Play,
  Square,
  GripVertical,
  Cog,
  FileJson,
  FileCode,
  FileArchive,
  Sparkles,
  Rocket,
  Gauge,
  Ban,
  UserX,
  Radio,
  Cpu,
  Pin,
  Lightbulb,
  ExternalLink,
  Move,
  Copy,
  Check,
  ClipboardList,
  Info,
} from "lucide-react";

// ===== DYNAMIC ADMIN FEATURE SYSTEM =====
// Founder can add new admin features/modules dynamically
interface AdminFeatureModule {
  id: string;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
  order: number;
  addedAt: string;
  isCustom?: boolean;
}

interface ApiKeyEntry {
  key: string;
  value: string;
  category: string;
  description: string;
  addedAt: string;
}

interface BatchUpdateRecord {
  id: string;
  name: string;
  description: string;
  type: "single_file" | "folder" | "json_config" | "module" | "code";
  files: string[];
  affectedComponents: string[];
  timestamp: string;
  status: "applied" | "pending" | "reverted";
}

// Available feature icons map
const FEATURE_ICONS: Record<string, any> = {
  Shield,
  Settings,
  KeyRound,
  FolderOpen,
  History,
  BarChart3,
  Users,
  Lock,
  Globe,
  Mail,
  MessageSquare,
  CreditCard,
  Brain,
  Cloud,
  Zap,
  Receipt,
  Fuel,
  Truck,
  Bell,
  ShoppingCart,
  Activity,
  TrendingUp,
  FileBarChart,
  LayoutDashboard,
  Folder,
  MessageCircle,
  Monitor,
  Smartphone,
  Code,
  HardDrive,
  Wifi,
  Printer,
  QrCode,
  Package,
  Puzzle,
  Wrench,
  Terminal,
  Server,
  Play,
  Square,
  Database,
  FileJson,
  FileCode,
  FileArchive,
  Sparkles,
  Rocket,
  Gauge,
  Radio,
  Cpu,
  Pin,
  Lightbulb,
  ExternalLink,
  Cog,
  ClipboardList,
  Info,
  Edit3,
  Trash2,
  Plus,
  Search,
  Eye,
  EyeOff,
  Upload,
  Download,
  Save,
  RefreshCw,
  ArrowLeft,
  LogOut,
  Layers,
  ChevronRight,
  Move,
  Copy,
  Check,
  X,
  Ban,
  UserX,
  Undo2,
  ToggleLeft,
  ToggleRight,
};

// Default admin modules
const DEFAULT_MODULES: AdminFeatureModule[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "Monitor",
    description: "System overview and status",
    enabled: true,
    order: 1,
    addedAt: new Date().toISOString(),
  },
  {
    id: "stations",
    label: "Stations",
    icon: "Layers",
    description: "Manage all fuel stations",
    enabled: true,
    order: 2,
    addedAt: new Date().toISOString(),
  },
  {
    id: "tabs",
    label: "Tab Config",
    icon: "LayoutDashboard",
    description: "Configure member-view tabs",
    enabled: true,
    order: 3,
    addedAt: new Date().toISOString(),
  },
  {
    id: "apikeys",
    label: "API Keys",
    icon: "KeyRound",
    description: "Manage API keys & integrations",
    enabled: true,
    order: 4,
    addedAt: new Date().toISOString(),
  },
  {
    id: "features",
    label: "Feature Manager",
    icon: "Puzzle",
    description: "Add/remove admin features dynamically",
    enabled: true,
    order: 5,
    addedAt: new Date().toISOString(),
  },
  {
    id: "batch",
    label: "Batch Updates",
    icon: "Package",
    description: "Upload & deploy site-wide updates",
    enabled: true,
    order: 6,
    addedAt: new Date().toISOString(),
  },
  {
    id: "system",
    label: "System",
    icon: "Settings",
    description: "System configuration",
    enabled: true,
    order: 7,
    addedAt: new Date().toISOString(),
  },
  {
    id: "updates",
    label: "Update History",
    icon: "History",
    description: "Track all admin changes",
    enabled: true,
    order: 8,
    addedAt: new Date().toISOString(),
  },
  {
    id: "accesslogs",
    label: "Access Logs",
    icon: "FileText",
    description: "Monitor access to admin panel",
    enabled: true,
    order: 9,
    addedAt: new Date().toISOString(),
  },
  {
    id: "security",
    label: "Security",
    icon: "Lock",
    description: "Admin security settings",
    enabled: true,
    order: 10,
    addedAt: new Date().toISOString(),
  },
];

type AdminTab = string;

function loadAdminModules(): AdminFeatureModule[] {
  try {
    const raw = localStorage.getItem("fuelpro_admin_modules");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_MODULES;
}

function saveAdminModules(modules: AdminFeatureModule[]) {
  localStorage.setItem("fuelpro_admin_modules", JSON.stringify(modules));
}

function loadBatchUpdates(): BatchUpdateRecord[] {
  try {
    const raw = localStorage.getItem("fuelpro_batch_updates");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function saveBatchUpdates(records: BatchUpdateRecord[]) {
  localStorage.setItem(
    "fuelpro_batch_updates",
    JSON.stringify(records.slice(0, 200))
  );
}

export default function AdminPanel() {
  const {
    isAdmin,
    loginAdmin,
    logoutAdmin,
    adminSettings,
    updateAdminSettings,
    updateTabConfig,
    updateApiKey,
    addUpdateRecord,
    revertUpdate,
    updateAdminPassword,
    stations,
    createStation,
    deleteStation,
    updateStation,
    exportAllData,
    importAllData,
    getAccessLogs,
    switchStation,
  } = useStations();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
    showPassword: false,
  });
  const [loginError, setLoginError] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [tabConfigs, setTabConfigs] = useState(adminSettings.tabConfig);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [newStation, setNewStation] = useState({
    name: "",
    location: "",
    phone: "",
    email: "",
  });
  const [systemCfg, setSystemCfg] = useState(adminSettings.systemConfig);
  const [modules, setModules] =
    useState<AdminFeatureModule[]>(loadAdminModules);
  const [batchRecords, setBatchRecords] =
    useState<BatchUpdateRecord[]>(loadBatchUpdates);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [apiCategory, setApiCategory] = useState("General");
  const [newApiForm, setNewApiForm] = useState({
    key: "",
    value: "",
    category: "General",
    description: "",
  });
  const [customApis, setCustomApis] = useState<ApiKeyEntry[]>([]);
  const [newModuleForm, setNewModuleForm] = useState({
    label: "",
    icon: "Puzzle",
    description: "",
  });
  const [showAddModule, setShowAddModule] = useState(false);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchResult, setBatchResult] = useState("");
  const [securityAttempts, setSecurityAttempts] = useState(0);
  const [securityLocked, setSecurityLocked] = useState(false);

  // Load API keys from admin settings + custom
  useEffect(() => {
    if (isAdmin) {
      setApiKeys(adminSettings.apiKeys);
      setTabConfigs(adminSettings.tabConfig);
      setSystemCfg(adminSettings.systemConfig);
      setLogs(getAccessLogs());
      // Load custom APIs
      try {
        const raw = localStorage.getItem("fuelpro_custom_apis");
        if (raw) setCustomApis(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  }, [isAdmin, adminSettings, getAccessLogs]);

  // Persist modules
  useEffect(() => {
    saveAdminModules(modules);
  }, [modules]);
  useEffect(() => {
    saveBatchUpdates(batchRecords);
  }, [batchRecords]);

  // Security lockout
  useEffect(() => {
    if (securityAttempts >= 5) {
      setSecurityLocked(true);
      setTimeout(() => {
        setSecurityLocked(false);
        setSecurityAttempts(0);
      }, 300000); // 5 min lockout
    }
  }, [securityAttempts]);

  // Admin Login
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
        {/* Hidden security background pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-white/10 max-w-md w-full relative z-10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-500 via-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield size={36} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white font-serif tracking-wide">
              Founder Access
            </h1>
            <p className="text-gray-500 mt-2 text-sm">
              Restricted area - Authorized founder only
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${securityLocked ? "bg-red-500 animate-pulse" : "bg-green-500"}`}
              />
              <span className="text-[10px] text-gray-600 font-mono">
                {securityLocked ? "SECURITY LOCKED - 5 MIN" : "SYSTEM SECURE"}
              </span>
            </div>
          </div>

          {loginError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{loginError}</span>
            </div>
          )}

          {securityLocked && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-center">
              <Ban size={24} className="mx-auto text-red-400 mb-2" />
              <p className="text-red-300 text-sm font-semibold">
                Access Temporarily Locked
              </p>
              <p className="text-red-400/70 text-xs mt-1">
                Too many failed attempts. Wait 5 minutes.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
                Founder Username
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={e =>
                  setLoginForm(p => ({ ...p, username: e.target.value }))
                }
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Enter founder username"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 text-sm transition-all"
                autoFocus
                disabled={securityLocked}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
                Founder Password
              </label>
              <div className="relative">
                <input
                  type={loginForm.showPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={e =>
                    setLoginForm(p => ({ ...p, password: e.target.value }))
                  }
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="Enter founder password"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 text-sm transition-all"
                  disabled={securityLocked}
                />
                <button
                  onClick={() =>
                    setLoginForm(p => ({ ...p, showPassword: !p.showPassword }))
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {loginForm.showPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={handleLogin}
              disabled={securityLocked}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-sm"
            >
              <Lock size={18} />
              {securityLocked ? "ACCESS LOCKED" : "Access Founder Console"}
            </button>
          </div>

          {/* Hidden back button - subtle */}
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-[11px] text-gray-700 hover:text-gray-400 flex items-center gap-1 mx-auto transition-colors"
            >
              <ArrowLeft size={10} />
              Return to Member View
            </button>
          </div>

          {/* Ultra-hidden security note - invisible to casual observers */}
          <div className="mt-6 select-none">
            <p
              className="text-[6px] text-transparent hover:text-gray-800/30 transition-colors text-center cursor-default"
              style={{ userSelect: "none" }}
            >
              SECURE_CHANNEL::FOUNDER_AUTH_V3::{Date.now()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function handleLogin() {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setLoginError("Please enter both username and password");
      return;
    }
    if (securityLocked) {
      setLoginError("Access temporarily locked due to failed attempts");
      return;
    }
    const success = loginAdmin(loginForm.username, loginForm.password);
    if (!success) {
      setSecurityAttempts(p => p + 1);
      setLoginError(
        `Invalid founder credentials. ${5 - securityAttempts - 1} attempts remaining.`
      );
      setLoginForm(p => ({ ...p, password: "" }));
    } else {
      setLoginError("");
      setSecurityAttempts(0);
    }
  }

  // ===== FEATURE MANAGER =====
  function handleAddModule() {
    if (!newModuleForm.label.trim()) return;
    const id = `custom_${Date.now()}`;
    const mod: AdminFeatureModule = {
      id,
      label: newModuleForm.label,
      icon: newModuleForm.icon || "Puzzle",
      description: newModuleForm.description,
      enabled: true,
      order: modules.length + 1,
      addedAt: new Date().toISOString(),
      isCustom: true,
    };
    setModules(prev => [...prev, mod]);
    setNewModuleForm({ label: "", icon: "Puzzle", description: "" });
    setShowAddModule(false);
    addUpdateRecord({
      type: "system",
      description: `Added new admin feature: ${mod.label}`,
      changes: { moduleId: id, label: mod.label },
    });
  }

  function handleRemoveModule(id: string) {
    if (
      !confirm("Remove this feature from admin panel? This cannot be undone.")
    )
      return;
    setModules(prev => prev.filter(m => m.id !== id));
    addUpdateRecord({
      type: "system",
      description: `Removed admin feature: ${id}`,
      changes: { moduleId: id },
    });
  }

  function handleToggleModule(id: string) {
    setModules(prev =>
      prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  }

  function handleReorderModule(id: string, direction: "up" | "down") {
    setModules(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx === -1) return prev;
      const newModules = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= newModules.length) return prev;
      [newModules[idx], newModules[swapIdx]] = [
        newModules[swapIdx],
        newModules[idx],
      ];
      return newModules.map((m, i) => ({ ...m, order: i + 1 }));
    });
  }

  // ===== API KEYS =====
  function handleAddCustomApi() {
    if (!newApiForm.key.trim() || !newApiForm.value.trim()) return;
    const entry: ApiKeyEntry = {
      key: newApiForm.key,
      value: newApiForm.value,
      category: newApiForm.category || "General",
      description: newApiForm.description,
      addedAt: new Date().toISOString(),
    };
    const updated = [...customApis, entry];
    setCustomApis(updated);
    localStorage.setItem("fuelpro_custom_apis", JSON.stringify(updated));
    updateApiKey(newApiForm.key, newApiForm.value);
    setNewApiForm({ key: "", value: "", category: "General", description: "" });
    addUpdateRecord({
      type: "api_keys",
      description: `Added API key: ${entry.key}`,
      changes: { key: entry.key, category: entry.category },
    });
  }

  function handleRemoveCustomApi(key: string) {
    const updated = customApis.filter(a => a.key !== key);
    setCustomApis(updated);
    localStorage.setItem("fuelpro_custom_apis", JSON.stringify(updated));
  }

  // ===== BATCH UPLOAD =====
  async function handleBatchUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBatchUploading(true);
    setBatchResult("");

    const uploadedFiles: string[] = [];
    const affectedComponents: string[] = [];
    let configData: any = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      uploadedFiles.push(file.name);

      // Parse JSON config files
      if (file.name.endsWith(".json")) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          configData = parsed;

          // Apply config changes
          if (parsed.apiKeys) {
            Object.entries(parsed.apiKeys).forEach(([k, v]) =>
              updateApiKey(k, v as string)
            );
            affectedComponents.push("API Keys");
          }
          if (parsed.tabConfig) {
            Object.entries(parsed.tabConfig).forEach(([k, v]) =>
              updateTabConfig(k, v as any)
            );
            affectedComponents.push("Tab Configuration");
          }
          if (parsed.systemConfig) {
            updateAdminSettings({
              systemConfig: { ...systemCfg, ...parsed.systemConfig },
            });
            affectedComponents.push("System Configuration");
          }
          if (parsed.stations) {
            // Import station data
            try {
              importAllData(text);
            } catch {
              /* ignore */
            }
            affectedComponents.push("Station Data");
          }
          if (parsed.modules) {
            setModules(prev => [
              ...prev,
              ...parsed.modules.filter(
                (m: any) => !prev.find(p => p.id === m.id)
              ),
            ]);
            affectedComponents.push("Admin Modules");
          }
        } catch (err) {
          console.warn("Failed to parse JSON:", file.name);
        }
      }

      // Store all files for reference
      const reader = new FileReader();
      reader.onload = ev => {
        const store = JSON.parse(
          localStorage.getItem("fuelpro_batch_files") || "{}"
        );
        store[file.name] = {
          content: ev.target?.result,
          uploadedAt: new Date().toISOString(),
          size: file.size,
        };
        localStorage.setItem("fuelpro_batch_files", JSON.stringify(store));
      };
      reader.readAsText(file);
    }

    const record: BatchUpdateRecord = {
      id: `batch_${Date.now()}`,
      name: `Batch upload - ${files.length} file${files.length > 1 ? "s" : ""}`,
      description:
        files.length === 1 ? files[0].name : `${files.length} files uploaded`,
      type: files.length === 1 ? "single_file" : "folder",
      files: uploadedFiles,
      affectedComponents:
        affectedComponents.length > 0 ? affectedComponents : ["Site-wide"],
      timestamp: new Date().toISOString(),
      status: "applied",
    };

    setBatchRecords(prev => [record, ...prev]);
    setBatchUploading(false);
    setBatchResult(
      `Successfully processed ${files.length} file(s). Affected: ${affectedComponents.join(", ") || "Site-wide configuration"}`
    );
    addUpdateRecord({
      type: "files",
      description: record.name,
      changes: { files: uploadedFiles, affected: affectedComponents },
    });
  }

  // ===== EXISTING HANDLERS =====
  function handleSaveApiKeys() {
    Object.entries(apiKeys).forEach(([k, v]) => updateApiKey(k, v));
    addUpdateRecord({
      type: "api_keys",
      description: "Updated API keys configuration",
      changes: Object.keys(apiKeys),
    });
    alert("API Keys saved");
  }

  function handleSaveTabs() {
    Object.entries(tabConfigs).forEach(([k, v]) => updateTabConfig(k, v));
    addUpdateRecord({
      type: "tabs",
      description: "Updated tab configuration",
      changes: tabConfigs,
    });
    alert("Tab configuration saved");
  }

  function handleSaveSystem() {
    updateAdminSettings({ systemConfig: systemCfg });
    addUpdateRecord({
      type: "system",
      description: "Updated system configuration",
      changes: systemCfg,
    });
    alert("System settings saved");
  }

  function handleCreateStation() {
    if (!newStation.name.trim()) return;
    const station = createStation(newStation);
    addUpdateRecord({
      type: "settings",
      description: `Created new station: ${station.name}`,
      changes: { stationId: station.id },
    });
    setNewStation({ name: "", location: "", phone: "", email: "" });
    alert(`Station "${station.name}" created`);
  }

  function handleExport() {
    const data = exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuelpro_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addUpdateRecord({
      type: "settings",
      description: "Exported all data backup",
      changes: {},
    });
  }

  function handleImport() {
    if (!importText.trim()) return;
    if (!confirm("Overwrite all existing data?")) return;
    importAllData(importText);
    setImportText("");
    setShowImport(false);
    alert("Data imported successfully");
  }

  // Render module icon
  const renderIcon = (iconName: string, size = 16) => {
    const Icon = FEATURE_ICONS[iconName] || Puzzle;
    return <Icon size={size} />;
  };

  // Sidebar modules (filtered to enabled)
  const sidebarModules = modules
    .filter(m => m.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 via-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-serif">Founder Console</h1>
            <p className="text-[10px] text-gray-500">
              FuelPro System Management v3.0
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-300 rounded-lg text-xs border border-red-500/20">
            <Shield size={12} />
            Founder Only
          </div>
          <button
            onClick={() => {
              logoutAdmin();
              navigate("/");
            }}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm flex items-center gap-2 transition-colors"
          >
            <Monitor size={14} /> Member View
          </button>
          <button
            onClick={() => {
              logoutAdmin();
              logout();
            }}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm flex items-center gap-2 transition-colors"
          >
            <LogOut size={14} /> Exit
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 bg-white/5 border-r border-white/10 min-h-[calc(100vh-56px)] sticky top-14 overflow-y-auto">
          <nav className="p-2 space-y-0.5">
            {sidebarModules.map(mod => (
              <button
                key={mod.id}
                onClick={() => setActiveTab(mod.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${activeTab === mod.id ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
              >
                <span className="text-amber-400/70">
                  {renderIcon(mod.icon, 15)}
                </span>
                <span className="truncate">{mod.label}</span>
                {activeTab === mod.id && (
                  <ChevronRight
                    size={12}
                    className="ml-auto text-amber-400/50"
                  />
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Monitor size={20} className="text-amber-400" /> Founder
                Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <Layers size={24} className="text-blue-400 mb-3" />
                  <p className="text-2xl font-bold">{stations.length}</p>
                  <p className="text-sm text-gray-400">Stations</p>
                </div>
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <Puzzle size={24} className="text-purple-400 mb-3" />
                  <p className="text-2xl font-bold">
                    {modules.filter(m => m.isCustom).length}
                  </p>
                  <p className="text-sm text-gray-400">Custom Features</p>
                </div>
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <History size={24} className="text-amber-400 mb-3" />
                  <p className="text-2xl font-bold">
                    {adminSettings.updateHistory.length}
                  </p>
                  <p className="text-sm text-gray-400">Total Updates</p>
                </div>
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <KeyRound size={24} className="text-emerald-400 mb-3" />
                  <p className="text-2xl font-bold">
                    {Object.keys(apiKeys).length + customApis.length}
                  </p>
                  <p className="text-sm text-gray-400">API Keys</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleExport}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-5 text-left transition-all"
                >
                  <Download size={20} className="text-emerald-400 mb-2" />
                  <p className="font-semibold text-sm">Export All Data</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Download complete backup
                  </p>
                </button>
                <button
                  onClick={() => setShowImport(!showImport)}
                  className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl p-5 text-left transition-all"
                >
                  <Upload size={20} className="text-blue-400 mb-2" />
                  <p className="font-semibold text-sm">Import Data</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Restore from backup
                  </p>
                </button>
                <label className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl p-5 text-left transition-all cursor-pointer block">
                  <Package size={20} className="text-purple-400 mb-2" />
                  <p className="font-semibold text-sm">Batch Update</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Deploy site-wide changes
                  </p>
                  <input
                    ref={batchFileRef}
                    type="file"
                    multiple
                    accept="*/*"
                    onChange={handleBatchUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {showImport && (
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="font-semibold mb-3 text-sm">Import Data</h3>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder="Paste JSON backup data..."
                    className="w-full h-32 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-xs font-mono focus:outline-none resize-none"
                  />
                  <button
                    onClick={handleImport}
                    className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg"
                  >
                    Import & Overwrite
                  </button>
                </div>
              )}

              {/* Recent Updates */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                  <History size={14} className="text-amber-400" /> Recent
                  Updates
                </h3>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {adminSettings.updateHistory.slice(0, 10).map(u => (
                    <div
                      key={u.id}
                      className={`flex items-center gap-3 p-3 rounded-lg ${u.reverted ? "bg-red-500/5" : "bg-white/5"}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${u.reverted ? "bg-red-400" : "bg-green-400"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{u.description}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(u.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {u.reverted && (
                        <span className="text-[10px] text-red-400">
                          Reverted
                        </span>
                      )}
                    </div>
                  ))}
                  {adminSettings.updateHistory.length === 0 && (
                    <p className="text-gray-500 text-xs text-center py-4">
                      No updates recorded
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STATIONS */}
          {activeTab === "stations" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers size={20} className="text-blue-400" /> Station
                Management
              </h2>
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                  <Plus size={16} className="text-green-400" /> Create New
                  Station
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={newStation.name}
                    onChange={e =>
                      setNewStation(p => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Station Name *"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <input
                    value={newStation.location}
                    onChange={e =>
                      setNewStation(p => ({ ...p, location: e.target.value }))
                    }
                    placeholder="Location"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <input
                    value={newStation.phone}
                    onChange={e =>
                      setNewStation(p => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="Phone"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <input
                    value={newStation.email}
                    onChange={e =>
                      setNewStation(p => ({ ...p, email: e.target.value }))
                    }
                    placeholder="Email"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <button
                  onClick={handleCreateStation}
                  disabled={!newStation.name.trim()}
                  className="mt-4 px-6 py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition-all"
                >
                  <Plus size={14} /> Create Station
                </button>
              </div>
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    All Stations ({stations.length})
                  </h3>
                </div>
                <div className="divide-y divide-white/5">
                  {stations.map(s => (
                    <div key={s.id} className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {s.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {s.location || "No location"} | {s.sharedUsers.length}{" "}
                          shared users
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${s.name}"?`)) {
                              deleteStation(s.id);
                            }
                          }}
                          className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TABS */}
          {activeTab === "tabs" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <LayoutDashboard size={20} className="text-purple-400" /> Tab
                Configuration
              </h2>
              <p className="text-sm text-gray-400">
                Customize member-view tab names, visibility, and order
              </p>
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10 text-[10px] text-gray-500 uppercase">
                  <div className="col-span-3">Tab ID</div>
                  <div className="col-span-3">Label</div>
                  <div className="col-span-1">Order</div>
                  <div className="col-span-2">Enabled</div>
                  <div className="col-span-3">Actions</div>
                </div>
                {Object.entries(tabConfigs)
                  .sort(([, a], [, b]) => a.order - b.order)
                  .map(([tabId, config]) => (
                    <div
                      key={tabId}
                      className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 items-center"
                    >
                      <div className="col-span-3 text-xs text-gray-500 font-mono">
                        {tabId}
                      </div>
                      <div className="col-span-3">
                        <input
                          value={config.label}
                          onChange={e =>
                            setTabConfigs(p => ({
                              ...p,
                              [tabId]: { ...p[tabId], label: e.target.value },
                            }))
                          }
                          className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-xs focus:outline-none"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          value={config.order}
                          onChange={e =>
                            setTabConfigs(p => ({
                              ...p,
                              [tabId]: {
                                ...p[tabId],
                                order: parseInt(e.target.value) || 0,
                              },
                            }))
                          }
                          className="w-12 px-1 py-1 rounded bg-white/10 border border-white/20 text-white text-xs text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <button
                          onClick={() =>
                            setTabConfigs(p => ({
                              ...p,
                              [tabId]: {
                                ...p[tabId],
                                enabled: !p[tabId].enabled,
                              },
                            }))
                          }
                          className={
                            config.enabled ? "text-green-400" : "text-gray-600"
                          }
                        >
                          {config.enabled ? (
                            <ToggleRight size={24} />
                          ) : (
                            <ToggleLeft size={24} />
                          )}
                        </button>
                      </div>
                      <div className="col-span-3 flex gap-1">
                        <button
                          onClick={() => handleSaveTabs}
                          className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-[10px]"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* API KEYS */}
          {activeTab === "apikeys" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <KeyRound size={20} className="text-emerald-400" /> API Keys &
                Integrations
              </h2>
              <p className="text-sm text-gray-400">
                Built-in API keys + ability to add custom keys individually
              </p>

              {/* Add Individual API */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                  <Plus size={14} className="text-green-400" /> Add New API Key
                  (Individual)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    value={newApiForm.key}
                    onChange={e =>
                      setNewApiForm(p => ({ ...p, key: e.target.value }))
                    }
                    placeholder="API Key Name (e.g., stripe_api)"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none"
                  />
                  <input
                    value={newApiForm.value}
                    onChange={e =>
                      setNewApiForm(p => ({ ...p, value: e.target.value }))
                    }
                    placeholder="API Key Value"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none"
                  />
                  <select
                    value={newApiForm.category}
                    onChange={e =>
                      setNewApiForm(p => ({ ...p, category: e.target.value }))
                    }
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none"
                  >
                    <option value="General" className="bg-gray-800">
                      General
                    </option>
                    <option value="Payment" className="bg-gray-800">
                      Payment
                    </option>
                    <option value="Communication" className="bg-gray-800">
                      Communication
                    </option>
                    <option value="AI" className="bg-gray-800">
                      AI
                    </option>
                    <option value="Storage" className="bg-gray-800">
                      Storage
                    </option>
                    <option value="Analytics" className="bg-gray-800">
                      Analytics
                    </option>
                    <option value="Government" className="bg-gray-800">
                      Government
                    </option>
                    <option value="Custom" className="bg-gray-800">
                      Custom
                    </option>
                  </select>
                  <button
                    onClick={handleAddCustomApi}
                    disabled={
                      !newApiForm.key.trim() || !newApiForm.value.trim()
                    }
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white text-sm rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Add Key
                  </button>
                </div>
                <input
                  value={newApiForm.description}
                  onChange={e =>
                    setNewApiForm(p => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Description (optional)"
                  className="mt-3 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none"
                />
              </div>

              {/* Custom API Keys */}
              {customApis.length > 0 && (
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                  <div className="px-5 py-3 bg-purple-500/10 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles size={14} className="text-purple-400" /> Custom
                      API Keys ({customApis.length})
                    </h3>
                  </div>
                  {customApis.map(api => (
                    <div
                      key={api.key}
                      className="px-5 py-3 border-b border-white/5 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {api.key}{" "}
                          <span className="text-xs text-gray-500 bg-white/10 px-2 py-0.5 rounded ml-2">
                            {api.category}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {api.description || "No description"}
                        </p>
                      </div>
                      <div className="relative">
                        <input
                          type={showKey[api.key] ? "text" : "password"}
                          value={api.value}
                          readOnly
                          className="px-3 py-1.5 pr-8 rounded bg-white/5 border border-white/10 text-gray-400 text-xs w-48"
                        />
                        <button
                          onClick={() =>
                            setShowKey(p => ({ ...p, [api.key]: !p[api.key] }))
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveCustomApi(api.key)}
                        className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Built-in API Keys */}
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    Built-in Integrations
                  </h3>
                  <button
                    onClick={handleSaveApiKeys}
                    className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs flex items-center gap-1.5 hover:bg-emerald-500/30"
                  >
                    <Save size={12} /> Save All
                  </button>
                </div>
                {[
                  { key: "kra_etims", label: "KRA eTIMS API", icon: Receipt },
                  {
                    key: "mpesa_api",
                    label: "M-Pesa Daraja API",
                    icon: CreditCard,
                  },
                  { key: "email_smtp", label: "Email SMTP", icon: Mail },
                  {
                    key: "whatsapp_api",
                    label: "WhatsApp Business API",
                    icon: MessageSquare,
                  },
                  { key: "google_maps", label: "Google Maps API", icon: Globe },
                  {
                    key: "firebase",
                    label: "Firebase Config",
                    icon: HardDrive,
                  },
                  { key: "cloud_backup", label: "Cloud Backup", icon: Cloud },
                  { key: "ai_api", label: "AI/LLM API Key", icon: Brain },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="px-5 py-3 border-b border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} className="text-amber-400" />
                      <span className="text-sm">{label}</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showKey[key] ? "text" : "password"}
                        value={apiKeys[key] || ""}
                        onChange={e =>
                          setApiKeys(p => ({ ...p, [key]: e.target.value }))
                        }
                        placeholder={`Enter ${label}...`}
                        className="w-full px-3 py-2 pr-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <button
                        onClick={() =>
                          setShowKey(p => ({ ...p, [key]: !p[key] }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        {showKey[key] ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FEATURE MANAGER */}
          {activeTab === "features" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Puzzle size={20} className="text-purple-400" /> Feature Manager
              </h2>
              <p className="text-sm text-gray-400">
                Dynamically add, remove, reorder, and toggle admin features. No
                code changes required.
              </p>

              {/* Add New Feature */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                  <Rocket size={14} className="text-green-400" /> Add New Admin
                  Feature
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={newModuleForm.label}
                    onChange={e =>
                      setNewModuleForm(p => ({ ...p, label: e.target.value }))
                    }
                    placeholder="Feature Name (e.g., Analytics Hub)"
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none"
                  />
                  <select
                    value={newModuleForm.icon}
                    onChange={e =>
                      setNewModuleForm(p => ({ ...p, icon: e.target.value }))
                    }
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none"
                  >
                    {Object.keys(FEATURE_ICONS).map(icon => (
                      <option key={icon} value={icon} className="bg-gray-800">
                        {icon}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddModule}
                    disabled={!newModuleForm.label.trim()}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white text-sm rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Add Feature
                  </button>
                </div>
                <input
                  value={newModuleForm.description}
                  onChange={e =>
                    setNewModuleForm(p => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Description (optional)"
                  className="mt-3 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none"
                />
              </div>

              {/* Feature List */}
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10 text-[10px] text-gray-500 uppercase">
                  <div className="col-span-4">Feature</div>
                  <div className="col-span-2">Icon</div>
                  <div className="col-span-1">Order</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-3">Actions</div>
                </div>
                {modules
                  .sort((a, b) => a.order - b.order)
                  .map(mod => (
                    <div
                      key={mod.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 items-center"
                    >
                      <div className="col-span-4 flex items-center gap-2">
                        <span className="text-gray-400">
                          {renderIcon(mod.icon, 14)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{mod.label}</p>
                          <p className="text-[10px] text-gray-500">
                            {mod.description}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-xs text-gray-400 font-mono">
                        {mod.icon}
                      </div>
                      <div className="col-span-1 text-xs text-gray-400">
                        {mod.order}
                      </div>
                      <div className="col-span-1">
                        <button
                          onClick={() => handleToggleModule(mod.id)}
                          className={
                            mod.enabled ? "text-green-400" : "text-gray-600"
                          }
                        >
                          {mod.enabled ? (
                            <ToggleRight size={22} />
                          ) : (
                            <ToggleLeft size={22} />
                          )}
                        </button>
                      </div>
                      <div className="col-span-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded ${mod.isCustom ? "bg-purple-500/20 text-purple-300" : "bg-gray-500/20 text-gray-400"}`}
                        >
                          {mod.isCustom ? "Custom" : "Built-in"}
                        </span>
                      </div>
                      <div className="col-span-3 flex gap-1">
                        <button
                          onClick={() => handleReorderModule(mod.id, "up")}
                          className="p-1 bg-white/10 rounded hover:bg-white/20"
                          title="Move up"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          onClick={() => handleReorderModule(mod.id, "down")}
                          className="p-1 bg-white/10 rounded hover:bg-white/20"
                          title="Move down"
                        >
                          <ChevronRight size={12} />
                        </button>
                        {mod.isCustom && (
                          <button
                            onClick={() => handleRemoveModule(mod.id)}
                            className="p-1 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20"
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* BATCH UPDATES */}
          {activeTab === "batch" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Package size={20} className="text-orange-400" /> Batch Updates
              </h2>
              <p className="text-sm text-gray-400">
                Upload files or folders to deploy site-wide changes. JSON
                configs are automatically parsed and applied.
              </p>

              {/* Upload Zone */}
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-8 border-2 border-dashed border-white/20 text-center hover:border-white/40 transition-all">
                <Upload size={40} className="mx-auto text-purple-400 mb-4" />
                <p className="font-semibold text-lg">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Upload JSON configs, JS modules, or any file to affect
                  site-wide changes
                </p>
                <label className="mt-4 inline-block px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg cursor-pointer transition-colors text-sm font-semibold">
                  Select Files or Folder
                  <input
                    ref={batchFileRef}
                    type="file"
                    multiple
                    onChange={handleBatchUpload}
                    className="hidden"
                  />
                </label>
                {batchUploading && (
                  <p className="mt-3 text-sm text-amber-400 animate-pulse">
                    Processing files...
                  </p>
                )}
                {batchResult && (
                  <p className="mt-3 text-sm text-green-400 bg-green-500/10 rounded-lg p-3">
                    {batchResult}
                  </p>
                )}
              </div>

              {/* Upload Instructions */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  <Info size={14} className="text-blue-400" /> Supported Upload
                  Formats
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
                  <div className="flex items-start gap-2">
                    <FileJson size={14} className="text-green-400 mt-0.5" />
                    <div>
                      <p className="text-gray-300 font-medium">
                        JSON Config Files
                      </p>
                      <p>apiKeys, tabConfig, systemConfig, modules, stations</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileCode size={14} className="text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-gray-300 font-medium">Code Modules</p>
                      <p>New feature modules, integration scripts</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileArchive size={14} className="text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-gray-300 font-medium">
                        Batch Archives
                      </p>
                      <p>Multiple files for comprehensive updates</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Sparkles size={14} className="text-purple-400 mt-0.5" />
                    <div>
                      <p className="text-gray-300 font-medium">
                        Auto-Applied Changes
                      </p>
                      <p>Changes take effect immediately on upload</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Batch History */}
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <History size={14} className="text-amber-400" /> Batch
                    Upload History ({batchRecords.length})
                  </h3>
                </div>
                {batchRecords.map(r => (
                  <div key={r.id} className="px-5 py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${r.status === "applied" ? "bg-green-400" : r.status === "reverted" ? "bg-red-400" : "bg-amber-400"}`}
                      />
                      <div className="flex-1">
                        <p className="text-sm">{r.name}</p>
                        <p className="text-[10px] text-gray-500">
                          Files: {r.files.join(", ")} | Affected:{" "}
                          {r.affectedComponents.join(", ")}
                        </p>
                        <p className="text-[10px] text-gray-600">
                          {new Date(r.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded ${r.status === "applied" ? "bg-green-500/20 text-green-300" : r.status === "reverted" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
                {batchRecords.length === 0 && (
                  <p className="text-gray-500 text-xs text-center py-6">
                    No batch updates yet
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SYSTEM */}
          {activeTab === "system" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings size={20} className="text-blue-400" /> System
                Configuration
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: "enableSync", label: "Cloud Sync" },
                  { key: "enableCloudBackup", label: "Cloud Backup" },
                  { key: "enableAutoReports", label: "Auto Reports" },
                  {
                    key: "enableKRAIntegration",
                    label: "Revenue Authority Integration",
                  },
                  { key: "enableWhatsApp", label: "WhatsApp" },
                  { key: "enableEmail", label: "Email" },
                  { key: "enableAI", label: "AI Assistant" },
                ].map(({ key, label }) => (
                  <div
                    key={key}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-sm">{label}</p>
                    </div>
                    <button
                      onClick={() =>
                        setSystemCfg(p => ({
                          ...p,
                          [key]: !p[key as keyof typeof p],
                        }))
                      }
                      className={
                        systemCfg[key as keyof typeof systemCfg]
                          ? "text-green-400"
                          : "text-gray-500"
                      }
                    >
                      {systemCfg[key as keyof typeof systemCfg] ? (
                        <ToggleRight size={28} />
                      ) : (
                        <ToggleLeft size={28} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveSystem}
                className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg text-sm flex items-center gap-2"
              >
                <Save size={16} /> Save System Settings
              </button>
            </div>
          )}

          {/* UPDATE HISTORY */}
          {activeTab === "updates" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History size={20} className="text-amber-400" /> Update History
              </h2>
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10 text-[10px] text-gray-500 uppercase">
                  <div className="col-span-2">Type</div>
                  <div className="col-span-4">Description</div>
                  <div className="col-span-3">Timestamp</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1"></div>
                </div>
                {adminSettings.updateHistory.map(u => (
                  <div
                    key={u.id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 items-center ${u.reverted ? "opacity-50" : ""}`}
                  >
                    <div className="col-span-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${u.type === "api_keys" ? "bg-emerald-500/20 text-emerald-300" : u.type === "tabs" ? "bg-purple-500/20 text-purple-300" : u.type === "system" ? "bg-blue-500/20 text-blue-300" : u.type === "files" ? "bg-amber-500/20 text-amber-300" : "bg-gray-500/20 text-gray-300"}`}
                      >
                        {u.type}
                      </span>
                    </div>
                    <div className="col-span-4 text-sm truncate">
                      {u.description}
                    </div>
                    <div className="col-span-3 text-[10px] text-gray-500">
                      {new Date(u.timestamp).toLocaleString()}
                    </div>
                    <div className="col-span-2">
                      {u.reverted ? (
                        <span className="text-[10px] text-red-400">
                          Reverted
                        </span>
                      ) : (
                        <span className="text-[10px] text-green-400">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="col-span-1">
                      {!u.reverted && (
                        <button
                          onClick={() => revertUpdate(u.id)}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          <Undo2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACCESS LOGS */}
          {activeTab === "accesslogs" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText size={20} className="text-cyan-400" /> Admin Access
                Logs
              </h2>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
                <AlertTriangle size={18} className="text-red-400" />
                <span className="text-red-300 text-sm">
                  These logs track who accessed the founder console. Failed
                  attempts are also recorded.
                </span>
              </div>
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10 text-[10px] text-gray-500 uppercase">
                  <div className="col-span-3">User</div>
                  <div className="col-span-3">Action</div>
                  <div className="col-span-3">Station</div>
                  <div className="col-span-3">Time</div>
                </div>
                {logs.map((log: any) => (
                  <div
                    key={log.id}
                    className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 items-center"
                  >
                    <div className="col-span-3 text-sm">{log.user}</div>
                    <div className="col-span-3 text-sm text-amber-300">
                      {log.action}
                    </div>
                    <div className="col-span-3 text-[10px] text-gray-400">
                      {stations.find(s => s.id === log.stationId)?.name ||
                        log.stationId}
                    </div>
                    <div className="col-span-3 text-[10px] text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-gray-500 text-xs text-center py-6">
                    No access logs yet
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Lock size={20} className="text-red-400" /> Founder Security
              </h2>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                <p className="text-red-300 text-sm flex items-center gap-2">
                  <Shield size={16} /> This panel is accessible ONLY to the
                  founder. No other user can access this area.
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                  <KeyRound size={16} className="text-amber-400" /> Change
                  Founder Password
                </h3>
                <div className="space-y-3 max-w-md">
                  <input
                    type="password"
                    value={pwForm.current}
                    onChange={e =>
                      setPwForm(p => ({ ...p, current: e.target.value }))
                    }
                    placeholder="Current Password"
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="password"
                    value={pwForm.new}
                    onChange={e =>
                      setPwForm(p => ({ ...p, new: e.target.value }))
                    }
                    placeholder="New Password"
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="password"
                    value={pwForm.confirm}
                    onChange={e =>
                      setPwForm(p => ({ ...p, confirm: e.target.value }))
                    }
                    placeholder="Confirm New Password"
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {pwMsg && (
                    <div
                      className={`p-3 rounded-lg text-sm ${pwMsg.includes("success") ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}
                    >
                      {pwMsg}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (pwForm.new !== pwForm.confirm) {
                        setPwMsg("Passwords do not match");
                        return;
                      }
                      if (pwForm.new.length < 6) {
                        setPwMsg("Min 6 characters");
                        return;
                      }
                      const ok = updateAdminPassword(
                        pwForm.current,
                        pwForm.new
                      );
                      setPwMsg(
                        ok
                          ? "Password updated successfully"
                          : "Current password incorrect"
                      );
                      if (ok) setPwForm({ current: "", new: "", confirm: "" });
                    }}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-sm transition-all"
                  >
                    Update Password
                  </button>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="font-semibold mb-4 text-sm">
                  Security Information
                </h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    <span className="text-gray-500">Username:</span>{" "}
                    {adminSettings.adminUsername}
                  </p>
                  <p>
                    <span className="text-gray-500">Session:</span> 8-hour
                    expiry
                  </p>
                  <p>
                    <span className="text-gray-500">Lockout:</span> 5 failed
                    attempts = 5-min lock
                  </p>
                  <p>
                    <span className="text-gray-500">Access:</span> Founder only
                  </p>
                  <p>
                    <span className="text-gray-500">Failed Attempts:</span>{" "}
                    {securityAttempts} (resets on success)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOM MODULES FALLBACK */}
          {modules.find(m => m.id === activeTab)?.isCustom && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Puzzle size={40} className="mx-auto text-purple-400 mb-4" />
                <h3 className="text-lg font-semibold">
                  {modules.find(m => m.id === activeTab)?.label}
                </h3>
                <p className="text-sm text-gray-400 mt-2">
                  {modules.find(m => m.id === activeTab)?.description}
                </p>
                <p className="text-xs text-gray-600 mt-4">
                  Custom feature module - configure via batch upload or API
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
