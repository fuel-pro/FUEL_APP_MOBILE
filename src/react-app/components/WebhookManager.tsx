import { useState } from "react";
import {
  Webhook,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  lastTriggered?: string;
  triggerCount: number;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  {
    id: "sale_created",
    label: "Sale Created",
    description: "Triggered when a new sale is completed",
  },
  {
    id: "payment_received",
    label: "Payment Received",
    description: "Triggered when payment is received",
  },
  {
    id: "inventory_low",
    label: "Inventory Low",
    description: "Triggered when fuel stock is low",
  },
  {
    id: "daily_report",
    label: "Daily Report",
    description: "Triggered daily with summary data",
  },
  {
    id: "user_created",
    label: "User Created",
    description: "Triggered when new user is added",
  },
  {
    id: "station_updated",
    label: "Station Updated",
    description: "Triggered when station details change",
  },
  {
    id: "alert_triggered",
    label: "Alert Triggered",
    description: "Triggered for compliance or security alerts",
  },
];

const STORAGE_KEY = "fuelpro_webhooks_v2";

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      /* */
    }
    return [];
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "warning";
  } | null>(null);
  const [formData, setFormData] = useState<Partial<WebhookEndpoint>>({
    name: "",
    url: "",
    secret: "",
    events: [],
    active: true,
  });

  const save = (list: WebhookEndpoint[]) => {
    setWebhooks(list);
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

  const copySecret = (secret: string, id: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleActive = (id: string) => {
    setWebhooks(prev =>
      prev.map(w => (w.id === id ? { ...w, active: !w.active } : w))
    );
    showNotification("Webhook status updated");
  };

  const handleSave = () => {
    if (!formData.name || !formData.url) {
      showNotification("Name and URL are required", "warning");
      return;
    }
    if (editingId) {
      setWebhooks(prev =>
        prev.map(w =>
          w.id === editingId ? ({ ...w, ...formData } as WebhookEndpoint) : w
        )
      );
      showNotification("Webhook updated");
    } else {
      const newWebhook: WebhookEndpoint = {
        id: `wh_${Date.now()}`,
        name: formData.name || "",
        url: formData.url || "",
        secret: formData.secret || generateSecret(),
        events: formData.events || [],
        active: formData.active ?? true,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
      };
      setWebhooks(prev => [newWebhook, ...prev]);
      showNotification("Webhook created");
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: "", url: "", secret: "", events: [], active: true });
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this webhook?")) {
      setWebhooks(prev => prev.filter(w => w.id !== id));
      showNotification("Webhook deleted");
    }
  };

  const handleEdit = (webhook: WebhookEndpoint) => {
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      active: webhook.active,
    });
    setEditingId(webhook.id);
    setShowForm(true);
  };

  const toggleEvent = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events?.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...(prev.events || []), eventId],
    }));
  };

  const generateSecret = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let secret = "";
    for (let i = 0; i < 32; i++)
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    return secret;
  };

  const regenerateSecret = () =>
    setFormData(prev => ({ ...prev, secret: generateSecret() }));

  const testWebhook = async (webhook: WebhookEndpoint) => {
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": webhook.secret,
          "X-Webhook-Test": "true",
        },
        body: JSON.stringify({
          event: "test",
          timestamp: new Date().toISOString(),
          data: { message: "Test webhook from FuelPro" },
        }),
      });
      if (response.ok) {
        setWebhooks(prev =>
          prev.map(w =>
            w.id === webhook.id
              ? {
                  ...w,
                  lastTriggered: new Date().toISOString(),
                  triggerCount: w.triggerCount + 1,
                }
              : w
          )
        );
        showNotification("Webhook test successful!");
      } else {
        showNotification(`Test failed: ${response.status}`, "warning");
      }
    } catch (e) {
      showNotification("Webhook test failed - check URL", "warning");
    }
  };

  return (
    <div className="space-y-6">
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
          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Webhook
              size={24}
              className="text-purple-600 dark:text-purple-400"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Webhook Manager
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure webhook endpoints for real-time notifications
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              name: "",
              url: "",
              secret: generateSecret(),
              events: [],
              active: true,
            });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Add Webhook
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">Total Webhooks</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {webhooks.length}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600">Active</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {webhooks.filter(w => w.active).length}
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-600">Total Triggers</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {webhooks.reduce((sum, w) => sum + w.triggerCount, 0)}
          </p>
        </div>
      </div>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center">
          <Webhook size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No webhooks configured yet
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
          >
            Create Your First Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(webhook => (
            <div
              key={webhook.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {webhook.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${webhook.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}
                    >
                      {webhook.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 font-mono">
                    {webhook.url}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="flex gap-1">
                        {webhook.events.slice(0, 3).map(event => (
                          <span
                            key={event}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs"
                          >
                            {AVAILABLE_EVENTS.find(e => e.id === event)
                              ?.label || event}
                          </span>
                        ))}
                        {webhook.events.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{webhook.events.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{webhook.triggerCount} triggers</span>
                    {webhook.lastTriggered && (
                      <span>
                        Last: {new Date(webhook.lastTriggered).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testWebhook(webhook)}
                    className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                    title="Test Webhook"
                  >
                    <Zap size={16} />
                  </button>
                  <button
                    onClick={() => toggleActive(webhook.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title={webhook.active ? "Disable" : "Enable"}
                  >
                    {webhook.active ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => handleEdit(webhook)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Edit"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {/* Secret */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded text-gray-600 dark:text-gray-400 truncate">
                  {showSecrets[webhook.id] ? webhook.secret : "•".repeat(32)}
                </code>
                <button
                  onClick={() => toggleSecret(webhook.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  {showSecrets[webhook.id] ? (
                    <EyeOff size={14} />
                  ) : (
                    <Eye size={14} />
                  )}
                </button>
                <button
                  onClick={() => copySecret(webhook.secret, webhook.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  {copiedId === webhook.id ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowForm(false)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Webhook" : "Create Webhook"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="My Webhook"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  URL
                </label>
                <input
                  type="url"
                  value={formData.url || ""}
                  onChange={e =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://api.example.com/webhook"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Secret Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.secret || ""}
                    onChange={e =>
                      setFormData({ ...formData, secret: e.target.value })
                    }
                    placeholder="Auto-generated if empty"
                    className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                  />
                  <button
                    onClick={regenerateSecret}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Events
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_EVENTS.map(event => (
                    <label
                      key={event.id}
                      className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.events?.includes(event.id) ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.events?.includes(event.id) || false}
                        onChange={() => toggleEvent(event.id)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {event.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {event.description}
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
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
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
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {editingId ? "Update Webhook" : "Create Webhook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
