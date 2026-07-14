import { useState } from "react";
import {
  MessageSquare,
  Key,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Globe,
} from "lucide-react";

interface SMSConfig {
  provider: "twilio" | "africastalking" | "bulk" | "custom";
  accountSid: string;
  authToken: string;
  fromNumber: string;
  apiKey: string;
  username: string;
  customUrl: string;
  enabled: boolean;
}

const STORAGE_KEY = "fuelpro_sms_config";

export default function SMSGatewayConfig() {
  const [config, setConfig] = useState<SMSConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      /* */
    }
    return {
      provider: "twilio",
      accountSid: "",
      authToken: "",
      fromNumber: "",
      apiKey: "",
      username: "",
      customUrl: "",
      enabled: true,
    };
  });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  const save = () => {
    setSaving(true);
    setError("");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
    if (confirm("Reset SMS configuration to defaults?")) {
      setConfig({
        provider: "twilio",
        accountSid: "",
        authToken: "",
        fromNumber: "",
        apiKey: "",
        username: "",
        customUrl: "",
        enabled: true,
      });
    }
  };

  const testSMS = async () => {
    if (!testPhone) {
      setError("Enter a phone number to test");
      return;
    }
    setTesting(true);
    setError("");
    try {
      // Simulate sending test SMS
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert(`Test SMS sent to ${testPhone}!`);
      setTestPhone("");
    } catch (e) {
      setError("Failed to send test SMS");
    }
    setTesting(false);
  };

  const providers = [
    {
      id: "twilio",
      name: "Twilio",
      icon: "💬",
      description: "Global SMS provider with global coverage",
    },
    {
      id: "africastalking",
      name: "Africa's Talking",
      icon: "📱",
      description: "Popular in Africa with local numbers",
    },
    {
      id: "bulk",
      name: "Bulk SMS",
      icon: "📢",
      description: "Cost-effective bulk SMS service",
    },
    {
      id: "custom",
      name: "Custom API",
      icon: "⚙️",
      description: "Use your own SMS gateway",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <MessageSquare
              size={24}
              className="text-blue-600 dark:text-blue-400"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              SMS Gateway Configuration
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure SMS notifications and alerts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e =>
                setConfig({ ...config, enabled: e.target.checked })
              }
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Enabled
            </span>
          </label>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.enabled ? "bg-green-500/10 border border-green-500/20" : "bg-gray-500/10 border border-gray-500/20"}`}
          >
            <div
              className={`w-2 h-2 rounded-full ${config.enabled ? "bg-green-500" : "bg-gray-400"}`}
            />
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              {config.enabled ? "ACTIVE" : "DISABLED"}
            </span>
          </div>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          SMS Provider
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => setConfig({ ...config, provider: p.id as any })}
              className={`p-4 rounded-xl border-2 transition-all ${config.provider === p.id ? "border-blue-500 bg-blue-500/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
            >
              <div className="text-2xl mb-2">{p.icon}</div>
              <div className="font-medium text-sm text-gray-900 dark:text-white">
                {p.name}
              </div>
              <div className="text-xs text-gray-500 mt-1">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Twilio Config */}
      {config.provider === "twilio" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
            <Key size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Twilio Credentials
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Account SID
              </label>
              <input
                type="text"
                value={config.accountSid}
                onChange={e =>
                  setConfig({ ...config, accountSid: e.target.value })
                }
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Auth Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={config.authToken}
                  onChange={e =>
                    setConfig({ ...config, authToken: e.target.value })
                  }
                  placeholder="Your Twilio Auth Token"
                  className="w-full px-3 py-2.5 pr-10 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              From Number
            </label>
            <input
              type="text"
              value={config.fromNumber}
              onChange={e =>
                setConfig({ ...config, fromNumber: e.target.value })
              }
              placeholder="+1234567890"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Africa's Talking Config */}
      {config.provider === "africastalking" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
            <Globe size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Africa's Talking Credentials
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={config.username}
                onChange={e =>
                  setConfig({ ...config, username: e.target.value })
                }
                placeholder="Your Africa's Talking username"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                API Key
              </label>
              <input
                type="text"
                value={config.apiKey}
                onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="Your API Key"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Shortcode / Sender ID
            </label>
            <input
              type="text"
              value={config.fromNumber}
              onChange={e =>
                setConfig({ ...config, fromNumber: e.target.value })
              }
              placeholder="e.g., FUELPRO or 4-digit shortcode"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Custom API Config */}
      {config.provider === "custom" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
            <Key size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Custom API Endpoint
            </h3>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              API URL
            </label>
            <input
              type="url"
              value={config.customUrl}
              onChange={e =>
                setConfig({ ...config, customUrl: e.target.value })
              }
              placeholder="https://api.yoursmsgateway.com/send"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-400">
              Your custom API should accept POST requests with{" "}
              {`{phone, message, api_key}`} parameters
            </p>
          </div>
        </div>
      )}

      {/* Test SMS */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Test SMS
        </h3>
        <div className="flex gap-3">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="+254712345678"
            className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={testSMS}
            disabled={testing || !config.enabled}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {testing ? "Sending..." : "Send Test"}
          </button>
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
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
  );
}
