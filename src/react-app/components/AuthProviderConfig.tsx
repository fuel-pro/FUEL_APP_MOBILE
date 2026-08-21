import { useState, useEffect, useRef } from "react";
import {
  Users,
  Shield,
  Key,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Mail,
  Lock,
} from "lucide-react";
import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";
import { useAuth } from "@/react-app/context/AuthContext";
import { useStations } from "@/react-app/context/StationContext";

interface AuthProvider {
  type: "email" | "google" | "phone" | "custom";
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  customEndpoint?: string;
}

interface AuthConfig {
  emailPassword: {
    enabled: boolean;
    requireVerification: boolean;
    minPasswordLength: number;
  };
  google: { enabled: boolean; clientId: string; clientSecret: string };
  phone: { enabled: boolean; provider: "twilio" | "africastalking" | "none" };
  custom: { enabled: boolean; endpoint: string; apiKey: string };
  session: {
    timeoutMinutes: number;
    rememberMe: boolean;
    maxLoginAttempts: number;
  };
  security: {
    twoFactorEnabled: boolean;
    lockoutDuration: number;
    passwordHistory: number;
  };
}

const STORAGE_KEY = "fuelpro_auth_config";
const CLOUD_KEY = "auth_config";

const DEFAULT_CONFIG: AuthConfig = {
  emailPassword: {
    enabled: true,
    requireVerification: true,
    minPasswordLength: 8,
  },
  google: { enabled: false, clientId: "", clientSecret: "" },
  phone: { enabled: true, provider: "none" },
  custom: { enabled: false, endpoint: "", apiKey: "" },
  session: { timeoutMinutes: 60, rememberMe: true, maxLoginAttempts: 5 },
  security: {
    twoFactorEnabled: false,
    lockoutDuration: 30,
    passwordHistory: 5,
  },
};

export default function AuthProviderConfig() {
  const { user } = useAuth();
  const { currentStation } = useStations();
  const stationId = currentStation?.id;

  const [config, setConfig] = useState<AuthConfig>(() => {
    const cached = cloudStorageService.getCached<AuthConfig>(
      CLOUD_KEY,
      stationId,
    );
    if (cached) return { ...DEFAULT_CONFIG, ...cached };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch {
      /* */
    }
    return DEFAULT_CONFIG;
  });
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [synced, setSynced] = useState(false);

  // Cloud-first load guard (prevents overwriting cloud data with defaults on fresh device)
  const cloudLoadCompleteRef = useRef(false);
  const localModifiedRef = useRef(false);

  // Load from cloud on mount/user/station change
  useEffect(() => {
    if (!user) return;
    cloudLoadCompleteRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await cloudStorageService.get<AuthConfig>(
          CLOUD_KEY,
          stationId,
        );
        if (!cancelled && cloud) {
          setConfig({ ...DEFAULT_CONFIG, ...cloud });
        }
      } catch {
        /* ignore - localStorage cache is fallback */
      } finally {
        if (!cancelled) {
          cloudLoadCompleteRef.current = true;
          setSynced(true);
          // Flush any local edits made during load
          if (localModifiedRef.current) {
            cloudStorageService
              .set(CLOUD_KEY, configRef.current, stationId)
              .catch(() => {});
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, stationId]);

  // Keep a ref of latest config for post-load flush
  const configRef = useRef(config);
  configRef.current = config;

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const unsub = cloudStorageService.subscribe<AuthConfig>(
      CLOUD_KEY,
      stationId,
      (cloud) => {
        if (cloud && !localModifiedRef.current) {
          setConfig({ ...DEFAULT_CONFIG, ...cloud });
          setSynced(true);
        }
      },
    );
    return () => unsub();
  }, [user, stationId]);

  const toggleSecret = (key: string) =>
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = () => {
    if (!cloudLoadCompleteRef.current) {
      setError(
        "Still loading your configuration from cloud. Please try again in a moment.",
      );
      return;
    }
    setSaving(true);
    setError("");
    localModifiedRef.current = true;
    try {
      // localStorage as read-through cache
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      // Cloud as source of truth
      cloudStorageService
        .set(CLOUD_KEY, config, stationId)
        .then(() => {
          localModifiedRef.current = false;
          setSynced(true);
        })
        .catch((e) => {
          setError(
            "Saved locally but failed to sync to cloud: " +
              (e?.message || "unknown error"),
          );
        });
      setTimeout(() => {
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }, 500);
    } catch (e) {
      setSaving(false);
      setError("Failed to save configuration");
    }
  };

  const reset = () => {
    if (confirm("Reset authentication configuration to defaults?")) {
      localModifiedRef.current = true;
      setConfig(DEFAULT_CONFIG);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
      cloudStorageService
        .set(CLOUD_KEY, DEFAULT_CONFIG, stationId)
        .catch(() => {});
    }
  };

  const updateNested = (path: string, value: any) => {
    setConfig((prev) => {
      const parts = path.split(".");
      const newConfig = JSON.parse(JSON.stringify(prev));
      let current = newConfig;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return newConfig;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <Shield
              size={24}
              className="text-indigo-600 dark:text-indigo-400"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Authentication Providers
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure login methods and security settings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            SECURE
          </span>
        </div>
      </div>

      {/* Email/Password */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail size={20} className="text-gray-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Email & Password
              </h3>
              <p className="text-xs text-gray-500">
                Traditional email/password authentication
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.emailPassword.enabled}
              onChange={(e) =>
                updateNested("emailPassword.enabled", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
        {config.emailPassword.enabled && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.emailPassword.requireVerification}
                onChange={(e) =>
                  updateNested(
                    "emailPassword.requireVerification",
                    e.target.checked,
                  )
                }
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Require email verification
              </span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Minimum Password Length
              </label>
              <input
                type="number"
                min="6"
                max="32"
                value={config.emailPassword.minPasswordLength}
                onChange={(e) =>
                  updateNested(
                    "emailPassword.minPasswordLength",
                    parseInt(e.target.value),
                  )
                }
                className="w-32 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Google OAuth */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-gray-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Google OAuth
              </h3>
              <p className="text-xs text-gray-500">
                Sign in with Google account
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.google.enabled}
              onChange={(e) => updateNested("google.enabled", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
        {config.google.enabled && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Client ID
              </label>
              <input
                type="text"
                value={config.google.clientId}
                onChange={(e) =>
                  updateNested("google.clientId", e.target.value)
                }
                placeholder=".apps.googleusercontent.com"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Client Secret
              </label>
              <div className="relative">
                <input
                  type={showSecrets["google"] ? "text" : "password"}
                  value={config.google.clientSecret}
                  onChange={(e) =>
                    updateNested("google.clientSecret", e.target.value)
                  }
                  placeholder="GOCSPX-..."
                  className="w-full px-3 py-2.5 pr-10 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 font-mono"
                />
                <button
                  onClick={() => toggleSecret("google")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecrets["google"] ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phone Auth */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Key size={20} className="text-gray-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Phone Authentication
              </h3>
              <p className="text-xs text-gray-500">
                Sign in with phone number (OTP)
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.phone.enabled}
              onChange={(e) => updateNested("phone.enabled", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
        {config.phone.enabled && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                SMS Provider
              </label>
              <select
                value={config.phone.provider}
                onChange={(e) => updateNested("phone.provider", e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
              >
                <option value="none">Disabled</option>
                <option value="twilio">Twilio</option>
                <option value="africastalking">Africa's Talking</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Session Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Lock size={20} className="text-gray-500" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Session Settings
            </h3>
            <p className="text-xs text-gray-500">Configure session behavior</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="1440"
              value={config.session.timeoutMinutes}
              onChange={(e) =>
                updateNested("session.timeoutMinutes", parseInt(e.target.value))
              }
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Max Login Attempts
            </label>
            <input
              type="number"
              min="3"
              max="10"
              value={config.session.maxLoginAttempts}
              onChange={(e) =>
                updateNested(
                  "session.maxLoginAttempts",
                  parseInt(e.target.value),
                )
              }
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Lockout Duration (min)
            </label>
            <input
              type="number"
              min="5"
              max="120"
              value={config.security.lockoutDuration}
              onChange={(e) =>
                updateNested(
                  "security.lockoutDuration",
                  parseInt(e.target.value),
                )
              }
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.session.rememberMe}
              onChange={(e) =>
                updateNested("session.rememberMe", e.target.checked)
              }
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Enable "Remember Me" option
            </span>
          </label>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-gray-500" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Security Settings
            </h3>
            <p className="text-xs text-gray-500">Enhanced security options</p>
          </div>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.security.twoFactorEnabled}
              onChange={(e) =>
                updateNested("security.twoFactorEnabled", e.target.checked)
              }
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Enable Two-Factor Authentication
              </span>
              <p className="text-xs text-gray-400">
                Require 2FA for admin accounts
              </p>
            </div>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Password History
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Number of previous passwords to remember
            </p>
            <input
              type="number"
              min="0"
              max="10"
              value={config.security.passwordHistory}
              onChange={(e) =>
                updateNested(
                  "security.passwordHistory",
                  parseInt(e.target.value),
                )
              }
              className="w-32 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <RotateCcw size={16} /> Reset
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {saved ? (
            <>
              <CheckCircle2 size={16} /> Saved
            </>
          ) : (
            "Save Configuration"
          )}
        </button>
        {synced && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 size={12} /> Cloud-synced
          </span>
        )}
      </div>
    </div>
  );
}
