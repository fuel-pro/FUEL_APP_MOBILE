import { useState } from "react";
import {
  Building2,
  ChevronDown,
  Plus,
  MapPin,
  Edit2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { useFuel, Station } from "@/react-app/context/FuelContext";

interface StationSelectorProps {
  compact?: boolean;
}

export default function StationSelector({
  compact = false,
}: StationSelectorProps) {
  const { state, dispatch } = useFuel();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [newStation, setNewStation] = useState({ name: "", location: "" });
  const [editStation, setEditStation] = useState({ name: "", location: "" });

  const stations = state.stations || [];
  const currentStation = stations.find(s => s.id === state.currentStationId);

  const handleAddStation = () => {
    if (!newStation.name.trim()) return;

    const station: Station = {
      id: `station_${Date.now()}`,
      name: newStation.name.trim(),
      location: newStation.location.trim(),
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: "ADD_STATION", payload: station });
    setNewStation({ name: "", location: "" });
    setIsAdding(false);
  };

  const handleSelectStation = (stationId: string) => {
    dispatch({ type: "SET_CURRENT_STATION", payload: stationId });
    setIsOpen(false);
  };

  const handleEditStation = (station: Station) => {
    setIsEditing(station.id);
    setEditStation({ name: station.name, location: station.location || "" });
  };

  const handleSaveEdit = (stationId: string) => {
    if (!editStation.name.trim()) return;

    dispatch({
      type: "UPDATE_STATION",
      payload: {
        id: stationId,
        name: editStation.name.trim(),
        location: editStation.location.trim(),
      },
    });
    setIsEditing(null);
  };

  const handleDeleteStation = (stationId: string) => {
    if (stations.length <= 1) {
      alert("You must have at least one station.");
      return;
    }

    if (
      confirm(
        "Are you sure you want to delete this station? All data for this station will be lost."
      )
    ) {
      dispatch({ type: "DELETE_STATION", payload: stationId });
    }
  };

  return (
    <div className="relative inline-block">
      {/* Station Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-400/50 rounded-lg transition-all duration-200 group ${
          compact ? "px-2 py-1.5" : "px-3 py-2 rounded-xl gap-2"
        }`}
      >
        <Building2
          size={compact ? 14 : 16}
          className="text-amber-600 dark:text-amber-400 flex-shrink-0"
        />
        {!compact && (
          <div className="text-left min-w-0">
            <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold truncate max-w-[140px]">
              {currentStation?.name || "Select Station"}
            </div>
            {currentStation?.location && (
              <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70 flex items-center gap-1 truncate max-w-[140px]">
                <MapPin size={8} />
                {currentStation.location}
              </div>
            )}
          </div>
        )}
        {compact && (
          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold truncate max-w-[60px]">
            {currentStation?.name?.split(" ")[0] || "Station"}
          </span>
        )}
        <ChevronDown
          size={compact ? 10 : 14}
          className={`text-amber-600 dark:text-amber-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setIsAdding(false);
              setIsEditing(null);
            }}
          />

          {/* Dropdown Menu */}
          <div className="absolute top-full mt-2 left-0 z-50 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-amber-200 dark:border-amber-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Your Stations</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {stations.length}{" "}
                  {stations.length === 1 ? "station" : "stations"}
                </span>
              </div>
            </div>

            {/* Stations List */}
            <div className="max-h-64 overflow-y-auto">
              {stations.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No stations yet</p>
                  <p className="text-xs">Add your first station below</p>
                </div>
              ) : (
                stations.map(station => (
                  <div key={station.id}>
                    {isEditing === station.id ? (
                      /* Edit Mode */
                      <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20">
                        <input
                          type="text"
                          value={editStation.name}
                          onChange={e =>
                            setEditStation({
                              ...editStation,
                              name: e.target.value,
                            })
                          }
                          placeholder="Station name"
                          className="w-full px-2 py-1 text-sm border border-amber-300 rounded mb-1 dark:bg-gray-700 dark:border-gray-600"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editStation.location}
                          onChange={e =>
                            setEditStation({
                              ...editStation,
                              location: e.target.value,
                            })
                          }
                          placeholder="Location (optional)"
                          className="w-full px-2 py-1 text-sm border border-amber-300 rounded mb-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSaveEdit(station.id)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                          >
                            <Check size={12} /> Save
                          </button>
                          <button
                            onClick={() => setIsEditing(null)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-gray-400 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          station.id === state.currentStationId
                            ? "bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent"
                        }`}
                      >
                        <div
                          className="flex-1 min-w-0"
                          onClick={() => handleSelectStation(station.id)}
                        >
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {station.name}
                          </div>
                          {station.location && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <MapPin size={10} />
                              {station.location}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleEditStation(station);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Edit station"
                          >
                            <Edit2 size={12} />
                          </button>
                          {stations.length > 1 && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteStation(station.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Delete station"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add New Station */}
            <div className="border-t border-gray-200 dark:border-gray-700">
              {isAdding ? (
                <div className="px-3 py-3 bg-gray-50 dark:bg-gray-750">
                  <input
                    type="text"
                    value={newStation.name}
                    onChange={e =>
                      setNewStation({ ...newStation, name: e.target.value })
                    }
                    placeholder="Station name (e.g., Main Branch)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newStation.location}
                    onChange={e =>
                      setNewStation({ ...newStation, location: e.target.value })
                    }
                    placeholder="Location (e.g., Nairobi CBD)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-3 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddStation}
                      disabled={!newStation.name.trim()}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Plus size={14} /> Add Station
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false);
                        setNewStation({ name: "", location: "" });
                      }}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <Plus size={16} />
                  <span className="font-medium">Add New Station</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
