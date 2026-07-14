import { useState } from "react";
import {
  Code2,
  Webhook,
  Key,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  Globe,
  CheckCircle2,
} from "lucide-react";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastTriggered: string | null;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
}

const WEBHOOKS_KEY = "fuelpro_webhooks";
const APIKEYS_KEY = "fuelpro_api_keys";

function loadWebhooks(): Webhook[] {
  try {
    const s = localStorage.getItem(WEBHOOKS_KEY);
    if (s) return JSON.parse(s);
  } catch {
    /* */
  }
  return [];
}
function loadApiKeys(): ApiKey[] {
  try {
    const s = localStorage.getItem(APIKEYS_KEY);
    if (s) return JSON.parse(s);
  } catch {
    /* */
  }
  return [];
}

interface Props {
  logAudit: (
    e: string,
    d: string,
    s: "success" | "warning" | "danger" | "info"
  ) => void;
}

export default function ApiSection({ logAudit }: Props) {
  const [webhooks, setWebhooks] = useState<Webhook[]>(loadWebhooks);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(loadApiKeys);
  const [newHookUrl, setNewHookUrl] = useState("");
  const [newHookEvents, setNewHookEvents] = useState<string[]>(["sales"]);
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const saveWebhooks = (w: Webhook[]) => {
    localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(w));
    setWebhooks(w);
  };
  const saveApiKeys = (k: ApiKey[]) => {
    localStorage.setItem(APIKEYS_KEY, JSON.stringify(k));
    setApiKeys(k);
  };

  const addWebhook = () => {
    if (!newHookUrl.trim()) return;
    const hook: Webhook = {
      id: `wh_${Date.now()}`,
      url: newHookUrl.trim(),
      events: newHookEvents,
      active: true,
      createdAt: new Date().toISOString(),
      lastTriggered: null,
    };
    saveWebhooks([...webhooks, hook]);
    setNewHookUrl("");
    setNewHookEvents(["sales"]);
    logAudit(
      "Webhook Created",
      `Webhook added for ${hook.events.join(", ")}`,
      "success"
    );
  };

  const toggleWebhook = (id: string) => {
    saveWebhooks(
      webhooks.map(w => (w.id === id ? { ...w, active: !w.active } : w))
    );
  };

  const deleteWebhook = (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    saveWebhooks(webhooks.filter(w => w.id !== id));
    logAudit("Webhook Deleted", `Webhook ${id} removed`, "warning");
  };

  const addApiKey = () => {
    if (!newKeyName.trim()) return;
    const key: ApiKey = {
      id: `ak_${Date.now()}`,
      name: newKeyName.trim(),
      key: `fpk_${btoa(`${Date.now()}_${Math.random().toString(36).slice(2)}`)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 32)}`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };
    saveApiKeys([...apiKeys, key]);
    setNewKeyName("");
    logAudit("API Key Created", `Key "${key.name}" generated`, "success");
  };

  const deleteApiKey = (id: string) => {
    if (!confirm("Revoke this API key?")) return;
    saveApiKeys(apiKeys.filter(k => k.id !== id));
    logAudit("API Key Revoked", `Key ${id} revoked`, "warning");
  };

  const copyKey = (key: string) => {
    navigator.clipboard?.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const eventOptions = [
    "sales",
    "inventory",
    "payments",
    "employees",
    "security",
    "system",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <Code2 size={18} className="text-purple-400" /> API & Webhooks
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage API keys and webhook endpoints
          </p>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Key size={14} className="text-amber-400" /> API Keys (
          {apiKeys.length})
        </h3>
        <div className="flex gap-2 mb-4">
          <input
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="Key name..."
            className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30"
          />
          <button
            onClick={addApiKey}
            className="px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs rounded-lg border border-amber-500/20 transition-colors flex items-center gap-1"
          >
            <Plus size={12} /> Create Key
          </button>
        </div>
        <div className="space-y-2">
          {apiKeys.map(k => (
            <div
              key={k.id}
              className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium">{k.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-[10px] text-gray-500 font-mono">
                    {k.key.slice(0, 16)}...
                  </code>
                  <button
                    onClick={() => copyKey(k.key)}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    {copiedKey === k.key ? (
                      <Check size={10} className="text-green-400" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                </div>
              </div>
              <button
                onClick={() => deleteApiKey(k.id)}
                className="text-gray-500 hover:text-red-400 transition-colors ml-2"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {apiKeys.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">
              No API keys
            </p>
          )}
        </div>
      </div>

      {/* Webhooks */}
      <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Webhook size={14} className="text-green-400" /> Webhooks (
          {webhooks.length})
        </h3>
        <div className="space-y-3 mb-4">
          <input
            value={newHookUrl}
            onChange={e => setNewHookUrl(e.target.value)}
            placeholder="https://your-app.com/webhook"
            className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30"
          />
          <div className="flex flex-wrap gap-2">
            {eventOptions.map(e => (
              <button
                key={e}
                onClick={() =>
                  setNewHookEvents(prev =>
                    prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
                  )
                }
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${newHookEvents.includes(e) ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-white/5 border-white/10 text-gray-500"}`}
              >
                {e}
              </button>
            ))}
            <button
              onClick={addWebhook}
              className="ml-auto px-3 py-1 bg-green-500/15 hover:bg-green-500/25 text-green-300 text-xs rounded-lg border border-green-500/20 transition-colors flex items-center gap-1"
            >
              <Plus size={10} /> Add
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {webhooks.map(w => (
            <div
              key={w.id}
              className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Globe
                    size={10}
                    className={w.active ? "text-green-400" : "text-gray-600"}
                  />
                  <p className="text-xs text-white truncate">{w.url}</p>
                </div>
                <div className="flex gap-1 mt-1">
                  {w.events.map(e => (
                    <span
                      key={e}
                      className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => toggleWebhook(w.id)}
                  className={`w-8 h-4.5 rounded-full transition-colors ${w.active ? "bg-green-500" : "bg-gray-600"}`}
                >
                  <div
                    className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${w.active ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </button>
                <button
                  onClick={() => deleteWebhook(w.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors ml-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {webhooks.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">
              No webhooks configured
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
