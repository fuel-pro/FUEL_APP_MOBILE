import { useFuel } from "@/react-app/context/FuelContext";
import { useStations } from "@/react-app/context/StationContext";
import { useAuth } from "@/react-app/context/AuthContext";
import { useTheme } from "@/react-app/context/ThemeContext";
import { useLocation } from "@/react-app/context/LocationContext";
import { useTutorial } from "@/react-app/context/TutorialContext";
import LocationSelector from "@/react-app/components/LocationSelector";
import TabConfigModal from "@/react-app/components/TabConfigModal";
import SyncStatusIndicator from "@/react-app/components/SyncStatusIndicator";
import RoleSelector from "@/react-app/components/RoleSelector";
import QuickSearch from "@/react-app/components/QuickSearch";
import { useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import { uploadStationLogo } from "@/react-app/lib/logo-storage-service";
import { toastSuccess, toastError } from "@/react-app/lib/toast";
import {
  getDetectedCurrency,
  getCurrencySymbol,
} from "@/react-app/lib/currency";
import {
  Fuel,
  Sun,
  Moon,
  Settings,
  User,
  Download,
  QrCode,
  LogOut,
  Edit3,
  Image,
  ChevronDown,
  Layers,
  Plus,
  X,
  Check,
  Menu,
  Shield,
  Globe,
  LayoutDashboard,
  Crown,
  Loader2,
  HelpCircle,
} from "lucide-react";

interface HeaderProps {
  onShowStations?: () => void;
  onShowCombined?: () => void;
}

export default function Header({
  onShowStations,
  onShowCombined,
}: HeaderProps) {
  const { state, dispatch } = useFuel();
  const { user, logout } = useAuth();
  const { currentStation, stations, switchStation } = useStations();
  const { resolvedTheme, toggleTheme } = useTheme();
  const location = useLocation();
  const tutorial = useTutorial();
  const navigate = useNavigate();
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showStationMenu, setShowStationMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showTabConfig, setShowTabConfig] = useState(false);
  const [editData, setEditData] = useState({ ...state.companyData });
  const [editDirty, setEditDirty] = useState(false);
  const [logoPreview, setLogoPreview] = useState(state.companyData.logo || "");
  const [logoUploading, setLogoUploading] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setShowMobileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // CRITICAL: Sync the Company Profile form with the authoritative
  // state.companyData whenever it changes (e.g. after an async cloud load on a
  // fresh device/browser). Without this, editData is captured once at mount
  // from the default/empty state and never updates — so the user sees empty
  // fields and must re-type their company details every session, even though
  // the data is correctly persisted in cloud storage. We only re-sync when the
  // user has NOT started editing (editDirty flag) so in-progress edits are not
  // clobbered. Also tracks the logo so a cloud-loaded logo wins over a stale
  // local blob URL preview after refresh.
  useEffect(() => {
    if (!editDirty) {
      setEditData({ ...state.companyData });
    }
    if (state.companyData.logo) {
      setLogoPreview(state.companyData.logo);
    }
  }, [state.companyData, editDirty]);

  const handleToggleTheme = () => {
    toggleTheme();
  };

  const handleEditInfo = () => {
    dispatch({ type: "SET_COMPANY_DATA", payload: editData });
    setEditDirty(false);
    setShowEditInfo(false);
  };

  // Wrapper that marks the form as dirty so the cloud-sync effect above does
  // not clobber in-progress edits with freshly-loaded state.
  const updateEdit = (patch: Partial<typeof editData>) => {
    setEditDirty(true);
    setEditData((prev) => ({ ...prev, ...patch }));
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show an instant local preview so the user gets feedback while uploading.
    const localPreview = URL.createObjectURL(file);
    setLogoPreview(localPreview);
    setLogoUploading(true);

    try {
      if (!user?.id) {
        throw new Error("You must be signed in to upload a logo.");
      }
      // Upload to Supabase Storage (cross-device) and store the public URL —
      // NOT a base64 blob — so the logo survives refresh and syncs to every
      // device signed into the same account.
      const { url } = await uploadStationLogo(file, user.id);
      setLogoPreview(url);
      setEditData((p) => ({ ...p, logo: url }));
      dispatch({
        type: "SET_COMPANY_DATA",
        payload: { ...state.companyData, logo: url },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Logo upload failed:", msg);
      toastError(`Could not upload logo: ${msg}`);
      // Revert preview to whatever was previously persisted.
      setLogoPreview(state.companyData.logo || "");
    } finally {
      setLogoUploading(false);
      // Reset the input so the same file can be re-selected.
      if (e.target) e.target.value = "";
    }
  };

  const generateQRCode = () => {
    const data = JSON.stringify({
      company: state.companyData.name,
      vat: state.companyData.vatRegNo,
      taxId: state.companyData.kraPin || state.companyData.vatRegNo || "",
      phone: state.companyData.contacts,
    });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
    const link = document.createElement("a");
    link.download = `qrcode_${state.companyData.name}.png`;
    link.href = qrUrl;
    link.click();
  };

  return (
    <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-gray-200 dark:border-white/10 text-gray-900 dark:text-white shadow-lg relative z-40">
      {/* Desktop Header */}
      <div className="container mx-auto px-2 sm:px-4 py-1.5 sm:py-2 lg:py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Logo & Company */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            {state.companyData.logo || logoPreview ? (
              <img
                src={state.companyData.logo || logoPreview}
                alt="Logo"
                className="w-9 h-9 rounded-lg object-cover border border-white/20"
              />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Fuel size={18} className="text-gray-900 dark:text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold font-serif truncate leading-tight">
                {currentStation?.name || state.companyData.name || "FuelPro"}
              </h1>
              <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                {currentStation?.location || "Fuel Distribution & Management"}
              </p>
            </div>
          </div>

          {/* Center: Location Selector (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <LocationSelector compact />
            <div className="w-px h-5 bg-gray-100 dark:bg-white/10" />
            {/* Station Selector */}
            {stations.length > 1 ? (
              <div className="relative inline-block">
                <button
                  onClick={() => setShowStationMenu(!showStationMenu)}
                  aria-haspopup="listbox"
                  aria-expanded={showStationMenu}
                  className="flex h-10 items-center gap-1.5 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs transition-all duration-150 border border-amber-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <Layers size={12} />
                  <span className="max-w-20 truncate">
                    {currentStation?.name}
                  </span>
                  <ChevronDown
                    size={10}
                    className={`transition-transform duration-150 ${showStationMenu ? "rotate-180" : ""}`}
                  />
                </button>
                {showStationMenu && (
                  <div
                    className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden z-50 transition-all duration-150 origin-top"
                    role="listbox"
                  >
                    {stations.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          switchStation(s.id);
                          setShowStationMenu(false);
                        }}
                        className={`w-full flex h-10 items-center gap-2.5 px-3 text-left hover:bg-gray-50 dark:bg-white/5 transition-colors duration-150 ${currentStation?.id === s.id ? "bg-amber-500/10" : ""}`}
                      >
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center text-[10px] font-bold text-gray-900 dark:text-white">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-200 truncate">
                          {s.name}
                        </span>
                        {currentStation?.id === s.id && (
                          <Check size={12} className="text-amber-400 ml-auto" />
                        )}
                      </button>
                    ))}
                    {onShowCombined && (
                      <button
                        onClick={() => {
                          onShowCombined();
                          setShowStationMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:bg-white/5 text-amber-300 text-xs border-t border-gray-200 dark:border-white/10"
                      >
                        <Layers size={12} /> Combined View
                      </button>
                    )}
                    {onShowStations && (
                      <button
                        onClick={() => {
                          onShowStations();
                          setShowStationMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:bg-white/5 text-blue-300 text-xs"
                      >
                        <Settings size={12} /> Manage Stations
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              onShowStations && (
                <button
                  onClick={onShowStations}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 text-gray-300 rounded-lg text-xs transition-colors"
                >
                  <Plus size={11} /> Add Station
                </button>
              )
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="px-2 py-1 bg-gray-50 dark:bg-white/5 rounded-md text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Local
            </span>
            {user && (
              <span className="px-2 py-1 bg-gray-50 dark:bg-white/5 rounded-md text-[10px] text-gray-300 flex items-center gap-1">
                <User size={10} className="text-amber-400" />
                <span className="hidden xl:inline">{user.name}</span>
              </span>
            )}
            <button
              onClick={() => setShowEditInfo(!showEditInfo)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <Edit3 size={12} />
              <span className="hidden lg:inline">Edit Info</span>
            </button>
            <button
              onClick={() => setShowTabConfig(true)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <LayoutDashboard size={12} />
              <span className="hidden lg:inline">Tabs</span>
            </button>
            <label className="px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer">
              {logoUploading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Image size={12} />
              )}
              <span className="hidden lg:inline">
                {logoUploading ? "Uploading…" : "Logo"}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                disabled={logoUploading}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setShowQRCode(true)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <QrCode size={12} />
              <span className="hidden lg:inline">QR</span>
            </button>
            <button
              onClick={() => tutorial.startTutorial("basic")}
              title="Replay the onboarding tutorial"
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <HelpCircle size={12} />
              <span className="hidden lg:inline">Tutorial</span>
            </button>
            <QuickSearch
              entries={[
                ...(state.tabConfigurations || []).map((tab) => ({
                  id: tab.id,
                  label: tab.label,
                  description: tab.description || "",
                  category: "Navigation" as const,
                  tabId: tab.id,
                  keywords: `${tab.id} ${tab.label}`,
                })),
                {
                  id: "qa-pos",
                  label: "New Sale (POS)",
                  description: "Quick fuel sale",
                  category: "Quick Action" as const,
                  tabId: "pos",
                  keywords: "sell checkout pos cart",
                },
                {
                  id: "qa-invoice",
                  label: "New Invoice",
                  description: "Create a new invoice",
                  category: "Quick Action" as const,
                  tabId: "invoice",
                  keywords: "bill receipt customer",
                },
                {
                  id: "qa-expense",
                  label: "Record Expense",
                  description: "Log a new expense",
                  category: "Quick Action" as const,
                  tabId: "expenses",
                  keywords: "cost spend money",
                },
                {
                  id: "qa-credit",
                  label: "Credit Accounts",
                  description: "Manage customer credit",
                  category: "Quick Action" as const,
                  tabId: "credit",
                  keywords: "debt loan customer balance",
                },
                {
                  id: "qa-stkpush",
                  label: "M-PESA STK Push",
                  description: "Collect payment via M-PESA",
                  category: "Quick Action" as const,
                  tabId: "livetransaction",
                  keywords: "mpesa payment collect phone",
                },
              ]}
            />
            <SyncStatusIndicator
              countryCode={location.currentCountry.id}
              compact
            />
            <RoleSelector />
            <button
              onClick={() => navigate("/founder")}
              className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 rounded-lg text-xs text-amber-400 transition-colors flex items-center gap-1.5 border border-amber-500/20"
            >
              <Crown size={12} />
              <span className="hidden lg:inline">Admin</span>
            </button>
            <button
              onClick={handleToggleTheme}
              className="p-2 hover:bg-gray-100 dark:bg-white/10 rounded-lg transition-colors"
              title={`Theme: ${resolvedTheme}`}
            >
              {resolvedTheme === "dark" ? (
                <Sun size={15} className="text-amber-400" />
              ) : (
                <Moon size={15} className="text-gray-300" />
              )}
            </button>
            <button
              onClick={() => {
                logout();
              }}
              className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs text-red-400 transition-colors flex items-center gap-1.5"
            >
              <LogOut size={12} />
              <span className="hidden lg:inline">Logout</span>
            </button>
          </div>

          {/* Mobile: Hamburger Menu */}
          <div
            className="flex md:hidden items-center gap-2"
            ref={mobileMenuRef}
          >
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2.5 bg-gray-100 dark:bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden bg-slate-800/95 backdrop-blur-lg border-t border-gray-200 dark:border-white/10 shadow-2xl">
          <div className="container mx-auto px-4 py-4 space-y-3">
            {/* Location & Station */}
            <div className="flex items-center justify-between">
              <LocationSelector compact />
              {stations.length > 1 && (
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowStationMenu(!showStationMenu)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-lg text-xs border border-amber-500/30"
                  >
                    <Layers size={12} />
                    {currentStation?.name}
                    <ChevronDown size={10} />
                  </button>
                  {showStationMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden z-50">
                      {stations.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            switchStation(s.id);
                            setShowStationMenu(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:bg-white/5 ${currentStation?.id === s.id ? "bg-amber-500/10" : ""}`}
                        >
                          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-gray-900 dark:text-white">
                            {s.name.charAt(0)}
                          </div>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setShowEditInfo(!showEditInfo);
                  setShowMobileMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:bg-white/10 transition-colors"
              >
                <Edit3 size={16} className="text-gray-300" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Edit Info</span>
              </button>
              <button
                onClick={() => {
                  setShowTabConfig(true);
                  setShowMobileMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:bg-white/10 transition-colors"
              >
                <LayoutDashboard size={16} className="text-gray-300" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Tabs</span>
              </button>
              <label className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:bg-white/10 transition-colors cursor-pointer">
                {logoUploading ? (
                  <Loader2 size={16} className="text-gray-300 animate-spin" />
                ) : (
                  <Image size={16} className="text-gray-300" />
                )}
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {logoUploading ? "Uploading…" : "Logo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={logoUploading}
                  onChange={(e) => {
                    handleLogoChange(e);
                    setShowMobileMenu(false);
                  }}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => {
                  setShowQRCode(true);
                  setShowMobileMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:bg-white/10 transition-colors"
              >
                <QrCode size={16} className="text-gray-300" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">QR Code</span>
              </button>
              <button
                onClick={() => {
                  tutorial.startTutorial("basic");
                  setShowMobileMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:bg-white/10 transition-colors"
              >
                <HelpCircle size={16} className="text-amber-400" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Tutorial</span>
              </button>
              <button
                onClick={() => {
                  handleToggleTheme();
                  setShowMobileMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:bg-white/10 transition-colors"
              >
                {resolvedTheme === "dark" ? (
                  <Sun size={16} className="text-amber-400" />
                ) : (
                  <Moon size={16} className="text-gray-300" />
                )}
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {resolvedTheme === "dark" ? "Light" : "Dark"}
                </span>
              </button>
              {onShowStations && (
                <button
                  onClick={() => {
                    onShowStations();
                    setShowMobileMenu(false);
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:bg-white/10 transition-colors"
                >
                  <Layers size={16} className="text-blue-400" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Stations</span>
                </button>
              )}
              <button
                onClick={() => {
                  navigate("/founder");
                  setShowMobileMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-amber-500/10 rounded-xl hover:bg-amber-500/20 transition-colors"
              >
                <Crown size={16} className="text-amber-400" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Admin</span>
              </button>
            </div>

            {/* User & Logout */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-white/10">
              {/* Firebase User Profile */}
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-300">{user.name}</span>
                </div>
              ) : null}
              <button
                onClick={() => {
                  logout();
                  setShowMobileMenu(false);
                }}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2 transition-colors"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Info Panel */}
      {showEditInfo && (
        <div className="bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10 px-4 py-4">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Company Profile</h3>
              <button
                onClick={() => setShowEditInfo(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
              >
                <X size={16} />
              </button>
            </div>
            {/* Company Profile Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Row 1: Company Name, P.O. Box, Contacts */}
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  Company Name
                </label>
                <input
                  value={editData.name}
                  onChange={(e) => updateEdit({ name: e.target.value })}
                  placeholder="e.g. Acme Fuel Station Ltd"
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  P.O. Box
                </label>
                <input
                  value={editData.poBox}
                  onChange={(e) => updateEdit({ poBox: e.target.value })}
                  placeholder="e.g. 12345-00100"
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  Contacts (phone)
                </label>
                <input
                  value={editData.contacts}
                  onChange={(e) => updateEdit({ contacts: e.target.value })}
                  placeholder="+1 555 000 0000"
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Row 2: Email, Currency, VAT */}
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  Email Address
                </label>
                <input
                  value={editData.email}
                  onChange={(e) => updateEdit({ email: e.target.value })}
                  placeholder="info@company.com"
                  type="email"
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  Currency
                </label>
                <select
                  value={editData.currency}
                  onChange={(e) => updateEdit({ currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {/* Detected station currency — shown first so the default
                      selection reflects the station's locale rather than
                      Kenya. */}
                  <option
                    value={getCurrencySymbol(getDetectedCurrency())}
                    className="bg-white dark:bg-gray-800"
                  >
                    {getDetectedCurrency()} — Detected
                  </option>
                  <option value="BRL" className="bg-white dark:bg-gray-800">
                    BRL — Brazilian Real
                  </option>
                  <option value="CNY" className="bg-white dark:bg-gray-800">
                    CNY — Chinese Yuan
                  </option>
                  <option value="EUR" className="bg-white dark:bg-gray-800">
                    EUR — Euro
                  </option>
                  <option value="GBP" className="bg-white dark:bg-gray-800">
                    GBP — British Pound
                  </option>
                  <option value="GHS" className="bg-white dark:bg-gray-800">
                    GHS — Ghana Cedi
                  </option>
                  <option value="INR" className="bg-white dark:bg-gray-800">
                    INR — Indian Rupee
                  </option>
                  <option value="JPY" className="bg-white dark:bg-gray-800">
                    JPY — Japanese Yen
                  </option>
                  <option value="KES" className="bg-white dark:bg-gray-800">
                    KES — Kenyan Shilling
                  </option>
                  <option value="NGN" className="bg-white dark:bg-gray-800">
                    NGN — Nigerian Naira
                  </option>
                  <option value="RWF" className="bg-white dark:bg-gray-800">
                    RWF — Rwanda Franc
                  </option>
                  <option value="TZS" className="bg-white dark:bg-gray-800">
                    TZS — Tanzania Shilling
                  </option>
                  <option value="UGX" className="bg-white dark:bg-gray-800">
                    UGX — Uganda Shilling
                  </option>
                  <option value="USD" className="bg-white dark:bg-gray-800">
                    USD — US Dollar
                  </option>
                  <option value="ZAR" className="bg-white dark:bg-gray-800">
                    ZAR — South African Rand
                  </option>
                  <option value="AUD" className="bg-white dark:bg-gray-800">
                    AUD — Australian Dollar
                  </option>
                  <option value="CAD" className="bg-white dark:bg-gray-800">
                    CAD — Canadian Dollar
                  </option>
                  <option value="CHF" className="bg-white dark:bg-gray-800">
                    CHF — Swiss Franc
                  </option>
                  <option value="CNY" className="bg-white dark:bg-gray-800">
                    CNY — Chinese Yuan
                  </option>
                  <option value="SGD" className="bg-white dark:bg-gray-800">
                    SGD — Singapore Dollar
                  </option>
                  <option value="HKD" className="bg-white dark:bg-gray-800">
                    HKD — Hong Kong Dollar
                  </option>
                  <option value="NZD" className="bg-white dark:bg-gray-800">
                    NZD — New Zealand Dollar
                  </option>
                  <option value="AED" className="bg-white dark:bg-gray-800">
                    AED — UAE Dirham
                  </option>
                  <option value="SAR" className="bg-white dark:bg-gray-800">
                    SAR — Saudi Riyal
                  </option>
                  <option value="BRL" className="bg-white dark:bg-gray-800">
                    BRL — Brazilian Real
                  </option>
                  <option value="MXN" className="bg-white dark:bg-gray-800">
                    MXN — Mexican Peso
                  </option>
                  <option value="RUB" className="bg-white dark:bg-gray-800">
                    RUB — Russian Ruble
                  </option>
                  <option value="TRY" className="bg-white dark:bg-gray-800">
                    TRY — Turkish Lira
                  </option>
                  <option value="KRW" className="bg-white dark:bg-gray-800">
                    KRW — South Korean Won
                  </option>
                  <option value="IDR" className="bg-white dark:bg-gray-800">
                    IDR — Indonesian Rupiah
                  </option>
                  <option value="MYR" className="bg-white dark:bg-gray-800">
                    MYR — Malaysian Ringgit
                  </option>
                  <option value="THB" className="bg-white dark:bg-gray-800">
                    THB — Thai Baht
                  </option>
                  <option value="PHP" className="bg-white dark:bg-gray-800">
                    PHP — Philippine Peso
                  </option>
                  <option value="VND" className="bg-white dark:bg-gray-800">
                    VND — Vietnamese Dong
                  </option>
                  <option value="EGP" className="bg-white dark:bg-gray-800">
                    EGP — Egyptian Pound
                  </option>
                  <option value="MAD" className="bg-white dark:bg-gray-800">
                    MAD — Moroccan Dirham
                  </option>
                  <option value="PKR" className="bg-white dark:bg-gray-800">
                    PKR — Pakistani Rupee
                  </option>
                  <option value="BDT" className="bg-white dark:bg-gray-800">
                    BDT — Bangladeshi Taka
                  </option>
                  <option value="ARS" className="bg-white dark:bg-gray-800">
                    ARS — Argentine Peso
                  </option>
                  <option value="CLP" className="bg-white dark:bg-gray-800">
                    CLP — Chilean Peso
                  </option>
                  <option value="COP" className="bg-white dark:bg-gray-800">
                    COP — Colombian Peso
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  VAT Registration No
                </label>
                <input
                  value={editData.vatRegNo}
                  onChange={(e) => updateEdit({ vatRegNo: e.target.value })}
                  placeholder="VAT Reg No"
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Row 3: Bank Details */}
              <div className="sm:col-span-2 lg:col-span-3 border-t border-gray-200 dark:border-white/10 pt-2 mt-1">
                <p className="text-[10px] text-amber-400 font-medium mb-2">
                  Bank Details (For Invoices)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                      Bank Name
                    </label>
                    <input
                      value={editData.bankName}
                      onChange={(e) => updateEdit({ bankName: e.target.value })}
                      placeholder="e.g. Equity Bank"
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                      Branch Name
                    </label>
                    <input
                      value={editData.branchName}
                      onChange={(e) =>
                        updateEdit({ branchName: e.target.value })
                      }
                      placeholder="e.g. Mombasa Road"
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                      Account Holder Name
                    </label>
                    <input
                      value={editData.accountHolder}
                      onChange={(e) =>
                        updateEdit({
                          accountHolder: e.target.value,
                        })
                      }
                      placeholder="Account holder name"
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                      Account Number
                    </label>
                    <input
                      value={editData.accountNumber}
                      onChange={(e) =>
                        updateEdit({
                          accountNumber: e.target.value,
                        })
                      }
                      placeholder="1234567890"
                      type="text"
                      inputMode="numeric"
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 border border-white/20 text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  onClick={handleEditInfo}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 dark:text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <Check size={14} /> Save Company Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQRCode(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Company QR Code</h3>
              <button
                onClick={() => setShowQRCode(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl flex items-center justify-center mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify({ company: state.companyData.name, vat: state.companyData.vatRegNo, phone: state.companyData.contacts, pin: state.companyData.kraPin }))}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
            <button
              onClick={generateQRCode}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download size={16} /> Download QR Code
            </button>
          </div>
        </div>
      )}

      {/* TABS Config Modal */}
      {showTabConfig && (
        <TabConfigModal onClose={() => setShowTabConfig(false)} />
      )}
    </header>
  );
}
