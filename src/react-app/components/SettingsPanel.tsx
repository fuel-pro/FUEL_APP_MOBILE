/**
 * SettingsPanel.tsx
 * Business settings: station info, tax rates, integrations, user profile.
 */
import React, { useState } from "react";
import {
  Save,
  Loader2,
  CheckCircle,
  Fuel,
  Smartphone,
  User,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { supabase } from "@/supabase/client";
import UserProfileSettings from "./UserProfileSettings";

export default function SettingsPanel() {
  const { currentStation, updateStation } = useStations();
  const [activeTab, setActiveTab] = useState<"business" | "profile">(
    "business",
  );
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: currentStation?.name || "",
    location: currentStation?.location || "",
    phone: currentStation?.phone || "",
    email: currentStation?.email || "",
    kraPin: currentStation?.kraPin || "",
    taxRate: String(currentStation?.taxRate ?? 16),
  });

  const handleSave = async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      await updateStation(currentStation.id, {
        ...currentStation,
        ...form,
        taxRate: parseFloat(form.taxRate) || 16,
      });
      setNotice("Settings saved successfully");
      setTimeout(() => setNotice(null), 3000);
    } catch (error) {
      console.error("Failed:", error);
      alert("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("business")}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            activeTab === "business"
              ? "bg-amber-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Fuel size={16} /> Business
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            activeTab === "profile"
              ? "bg-amber-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <User size={16} /> User Profile
        </button>
      </div>

      {activeTab === "profile" ? (
        <UserProfileSettings />
      ) : (
        <>
          {/* Station Info */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Fuel size={20} className="text-amber-400" /> Station Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-2 block">
                  Station Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-2 block">
                  Location
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-2 block">
                  KRA PIN
                </label>
                <input
                  type="text"
                  value={form.kraPin}
                  onChange={(e) => setForm({ ...form, kraPin: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-2 block">
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={form.taxRate}
                  onChange={(e) =>
                    setForm({ ...form, taxRate: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>

          {/* Integrations */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Smartphone size={20} className="text-blue-400" /> Integrations
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-emerald-400 font-bold text-sm">
                      MP
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">M-PESA</p>
                    <p className="text-gray-500 text-xs">
                      Mobile money payments
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full">
                  Not Connected
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 font-bold text-sm">KK</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Kopo Kopo</p>
                    <p className="text-gray-500 text-xs">Payment gateway</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full">
                  Not Connected
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save Settings
          </button>

          {notice && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
              <CheckCircle size={18} /> {notice}
            </div>
          )}
        </>
      )}
    </div>
  );
}
