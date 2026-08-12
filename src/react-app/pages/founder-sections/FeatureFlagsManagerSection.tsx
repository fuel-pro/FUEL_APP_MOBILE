/**
 * FeatureFlagsManagerSection — enhanced cloud-backed Feature Flags panel for
 * the Founder Console.
 *
 * Replaces the inline localStorage-only Flags view with a cloud-backed,
 * real-time synced panel that adds: add/edit/delete custom flag, description +
 * category + environment editing, bulk enable/disable, search, and category
 * filtering.
 */

import { useMemo, useState } from "react";
import {
  ToggleRight,
  Plus,
  X,
  Trash2,
  Search,
  CheckCircle2,
  Zap,
  Edit3,
} from "lucide-react";
import type {
  ConsoleFeatureFlag,
  ConsoleSettings,
  AuditSeverity,
} from "@/react-app/hooks/useFounderConsoleStore";

interface Props {
  flags: ConsoleFeatureFlag[];
  settings: ConsoleSettings;
  onUpsert: (f: ConsoleFeatureFlag) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkSet: (enabled: boolean) => void;
  logAudit: (
    event: string,
    detail: string,
    severity?: AuditSeverity,
    user?: string,
  ) => void;
}

const ENV_LABELS: Record<string, string> = {
  all: "All Envs",
  dev: "Dev",
  staging: "Staging",
  production: "Production",
};

function genId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || `flag_${Date.now().toString(36)}`
  );
}

export default function FeatureFlagsManagerSection({
  flags,
  settings,
  onUpsert,
  onToggle,
  onDelete,
  onBulkSet,
  logAudit,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterEnv, setFilterEnv] = useState("all");

  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftCategory, setDraftCategory] = useState(
    settings.flagCategories[0] || "Core",
  );
  const [draftEnv, setDraftEnv] =
    useState<ConsoleFeatureFlag["environment"]>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return flags.filter((f) => {
      const matchesQ =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q);
      const matchesCat =
        filterCategory === "all" || (f.category || "Core") === filterCategory;
      const matchesEnv =
        filterEnv === "all" || (f.environment || "all") === filterEnv;
      return matchesQ && matchesCat && matchesEnv;
    });
  }, [flags, search, filterCategory, filterEnv]);

  const enabledCount = flags.filter((f) => f.enabled).length;

  const openAdd = () => {
    setEditingId(null);
    setDraftName("");
    setDraftDesc("");
    setDraftCategory(settings.flagCategories[0] || "Core");
    setDraftEnv("all");
    setShowAdd(true);
  };

  const openEdit = (f: ConsoleFeatureFlag) => {
    setEditingId(f.id);
    setDraftName(f.name);
    setDraftDesc(f.description);
    setDraftCategory(f.category || "Core");
    setDraftEnv(f.environment || "all");
    setShowAdd(true);
  };

  const saveDraft = () => {
    if (!draftName.trim()) return;
    const flag: ConsoleFeatureFlag = {
      id: editingId || genId(draftName),
      name: draftName.trim(),
      description: draftDesc.trim() || "—",
      enabled: editingId
        ? (flags.find((f) => f.id === editingId)?.enabled ?? true)
        : true,
      category: draftCategory,
      environment: draftEnv,
    };
    onUpsert(flag);
    logAudit(
      editingId ? "Flag Updated" : "Flag Created",
      `"${flag.name}" (${draftCategory})`,
      "success",
    );
    setShowAdd(false);
    setEditingId(null);
  };

  const handleToggle = (f: ConsoleFeatureFlag) => {
    onToggle(f.id);
    logAudit(
      "Feature Flag Toggled",
      `"${f.name}" ${f.enabled ? "disabled" : "enabled"}`,
      f.enabled ? "warning" : "success",
    );
  };

  const handleDelete = (f: ConsoleFeatureFlag) => {
    if (!confirm(`Delete flag "${f.name}"?`)) return;
    onDelete(f.id);
    logAudit("Flag Deleted", `"${f.name}" removed`, "warning");
  };

  const handleBulk = (enabled: boolean) => {
    onBulkSet(enabled);
    logAudit(
      "Flags Bulk Updated",
      `${enabled ? "Enabled" : "Disabled"} all ${flags.length} flags`,
      "success",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <ToggleRight size={18} className="text-amber-400" /> Feature Flags
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Real-time synced
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Toggle features on/off — changes propagate to all devices instantly
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleBulk(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-300 text-xs rounded-lg transition-colors border border-green-500/20"
          >
            <CheckCircle2 size={13} /> Enable All
          </button>
          <button
            onClick={() => handleBulk(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] text-gray-300 text-xs rounded-lg transition-colors border border-white/[0.08]"
          >
            <X size={13} /> Disable All
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs rounded-lg transition-colors border border-amber-500/20"
          >
            {showAdd ? <X size={14} /> : <Plus size={14} />}{" "}
            {showAdd ? "Cancel" : "Add Flag"}
          </button>
        </div>
      </div>

      {/* Stats + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">
          {enabledCount} of {flags.length} enabled
        </span>
        <div className="flex-1 min-w-[160px] relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flags..."
            className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/30"
        >
          <option value="all">All categories</option>
          {settings.flagCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterEnv}
          onChange={(e) => setFilterEnv(e.target.value)}
          className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/30"
        >
          <option value="all">All envs</option>
          <option value="dev">Dev</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
      </div>

      {showAdd && (
        <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-3">
            {editingId ? "Edit Flag" : "New Feature Flag"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">
                Name
              </label>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. New Reporting Module"
                disabled={!!editingId}
                className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">
                Description
              </label>
              <input
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="What does this flag control?"
                className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">
                Category
              </label>
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/30"
              >
                {settings.flagCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">
                Environment
              </label>
              <select
                value={draftEnv}
                onChange={(e) =>
                  setDraftEnv(
                    e.target.value as ConsoleFeatureFlag["environment"],
                  )
                }
                className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/30"
              >
                <option value="all">All Environments</option>
                <option value="dev">Dev only</option>
                <option value="staging">Staging only</option>
                <option value="production">Production only</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={saveDraft}
              className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs rounded-lg transition-colors border border-amber-500/20"
            >
              {editingId ? "Update Flag" : "Create Flag"}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setEditingId(null);
              }}
              className="px-4 py-2 text-gray-400 text-xs rounded-lg hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((f) => (
          <div
            key={f.id}
            className="bg-[#161618] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${f.enabled ? "bg-green-400" : "bg-gray-600"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-white">{f.name}</p>
                  {f.category && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                      {f.category}
                    </span>
                  )}
                  {f.environment && f.environment !== "all" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
                      {ENV_LABELS[f.environment] || f.environment}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 truncate">
                  {f.description}
                </p>
                {f.updatedAt && (
                  <p className="text-[9px] text-gray-600 mt-0.5">
                    Updated {new Date(f.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => openEdit(f)}
                title="Edit flag"
                className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Edit3 size={14} />
              </button>
              <button
                onClick={() => handleDelete(f)}
                title="Delete flag"
                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => handleToggle(f)}
                title={f.enabled ? "Disable" : "Enable"}
                className={`relative w-11 h-6 rounded-full transition-colors ${f.enabled ? "bg-green-500" : "bg-gray-600"}`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${f.enabled ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-12 text-center">
            <Zap size={24} className="mx-auto mb-2 text-gray-700" />
            <p className="text-sm text-gray-600">
              {flags.length === 0
                ? "No feature flags configured"
                : "No flags match your filter"}
            </p>
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-600">
        {flags.length} total · {enabledCount} enabled · {filtered.length} shown
        · cloud-synced in real time
      </p>
    </div>
  );
}
