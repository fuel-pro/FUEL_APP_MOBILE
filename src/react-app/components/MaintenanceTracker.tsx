import { useState, useEffect } from "react";
import {
  Wrench,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Fuel,
  Gauge,
  Droplets,
  Zap,
  Cog,
} from "lucide-react";

interface MaintenanceRecord {
  id: string;
  equipmentName: string;
  equipmentType:
    | "pump"
    | "tank"
    | "dispenser"
    | "generator"
    | "compressor"
    | "other";
  stationId: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "scheduled" | "in_progress" | "completed" | "overdue";
  assignedTo: string;
  cost: number;
  scheduledDate: string;
  completedDate?: string;
  nextDueDate: string;
  notes: string;
  createdAt: string;
}

const STORAGE_KEY = "fuelpro_maintenance_v2";

const EQUIPMENT_TYPES = [
  { value: "pump", label: "Fuel Pump", icon: Fuel },
  { value: "tank", label: "Storage Tank", icon: Droplets },
  { value: "dispenser", label: "Dispenser", icon: Gauge },
  { value: "generator", label: "Generator", icon: Zap },
  { value: "compressor", label: "Compressor", icon: Cog },
  { value: "other", label: "Other", icon: Wrench },
] as const;

function loadRecords(): MaintenanceRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return [];
}

export default function MaintenanceTracker() {
  const [records, setRecords] = useState<MaintenanceRecord[]>(loadRecords);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "warning";
  } | null>(null);
  const [formData, setFormData] = useState<Partial<MaintenanceRecord>>({
    equipmentName: "",
    equipmentType: "pump",
    description: "",
    priority: "medium",
    status: "scheduled",
    assignedTo: "",
    cost: 0,
    scheduledDate: "",
    nextDueDate: "",
    notes: "",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const showNotification = (
    message: string,
    type: "success" | "warning" = "success"
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const filtered = records.filter(r => {
    const matchesSearch =
      r.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.assignedTo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || r.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleSave = () => {
    if (!formData.equipmentName || !formData.description) {
      showNotification(
        "Equipment name and description are required",
        "warning"
      );
      return;
    }
    if (editingId) {
      setRecords(prev =>
        prev.map(r =>
          r.id === editingId ? ({ ...r, ...formData } as MaintenanceRecord) : r
        )
      );
      showNotification("Maintenance record updated");
    } else {
      const newRecord: MaintenanceRecord = {
        ...(formData as MaintenanceRecord),
        id: `mt_${Date.now()}`,
        stationId: "default",
        createdAt: new Date().toISOString(),
      };
      setRecords(prev => [newRecord, ...prev]);
      showNotification("Maintenance record added");
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this maintenance record?")) {
      setRecords(prev => prev.filter(r => r.id !== id));
      showNotification("Record deleted");
    }
  };

  const updateStatus = (id: string, newStatus: MaintenanceRecord["status"]) => {
    setRecords(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              status: newStatus,
              completedDate:
                newStatus === "completed"
                  ? new Date().toISOString()
                  : r.completedDate,
            }
          : r
      )
    );
    showNotification(`Status updated to ${newStatus}`);
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    overdue: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  const priorityColors: Record<string, string> = {
    low: "text-gray-500",
    medium: "text-blue-500",
    high: "text-amber-500",
    critical: "text-red-500",
  };

  const priorityIcons: Record<string, string> = {
    low: "↓",
    medium: "→",
    high: "↑",
    critical: "!",
  };

  const stats = {
    total: records.length,
    scheduled: records.filter(r => r.status === "scheduled").length,
    inProgress: records.filter(r => r.status === "in_progress").length,
    completed: records.filter(r => r.status === "completed").length,
    overdue: records.filter(r => r.status === "overdue").length,
    critical: records.filter(
      r => r.priority === "critical" && r.status !== "completed"
    ).length,
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench size={22} className="text-amber-500" /> Maintenance Tracker
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Equipment maintenance & servicing schedules
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              equipmentName: "",
              equipmentType: "pump",
              description: "",
              priority: "medium",
              status: "scheduled",
              assignedTo: "",
              cost: 0,
              scheduledDate: "",
              nextDueDate: "",
              notes: "",
            });
          }}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          {
            label: "Total",
            value: stats.total,
            color: "text-gray-600 dark:text-gray-400",
            bg: "bg-gray-100 dark:bg-gray-700/50",
          },
          {
            label: "Scheduled",
            value: stats.scheduled,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-500/10",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-500/10",
          },
          {
            label: "Completed",
            value: stats.completed,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-500/10",
          },
          {
            label: "Overdue",
            value: stats.overdue,
            color: "text-red-600 dark:text-red-400",
            bg: "bg-red-50 dark:bg-red-500/10",
          },
          {
            label: "Critical",
            value: stats.critical,
            color: "text-red-600 dark:text-red-400",
            bg: "bg-red-50 dark:bg-red-500/10",
          },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search equipment or technician..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-gray-300 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-gray-300 focus:outline-none"
        >
          <option value="all">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Records */}
      <div className="space-y-3">
        {filtered.map(record => {
          const EquipIcon =
            EQUIPMENT_TYPES.find(e => e.value === record.equipmentType)?.icon ||
            Wrench;
          return (
            <div
              key={record.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${record.status === "overdue" ? "bg-red-500/10" : record.status === "completed" ? "bg-emerald-500/10" : "bg-amber-500/10"}`}
                    >
                      <EquipIcon
                        size={18}
                        className={
                          record.status === "overdue"
                            ? "text-red-500"
                            : record.status === "completed"
                              ? "text-emerald-500"
                              : "text-amber-500"
                        }
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {record.equipmentName}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {record.description.slice(0, 60)}
                        {record.description.length > 60 ? "..." : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[record.status]}`}
                    >
                      {record.status.replace("_", " ")}
                    </span>
                    <span
                      className={`text-xs font-bold ${priorityColors[record.priority]}`}
                    >
                      {priorityIcons[record.priority]} {record.priority}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <Clock size={12} /> {record.assignedTo}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <Calendar size={12} />{" "}
                    {new Date(record.scheduledDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    Next: {new Date(record.nextDueDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    KES {record.cost.toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === record.id ? null : record.id)
                    }
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg text-xs text-gray-600 dark:text-gray-300 transition-colors flex items-center gap-1"
                  >
                    {expandedId === record.id ? (
                      <>
                        <ChevronUp size={12} /> Less
                      </>
                    ) : (
                      <>
                        <ChevronDown size={12} /> Details
                      </>
                    )}
                  </button>
                  {record.status === "scheduled" && (
                    <button
                      onClick={() => updateStatus(record.id, "in_progress")}
                      className="px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-xs hover:bg-amber-500/20 transition-colors"
                    >
                      Start
                    </button>
                  )}
                  {record.status === "in_progress" && (
                    <button
                      onClick={() => updateStatus(record.id, "completed")}
                      className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs hover:bg-emerald-500/20 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(record.id);
                      setFormData(record);
                      setShowForm(true);
                    }}
                    className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg transition-colors"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {expandedId === record.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="text-gray-500">Full Description:</span>{" "}
                        {record.description}
                      </div>
                      <div>
                        <span className="text-gray-500">Cost:</span> KES{" "}
                        {record.cost.toLocaleString()}
                      </div>
                      {record.completedDate && (
                        <div>
                          <span className="text-gray-500">Completed:</span>{" "}
                          {new Date(record.completedDate).toLocaleDateString()}
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Next Service:</span>{" "}
                        {new Date(record.nextDueDate).toLocaleDateString()}
                      </div>
                      {record.notes && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Notes:</span>{" "}
                          {record.notes}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Wrench size={48} className="mx-auto mb-3 opacity-30" />
          <p>No maintenance records found</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingId ? "Edit" : "New"} Maintenance Task
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Equipment Name *
                    </label>
                    <input
                      value={formData.equipmentName}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          equipmentName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Type
                    </label>
                    <select
                      value={formData.equipmentType}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          equipmentType: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {EQUIPMENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {["low", "medium", "high", "critical"].map(p => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          status: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    >
                      {["scheduled", "in_progress", "completed", "overdue"].map(
                        s => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Cost (KES)
                    </label>
                    <input
                      type="number"
                      value={formData.cost}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          cost: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Assigned To
                    </label>
                    <input
                      value={formData.assignedTo}
                      onChange={e =>
                        setFormData({ ...formData, assignedTo: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          scheduledDate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.nextDueDate}
                    onChange={e =>
                      setFormData({ ...formData, nextDueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleSave}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
