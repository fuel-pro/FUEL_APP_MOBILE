import { useState } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Clock,
  RefreshCw,
  Activity,
} from "lucide-react";

interface APIKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  active: boolean;
}

const AVAILABLE_SCOPES = [
  {
    id: "read:stations",
    label: "Read Stations",
    description: "View station data",
  },
  {
    id: "write:stations",
    label: "Write Stations",
    description: "Create/update station data",
  },
  {
    id: "read:sales",
    label: "Read Sales",
    description: "View sales transactions",
  },
  {
    id: "write:sales",
    label: "Write Sales",
    description: "Create sales transactions",
  },
  {
    id: "read:inventory",
    label: "Read Inventory",
    description: "View inventory data",
  },
  {
    id: "write:inventory",
    label: "Write Inventory",
    description: "Update inventory",
  },
  {
    id: "read:reports",
    label: "Read Reports",
    description: "Access reports and analytics",
  },
  { id: "admin", label: "Admin", description: "Full administrative access" },
];

const STORAGE_KEY = "fuelpro_apikeys_v2";

export default function APIKeyManager() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      /* */
    }
    return [];
  });
  const [showForm, setShowForm] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "warning";
  } | null>(null);
  const [formData, setFormData] = useState<Partial<APIKey>>({
    name: "",
    scopes: [],
    active: true,
  });

  const save = (list: APIKey[]) => {
    setApiKeys(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const showNotification = (
    message: string,
    type: "success" | "warning" = "success"
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleSecret = (id: string) =>
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateKey = () => {
    const prefix = "fp";
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomPart = "";
    for (let i = 0; i < 40; i++)
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefix}_${randomPart}`;
  };

  const handleSave = () => {
    if (!formData.name) {
      showNotification("Name is required", "warning");
      return;
    }
    const newKey: APIKey = {
      id: `key_${Date.now()}`,
      name: formData.name || "",
      key: generateKey(),
      scopes: formData.scopes || [],
      active: formData.active ?? true,
      createdAt: new Date().toISOString(),
    };
    setApiKeys(prev => [newKey, ...prev]);
    showNotification("API Key created successfully");
    setShowForm(false);
    setFormData({ name: "", scopes: [], active: true });
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this API key? This action cannot be undone.")) {
      setApiKeys(prev => prev.filter(k => k.id !== id));
      showNotification("API Key deleted");
    }
  };

  const toggleActive = (id: string) => {
    setApiKeys(prev =>
      prev.map(k => (k.id === id ? { ...k, active: !k.active } : k))
    );
    showNotification("API Key status updated");
  };

  const toggleScope = (scopeId: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes?.includes(scopeId)
        ? prev.scopes.filter(s => s !== scopeId)
        : [...(prev.scopes || []), scopeId],
    }));
  };

  return (
    <div className="space-y-3">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2 ${notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span className="text-sm">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl">
            <Key size={24} className="text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              API Key Manager
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage API keys for external integrations
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Create API Key
        </button>
      </div>

      {/* Security Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <Shield size={20} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Security Notice
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            API keys provide full programmatic access to your station data. Keep
            them secure and never share in public repositories.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Total Keys</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {apiKeys.length}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600">Active Keys</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {apiKeys.filter(k => k.active).length}
          </p>
        </div>
        <div className="bg-cyan-50 dark:bg-cyan-900/10 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
          <p className="text-xs text-cyan-600">Total Scopes</p>
          <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
            {new Set(apiKeys.flatMap(k => k.scopes)).size}
          </p>
        </div>
      </div>

      {/* Keys List */}
      {apiKeys.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center">
          <Key size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No API keys created yet
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Create your first API key to enable external integrations
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium"
          >
            Create Your First Key
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map(apiKey => (
            <div
              key={apiKey.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {apiKey.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${apiKey.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}
                    >
                      {apiKey.active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* API Key Display */}
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded text-gray-600 dark:text-gray-400 truncate">
                      {showSecrets[apiKey.id]
                        ? apiKey.key
                        : apiKey.key.slice(0, 12) +
                          "•".repeat(apiKey.key.length - 12)}
                    </code>
                    <button
                      onClick={() => toggleSecret(apiKey.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showSecrets[apiKey.id] ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => copyKey(apiKey.key, apiKey.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {copiedId === apiKey.id ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>

                  {/* Scopes */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {apiKey.scopes.map(scope => (
                      <span
                        key={scope}
                        className="px-2 py-0.5 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 rounded text-xs"
                      >
                        {AVAILABLE_SCOPES.find(s => s.id === scope)?.label ||
                          scope}
                      </span>
                    ))}
                  </div>

                  {/* Meta Info */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Created{" "}
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </span>
                    {apiKey.lastUsed && (
                      <span className="flex items-center gap-1">
                        <Activity size={12} /> Last used{" "}
                        {new Date(apiKey.lastUsed).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(apiKey.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title={apiKey.active ? "Deactivate" : "Activate"}
                  >
                    {apiKey.active ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(apiKey.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowForm(false)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Create API Key
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Key Name
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Production API Key"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Permissions (Scopes)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_SCOPES.map(scope => (
                    <label
                      key={scope.id}
                      className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.scopes?.includes(scope.id) ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.scopes?.includes(scope.id) || false}
                        onChange={() => toggleScope(scope.id)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {scope.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {scope.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active ?? true}
                  onChange={e =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Active immediately
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create API Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
