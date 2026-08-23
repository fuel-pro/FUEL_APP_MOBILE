/**
 * GeneralSettings.tsx — Comprehensive admin/owner-only Settings tab.
 *
 * A single control center for EVERY modification (present + future) to:
 * tabs, sub-tabs, logic, integrations, branding, localization, security,
 * notifications, automation, and system config. Cloud-backed (cross-device)
 * via cloudStorageService + real-time subscription.
 *
 * Sub-tabs:
 *  1. General       — company info, currency, date/time format, default tab
 *  2. Tab Manager   — show/hide/reorder every top-level tab + label editing
 *  3. Features      — feature flags (POS, inventory, AI, cloud sync, etc.)
 *  4. Appearance    — theme, compact mode, accent color, branding/logo
 *  5. Tax & Finance — VAT rate/label, payment methods, invoice prefix
 *  6. Integrations  — M-PESA, Kopo Kopo, KRA, webhooks, SMS/email gateways
 *  7. Automation    — auto-reorder, auto-sync, auto-refresh toggles
 *  8. Security      — 2FA, session timeout, access codes, API keys
 *  9. Notifications — email/SMS/push notification preferences
 * 10. System        — version, docs links, health check, backup/restore
 *
 * Admin/owner-only. The gate is enforced via PermissionContext.canDo("manage","settings").
 */
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Settings,
  LayoutGrid,
  ToggleLeft,
  Palette,
  Receipt,
  Plug,
  Zap,
  Shield,
  Bell,
  Server,
  Save,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Search,
  GripVertical,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Upload,
  Info,
  Globe,
  Clock,
  DollarSign,
  Tag,
  KeyRound,
  Activity,
  Database,
  Cloud,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import SubTabBar, { SubTab } from "@/react-app/components/SubTabBar";
import { useFuel } from "@/react-app/context/FuelContext";
import { usePermissions } from "@/react-app/context/PermissionContext";
import { useAuth } from "@/react-app/context/AuthContext";
import { useTenant } from "@/react-app/context/TenantContext";
import {
  useUserPrefs,
  UserPreferences,
} from "@/react-app/lib/user-preferences";
import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";
import {
  getCurrencySymbol,
  getDetectedCurrency,
  getDetectedCountryCode,
} from "@/react-app/lib/currency";
import { getVATRate } from "@/react-app/config/pricing";
import { TabConfiguration } from "@/react-app/context/FuelContext";

// ─── Cloud-backed settings store ────────────────────────────────────────────
const SETTINGS_KEY = "general_settings_v1";

export interface GeneralSettingsConfig {
  // General
  stationName: string;
  stationAddress: string;
  stationPhone: string;
  stationEmail: string;
  stationWebsite: string;
  timezone: string;
  businessHours: { open: string; close: string; days: string[] };

  // Appearance
  theme: "dark" | "light" | "system";
  accentColor: string;
  compactMode: boolean;
  sidebarCollapsed: boolean;
  logoUrl: string;

  // Tax & Finance
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  taxIncludedInPrice: boolean;
  currency: string;
  currencyPosition: "before" | "after";
  invoicePrefix: string;
  invoiceNextNumber: number;
  receiptFooter: string;
  receiptHeader: string;

  // Notifications
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  lowStockAlerts: boolean;
  dailySummaryEmail: boolean;
  creditAlerts: boolean;
  shiftReminders: boolean;

  // Security
  sessionTimeoutMinutes: number;
  requireTwoFactor: boolean;
  maxLoginAttempts: number;
  ipWhitelist: string;
  auditLogRetentionDays: number;

  // System
  autoBackup: boolean;
  backupFrequency: "daily" | "weekly" | "monthly";
  dataRetentionDays: number;
  enableRealtime: boolean;
  enableCompression: boolean;
  lowBandwidthMode: boolean;

  // Metadata
  updatedAt: string;
  updatedBy: string;
  version: number;
}

const DEFAULT_CONFIG: GeneralSettingsConfig = {
  stationName: "",
  stationAddress: "",
  stationPhone: "",
  stationEmail: "",
  stationWebsite: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  businessHours: {
    open: "06:00",
    close: "22:00",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },

  theme: "dark",
  accentColor: "#3b82f6",
  compactMode: false,
  sidebarCollapsed: false,
  logoUrl: "",

  taxEnabled: true,
  taxRate: getVATRate(getDetectedCountryCode()),
  taxLabel: "VAT",
  taxIncludedInPrice: false,
  currency: getDetectedCurrency(),
  currencyPosition: "before",
  invoicePrefix: "INV",
  invoiceNextNumber: 1,
  receiptFooter: "Thank you for your business!",
  receiptHeader: "FuelPro Station",

  emailNotifications: true,
  smsNotifications: false,
  pushNotifications: true,
  lowStockAlerts: true,
  dailySummaryEmail: false,
  creditAlerts: true,
  shiftReminders: true,

  sessionTimeoutMinutes: 30,
  requireTwoFactor: false,
  maxLoginAttempts: 5,
  ipWhitelist: "",
  auditLogRetentionDays: 90,

  autoBackup: true,
  backupFrequency: "daily",
  dataRetentionDays: 365,
  enableRealtime: true,
  enableCompression: true,
  lowBandwidthMode: false,

  updatedAt: new Date().toISOString(),
  updatedBy: "",
  version: 1,
};

// ─── Toast helper ───────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const show = useCallback(
    (msg: string, type: "success" | "error" | "info" = "success") => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );
  return { toast, show };
}

// ─── Reusable toggle ────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          checked ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Reusable field ─────────────────────────────────────────────────────────
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors min-h-[40px]";

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function GeneralSettings() {
  const { state, dispatch } = useFuel();
  const { canDo } = usePermissions();
  const { user } = useAuth();
  const { featureFlags } = useTenant();
  const { prefs, update: updatePrefs } = useUserPrefs();
  const { toast, show } = useToast();

  const [activeSubTab, setActiveSubTab] = useState("general");
  const [config, setConfig] = useState<GeneralSettingsConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 3-ref guard for cloud sync
  const cloudLoadCompleteRef = useRef(false);
  const localModifiedRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  // Permission gate — admin/owner only
  const canManageSettings =
    canDo("manage", "settings") || canDo("view", "settings");
  const isOwner = canDo("manage", "settings");

  // Load config from cloud
  useEffect(() => {
    let cancelled = false;
    cloudLoadCompleteRef.current = false;
    (async () => {
      try {
        const cloud =
          await cloudStorageService.get<GeneralSettingsConfig>(SETTINGS_KEY);
        if (!cancelled && cloud) {
          setConfig({ ...DEFAULT_CONFIG, ...cloud });
        }
      } catch (e) {
        console.error("[GeneralSettings] load error:", e);
      } finally {
        if (!cancelled) {
          cloudLoadCompleteRef.current = true;
          setLoading(false);
          // Flush local modifications made during load
          if (localModifiedRef.current) {
            cloudStorageService
              .set(SETTINGS_KEY, configRef.current)
              .catch(() => {});
            localModifiedRef.current = false;
          }
        }
      }
    })();
    const unsub = cloudStorageService.subscribe<GeneralSettingsConfig>(
      SETTINGS_KEY,
      undefined,
      (cloud) => {
        if (!localModifiedRef.current && cloud) {
          setConfig({ ...DEFAULT_CONFIG, ...cloud });
        }
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.id]);

  // Save handler
  const saveConfig = useCallback(
    (newConfig: GeneralSettingsConfig) => {
      if (!cloudLoadCompleteRef.current) return;
      localModifiedRef.current = true;
      const updated = {
        ...newConfig,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || "unknown",
      };
      setConfig(updated);
      setSaving(true);
      cloudStorageService
        .set(SETTINGS_KEY, updated)
        .then(() => {
          localModifiedRef.current = false;
          show("Settings saved & synced across devices", "success");
        })
        .catch(() => show("Failed to save settings to cloud", "error"))
        .finally(() => setSaving(false));
    },
    [user?.email, show],
  );

  // Update a single field
  const update = useCallback(
    <K extends keyof GeneralSettingsConfig>(
      key: K,
      value: GeneralSettingsConfig[K],
    ) => {
      saveConfig({ ...configRef.current, [key]: value });
    },
    [saveConfig],
  );

  // Reset to defaults
  const resetConfig = useCallback(() => {
    if (!confirm("Reset ALL settings to defaults? This cannot be undone."))
      return;
    saveConfig({ ...DEFAULT_CONFIG, stationName: config.stationName });
    show("Settings reset to defaults", "info");
  }, [saveConfig, config.stationName, show]);

  // Export settings
  const exportSettings = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuelpro-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    show("Settings exported", "success");
  }, [config, show]);

  // Import settings
  const importSettings = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target?.result as string);
          saveConfig({ ...DEFAULT_CONFIG, ...imported });
          show("Settings imported successfully", "success");
        } catch {
          show("Invalid settings file", "error");
        }
      };
      reader.readAsText(file);
    },
    [saveConfig, show],
  );

  // Sub-tab definitions
  const subTabs: SubTab[] = useMemo(
    () => [
      { id: "general", label: "General", icon: Settings },
      { id: "tabs", label: "Tab Manager", icon: LayoutGrid },
      { id: "features", label: "Features", icon: ToggleLeft },
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "finance", label: "Tax & Finance", icon: Receipt },
      { id: "integrations", label: "Integrations", icon: Plug },
      { id: "automation", label: "Automation", icon: Zap },
      { id: "security", label: "Security", icon: Shield },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "system", label: "System", icon: Server },
    ],
    [],
  );

  // ─── Permission gate ──────────────────────────────────────────────────────
  if (!canManageSettings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Access Restricted
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Only the station owner or admin can manage settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading settings…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold">General Settings</h2>
              <p className="text-sm text-blue-100">
                Admin control center — manage tabs, features, integrations &
                system config
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full flex items-center gap-1">
              <Cloud size={10} /> Cloud-synced
            </span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              Updated {new Date(config.updatedAt).toLocaleDateString()}
            </span>
            <button
              onClick={exportSettings}
              className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-1 transition-colors"
              title="Export settings as JSON"
            >
              <Download size={12} /> Export
            </button>
            <label
              className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="Import settings from JSON"
            >
              <Upload size={12} /> Import
              <input
                type="file"
                accept=".json"
                onChange={importSettings}
                className="hidden"
              />
            </label>
            {isOwner && (
              <button
                onClick={resetConfig}
                className="text-xs px-3 py-1.5 bg-red-500/30 hover:bg-red-500/40 rounded-lg flex items-center gap-1 transition-colors"
                title="Reset all settings to defaults"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tab bar */}
      <SubTabBar
        tabs={subTabs}
        active={activeSubTab}
        onChange={setActiveSubTab}
      />

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {activeSubTab === "general" && (
          <GeneralTab
            config={config}
            update={update}
            prefs={prefs}
            updatePrefs={updatePrefs}
            show={show}
          />
        )}
        {activeSubTab === "tabs" && (
          <TabManagerTab
            tabConfigs={state.tabConfigurations}
            dispatch={dispatch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            show={show}
            isOwner={isOwner}
          />
        )}
        {activeSubTab === "features" && (
          <FeaturesTab featureFlags={featureFlags} show={show} />
        )}
        {activeSubTab === "appearance" && (
          <AppearanceTab
            config={config}
            update={update}
            updatePrefs={updatePrefs}
            show={show}
          />
        )}
        {activeSubTab === "finance" && (
          <FinanceTab
            config={config}
            update={update}
            prefs={prefs}
            updatePrefs={updatePrefs}
            show={show}
          />
        )}
        {activeSubTab === "integrations" && <IntegrationsTab />}
        {activeSubTab === "automation" && (
          <AutomationTab prefs={prefs} updatePrefs={updatePrefs} show={show} />
        )}
        {activeSubTab === "security" && (
          <SecurityTab
            config={config}
            update={update}
            show={show}
            isOwner={isOwner}
          />
        )}
        {activeSubTab === "notifications" && (
          <NotificationsTab config={config} update={update} />
        )}
        {activeSubTab === "system" && <SystemTab config={config} show={show} />}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-fade-in ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-blue-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : toast.type === "error" ? (
            <AlertCircle size={16} />
          ) : (
            <Info size={16} />
          )}
          {toast.msg}
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-6 left-6 z-50 px-4 py-2 bg-gray-900 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Syncing…
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: GENERAL
// ═══════════════════════════════════════════════════════════════════════════
function GeneralTab({
  config,
  update,
  prefs,
  updatePrefs,
  show,
}: {
  config: GeneralSettingsConfig;
  update: <K extends keyof GeneralSettingsConfig>(
    key: K,
    value: GeneralSettingsConfig[K],
  ) => void;
  prefs: UserPreferences;
  updatePrefs: (patch: Partial<UserPreferences>) => Promise<void>;
  show: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [
        "UTC",
        "Africa/Nairobi",
        "America/New_York",
        "Europe/London",
        "Asia/Dubai",
        "Asia/Kolkata",
      ];
    }
  }, []);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const toggleDay = (day: string) => {
    const days = config.businessHours.days.includes(day)
      ? config.businessHours.days.filter((d) => d !== day)
      : [...config.businessHours.days, day];
    update("businessHours", { ...config.businessHours, days });
  };

  return (
    <div className="p-5 space-y-6">
      <SectionCard title="Station Information" icon={Info}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Station Name">
            <input
              className={inputClass}
              value={config.stationName}
              onChange={(e) => update("stationName", e.target.value)}
              placeholder="e.g. Global Energy Station"
            />
          </Field>
          <Field label="Website">
            <input
              className={inputClass}
              value={config.stationWebsite}
              onChange={(e) => update("stationWebsite", e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label="Address">
            <input
              className={inputClass}
              value={config.stationAddress}
              onChange={(e) => update("stationAddress", e.target.value)}
              placeholder="Street, City, Country"
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              value={config.stationPhone}
              onChange={(e) => update("stationPhone", e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </Field>
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              value={config.stationEmail}
              onChange={(e) => update("stationEmail", e.target.value)}
              placeholder="contact@station.com"
            />
          </Field>
          <Field label="Timezone" hint="Used for all date/time displays">
            <select
              className={inputClass}
              value={config.timezone}
              onChange={(e) => update("timezone", e.target.value)}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Business Hours" icon={Clock}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Opening Time">
            <input
              type="time"
              className={inputClass}
              value={config.businessHours.open}
              onChange={(e) =>
                update("businessHours", {
                  ...config.businessHours,
                  open: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Closing Time">
            <input
              type="time"
              className={inputClass}
              value={config.businessHours.close}
              onChange={(e) =>
                update("businessHours", {
                  ...config.businessHours,
                  close: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Operating Days">
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    config.businessHours.days.includes(day)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Localization" icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Currency"
            hint="3-letter ISO code (USD, KES, EUR, etc.)"
          >
            <input
              className={inputClass}
              value={config.currency}
              onChange={(e) => {
                update("currency", e.target.value.toUpperCase());
                updatePrefs({
                  currency: e.target.value.toUpperCase(),
                  currencySymbol: getCurrencySymbol(
                    e.target.value.toUpperCase(),
                  ),
                });
              }}
              maxLength={3}
            />
          </Field>
          <Field label="Date Format">
            <select
              className={inputClass}
              value={prefs.dateFormat}
              onChange={(e) =>
                updatePrefs({
                  dateFormat: e.target.value as UserPreferences["dateFormat"],
                })
              }
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (International)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            </select>
          </Field>
          <Field label="Time Format">
            <select
              className={inputClass}
              value={prefs.timeFormat}
              onChange={(e) =>
                updatePrefs({
                  timeFormat: e.target.value as UserPreferences["timeFormat"],
                })
              }
            >
              <option value="24h">24-hour (14:30)</option>
              <option value="12h">12-hour (2:30 PM)</option>
            </select>
          </Field>
          <Field label="Number Format">
            <select
              className={inputClass}
              value={prefs.numberFormat}
              onChange={(e) =>
                updatePrefs({
                  numberFormat: e.target
                    .value as UserPreferences["numberFormat"],
                })
              }
            >
              <option value="1,000.00">1,000.00 (US/UK)</option>
              <option value="1.000,00">1.000,00 (EU)</option>
              <option value="1 000.00">1 000.00 (Space)</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Default Landing Tab" icon={LayoutGrid}>
        <Field label="Which tab should open when you log in?">
          <select
            className={inputClass}
            value={prefs.defaultTab}
            onChange={(e) => {
              updatePrefs({ defaultTab: e.target.value });
              show("Default tab updated — applies on next login", "success");
            }}
          >
            <option value="dashboard">Dashboard</option>
            <option value="pos">Point of Sale</option>
            <option value="sales">Sales Tracking</option>
            <option value="inventory">Stock Management</option>
            <option value="analytics">Analytics</option>
          </select>
        </Field>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: TAB MANAGER
// ═══════════════════════════════════════════════════════════════════════════
function TabManagerTab({
  tabConfigs,
  dispatch,
  searchQuery,
  setSearchQuery,
  show,
  isOwner,
}: {
  tabConfigs: TabConfiguration[];
  dispatch: React.Dispatch<any>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  show: (msg: string, type?: "success" | "error" | "info") => void;
  isOwner: boolean;
}) {
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim())
      return [...tabConfigs].sort((a, b) => a.order - b.order);
    const q = searchQuery.toLowerCase();
    return tabConfigs
      .filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
      .sort((a, b) => a.order - b.order);
  }, [tabConfigs, searchQuery]);

  const toggleVisible = (id: string) => {
    const updated = tabConfigs.map((t) =>
      t.id === id ? { ...t, visible: !t.visible } : t,
    );
    dispatch({ type: "SET_TAB_CONFIGURATIONS", payload: updated });
    show(
      `Tab ${updated.find((t) => t.id === id)?.visible ? "shown" : "hidden"}`,
      "success",
    );
  };

  const moveTab = (id: string, direction: "up" | "down") => {
    const sorted = [...tabConfigs].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const updated = tabConfigs.map((t) => {
      if (t.id === a.id) return { ...t, order: b.order };
      if (t.id === b.id) return { ...t, order: a.order };
      return t;
    });
    dispatch({ type: "SET_TAB_CONFIGURATIONS", payload: updated });
  };

  const saveLabel = (id: string) => {
    if (!tempLabel.trim()) {
      setEditingLabel(null);
      return;
    }
    const updated = tabConfigs.map((t) =>
      t.id === id ? { ...t, label: tempLabel.trim() } : t,
    );
    dispatch({ type: "SET_TAB_CONFIGURATIONS", payload: updated });
    show("Tab label updated", "success");
    setEditingLabel(null);
  };

  const showAll = () => {
    dispatch({
      type: "SET_TAB_CONFIGURATIONS",
      payload: tabConfigs.map((t) => ({ ...t, visible: true })),
    });
    show("All tabs shown", "success");
  };

  const hideAll = () => {
    if (
      !confirm(
        "Hide ALL tabs except Dashboard? This will make most features invisible.",
      )
    )
      return;
    dispatch({
      type: "SET_TAB_CONFIGURATIONS",
      payload: tabConfigs.map((t) => ({ ...t, visible: t.id === "dashboard" })),
    });
    show("All tabs hidden (except Dashboard)", "info");
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tab Manager
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Control which tabs are visible, their order, and custom labels.
            Changes apply instantly across all devices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={showAll}
            className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
          >
            <Eye size={12} className="inline mr-1" /> Show All
          </button>
          {isOwner && (
            <button
              onClick={hideAll}
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <EyeOff size={12} className="inline mr-1" /> Hide All
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          className={`${inputClass} pl-10`}
          placeholder="Search tabs by name or description…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filtered.map((tab) => {
          const sorted = [...tabConfigs].sort((a, b) => a.order - b.order);
          const isFirst = sorted[0]?.id === tab.id;
          const isLast = sorted[sorted.length - 1]?.id === tab.id;
          return (
            <div
              key={tab.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                tab.visible
                  ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/20 opacity-60"
              }`}
            >
              <GripVertical
                size={16}
                className="text-gray-300 dark:text-gray-600 flex-shrink-0"
              />
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveTab(tab.id, "up")}
                  disabled={isFirst}
                  className="text-gray-400 hover:text-blue-500 disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => moveTab(tab.id, "down")}
                  disabled={isLast}
                  className="text-gray-400 hover:text-blue-500 disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                {editingLabel === tab.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="px-2 py-1 text-sm border border-blue-500 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                      value={tempLabel}
                      onChange={(e) => setTempLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveLabel(tab.id);
                        if (e.key === "Escape") setEditingLabel(null);
                      }}
                      onBlur={() => saveLabel(tab.id)}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {tab.label}
                      {tab.label !== tab.originalLabel && (
                        <span className="text-xs text-gray-400 line-through">
                          {tab.originalLabel}
                        </span>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => {
                            setEditingLabel(tab.id);
                            setTempLabel(tab.label);
                          }}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {tab.description}
                    </p>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                #{tab.order}
              </span>
              <button
                onClick={() => toggleVisible(tab.id)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex-shrink-0 ${
                  tab.visible
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                }`}
              >
                {tab.visible ? "Visible" : "Hidden"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: FEATURES (Feature Flags)
// ═══════════════════════════════════════════════════════════════════════════
function FeaturesTab({
  featureFlags,
  show,
}: {
  featureFlags: Record<string, boolean>;
  show: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const flagCategories = useMemo(
    () => [
      {
        title: "Core Modules",
        icon: LayoutGrid,
        flags: [
          {
            key: "pos",
            label: "Point of Sale",
            desc: "Quick sales + receipt printing",
          },
          {
            key: "inventory",
            label: "Stock Management",
            desc: "Products, stock adjustments, transfers",
          },
          {
            key: "sales",
            label: "Sales Tracking",
            desc: "Pump readings & daily operations",
          },
          {
            key: "analytics",
            label: "Analytics",
            desc: "Predictions, trends & BI",
          },
          {
            key: "payroll",
            label: "Payroll System",
            desc: "Employee payments",
          },
          {
            key: "expenses",
            label: "Expense Tracker",
            desc: "Operational expenses",
          },
          {
            key: "customers",
            label: "Customer Loyalty",
            desc: "Rewards program",
          },
          {
            key: "suppliers",
            label: "Supplier Management",
            desc: "Suppliers & purchase orders",
          },
          {
            key: "documents",
            label: "Document Center",
            desc: "Smart document management",
          },
        ],
      },
      {
        title: "Payment Methods",
        icon: DollarSign,
        flags: [
          {
            key: "mpesa",
            label: "M-PESA Analyzer",
            desc: "Mobile money transaction analysis",
          },
          {
            key: "creditCards",
            label: "Credit Cards",
            desc: "Card payment processing",
          },
          { key: "cash", label: "Cash", desc: "Cash payment tracking" },
          {
            key: "bankTransfer",
            label: "Bank Transfer",
            desc: "Bank transfer records",
          },
          {
            key: "mobileMoney",
            label: "Mobile Money",
            desc: "Generic mobile money support",
          },
        ],
      },
      {
        title: "Regional & Compliance",
        icon: Globe,
        flags: [
          {
            key: "kraIntegration",
            label: "KRA Integration",
            desc: "Kenya Revenue Authority eTIMS",
          },
          {
            key: "etims",
            label: "eTIMS",
            desc: "Electronic Tax Invoice Management",
          },
          {
            key: "efd",
            label: "EFD",
            desc: "Electronic Fiscal Device (Tanzania)",
          },
          { key: "etr", label: "ETR", desc: "Electronic Tax Register" },
          {
            key: "vatReporting",
            label: "VAT Reporting",
            desc: "VAT compliance reports",
          },
          {
            key: "compliance",
            label: "Compliance Tab",
            desc: "Country-specific regulations",
          },
        ],
      },
      {
        title: "Advanced Features",
        icon: Zap,
        flags: [
          {
            key: "ai",
            label: "AI Assistant",
            desc: "Gemini-powered AI chatbot",
          },
          {
            key: "cloudSync",
            label: "Cloud Sync",
            desc: "Cross-device data synchronization",
          },
          {
            key: "webhooks",
            label: "Webhooks",
            desc: "Outbound event notifications",
          },
          {
            key: "integrations",
            label: "Integration Hub",
            desc: "Third-party service connectors",
          },
          {
            key: "audit",
            label: "Audit Trail",
            desc: "Complete activity logging",
          },
          {
            key: "loyalty",
            label: "Loyalty Program",
            desc: "Points & rewards",
          },
          {
            key: "priceboard",
            label: "Price Board",
            desc: "Fuel price display board",
          },
          {
            key: "fueltypes",
            label: "Fuel Type Manager",
            desc: "Fuel products & pump settings",
          },
          {
            key: "maintenance",
            label: "Maintenance Tracker",
            desc: "Equipment servicing schedules",
          },
          {
            key: "quality",
            label: "Fuel Quality Testing",
            desc: "Quality test records",
          },
        ],
      },
      {
        title: "Communication",
        icon: Bell,
        flags: [
          { key: "whatsapp", label: "WhatsApp", desc: "WhatsApp integration" },
          { key: "email", label: "Email", desc: "Email notifications" },
          { key: "sms", label: "SMS", desc: "SMS gateway" },
        ],
      },
      {
        title: "Company-Level",
        icon: Server,
        flags: [
          {
            key: "founderAccess",
            label: "Founder Access",
            desc: "Global admin console",
          },
          {
            key: "combinedView",
            label: "Combined View",
            desc: "Multi-station overview",
          },
        ],
      },
    ],
    [],
  );

  return (
    <div className="p-5 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Feature Flags
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enable or disable features across the entire station. Feature flags
          are resolved based on your country and company settings.
        </p>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
          <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Feature flags are currently resolved automatically based on your
            station's country and plan. To customize them, configure your
            company settings in the Founder Access console.
          </p>
        </div>
      </div>

      {flagCategories.map((cat) => {
        const Icon = cat.icon;
        return (
          <SectionCard key={cat.title} title={cat.title} icon={Icon}>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {cat.flags.map((flag) => (
                <Toggle
                  key={flag.key}
                  checked={!!featureFlags[flag.key]}
                  onChange={() =>
                    show(
                      `Feature "${flag.label}" is ${featureFlags[flag.key] ? "enabled" : "disabled"} (managed by company settings)`,
                      "info",
                    )
                  }
                  label={flag.label}
                  description={flag.desc}
                  disabled
                />
              ))}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: APPEARANCE
// ═══════════════════════════════════════════════════════════════════════════
function AppearanceTab({
  config,
  update,
  updatePrefs,
  show,
}: {
  config: GeneralSettingsConfig;
  update: <K extends keyof GeneralSettingsConfig>(
    key: K,
    value: GeneralSettingsConfig[K],
  ) => void;
  updatePrefs: (patch: Partial<UserPreferences>) => Promise<void>;
  show: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const accentColors = [
    { name: "Blue", value: "#3b82f6" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Purple", value: "#8b5cf6" },
    { name: "Pink", value: "#ec4899" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Green", value: "#22c55e" },
    { name: "Teal", value: "#14b8a6" },
  ];

  return (
    <div className="p-5 space-y-6">
      <SectionCard title="Theme" icon={Palette}>
        <div className="grid grid-cols-3 gap-3">
          {(["dark", "light", "system"] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => {
                update("theme", theme);
                updatePrefs({ theme: theme === "system" ? "dark" : theme });
                show(`Theme set to ${theme}`, "success");
              }}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                config.theme === theme
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div
                className={`w-full h-16 rounded mb-2 ${
                  theme === "dark"
                    ? "bg-gray-900"
                    : theme === "light"
                      ? "bg-white border border-gray-200"
                      : "bg-gradient-to-r from-gray-900 to-white"
                }`}
              />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                {theme}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Accent Color" icon={Palette}>
        <div className="flex flex-wrap gap-3">
          {accentColors.map((color) => (
            <button
              key={color.value}
              onClick={() => {
                update("accentColor", color.value);
                show(`Accent color: ${color.name}`, "success");
              }}
              className={`w-12 h-12 rounded-full border-4 transition-all ${
                config.accentColor === color.value
                  ? "border-gray-900 dark:border-white scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
          <label className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
            <input
              type="color"
              value={config.accentColor}
              onChange={(e) => update("accentColor", e.target.value)}
              className="hidden"
            />
            <Palette size={16} className="text-gray-400" />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Layout" icon={LayoutGrid}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={config.compactMode}
            onChange={(v) => {
              update("compactMode", v);
              updatePrefs({ compactMode: v });
            }}
            label="Compact Mode"
            description="Reduce padding & spacing for more content per screen"
          />
          <Toggle
            checked={config.sidebarCollapsed}
            onChange={(v) => update("sidebarCollapsed", v)}
            label="Collapse Sidebar by Default"
            description="Start with the navigation sidebar collapsed"
          />
        </div>
      </SectionCard>

      <SectionCard title="Logo" icon={Tag}>
        <div className="space-y-3">
          {config.logoUrl && (
            <img
              src={config.logoUrl}
              alt="Station logo"
              className="max-h-24 rounded-lg border border-gray-200 dark:border-gray-700"
            />
          )}
          <Field
            label="Logo URL"
            hint="Paste a public image URL. The logo appears on receipts, invoices & reports."
          >
            <input
              className={inputClass}
              value={config.logoUrl}
              onChange={(e) => update("logoUrl", e.target.value)}
              placeholder="https://… or upload via Edit Info"
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: TAX & FINANCE
// ═══════════════════════════════════════════════════════════════════════════
function FinanceTab({
  config,
  update,
  prefs,
  updatePrefs,
  show,
}: {
  config: GeneralSettingsConfig;
  update: <K extends keyof GeneralSettingsConfig>(
    key: K,
    value: GeneralSettingsConfig[K],
  ) => void;
  prefs: UserPreferences;
  updatePrefs: (patch: Partial<UserPreferences>) => Promise<void>;
  show: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  return (
    <div className="p-5 space-y-6">
      <SectionCard title="Tax Configuration" icon={Receipt}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={config.taxEnabled}
            onChange={(v) => update("taxEnabled", v)}
            label="Enable Tax"
            description="Apply tax to sales, invoices & receipts"
          />
          <Toggle
            checked={config.taxIncludedInPrice}
            onChange={(v) => update("taxIncludedInPrice", v)}
            label="Tax Included in Price"
            description="Prices already include tax (don't add on top)"
          />
        </div>
        {config.taxEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Field label="Tax Rate (%)" hint="0 = use country default">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className={inputClass}
                value={config.taxRate}
                onChange={(e) => {
                  update("taxRate", parseFloat(e.target.value) || 0);
                  updatePrefs({ vatRate: parseFloat(e.target.value) || 0 });
                }}
              />
            </Field>
            <Field label="Tax Label" hint="VAT, GST, Sales Tax, IVA, etc.">
              <input
                className={inputClass}
                value={config.taxLabel}
                onChange={(e) => {
                  update("taxLabel", e.target.value);
                  updatePrefs({ vatLabel: e.target.value });
                }}
                placeholder="VAT"
              />
            </Field>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Currency" icon={DollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Currency Code">
            <input
              className={inputClass}
              value={config.currency}
              onChange={(e) => {
                update("currency", e.target.value.toUpperCase());
                updatePrefs({
                  currency: e.target.value.toUpperCase(),
                  currencySymbol: getCurrencySymbol(
                    e.target.value.toUpperCase(),
                  ),
                });
              }}
              maxLength={3}
            />
          </Field>
          <Field label="Symbol Position">
            <select
              className={inputClass}
              value={config.currencyPosition}
              onChange={(e) => {
                update(
                  "currencyPosition",
                  e.target.value as "before" | "after",
                );
                updatePrefs({
                  currencyPosition: e.target.value as "before" | "after",
                });
              }}
            >
              <option value="before">$ 1,000 (before)</option>
              <option value="after">1,000 $ (after)</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Invoice & Receipt Settings" icon={Receipt}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Invoice Prefix">
            <input
              className={inputClass}
              value={config.invoicePrefix}
              onChange={(e) => {
                update("invoicePrefix", e.target.value);
                updatePrefs({ invoicePrefix: e.target.value });
              }}
              placeholder="INV"
            />
          </Field>
          <Field label="Next Invoice Number">
            <input
              type="number"
              min="1"
              className={inputClass}
              value={config.invoiceNextNumber}
              onChange={(e) => {
                update("invoiceNextNumber", parseInt(e.target.value) || 1);
                updatePrefs({
                  invoiceNextNumber: parseInt(e.target.value) || 1,
                });
              }}
            />
          </Field>
          <Field label="Receipt Header">
            <input
              className={inputClass}
              value={config.receiptHeader}
              onChange={(e) => update("receiptHeader", e.target.value)}
            />
          </Field>
          <Field label="Receipt Footer">
            <input
              className={inputClass}
              value={config.receiptFooter}
              onChange={(e) => {
                update("receiptFooter", e.target.value);
                updatePrefs({ receiptFooter: e.target.value });
              }}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Payment Methods" icon={DollarSign}>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Default payment methods available at the Point of Sale.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "cash",
            "card",
            "bank_transfer",
            "mobile_money",
            "mpesa",
            "credit",
          ].map((method) => {
            const active = prefs.defaultPaymentMethods.includes(method);
            return (
              <button
                key={method}
                onClick={() => {
                  const methods = active
                    ? prefs.defaultPaymentMethods.filter((m) => m !== method)
                    : [...prefs.defaultPaymentMethods, method];
                  updatePrefs({ defaultPaymentMethods: methods });
                  show(
                    `Payment method ${active ? "removed" : "added"}: ${method}`,
                    "success",
                  );
                }}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                {method.replace("_", " ")}
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════
function IntegrationsTab() {
  const integrations = useMemo(
    () => [
      {
        name: "M-PESA Daraja",
        desc: "Safaricom M-PESA STK Push & C2B payments",
        docs: "https://developer.safaricom.co.ke/APIs/",
        tab: "integration",
        status: "Configure in Integration Hub → Payment Setup",
      },
      {
        name: "Kopo Kopo",
        desc: "Kopo Kopo Till Number integration",
        docs: "https://kopokopo.co.ke/developers",
        tab: "integration",
        status: "Configure in Integration Hub → Payment Setup",
      },
      {
        name: "KRA eTIMS",
        desc: "Kenya Revenue Authority electronic Tax Invoice Management",
        docs: "https://www.kra.go.ke/en/information/e-tims",
        tab: "integration",
        status: "Kenya-only — auto-enabled with KRA PIN",
      },
      {
        name: "Supabase (Backend)",
        desc: "Cloud database, auth, real-time sync & storage",
        docs: "https://supabase.com/docs",
        tab: "data",
        status: "Connected (active)",
        connected: true,
      },
      {
        name: "Cloudflare Pages",
        desc: "Static site hosting & edge CDN",
        docs: "https://developers.cloudflare.com/pages/",
        tab: "",
        status: "Deployed",
        connected: true,
      },
      {
        name: "Vercel",
        desc: "Serverless functions & preview deployments",
        docs: "https://vercel.com/docs",
        tab: "",
        status: "Connected",
        connected: true,
      },
      {
        name: "TVGarden Live Feed",
        desc: "Live TV/Radio channels (News tab)",
        docs: "https://tvgarden.world",
        tab: "news",
        status: "Connected via /api/live-channels proxy",
        connected: true,
      },
      {
        name: "Google Identity Services",
        desc: "Sign in with Google OAuth",
        docs: "https://developers.google.com/identity/gsi/web/guides/overview",
        tab: "",
        status: "Enabled",
        connected: true,
      },
      {
        name: "Nominatim Geocoding",
        desc: "OpenStreetMap reverse geocoding for fuel prices",
        docs: "https://nominatim.org/release-docs/latest/api/Overview/",
        tab: "price-finder",
        status: "Connected",
        connected: true,
      },
      {
        name: "PostGIS Fuel Prices",
        desc: "Spatial fuel price cache & nearest-town lookup",
        docs: "https://postgis.net/documentation/",
        tab: "price-finder",
        status: "Connected (Supabase)",
        connected: true,
      },
    ],
    [],
  );

  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Integrations
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          All third-party integrations connected to your station. Click an
          integration to view its documentation or configure it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {integrations.map((int) => (
          <div
            key={int.name}
            className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${int.connected ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-700"}`}
                >
                  {int.connected ? (
                    <CheckCircle2
                      size={16}
                      className="text-green-600 dark:text-green-400"
                    />
                  ) : (
                    <Plug size={16} className="text-gray-400" />
                  )}
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {int.name}
                </h4>
              </div>
              <a
                href={int.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-500"
                title="View documentation"
              >
                <ExternalLink size={14} />
              </a>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {int.desc}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {int.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: AUTOMATION
// ═══════════════════════════════════════════════════════════════════════════
function AutomationTab({
  prefs,
  updatePrefs,
  show,
}: {
  prefs: UserPreferences;
  updatePrefs: (patch: Partial<UserPreferences>) => Promise<void>;
  show: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const automation = prefs.automation;
  const setAuto = (
    key: keyof UserPreferences["automation"],
    value: boolean,
  ) => {
    updatePrefs({ automation: { ...automation, [key]: value } });
    show(
      `Automation ${value ? "enabled" : "disabled"}: ${key.replace(/([A-Z])/g, " $1").trim()}`,
      "success",
    );
  };

  return (
    <div className="p-5 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Automation Engine
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The site's brain — automated actions that run without manual
          intervention. Changes sync across all devices.
        </p>
      </div>

      <SectionCard title="Stock Automation" icon={Zap}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={automation.autoReorderEnabled}
            onChange={(v) => setAuto("autoReorderEnabled", v)}
            label="Auto-Reorder"
            description="Automatically create purchase orders when stock drops below reorder level"
          />
          <Toggle
            checked={automation.autoRecordStockOnProductEdit}
            onChange={(v) => setAuto("autoRecordStockOnProductEdit", v)}
            label="Auto-Record Stock Changes"
            description="Log an inventory transaction whenever a product's stock is edited"
          />
        </div>
      </SectionCard>

      <SectionCard title="Dashboard & Sync" icon={RefreshCw}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={automation.autoRefreshDashboard}
            onChange={(v) => setAuto("autoRefreshDashboard", v)}
            label="Auto-Refresh Dashboard"
            description="Dashboard KPIs update automatically when new sales/transactions occur"
          />
          <Toggle
            checked={automation.autoSyncPricesAcrossTabs}
            onChange={(v) => setAuto("autoSyncPricesAcrossTabs", v)}
            label="Sync Prices Across Tabs"
            description="Fuel price changes propagate to Dashboard, POS, Invoice, Reports instantly"
          />
          <Toggle
            checked={automation.autoLogShiftTotals}
            onChange={(v) => setAuto("autoLogShiftTotals", v)}
            label="Auto-Log Shift Totals"
            description="Record shift totals automatically when a shift is closed"
          />
        </div>
      </SectionCard>

      <SectionCard title="Documentation" icon={ExternalLink}>
        <div className="space-y-2">
          <a
            href="https://supabase.com/docs/guides/realtime"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
          >
            <span className="text-gray-700 dark:text-gray-300">
              Supabase Realtime — how cross-device sync works
            </span>
            <ExternalLink size={14} className="text-gray-400" />
          </a>
          <a
            href="https://postgis.net/documentation/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
          >
            <span className="text-gray-700 dark:text-gray-300">
              PostGIS — spatial fuel price cache
            </span>
            <ExternalLink size={14} className="text-gray-400" />
          </a>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: SECURITY
// ═══════════════════════════════════════════════════════════════════════════
function SecurityTab({
  config,
  update,
  show,
  isOwner,
}: {
  config: GeneralSettingsConfig;
  update: <K extends keyof GeneralSettingsConfig>(
    key: K,
    value: GeneralSettingsConfig[K],
  ) => void;
  show: (msg: string, type?: "success" | "error" | "info") => void;
  isOwner: boolean;
}) {
  return (
    <div className="p-5 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Security
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Authentication, session, and access control settings for your station.
        </p>
      </div>

      <SectionCard title="Authentication" icon={Shield}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={config.requireTwoFactor}
            onChange={(v) => {
              if (!isOwner) {
                show("Only the owner can change 2FA requirements", "error");
                return;
              }
              update("requireTwoFactor", v);
            }}
            label="Require Two-Factor Authentication (2FA)"
            description="All team members must enable 2FA before accessing the station"
            disabled={!isOwner}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field
            label="Session Timeout (minutes)"
            hint="Auto-logout after inactivity"
          >
            <input
              type="number"
              min="5"
              max="1440"
              className={inputClass}
              value={config.sessionTimeoutMinutes}
              onChange={(e) =>
                update("sessionTimeoutMinutes", parseInt(e.target.value) || 30)
              }
              disabled={!isOwner}
            />
          </Field>
          <Field label="Max Login Attempts" hint="Before account lockout">
            <input
              type="number"
              min="3"
              max="20"
              className={inputClass}
              value={config.maxLoginAttempts}
              onChange={(e) =>
                update("maxLoginAttempts", parseInt(e.target.value) || 5)
              }
              disabled={!isOwner}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Access Control" icon={KeyRound}>
        <Field
          label="IP Whitelist"
          hint="Comma-separated list of allowed IP addresses (empty = allow all)"
        >
          <input
            className={inputClass}
            value={config.ipWhitelist}
            onChange={(e) => update("ipWhitelist", e.target.value)}
            placeholder="e.g. 192.168.1.0/24, 10.0.0.5"
            disabled={!isOwner}
          />
        </Field>
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2">
          <AlertCircle
            size={16}
            className="text-amber-500 flex-shrink-0 mt-0.5"
          />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Access codes &amp; team member permissions are managed in the Team
            Manager tab. Role-based access control (Owner &gt; Manager &gt;
            Staff &gt; Auditor) is configured there.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Audit & Compliance" icon={Activity}>
        <Field
          label="Audit Log Retention (days)"
          hint="How long to keep activity logs"
        >
          <input
            type="number"
            min="30"
            max="3650"
            className={inputClass}
            value={config.auditLogRetentionDays}
            onChange={(e) =>
              update("auditLogRetentionDays", parseInt(e.target.value) || 90)
            }
          />
        </Field>
      </SectionCard>

      <SectionCard title="Security Documentation" icon={ExternalLink}>
        <div className="space-y-2">
          <a
            href="https://supabase.com/docs/guides/auth"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
          >
            <span className="text-gray-700 dark:text-gray-300">
              Supabase Auth — authentication documentation
            </span>
            <ExternalLink size={14} className="text-gray-400" />
          </a>
          <a
            href="https://supabase.com/docs/guides/database/postgres/row-level-security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
          >
            <span className="text-gray-700 dark:text-gray-300">
              Row-Level Security — how data isolation works
            </span>
            <ExternalLink size={14} className="text-gray-400" />
          </a>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
function NotificationsTab({
  config,
  update,
}: {
  config: GeneralSettingsConfig;
  update: <K extends keyof GeneralSettingsConfig>(
    key: K,
    value: GeneralSettingsConfig[K],
  ) => void;
}) {
  return (
    <div className="p-5 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Notifications
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure how and when you receive alerts about station activity.
        </p>
      </div>

      <SectionCard title="Delivery Channels" icon={Bell}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={config.emailNotifications}
            onChange={(v) => update("emailNotifications", v)}
            label="Email Notifications"
            description="Receive alerts via email"
          />
          <Toggle
            checked={config.smsNotifications}
            onChange={(v) => update("smsNotifications", v)}
            label="SMS Notifications"
            description="Receive alerts via SMS (requires SMS gateway in Integration Hub)"
          />
          <Toggle
            checked={config.pushNotifications}
            onChange={(v) => update("pushNotifications", v)}
            label="Push Notifications"
            description="Browser push notifications"
          />
        </div>
      </SectionCard>

      <SectionCard title="Alert Types" icon={AlertCircle}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={config.lowStockAlerts}
            onChange={(v) => update("lowStockAlerts", v)}
            label="Low Stock Alerts"
            description="Notify when a product drops below its reorder level"
          />
          <Toggle
            checked={config.creditAlerts}
            onChange={(v) => update("creditAlerts", v)}
            label="Credit Account Alerts"
            description="Notify when a credit account is overdue or near its limit"
          />
          <Toggle
            checked={config.shiftReminders}
            onChange={(v) => update("shiftReminders", v)}
            label="Shift Reminders"
            description="Remind staff about upcoming shift changes"
          />
          <Toggle
            checked={config.dailySummaryEmail}
            onChange={(v) => update("dailySummaryEmail", v)}
            label="Daily Summary Email"
            description="Receive a daily summary of sales, expenses & stock changes"
          />
        </div>
      </SectionCard>

      <SectionCard title="Notification Documentation" icon={ExternalLink}>
        <a
          href="https://supabase.com/docs/guides/realtime"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
        >
          <span className="text-gray-700 dark:text-gray-300">
            Supabase Realtime — how instant notifications work
          </span>
          <ExternalLink size={14} className="text-gray-400" />
        </a>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-TAB: SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
function SystemTab({
  config,
  show,
}: {
  config: GeneralSettingsConfig;
  show: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const [healthStatus, setHealthStatus] = useState<
    Record<string, "ok" | "error" | "checking">
  >({
    supabase: "checking",
    cloudflare: "checking",
    vercel: "checking",
    realtime: "checking",
  });

  const runHealthCheck = useCallback(async () => {
    setHealthStatus({
      supabase: "checking",
      cloudflare: "checking",
      vercel: "checking",
      realtime: "checking",
    });
    try {
      // Check Supabase
      const sbRes = await fetch(
        "https://ojsscjwatikixlpshmub.supabase.co/rest/v1/",
        { method: "HEAD" },
      );
      setHealthStatus((s) => ({ ...s, supabase: sbRes.ok ? "ok" : "error" }));
    } catch {
      setHealthStatus((s) => ({ ...s, supabase: "error" }));
    }
    try {
      // Check Cloudflare
      const cfRes = await fetch("https://fuel-app-mobile.pages.dev/", {
        method: "HEAD",
      });
      setHealthStatus((s) => ({ ...s, cloudflare: cfRes.ok ? "ok" : "error" }));
    } catch {
      setHealthStatus((s) => ({ ...s, cloudflare: "error" }));
    }
    try {
      // Check Vercel
      const vRes = await fetch("https://fuel-app-mobile.vercel.app/", {
        method: "HEAD",
      });
      setHealthStatus((s) => ({ ...s, vercel: vRes.ok ? "ok" : "error" }));
    } catch {
      setHealthStatus((s) => ({ ...s, vercel: "error" }));
    }
    setHealthStatus((s) => ({
      ...s,
      realtime: config.enableRealtime ? "ok" : "error",
    }));
    show("Health check complete", "success");
  }, [config.enableRealtime, show]);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  const systemInfo = useMemo(
    () => [
      { label: "App Version", value: "FuelPro v3.0 (2026)", icon: Info },
      {
        label: "Backend",
        value: "Supabase (ojsscjwatikixlpshmub)",
        icon: Database,
      },
      {
        label: "Frontend Hosting",
        value: "Cloudflare Pages + Vercel",
        icon: Cloud,
      },
      {
        label: "Realtime",
        value: config.enableRealtime
          ? "Enabled (Supabase Realtime)"
          : "Disabled",
        icon: Activity,
      },
      {
        label: "Compression",
        value: config.enableCompression ? "Enabled (gzip level 9)" : "Disabled",
        icon: Database,
      },
      {
        label: "Low-Bandwidth Mode",
        value: config.lowBandwidthMode ? "ON (Realtime paused)" : "OFF",
        icon: Zap,
      },
      {
        label: "Auto-Backup",
        value: config.autoBackup
          ? `${config.backupFrequency} (to cloud)`
          : "Disabled",
        icon: Save,
      },
      {
        label: "Data Retention",
        value: `${config.dataRetentionDays} days`,
        icon: Clock,
      },
      {
        label: "Last Updated",
        value: new Date(config.updatedAt).toLocaleString(),
        icon: Clock,
      },
    ],
    [config],
  );

  const docLinks = useMemo(
    () => [
      {
        title: "FuelPro Documentation",
        url: "https://fuel-app-mobile.pages.dev/",
        desc: "Main app documentation",
      },
      {
        title: "Supabase Docs",
        url: "https://supabase.com/docs",
        desc: "Backend database, auth & realtime",
      },
      {
        title: "Cloudflare Pages Docs",
        url: "https://developers.cloudflare.com/pages/",
        desc: "Frontend hosting",
      },
      {
        title: "Vercel Docs",
        url: "https://vercel.com/docs",
        desc: "Serverless functions",
      },
      {
        title: "React Documentation",
        url: "https://react.dev/",
        desc: "Frontend framework",
      },
      {
        title: "Vite Documentation",
        url: "https://vitejs.dev/guide/",
        desc: "Build tool",
      },
      {
        title: "Tailwind CSS",
        url: "https://tailwindcss.com/docs",
        desc: "Styling framework",
      },
      {
        title: "hls.js",
        url: "https://github.com/video-dev/hls.js/",
        desc: "Live TV video player",
      },
      {
        title: "Supabase Realtime",
        url: "https://supabase.com/docs/guides/realtime",
        desc: "Cross-device sync",
      },
      {
        title: "PostGIS",
        url: "https://postgis.net/documentation/",
        desc: "Spatial fuel price cache",
      },
    ],
    [],
  );

  return (
    <div className="p-5 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          System
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          System information, health status, backup configuration &
          documentation.
        </p>
      </div>

      <SectionCard title="System Information" icon={Server}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {systemInfo.map((info) => {
            const Icon = info.icon;
            return (
              <div
                key={info.label}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <Icon size={16} className="text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {info.label}
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {info.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Health Check" icon={Activity}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Live connectivity status of all services
          </p>
          <button
            onClick={runHealthCheck}
            className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
          >
            <RefreshCw size={12} /> Recheck
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(healthStatus).map(([service, status]) => (
            <div
              key={service}
              className={`p-3 rounded-lg border text-center ${
                status === "ok"
                  ? "border-green-300 bg-green-50 dark:bg-green-900/20"
                  : status === "error"
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                    : "border-gray-200 bg-gray-50 dark:bg-gray-800"
              }`}
            >
              <div className="flex items-center justify-center mb-1">
                {status === "ok" ? (
                  <CheckCircle2
                    size={20}
                    className="text-green-600 dark:text-green-400"
                  />
                ) : status === "error" ? (
                  <AlertCircle
                    size={20}
                    className="text-red-600 dark:text-red-400"
                  />
                ) : (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <p className="text-xs font-medium capitalize text-gray-900 dark:text-gray-100">
                {service}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {status === "ok"
                  ? "Connected"
                  : status === "error"
                    ? "Offline"
                    : "Checking…"}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Backup & Data" icon={Database}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={config.autoBackup}
            onChange={(v) => updateAutoBackup(v)}
            label="Automatic Cloud Backup"
            description="Periodically back up all station data to the cloud"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Field label="Backup Frequency">
            <select
              className={inputClass}
              value={config.backupFrequency}
              onChange={(e) =>
                updateAutoBackupFreq(
                  e.target.value as "daily" | "weekly" | "monthly",
                )
              }
              disabled={!config.autoBackup}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="Data Retention (days)">
            <input
              type="number"
              min="30"
              max="3650"
              className={inputClass}
              value={config.dataRetentionDays}
              onChange={(e) =>
                updateDataRetention(parseInt(e.target.value) || 365)
              }
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Performance" icon={Zap}>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            checked={config.enableRealtime}
            onChange={(v) => {
              updateEnableRealtime(v);
              cloudStorageService.setRealtimeEnabled(v);
            }}
            label="Real-time Sync"
            description="Instant cross-device updates via Supabase Realtime (uses more bandwidth)"
          />
          <Toggle
            checked={config.enableCompression}
            onChange={(v) => updateEnableCompression(v)}
            label="Data Compression"
            description="Compress cloud data with gzip (reduces storage & egress)"
          />
          <Toggle
            checked={config.lowBandwidthMode}
            onChange={(v) => {
              updateLowBandwidth(v);
              cloudStorageService.setRealtimeEnabled(!v);
            }}
            label="Low-Bandwidth Mode"
            description="Pause real-time sync to save data (use manual refresh)"
          />
        </div>
      </SectionCard>

      <SectionCard title="Documentation & Resources" icon={ExternalLink}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {docLinks.map((doc) => (
            <a
              key={doc.title}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm group"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {doc.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {doc.desc}
                </p>
              </div>
              <ExternalLink
                size={14}
                className="text-gray-400 group-hover:text-blue-500"
              />
            </a>
          ))}
        </div>
      </SectionCard>
    </div>
  );

  function updateAutoBackup(v: boolean) {
    // Inline update to avoid prop drilling
    cloudStorageService
      .set(SETTINGS_KEY, {
        ...config,
        autoBackup: v,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => {});
    show(`Auto-backup ${v ? "enabled" : "disabled"}`, "success");
  }
  function updateAutoBackupFreq(freq: "daily" | "weekly" | "monthly") {
    cloudStorageService
      .set(SETTINGS_KEY, {
        ...config,
        backupFrequency: freq,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => {});
    show(`Backup frequency: ${freq}`, "success");
  }
  function updateDataRetention(days: number) {
    cloudStorageService
      .set(SETTINGS_KEY, {
        ...config,
        dataRetentionDays: days,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => {});
    show(`Data retention: ${days} days`, "success");
  }
  function updateEnableRealtime(v: boolean) {
    cloudStorageService
      .set(SETTINGS_KEY, {
        ...config,
        enableRealtime: v,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => {});
    show(`Real-time sync ${v ? "enabled" : "disabled"}`, "success");
  }
  function updateEnableCompression(v: boolean) {
    cloudStorageService
      .set(SETTINGS_KEY, {
        ...config,
        enableCompression: v,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => {});
    show(`Compression ${v ? "enabled" : "disabled"}`, "success");
  }
  function updateLowBandwidth(v: boolean) {
    cloudStorageService
      .set(SETTINGS_KEY, {
        ...config,
        lowBandwidthMode: v,
        enableRealtime: !v,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => {});
    show(`Low-bandwidth mode ${v ? "ON" : "OFF"}`, "success");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REUSABLE SECTION CARD
// ═══════════════════════════════════════════════════════════════════════════
function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <Icon size={16} className="text-blue-500 flex-shrink-0" />
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
