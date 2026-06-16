import React, { useState, useEffect } from "react";
import {
  Settings,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  RotateCcw,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Code,
  ToggleRight,
  ToggleLeft,
  History,
  ChevronDown,
  ChevronUp,
  Server,
  Zap,
  Globe2,
} from "lucide-react";
import { useSiteConfig } from "@/react-app/hooks/useSiteConfig";

interface SiteConfigSectionProps {
  onToast?: (msg: string, type: "success" | "error") => void;
}

const CATEGORIES = [
  { id: "general", label: "General", icon: Settings },
  { id: "features", label: "Features", icon: Zap },
  { id: "integrations", label: "Integrations", icon: Globe2 },
  { id: "appearance", label: "Appearance", icon: Code },
  { id: "pricing", label: "Pricing", icon: Settings },
  { id: "security", label: "Security", icon: Lock },
];

export default function SiteConfigSection({ onToast }: SiteConfigSectionProps) {
  const {
    configs,
    versions,
    deployments,
    deploymentsConfigured,
    deploymentsError,
    production,
    refetchConfigs,
    refetchVersions,
    refetchDeployments,
    upsertConfig,
    deleteConfig,
    publishSnapshot,
    restoreVersion,
    rollbackDeployment,
  } = useSiteConfig();

  const [activeTab, setActiveTab] = useState<"configs" | "versions" | "deployments">("configs");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newConfig, setNewConfig] = useState({ key: "", value: "", type: "string" as const, category: "general", description: "", isPublic: false });
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  const groupedConfigs = configs.reduce((acc, cfg: any) => {
    const cat = cfg.configCategory || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cfg);
    return acc;
  }, {} as Record<string, any[]>);

  const handleUpsert = async () => {
    if (!newConfig.key.trim()) {
      onToast?.("Config key is required", "error");
      return;
    }
    setLoading(true);
    try {
      await upsertConfig(newConfig);
      onToast?.(`Config "${newConfig.key}" saved successfully`, "success");
      setNewConfig({ key: "", value: "", type: "string", category: "general", description: "", isPublic: false });
      setShowNewForm(false);
      refetchConfigs();
    } catch (e) {
      onToast?.("Failed to save config", "error");
    }
    setLoading(false);
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete config "${key}"?`)) return;
    try {
      await deleteConfig(key);
      onToast?.(`Config "${key}" deleted`, "success");
      refetchConfigs();
    } catch (e) {
      onToast?.("Failed to delete config", "error");
    }
  };

  const handlePublishSnapshot = async () => {
    const name = prompt("Enter a name for this snapshot:");
    if (!name) return;
    const desc = prompt("Description (optional):") || undefined;
    try {
      await publishSnapshot(name, desc);
      onToast?.("Snapshot published successfully", "success");
      refetchVersions();
    } catch (e) {
      onToast?.("Failed to publish snapshot", "error");
    }
  };

  const handleRestore = async (version: string) => {
    if (!confirm(`Restore to version ${version}? This will overwrite current configs.`)) return;
    try {
      const result = await restoreVersion(version);
      onToast?.(`Restored ${result.restoredConfigs || 0} configs from ${version}`, "success");
      refetchConfigs();
    } catch (e) {
      onToast?.("Failed to restore version", "error");
    }
  };

  const handleRollback = async (deploymentId: string) => {
    if (!confirm("Rollback to this deployment? The live site will switch to this version.")) return;
    setRollbackLoading(deploymentId);
    try {
      const result = await rollbackDeployment(deploymentId);
      if (result.success) {
        onToast?.(`Rollback initiated: ${result.message}`, "success");
      } else {
        onToast?.(`Rollback failed: ${result.error}`, "error");
      }
    } catch (e) {
      onToast?.("Failed to initiate rollback", "error");
    }
    setRollbackLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Site Configuration</h2>
          <p className="text-gray-400 text-sm">Manage dynamic settings and code deployments</p>
        </div>
        <button
          onClick={() => { refetchConfigs(); refetchVersions(); refetchDeployments(); }}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { id: "configs", label: "Configs", count: configs.length },
          { id: "versions", label: "Version History", count: versions.length },
          { id: "deployments", label: "Deployments", count: deployments.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-amber-500/20 text-amber-400"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label} {tab.count > 0 && <span className="ml-1 opacity-60">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Configs Tab */}
      {activeTab === "configs" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              {configs.length} configuration{configs.length !== 1 ? "s" : ""} loaded from database
            </p>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-medium"
            >
              {showNewForm ? <X size={14} /> : <Plus size={14} />}
              {showNewForm ? "Cancel" : "Add Config"}
            </button>
          </div>

          {showNewForm && (
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Key</label>
                  <input
                    type="text"
                    value={newConfig.key}
                    onChange={e => setNewConfig({ ...newConfig, key: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                    placeholder="e.g., fuel_price_per_liter"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Type</label>
                  <select
                    value={newConfig.type}
                    onChange={e => setNewConfig({ ...newConfig, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Value</label>
                <textarea
                  value={newConfig.value}
                  onChange={e => setNewConfig({ ...newConfig, value: e.target.value })}
                  placeholder={newConfig.type === "boolean" ? "true or false" : newConfig.type === "number" ? "145.50" : newConfig.type === "json" ? '{"key": "value"}' : "Enter value"}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Category</label>
                  <select
                    value={newConfig.category}
                    onChange={e => setNewConfig({ ...newConfig, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={newConfig.isPublic}
                    onChange={e => setNewConfig({ ...newConfig, isPublic: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="isPublic" className="text-sm text-gray-300">Public (no auth required)</label>
                </div>
              </div>
              <button
                onClick={handleUpsert}
                disabled={loading}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-black rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                Save Configuration
              </button>
            </div>
          )}

          {/* Grouped configs by category */}
          {CATEGORIES.map(cat => {
            const catConfigs = groupedConfigs[cat.id] || [];
            if (catConfigs.length === 0) return null;
            const Icon = cat.icon;
            return (
              <div key={cat.id} className="bg-black/20 border border-white/5 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-white/5">
                  <Icon size={14} className="text-amber-400" />
                  <span className="text-sm font-medium text-white capitalize">{cat.label}</span>
                  <span className="text-xs text-gray-500">({catConfigs.length})</span>
                </div>
                <div className="divide-y divide-white/5">
                  {catConfigs.map((cfg: any) => (
                    <div key={cfg.configKey} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-amber-300 font-mono">{cfg.configKey}</code>
                          {cfg.isPublic && <Globe size={10} className="text-green-400" />}
                        </div>
                        {cfg.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{cfg.description}</p>
                        )}
                        <div className="mt-1">
                          <code className="text-xs text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded">
                            {String(cfg.configValue).substring(0, 60)}{String(cfg.configValue).length > 60 ? "..." : ""}
                          </code>
                          <span className="text-xs text-gray-600 ml-2">({cfg.configType})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(cfg.configKey)}
                          className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {configs.length === 0 && !showNewForm && (
            <div className="text-center py-12 text-gray-500">
              <Settings size={32} className="mx-auto mb-3 opacity-50" />
              <p>No configs yet. Add your first configuration.</p>
            </div>
          )}
        </div>
      )}

      {/* Version History Tab */}
      {activeTab === "versions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">Snapshot your configs before making changes</p>
            <button
              onClick={handlePublishSnapshot}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-medium"
            >
              <Upload size={14} />
              Publish Snapshot
            </button>
          </div>

          {versions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History size={32} className="mx-auto mb-3 opacity-50" />
              <p>No version snapshots yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v: any) => (
                <div key={v.version} className={`bg-black/20 border rounded-xl p-4 ${
                  v.status === "published" ? "border-green-500/30" : "border-white/5"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-amber-300 font-mono">{v.version}</code>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          v.status === "published" ? "bg-green-500/20 text-green-400" :
                          v.status === "archived" ? "bg-gray-500/20 text-gray-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {v.status}
                        </span>
                      </div>
                      <p className="text-sm text-white mt-1">{v.name}</p>
                      {v.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{v.description}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-1">
                        {v.publishedAt ? `Published: ${new Date(v.publishedAt).toLocaleString()}` : `Created: ${new Date(v.createdAt).toLocaleString()}`}
                      </p>
                    </div>
                    {v.status !== "published" && (
                      <button
                        onClick={() => handleRestore(v.version)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deployments Tab */}
      {activeTab === "deployments" && (
        <div className="space-y-4">
          {!deploymentsConfigured ? (
            <div className="text-center py-12 text-gray-500">
              <Server size={32} className="mx-auto mb-3 opacity-50" />
              <p>Vercel API not configured</p>
              <p className="text-xs mt-1">Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID in environment</p>
              {deploymentsError && (
                <p className="text-xs text-red-400 mt-2">{deploymentsError}</p>
              )}
            </div>
          ) : deployments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Server size={32} className="mx-auto mb-3 opacity-50" />
              <p>No deployments found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deployments.map((d: any) => (
                <div key={d.id} className={`bg-black/20 border rounded-xl p-4 ${
                  d.status === "READY" ? "border-green-500/30" : "border-white/5"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-amber-300 font-mono">{d.id.substring(0, 8)}...</code>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          d.status === "READY" ? "bg-green-500/20 text-green-400" :
                          d.status === "BUILDING" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {d.status}
                        </span>
                        {d.target && <span className="text-xs text-gray-500">→ {d.target}</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {d.createdAt ? new Date(d.createdAt).toLocaleString() : "Unknown date"}
                      </p>
                      {d.url && (
                        <a href={`https://${d.url}`} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:underline mt-0.5 block">
                          {d.url}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleRollback(d.id)}
                      disabled={rollbackLoading === d.id || d.status !== "READY"}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm"
                    >
                      {rollbackLoading === d.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      Rollback
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
