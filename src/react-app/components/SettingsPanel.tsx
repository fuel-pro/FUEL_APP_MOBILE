/**
 * SettingsPanel.tsx
 * Business settings: station info, tax rates, integrations, user profile.
 */
import React, { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  CheckCircle,
  Fuel,
  Smartphone,
  User,
  Settings,
  Zap,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { useAuth } from "@/react-app/context/AuthContext";
import { useFuel } from "@/react-app/context/FuelContext";
import { supabase } from "@/supabase/client";
import UserProfileSettings from "./UserProfileSettings";
import {
  getMpesaConfig,
  getKopokopoConfig,
  switchToTab,
} from "@/react-app/lib/mpesa-integration-service";
import { isKenyaStation, getCurrencySymbol } from "@/react-app/lib/currency";
import { useUserPrefs } from "@/react-app/lib/user-preferences";
import { toastSuccess, toastError } from "@/react-app/lib/toast";

export default function SettingsPanel() {
  const { currentStation, updateStation } = useStations();
  const { user } = useAuth();
  const { state, dispatch } = useFuel();
  const stationId = currentStation?.id;
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
  const [mpesaConnected, setMpesaConnected] = useState(false);
  const [kopoConnected, setKopoConnected] = useState(false);
  const isKenya = isKenyaStation();

  // Cloud-backed user/site preferences (currency, tax label, categories, etc.)
  const { prefs, update } = useUserPrefs();
  const [categoriesDraft, setCategoriesDraft] = useState(
    prefs.defaultCategories.join(", "),
  );
  useEffect(() => {
    setCategoriesDraft(prefs.defaultCategories.join(", "));
  }, [prefs.defaultCategories]);

  // Load real integration connection status from cloud config
  useEffect(() => {
    if (!user) return;
    (async () => {
      const m = await getMpesaConfig(stationId);
      setMpesaConnected(m.enabled && !!m.consumerKey);
      const k = await getKopokopoConfig(stationId);
      setKopoConnected(k.enabled && !!k.clientId);
    })();
  }, [user, stationId]);

  const handleSave = async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      await updateStation(currentStation.id, {
        ...currentStation,
        ...form,
        taxRate: parseFloat(form.taxRate) || 16,
      });
      // ALSO sync the company-info fields into FuelContext.companyData so
      // invoices/reports (which read from companyData, NOT the station
      // record) reflect the user's Settings edits. Without this, the KRA
      // PIN / phone / email / company name entered here never reached the
      // cloud blob that the invoice template reads from.
      dispatch({
        type: "SET_COMPANY_DATA",
        payload: {
          ...state.companyData,
          name: form.name || state.companyData.name,
          contacts: form.phone || state.companyData.contacts,
          email: form.email || state.companyData.email,
          kraPin: form.kraPin || state.companyData.kraPin,
          physicalAddress: form.location || state.companyData.physicalAddress,
        },
      });
      setNotice("Settings saved successfully");
      setTimeout(() => setNotice(null), 3000);
    } catch (error) {
      console.error("Failed:", error);
      toastError("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Settings
      </h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 p-1 bg-gray-50 dark:bg-white/5 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("business")}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            activeTab === "business"
              ? "bg-amber-500 text-gray-900 dark:text-white"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
          }`}
        >
          <Fuel size={16} /> Business
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            activeTab === "profile"
              ? "bg-amber-500 text-gray-900 dark:text-white"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
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
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
              <Fuel size={20} className="text-amber-400" /> Station Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  Station Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  Location
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              {isKenya && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                    KRA PIN
                  </label>
                  <input
                    type="text"
                    value={form.kraPin}
                    onChange={(e) =>
                      setForm({ ...form, kraPin: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>
              )}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={form.taxRate}
                  onChange={(e) =>
                    setForm({ ...form, taxRate: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>

          {/* Integrations */}
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
              <Smartphone size={20} className="text-blue-400" /> Integrations
            </h3>
            <div className="space-y-4">
              {isKenya ? (
                <button
                  onClick={() => switchToTab("integration")}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 rounded-xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-emerald-400 font-bold text-sm">
                        MP
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white font-medium">
                        M-PESA
                      </p>
                      <p className="text-gray-500 text-xs">
                        Mobile money payments
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      mpesaConnected
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {mpesaConnected ? "Connected" : "Not Connected"}
                  </span>
                </button>
              ) : (
                <div className="w-full flex items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-xl opacity-70">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-emerald-400 font-bold text-sm">
                      MP
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">
                      M-PESA
                    </p>
                    <p className="text-gray-500 text-xs">
                      M-PESA is available in Kenya only
                    </p>
                  </div>
                </div>
              )}
              {isKenya ? (
                <button
                  onClick={() => switchToTab("integration")}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 rounded-xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-blue-400 font-bold text-sm">
                        KK
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white font-medium">
                        Kopo Kopo
                      </p>
                      <p className="text-gray-500 text-xs">Payment gateway</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      kopoConnected
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {kopoConnected ? "Connected" : "Not Connected"}
                  </span>
                </button>
              ) : (
                <div className="w-full flex items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-xl opacity-70">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 font-bold text-sm">KK</span>
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">
                      Kopo Kopo
                    </p>
                    <p className="text-gray-500 text-xs">
                      Kopo Kopo is available in Kenya only
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Site Preferences (cloud-backed user preferences) */}
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
              <Settings size={20} className="text-amber-400" /> Site Preferences
            </h3>
            <div className="space-y-4">
              {/* Currency */}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  Currency
                </label>
                <select
                  value={prefs.currency}
                  onChange={(e) =>
                    update({
                      currency: e.target.value,
                      currencySymbol: getCurrencySymbol(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                >
                  {[
                    "USD",
                    "EUR",
                    "GBP",
                    "KES",
                    "NGN",
                    "GHS",
                    "UGX",
                    "TZS",
                    "ZAR",
                    "INR",
                    "AED",
                    "SAR",
                    "CAD",
                    "AUD",
                    "JPY",
                    "CNY",
                  ].map((c) => (
                    <option
                      key={c}
                      value={c}
                      className="bg-white dark:bg-gray-800"
                    >
                      {c} ({getCurrencySymbol(c)})
                    </option>
                  ))}
                </select>
              </div>

              {/* VAT / Tax label */}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  VAT / Tax Label
                </label>
                <input
                  type="text"
                  value={prefs.vatLabel}
                  onChange={(e) => update({ vatLabel: e.target.value })}
                  placeholder="e.g. VAT, GST, Sales Tax"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                />
              </div>

              {/* VAT rate override */}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  VAT Rate Override (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={prefs.vatRate || 0}
                  onChange={(e) =>
                    update({ vatRate: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Leave 0 to use country default.
                </p>
              </div>

              {/* Default categories */}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  Default Categories (comma-separated)
                </label>
                <input
                  type="text"
                  value={categoriesDraft}
                  onChange={(e) => setCategoriesDraft(e.target.value)}
                  onBlur={() =>
                    update({
                      defaultCategories: categoriesDraft
                        .split(",")
                        .map((c) => c.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Fuel, Lubricants, Accessories, Services, Other"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                />
              </div>

              {/* Receipt footer */}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  Receipt Footer
                </label>
                <input
                  type="text"
                  value={prefs.receiptFooter}
                  onChange={(e) => update({ receiptFooter: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                />
              </div>

              {/* Invoice prefix */}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={prefs.invoicePrefix}
                  onChange={(e) => update({ invoicePrefix: e.target.value })}
                  placeholder="INV"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                />
              </div>

              {/* Configure Automation */}
              <button
                onClick={() => switchToTab("automation")}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 rounded-xl transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Zap size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">
                      Configure Automation
                    </p>
                    <p className="text-gray-500 text-xs">
                      Auto-reorder, stock edits, dashboards & more
                    </p>
                  </div>
                </div>
                <span className="text-xs text-amber-400">Open →</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save Settings
          </button>

          {notice && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-gray-900 dark:text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
              <CheckCircle size={18} /> {notice}
            </div>
          )}
        </>
      )}
    </div>
  );
}
