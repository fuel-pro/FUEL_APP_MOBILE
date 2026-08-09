import { useState, useEffect } from "react";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  Settings,
  Smartphone,
  Key,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Shield,
} from "lucide-react";

interface MpesaConfig {
  mode: "production" | "sandbox";
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  initiatorName: string;
  securityCredential: string;
  passkey: string;
  callbackUrl: string;
}

const STORAGE_KEY = "fuelpro_mpesa_config";
const CLOUD_KEY = "mpesa_config";
const TEST_PASSKEY =
  "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f235600b5509d608392";

export default function MPesaConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<MpesaConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      /* */
    }
    return {
      mode: "production",
      consumerKey: "",
      consumerSecret: "",
      shortcode: "",
      initiatorName: "",
      securityCredential: "",
      passkey: TEST_PASSKEY,
      callbackUrl: "",
    };
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showCredential, setShowCredential] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const save = () => {
    setSaving(true);
    setError("");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      cloudStorageService.set(CLOUD_KEY, config).catch(() => {});
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

  // Load from cloud on mount (cross-device sync)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const cloud = await cloudStorageService.get<MpesaConfig>(CLOUD_KEY);
      if (cloud) setConfig(cloud);
    })();
  }, [user]);

  const reset = () => {
    if (confirm("Reset to default production settings?")) {
      setConfig({
        mode: "production",
        consumerKey: "",
        consumerSecret: "",
        shortcode: "",
        initiatorName: "",
        securityCredential: "",
        passkey: TEST_PASSKEY,
        callbackUrl: "",
      });
    }
  };

  const testConnection = async () => {
    setError("");
    try {
      const auth = btoa(
        `${config.consumerKey || "test"}:${config.consumerSecret || "test"}`
      );
      const response = await fetch(
        "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
          headers: { Authorization: `Basic ${auth}` },
        }
      );
      if (response.ok) alert("Connection successful!");
      else throw new Error("Invalid credentials");
    } catch (e) {
      setError("Connection test failed. Check your credentials.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
            <Smartphone
              size={24}
              className="text-green-600 dark:text-green-400"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              M-PESA Configuration
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure Safaricom M-PESA integration for payments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <div
            className={`w-2 h-2 rounded-full ${config.mode === "production" ? "bg-red-500" : "bg-yellow-500"}`}
          />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            {config.mode.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Environment Mode
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setConfig({ ...config, mode: "sandbox" })}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${config.mode === "sandbox" ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
          >
            Sandbox (Testing)
          </button>
          <button
            onClick={() => setConfig({ ...config, mode: "production" })}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${config.mode === "production" ? "bg-green-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
          >
            Production (Live)
          </button>
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
          <Key size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            API Credentials
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Consumer Key
            </label>
            <input
              type="text"
              value={config.consumerKey}
              onChange={e =>
                setConfig({ ...config, consumerKey: e.target.value })
              }
              placeholder="Enter M-PESA Consumer Key"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Consumer Secret
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={config.consumerSecret}
                onChange={e =>
                  setConfig({ ...config, consumerSecret: e.target.value })
                }
                placeholder="Enter M-PESA Consumer Secret"
                className="w-full px-3 py-2.5 pr-10 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shortcode & Passkey */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
          <Settings size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Shortcode & Security
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Shortcode (Paybill/Till)
            </label>
            <input
              type="text"
              value={config.shortcode}
              onChange={e =>
                setConfig({ ...config, shortcode: e.target.value })
              }
              placeholder="e.g., 174379"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Passkey
            </label>
            <input
              type="text"
              value={config.passkey}
              onChange={e => setConfig({ ...config, passkey: e.target.value })}
              placeholder="Enter Passkey"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Initiator Name
            </label>
            <input
              type="text"
              value={config.initiatorName}
              onChange={e =>
                setConfig({ ...config, initiatorName: e.target.value })
              }
              placeholder="M-PESA Initiator Username"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Security Credential
            </label>
            <div className="relative">
              <input
                type={showCredential ? "text" : "password"}
                value={config.securityCredential}
                onChange={e =>
                  setConfig({ ...config, securityCredential: e.target.value })
                }
                placeholder="Encrypted M-PESA Security Credential"
                className="w-full px-3 py-2.5 pr-10 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-xs"
              />
              <button
                onClick={() => setShowCredential(!showCredential)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCredential ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Callback URL */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
          <Shield size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Callback Configuration
          </h3>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Callback URL
          </label>
          <input
            type="url"
            value={config.callbackUrl}
            onChange={e =>
              setConfig({ ...config, callbackUrl: e.target.value })
            }
            placeholder="https://yourapp.com/api/mpesa/callback"
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <p className="mt-2 text-xs text-gray-400">
            Configure this URL in your Safaricom Developer Portal to receive
            payment notifications
          </p>
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
        <div className="flex items-center gap-3">
          <button
            onClick={testConnection}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Test Connection
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );
}
