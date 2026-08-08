import { useFuel } from "@/react-app/context/FuelContext";
import { useStations } from "@/react-app/context/StationContext";
import { useAuth } from "@/react-app/context/AuthContext";
import { useTheme } from "@/react-app/context/ThemeContext";
import { useLocation } from "@/react-app/context/LocationContext";
import LocationSelector from "@/react-app/components/LocationSelector";
import TabConfigModal from "@/react-app/components/TabConfigModal";
import SyncStatusIndicator from "@/react-app/components/SyncStatusIndicator";
import RoleSelector from "@/react-app/components/RoleSelector";
import { useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
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
  const navigate = useNavigate();
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showStationMenu, setShowStationMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showTabConfig, setShowTabConfig] = useState(false);
  const [editData, setEditData] = useState({ ...state.companyData });
  const [logoPreview, setLogoPreview] = useState(state.companyData.logo || "");
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

  // CRITICAL: Sync logoPreview with state after loading from storage
  // This fixes logo disappearing after refresh
  useEffect(() => {
    if (state.companyData.logo && !logoPreview) {
      setLogoPreview(state.companyData.logo);
      setEditData(prev => ({ ...prev, logo: state.companyData.logo }));
    }
  }, [state.companyData.logo]);

  const handleToggleTheme = () => {
    toggleTheme();
  };

  const handleEditInfo = () => {
    dispatch({ type: "SET_COMPANY_DATA", payload: editData });
    setShowEditInfo(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        setEditData(p => ({ ...p, logo: result }));
        dispatch({
          type: "SET_COMPANY_DATA",
          payload: { ...state.companyData, logo: result },
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const generateQRCode = () => {
    const data = JSON.stringify({
      company: state.companyData.name,
      vat: state.companyData.vatRegNo,
      pin: state.companyData.kraPin,
      phone: state.companyData.contacts,
    });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
    const link = document.createElement("a");
    link.download = `qrcode_${state.companyData.name}.png`;
    link.href = qrUrl;
    link.click();
  };

  return (
    <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-white/10 text-white shadow-lg relative z-40">
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
                <Fuel size={18} className="text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold font-serif truncate leading-tight">
                {currentStation?.name || state.companyData.name || "FuelPro"}
              </h1>
              <p className="text-[9px] text-gray-400 truncate leading-tight">
                {currentStation?.location || "Fuel Distribution & Management"}
              </p>
            </div>
          </div>

          {/* Center: Location Selector (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <LocationSelector compact />
            <div className="w-px h-5 bg-white/10" />
            {/* Station Selector */}
            {stations.length > 1 ? (
              <div className="relative inline-block">
                <button
                  onClick={() => setShowStationMenu(!showStationMenu)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs transition-colors border border-amber-500/30"
                >
                  <Layers size={12} />
                  <span className="max-w-20 truncate">
                    {currentStation?.name}
                  </span>
                  <ChevronDown size={10} />
                </button>
                {showStationMenu && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-gray-800 rounded-xl shadow-xl border border-white/10 overflow-hidden z-50">
                    {stations.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          switchStation(s.id);
                          setShowStationMenu(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors ${currentStation?.id === s.id ? "bg-amber-500/10" : ""}`}
                      >
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center text-[10px] font-bold text-white">
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 text-amber-300 text-xs border-t border-white/10"
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 text-blue-300 text-xs"
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
                  className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs transition-colors"
                >
                  <Plus size={11} /> Add Station
                </button>
              )
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="px-2 py-1 bg-white/5 rounded-md text-[10px] text-gray-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Local
            </span>
            {user && (
              <span className="px-2 py-1 bg-white/5 rounded-md text-[10px] text-gray-300 flex items-center gap-1">
                <User size={10} className="text-amber-400" />
                <span className="hidden xl:inline">{user.name}</span>
              </span>
            )}
            <button
              onClick={() => setShowEditInfo(!showEditInfo)}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <Edit3 size={12} />
              <span className="hidden lg:inline">Edit Info</span>
            </button>
            <button
              onClick={() => setShowTabConfig(true)}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <LayoutDashboard size={12} />
              <span className="hidden lg:inline">Tabs</span>
            </button>
            <label className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer">
              <Image size={12} />
              <span className="hidden lg:inline">Logo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setShowQRCode(true)}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <QrCode size={12} />
              <span className="hidden lg:inline">QR</span>
            </button>
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
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
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
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden bg-slate-800/95 backdrop-blur-lg border-t border-white/10 shadow-2xl">
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
                    <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 rounded-xl shadow-xl border border-white/10 overflow-hidden z-50">
                      {stations.map(s => (
                        <button
                          key={s.id}
                          onClick={() => {
                            switchStation(s.id);
                            setShowStationMenu(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 ${currentStation?.id === s.id ? "bg-amber-500/10" : ""}`}
                        >
                          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-white">
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
                className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Edit3 size={16} className="text-gray-300" />
                <span className="text-[10px] text-gray-400">Edit Info</span>
              </button>
              <button
                onClick={() => {
                  setShowTabConfig(true);
                  setShowMobileMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <LayoutDashboard size={16} className="text-gray-300" />
                <span className="text-[10px] text-gray-400">Tabs</span>
              </button>
              <label className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                <Image size={16} className="text-gray-300" />
                <span className="text-[10px] text-gray-400">Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
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
                className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <QrCode size={16} className="text-gray-300" />
                <span className="text-[10px] text-gray-400">QR Code</span>
              </button>
              <button
                onClick={() => {
                  handleToggleTheme();
                  setShowMobileMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                {resolvedTheme === "dark" ? (
                  <Sun size={16} className="text-amber-400" />
                ) : (
                  <Moon size={16} className="text-gray-300" />
                )}
                <span className="text-[10px] text-gray-400">
                  {resolvedTheme === "dark" ? "Light" : "Dark"}
                </span>
              </button>
              {onShowStations && (
                <button
                  onClick={() => {
                    onShowStations();
                    setShowMobileMenu(false);
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Layers size={16} className="text-blue-400" />
                  <span className="text-[10px] text-gray-400">Stations</span>
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
                <span className="text-[10px] text-gray-400">Admin</span>
              </button>
            </div>

            {/* User & Logout */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
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
        <div className="bg-white/5 border-t border-white/10 px-4 py-4">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Company Profile</h3>
              <button
                onClick={() => setShowEditInfo(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            {/* Company Profile Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Row 1: Company Name, P.O. Box, Contacts */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">
                  Company Name
                </label>
                <input
                  value={editData.name}
                  onChange={e =>
                    setEditData(p => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Acme Fuel Station Ltd"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">
                  P.O. Box
                </label>
                <input
                  value={editData.poBox}
                  onChange={e =>
                    setEditData(p => ({ ...p, poBox: e.target.value }))
                  }
                  placeholder="e.g. 12345-00100"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">
                  Contacts (e.g. +254...)
                </label>
                <input
                  value={editData.contacts}
                  onChange={e =>
                    setEditData(p => ({ ...p, contacts: e.target.value }))
                  }
                  placeholder="+254 700 000 000"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Row 2: Email, Currency, VAT */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">
                  Email Address
                </label>
                <input
                  value={editData.email}
                  onChange={e =>
                    setEditData(p => ({ ...p, email: e.target.value }))
                  }
                  placeholder="info@company.co.ke"
                  type="email"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">
                  Currency
                </label>
                <select
                  value={editData.currency}
                  onChange={e =>
                    setEditData(p => ({ ...p, currency: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="KSh" className="bg-gray-800">
                    Ksh — Kenyan Shilling
                  </option>
                  <option value="UGX" className="bg-gray-800">
                    UGX — Uganda Shilling
                  </option>
                  <option value="TZS" className="bg-gray-800">
                    TZS — Tanzania Shilling
                  </option>
                  <option value="NGN" className="bg-gray-800">
                    NGN — Nigerian Naira
                  </option>
                  <option value="ZAR" className="bg-gray-800">
                    ZAR — South African Rand
                  </option>
                  <option value="GHS" className="bg-gray-800">
                    GHS — Ghana Cedi
                  </option>
                  <option value="RWF" className="bg-gray-800">
                    RWF — Rwanda Franc
                  </option>
                  <option value="USD" className="bg-gray-800">
                    USD — US Dollar
                  </option>
                  <option value="GBP" className="bg-gray-800">
                    GBP — British Pound
                  </option>
                  <option value="EUR" className="bg-gray-800">
                    EUR — Euro
                  </option>
                  <option value="INR" className="bg-gray-800">
                    INR — Indian Rupee
                  </option>
                  <option value="BRL" className="bg-gray-800">
                    BRL — Brazilian Real
                  </option>
                  <option value="CNY" className="bg-gray-800">
                    CNY — Chinese Yuan
                  </option>
                  <option value="JPY" className="bg-gray-800">
                    JPY — Japanese Yen
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">
                  VAT Registration No
                </label>
                <input
                  value={editData.vatRegNo}
                  onChange={e =>
                    setEditData(p => ({ ...p, vatRegNo: e.target.value }))
                  }
                  placeholder="VAT Reg No"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Row 3: Bank Details */}
              <div className="sm:col-span-2 lg:col-span-3 border-t border-white/10 pt-2 mt-1">
                <p className="text-[10px] text-amber-400 font-medium mb-2">
                  Bank Details (For Invoices)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">
                      Bank Name
                    </label>
                    <input
                      value={editData.bankName}
                      onChange={e =>
                        setEditData(p => ({ ...p, bankName: e.target.value }))
                      }
                      placeholder="e.g. Equity Bank"
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">
                      Branch Name
                    </label>
                    <input
                      value={editData.branchName}
                      onChange={e =>
                        setEditData(p => ({ ...p, branchName: e.target.value }))
                      }
                      placeholder="e.g. Mombasa Road"
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">
                      Account Holder Name
                    </label>
                    <input
                      value={editData.accountHolder}
                      onChange={e =>
                        setEditData(p => ({
                          ...p,
                          accountHolder: e.target.value,
                        }))
                      }
                      placeholder="Account holder name"
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">
                      Account Number
                    </label>
                    <input
                      value={editData.accountNumber}
                      onChange={e =>
                        setEditData(p => ({
                          ...p,
                          accountNumber: e.target.value,
                        }))
                      }
                      placeholder="1234567890"
                      type="text"
                      inputMode="numeric"
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  onClick={handleEditInfo}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
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
            className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/20"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Company QR Code</h3>
              <button
                onClick={() => setShowQRCode(false)}
                className="text-gray-400 hover:text-white"
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
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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
