import { useState } from "react";
import { useStations } from "@/react-app/context/StationContext";
import { useNavigate } from "react-router";
import {
  Plus,
  X,
  ChevronRight,
  Lock,
  Users,
  Globe,
  Trash2,
  Edit3,
  Check,
  ArrowLeft,
  Fuel,
  MapPin,
  Phone,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Layers,
  Share2,
  Copy,
  AlertTriangle,
  RefreshCw,
  LogIn,
} from "lucide-react";

interface StationManagerProps {
  onClose?: () => void;
}

export default function StationManager({ onClose }: StationManagerProps) {
  const {
    stations,
    currentStation,
    createStation,
    updateStation,
    deleteStation,
    switchStation,
    shareStation,
    revokeAccess,
    changeStationPassword,
    combineStations,
    addUpdateRecord,
    isAdmin,
  } = useStations();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"list" | "create" | "share" | "access">(
    "list"
  );
  const [newStation, setNewStation] = useState({
    name: "",
    location: "",
    phone: "",
    email: "",
    kraPin: "",
    taxRate: 16,
  });
  const [shareForm, setShareForm] = useState({
    stationId: "",
    email: "",
    password: "",
  });
  const [accessForm, setAccessForm] = useState({ stationId: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [editingStation, setEditingStation] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }
  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }

  function handleCreate() {
    if (!newStation.name.trim()) {
      showError("Station name is required");
      return;
    }
    const station = createStation(newStation);
    showSuccess(`Station "${station.name}" created successfully`);
    setNewStation({
      name: "",
      location: "",
      phone: "",
      email: "",
      kraPin: "",
      taxRate: 16,
    });
    setMode("list");
    // Auto-switch to new station
    setTimeout(() => {
      if (onClose) onClose();
    }, 500);
  }

  function handleShare() {
    if (!shareForm.stationId || !shareForm.email || !shareForm.password) {
      showError("All fields are required");
      return;
    }
    shareStation(shareForm.stationId, shareForm.email, shareForm.password);
    showSuccess(`Access shared with ${shareForm.email}`);
    setShareForm({ stationId: "", email: "", password: "" });
    setMode("list");
  }

  function handleAccessStation() {
    if (!accessForm.stationId || !accessForm.password) {
      showError("Station and password are required");
      return;
    }
    // In a real system, we'd verify the password. For local mode, we accept it.
    switchStation(accessForm.stationId);
    showSuccess("Station accessed successfully");
    setAccessForm({ stationId: "", password: "" });
    if (onClose) onClose();
  }

  function handleDelete(id: string, name: string) {
    if (
      confirm(`Delete station "${name}" permanently? All data will be lost.`)
    ) {
      deleteStation(id);
      addUpdateRecord({
        type: "settings",
        description: `Deleted station: ${name}`,
        changes: { stationId: id },
      });
      showSuccess(`Station "${name}" deleted`);
    }
  }

  const combined = combineStations();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onClose && (
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold font-serif flex items-center gap-2">
                <Layers size={20} className="text-amber-400" />
                Station Manager
              </h1>
              <p className="text-xs text-gray-400">
                {stations.length} station(s) | Manage access & data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stations.length > 0 && (
              <button
                onClick={() => navigate("/?combined=true")}
                className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg text-sm flex items-center gap-2 hover:bg-amber-500/30 transition-colors"
              >
                <Layers size={14} />
                Combined View
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-400" />
            <span className="text-red-200 text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
            <Check size={18} className="text-green-400" />
            <span className="text-green-200 text-sm">{success}</span>
          </div>
        )}

        {/* Mode Selection */}
        {mode === "list" && (
          <>
            {/* Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setMode("create")}
                className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-xl p-4 text-center hover:scale-[1.02] transition-all group"
              >
                <Plus
                  size={24}
                  className="mx-auto mb-2 text-emerald-400 group-hover:scale-110 transition-transform"
                />
                <p className="font-semibold text-sm">Create Station</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add new fuel station
                </p>
              </button>
              <button
                onClick={() => setMode("access")}
                className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-4 text-center hover:scale-[1.02] transition-all group"
              >
                <LogIn
                  size={24}
                  className="mx-auto mb-2 text-blue-400 group-hover:scale-110 transition-transform"
                />
                <p className="font-semibold text-sm">Access Station</p>
                <p className="text-xs text-gray-400 mt-1">
                  Login to shared station
                </p>
              </button>
              <button
                onClick={() => {
                  if (stations.length > 0) {
                    setShareForm(p => ({ ...p, stationId: stations[0].id }));
                    setMode("share");
                  }
                }}
                disabled={stations.length === 0}
                className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-4 text-center hover:scale-[1.02] transition-all group disabled:opacity-40"
              >
                <Share2
                  size={24}
                  className="mx-auto mb-2 text-purple-400 group-hover:scale-110 transition-transform"
                />
                <p className="font-semibold text-sm">Share Access</p>
                <p className="text-xs text-gray-400 mt-1">
                  Grant access to others
                </p>
              </button>
              <button
                onClick={() => navigate("/founder")}
                className="bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30 rounded-xl p-4 text-center hover:scale-[1.02] transition-all group"
              >
                <Lock
                  size={24}
                  className="mx-auto mb-2 text-amber-400 group-hover:scale-110 transition-transform"
                />
                <p className="font-semibold text-sm">Founder Access</p>
                <p className="text-xs text-gray-400 mt-1">System management</p>
              </button>
            </div>

            {/* Station List */}
            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold">Your Stations</h3>
                {combined && (
                  <span className="text-xs text-amber-400">
                    Combined Revenue: Ksh{" "}
                    {combined.data.totalRevenue?.toLocaleString() || 0}
                  </span>
                )}
              </div>
              <div className="divide-y divide-white/5">
                {stations.map(station => (
                  <div
                    key={station.id}
                    className={`p-5 hover:bg-white/5 transition-all cursor-pointer ${currentStation?.id === station.id ? "bg-amber-500/10 border-l-2 border-amber-500" : ""}`}
                    onClick={() => {
                      switchStation(station.id);
                      if (onClose) onClose();
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0">
                        {station.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold truncate">
                            {station.name}
                          </h4>
                          {currentStation?.id === station.id && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          {station.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} />
                              {station.location}
                            </span>
                          )}
                          {station.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={10} />
                              {station.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users size={10} />
                            {station.sharedUsers.length} shared
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingStation(station.id);
                            setEditData({
                              name: station.name,
                              location: station.location,
                              phone: station.phone,
                              email: station.email,
                            });
                          }}
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDelete(station.id, station.name);
                          }}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={16} className="text-gray-500" />
                      </div>
                    </div>

                    {/* Edit inline */}
                    {editingStation === station.id && (
                      <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            value={editData.name || ""}
                            onChange={e =>
                              setEditData(p => ({ ...p, name: e.target.value }))
                            }
                            placeholder="Station Name"
                            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <input
                            value={editData.location || ""}
                            onChange={e =>
                              setEditData(p => ({
                                ...p,
                                location: e.target.value,
                              }))
                            }
                            placeholder="Location"
                            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <input
                            value={editData.phone || ""}
                            onChange={e =>
                              setEditData(p => ({
                                ...p,
                                phone: e.target.value,
                              }))
                            }
                            placeholder="Phone"
                            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <input
                            value={editData.email || ""}
                            onChange={e =>
                              setEditData(p => ({
                                ...p,
                                email: e.target.value,
                              }))
                            }
                            placeholder="Email"
                            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="password"
                            placeholder="New password (optional)"
                            onChange={e =>
                              setEditData(p => ({
                                ...p,
                                newPassword: e.target.value,
                              }))
                            }
                            className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <button
                            onClick={() => {
                              updateStation(station.id, editData);
                              if (editData.newPassword) {
                                changeStationPassword(
                                  station.id,
                                  editData.newPassword
                                );
                              }
                              setEditingStation(null);
                              showSuccess("Station updated");
                            }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingStation(null)}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 text-sm rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {stations.length === 0 && (
                  <div className="p-12 text-center">
                    <Fuel size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400 font-medium">No stations yet</p>
                    <p className="text-gray-500 text-sm mt-1">
                      Create your first fuel station to get started
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Create Mode */}
        {mode === "create" && (
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus size={18} className="text-emerald-400" />
              Create New Station
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Station Name *
                </label>
                <input
                  value={newStation.name}
                  onChange={e =>
                    setNewStation(p => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g., Sunrise Petrol Station"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Location
                </label>
                <input
                  value={newStation.location}
                  onChange={e =>
                    setNewStation(p => ({ ...p, location: e.target.value }))
                  }
                  placeholder="e.g., Mombasa Road, Nairobi"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Phone
                </label>
                <input
                  value={newStation.phone}
                  onChange={e =>
                    setNewStation(p => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="e.g., 0712 345 678"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Email
                </label>
                <input
                  value={newStation.email}
                  onChange={e =>
                    setNewStation(p => ({ ...p, email: e.target.value }))
                  }
                  placeholder="e.g., info@station.co.ke"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  KRA PIN
                </label>
                <input
                  value={newStation.kraPin}
                  onChange={e =>
                    setNewStation(p => ({ ...p, kraPin: e.target.value }))
                  }
                  placeholder="e.g., A001234567B"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={newStation.taxRate}
                  onChange={e =>
                    setNewStation(p => ({
                      ...p,
                      taxRate: parseInt(e.target.value) || 16,
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCreate}
                disabled={!newStation.name.trim()}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center gap-2"
              >
                <Plus size={16} />
                Create Station
              </button>
              <button
                onClick={() => setMode("list")}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Access Mode */}
        {mode === "access" && (
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <LogIn size={18} className="text-blue-400" />
              Access Shared Station
            </h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Select Station
                </label>
                <select
                  value={accessForm.stationId}
                  onChange={e =>
                    setAccessForm(p => ({ ...p, stationId: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="" className="bg-gray-800">
                    Choose a station...
                  </option>
                  {stations.map(s => (
                    <option key={s.id} value={s.id} className="bg-gray-800">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Station Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={accessForm.password}
                    onChange={e =>
                      setAccessForm(p => ({ ...p, password: e.target.value }))
                    }
                    placeholder="Enter station password"
                    className="w-full px-4 py-2.5 pr-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAccessStation}
                  className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                  <LogIn size={16} />
                  Access Station
                </button>
                <button
                  onClick={() => setMode("list")}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Mode */}
        {mode === "share" && (
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Share2 size={18} className="text-purple-400" />
              Share Station Access
            </h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Select Station
                </label>
                <select
                  value={shareForm.stationId}
                  onChange={e =>
                    setShareForm(p => ({ ...p, stationId: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="" className="bg-gray-800">
                    Choose a station...
                  </option>
                  {stations.map(s => (
                    <option key={s.id} value={s.id} className="bg-gray-800">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  User Email
                </label>
                <input
                  type="email"
                  value={shareForm.email}
                  onChange={e =>
                    setShareForm(p => ({ ...p, email: e.target.value }))
                  }
                  placeholder="e.g., user@company.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Set Password for User
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={shareForm.password}
                    onChange={e =>
                      setShareForm(p => ({ ...p, password: e.target.value }))
                    }
                    placeholder="Set access password"
                    className="w-full px-4 py-2.5 pr-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleShare}
                  className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                  <Share2 size={16} />
                  Grant Access
                </button>
                <button
                  onClick={() => setMode("list")}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
