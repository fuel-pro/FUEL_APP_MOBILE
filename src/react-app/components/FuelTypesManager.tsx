import { useState, useEffect } from "react";
import {
  KENYA_SPECIALTY_PRICES,
  CANONICAL_FUEL_TYPES,
  getCountryPrice,
} from "@/react-app/config/pricing";
import {
  Fuel,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Beaker,
  Droplets,
  Flame,
  Zap,
  Wind,
  AlertTriangle,
  CheckCircle2,
  Settings,
  ChevronDown,
  ChevronUp,
  Monitor,
  FlaskConical,
  Gauge,
  DollarSign,
  Minus,
  Lock,
} from "lucide-react";
import { useFuel, type Pump } from "@/react-app/context/FuelContext";
import { usePermissions } from "@/react-app/context/PermissionContext";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";
import {
  getCurrencySymbol,
  getDetectedCountryCode,
} from "@/react-app/lib/currency";
import { useAuth } from "@/react-app/context/AuthContext";
import { useStations } from "@/react-app/context/StationContext";
import SubTabBar from "@/react-app/components/SubTabBar";
import PriceBoard from "@/react-app/components/PriceBoard";
import FuelQualityTesting from "@/react-app/components/FuelQualityTesting";
import {
  emitFuelTypeChange,
  emitFuelPriceChange,
  type FuelPricePrefill,
} from "@/react-app/lib/fuel-interlink-bus";
import {
  onTabPayload,
  navigateToTab,
} from "@/react-app/lib/mpesa-integration-service";
import { normalizeFuelType, getFuelLabel } from "@/react-app/config/pricing";
import type { CanonicalFuelType } from "@/react-app/config/pricing";
import { useStationFuelTypes } from "@/react-app/hooks/useStationFuelTypes";

// ============================================================
// CUSTOM FUEL TYPE MANAGER
// Add, edit, delete any fuel type (Kerosene, V-Power, etc.)
// ============================================================

export interface CustomFuelType {
  id: string;
  code: string;
  name: string;
  localName: string;
  price: number;
  costPrice: number;
  taxRate: number;
  levyRate: number;
  color: string;
  icon: string;
  pumpCount: number;
  active: boolean;
  description: string;
}

// Cloud key under which the custom fuel-type catalog is persisted/synced.
const FUEL_TYPES_CLOUD_KEY = "fuel_types_config";

/**
 * Hardens a single fuel-type record loaded from cloud/localStorage into a fully
 * valid CustomFuelType so render-time access (.map, .toFixed, .toLowerCase...)
 * can never throw "Cannot read properties of undefined". Mirrors the
 * SupplierManagement.tsx normalize pattern.
 */
function normalizeCustomFuelType(
  f: Partial<CustomFuelType> | null | undefined,
): CustomFuelType {
  const id =
    f?.id || `fuel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    code: f?.code ?? "",
    name: f?.name ?? "",
    localName: f?.localName ?? "",
    price: typeof f?.price === "number" ? f.price : 0,
    costPrice: typeof f?.costPrice === "number" ? f.costPrice : 0,
    taxRate: typeof f?.taxRate === "number" ? f.taxRate : 0,
    levyRate: typeof f?.levyRate === "number" ? f.levyRate : 0,
    color: f?.color ?? "",
    icon: f?.icon ?? "",
    pumpCount: typeof f?.pumpCount === "number" ? f.pumpCount : 0,
    active: typeof f?.active === "boolean" ? f.active : false,
    description: f?.description ?? "",
  };
}

/**
 * Hardens an array of cloud/localStorage fuel-type records. Non-array input
 * (null, undefined, partial object, etc.) collapses to [].
 */
function normalizeCustomFuelTypes(arr: unknown): CustomFuelType[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((f) => normalizeCustomFuelType(f as Partial<CustomFuelType>));
}

const PRESET_FUELS: CustomFuelType[] = [
  {
    id: "iko",
    code: CANONICAL_FUEL_TYPES.kerosene.code,
    name: "Illuminating Kerosene",
    localName: CANONICAL_FUEL_TYPES.kerosene.label,
    price: 164.9,
    costPrice: 155.0,
    taxRate: 16,
    levyRate: 0,
    color: "amber",
    icon: "flame",
    pumpCount: 1,
    active: true,
    description: "Kerosene for lighting and cooking",
  },
  {
    id: "vpower",
    code: CANONICAL_FUEL_TYPES.vpower.code,
    name: "Shell V-Power",
    localName: CANONICAL_FUEL_TYPES.vpower.label,
    price: 214.35,
    costPrice: 200.0,
    taxRate: 16,
    levyRate: 0,
    color: "purple",
    icon: "zap",
    pumpCount: 1,
    active: true,
    description: "Premium fuel with cleaning additives",
  },
  {
    id: "diesel-premium",
    code: CANONICAL_FUEL_TYPES.premium_diesel.code,
    name: "Premium Diesel",
    localName: CANONICAL_FUEL_TYPES.premium_diesel.label,
    price: 213.72,
    costPrice: 199.5,
    taxRate: 16,
    levyRate: 0,
    color: "indigo",
    icon: "droplet",
    pumpCount: 1,
    active: true,
    description: "High-performance diesel",
  },
  {
    id: "lpg",
    code: CANONICAL_FUEL_TYPES.lpg.code,
    name: "Liquefied Petroleum Gas",
    localName: CANONICAL_FUEL_TYPES.lpg.label,
    price: 120.0,
    costPrice: 100.0,
    taxRate: 8,
    levyRate: 0,
    color: "green",
    icon: "wind",
    pumpCount: 1,
    active: true,
    description: "LPG for domestic and commercial cooking",
  },
  {
    id: "cng",
    code: "CNG",
    name: "Compressed Natural Gas",
    localName: "CNG",
    price: 80.0,
    costPrice: 65.0,
    taxRate: 16,
    levyRate: 0,
    color: "cyan",
    icon: "wind",
    pumpCount: 1,
    active: true,
    description: "Compressed natural gas for vehicles",
  },
  {
    id: "biodiesel",
    code: "B20",
    name: "Biodiesel B20",
    localName: "Bio Diesel",
    price: 195.0,
    costPrice: 180.0,
    taxRate: 16,
    levyRate: 0,
    color: "emerald",
    icon: "leaf",
    pumpCount: 1,
    active: true,
    description: "20% biodiesel blend",
  },
  {
    id: "ethanol",
    code: "E10",
    name: "Ethanol Blend E10",
    localName: "Ethanol Petrol",
    price: 200.0,
    costPrice: 185.0,
    taxRate: 16,
    levyRate: 0,
    color: "yellow",
    icon: "beaker",
    pumpCount: 1,
    active: true,
    description: "10% ethanol blend petrol",
  },
  {
    id: "avgas",
    code: "AVGAS",
    name: "Aviation Gasoline",
    localName: "Avgas",
    price: 350.0,
    costPrice: 320.0,
    taxRate: 16,
    levyRate: 0,
    color: "sky",
    icon: "plane",
    pumpCount: 0,
    active: false,
    description: "Aviation fuel for small aircraft",
  },
  {
    id: "jet-a1",
    code: "JET",
    name: "Jet A-1 Fuel",
    localName: "Jet Fuel",
    price: 280.0,
    costPrice: 260.0,
    taxRate: 16,
    levyRate: 0,
    color: "slate",
    icon: "plane",
    pumpCount: 0,
    active: false,
    description: "Jet fuel for aircraft",
  },
  {
    id: "fuel-oil",
    code: "IFO",
    name: "Industrial Fuel Oil",
    localName: "Fuel Oil",
    price: 150.0,
    costPrice: 130.0,
    taxRate: 16,
    levyRate: 0,
    color: "orange",
    icon: "factory",
    pumpCount: 0,
    active: false,
    description: "Heavy fuel oil for industrial use",
  },
];

const FUEL_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-700 border-red-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  green: "bg-green-100 text-green-700 border-green-200",
  cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  sky: "bg-sky-100 text-sky-700 border-sky-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
};

const COLOR_OPTIONS = Object.keys(FUEL_COLORS);
const ICON_OPTIONS = [
  { id: "flame", label: "Flame" },
  { id: "droplet", label: "Droplet" },
  { id: "zap", label: "Lightning" },
  { id: "wind", label: "Wind/Gas" },
  { id: "beaker", label: "Beaker" },
  { id: "leaf", label: "Eco/Leaf" },
  { id: "plane", label: "Aviation" },
  { id: "factory", label: "Industrial" },
];

function loadFuelTypes(): CustomFuelType[] {
  try {
    const saved = localStorage.getItem("fuelpro_custom_fuel_types");
    if (saved) return normalizeCustomFuelTypes(JSON.parse(saved));
  } catch {}
  return [];
}

function saveFuelTypes(types: CustomFuelType[]) {
  localStorage.setItem("fuelpro_custom_fuel_types", JSON.stringify(types));
}

export default function FuelTypesManager() {
  const { user } = useAuth();
  const { currentStation } = useStations();
  const { state } = useFuel();
  const currencySymbol = getCurrencySymbol(state.companyData?.currency);
  const stationId = currentStation?.id;
  const [fuelTypes, setFuelTypes] = useState<CustomFuelType[]>(() => {
    const cloudCached = cloudStorageService.getCached<unknown[]>(
      "fuel_types_config",
      stationId,
    );
    if (Array.isArray(cloudCached))
      return normalizeCustomFuelTypes(cloudCached);
    return loadFuelTypes();
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  // Inner sub-tab: hosts the formerly-standalone Pump Settings, Price Board,
  // and Fuel Quality Testing tabs alongside the fuel-type catalog.
  const [activeView, setActiveView] = useState<
    "fueltypes" | "pumps" | "priceboard" | "quality"
  >("fueltypes");

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formLocalName, setFormLocalName] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formCostPrice, setFormCostPrice] = useState(0);
  const [formTaxRate, setFormTaxRate] = useState(16);
  const [formColor, setFormColor] = useState("red");
  const [formIcon, setFormIcon] = useState("flame");
  const [formPumps, setFormPumps] = useState(1);
  const [formDesc, setFormDesc] = useState("");

  const persist = (types: CustomFuelType[]) => {
    setFuelTypes(types);
    saveFuelTypes(types);
    cloudStorageService
      .set(FUEL_TYPES_CLOUD_KEY, types, stationId)
      .catch(() => {});
    // Broadcast each active fuel's price on the interlink bus so same-page
    // consumers (Dashboard, PriceBoard, POS, Invoice, Reports) update
    // instantly without waiting for the cloud real-time round-trip.
    for (const ft of types) {
      if (!ft.active) continue;
      emitFuelTypeChange({
        id: ft.id,
        fuelType: ft.name,
        canonical: normalizeFuelType(ft.name),
        source: "FuelTypesManager.persist",
      });
      emitFuelPriceChange({
        fuelType: ft.name,
        canonical: normalizeFuelType(ft.name),
        price: ft.price,
        source: "FuelTypesManager.persist",
      });
    }
  };

  // Load from cloud on mount + real-time cross-device sync
  useEffect(() => {
    if (!user) return;
    (async () => {
      const cloudData = await cloudStorageService.get<CustomFuelType[]>(
        FUEL_TYPES_CLOUD_KEY,
        stationId,
      );
      if (cloudData) setFuelTypes(normalizeCustomFuelTypes(cloudData));
    })();
    // Real-time: when another device updates fuel types, update instantly
    const unsubs = [
      cloudStorageService.subscribe<CustomFuelType[]>(
        FUEL_TYPES_CLOUD_KEY,
        stationId,
        (val) => {
          if (val) setFuelTypes(normalizeCustomFuelTypes(val));
        },
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user, stationId]);

  // Interlink receiver: when another tab calls navigateToTab("fueltypes",
  // <FuelPricePrefill>), open the add form pre-filled with the fuel type +
  // price so the user can review and save (which then propagates everywhere
  // via the bus + cloud real-time).
  useEffect(() => {
    return onTabPayload("fueltypes", (raw) => {
      const p = (raw || {}) as FuelPricePrefill;
      if (Object.keys(p).length === 0) return;
      const validViews = [
        "fueltypes",
        "pumps",
        "priceboard",
        "quality",
      ] as const;
      const target =
        p.view && (validViews as readonly string[]).includes(p.view)
          ? (p.view as (typeof validViews)[number])
          : "fueltypes";
      setActiveView(target);
      // Only open the add form when a fuel type / price is actually being
      // pre-filled — a pure "show price board" navigation has no fuelType.
      if (p.fuelType) {
        setFormName(p.fuelType);
        setFormLocalName(p.fuelType);
        const canonical = normalizeFuelType(p.fuelType);
        if (canonical) {
          // Use the canonical code as the form code (PMS/AGO/IK/...).
          const codeMap: Record<string, string> = {
            petrol: "PMS",
            diesel: "AGO",
            kerosene: "IK",
            vpower: "VPW",
            premium_diesel: "PDS",
            lpg: "LPG",
            cng: "CNG",
          };
          setFormCode(codeMap[canonical] || "");
        }
      }
      if (typeof p.price === "number" && p.price > 0) setFormPrice(p.price);
      setShowAddForm(true);
    });
  }, []);

  const resetForm = () => {
    setFormCode("");
    setFormName("");
    setFormLocalName("");
    setFormPrice(0);
    setFormCostPrice(0);
    setFormTaxRate(16);
    setFormColor("red");
    setFormIcon("flame");
    setFormPumps(1);
    setFormDesc("");
  };

  const handleAdd = () => {
    if (!formCode.trim() || !formName.trim()) return;
    const newFuel: CustomFuelType = {
      id: `fuel_${Date.now()}`,
      code: formCode.toUpperCase(),
      name: formName,
      localName: formLocalName || formName,
      price: formPrice,
      costPrice: formCostPrice,
      taxRate: formTaxRate,
      levyRate: 0,
      color: formColor,
      icon: formIcon,
      pumpCount: formPumps,
      active: true,
      description: formDesc,
    };
    persist([...fuelTypes, newFuel]);
    resetForm();
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this fuel type?")) return;
    persist(fuelTypes.filter((f) => f.id !== id));
  };

  const handleToggleActive = (id: string) => {
    persist(
      fuelTypes.map((f) => (f.id === id ? { ...f, active: !f.active } : f)),
    );
  };

  const handleAddPreset = (preset: CustomFuelType) => {
    const exists = fuelTypes.some((f) => f.code === preset.code);
    if (exists) {
      alert(`${preset.name} already exists!`);
      return;
    }
    persist([...fuelTypes, { ...preset, id: `fuel_${Date.now()}` }]);
  };

  const marginPercent = (price: number, cost: number) =>
    cost > 0 ? (((price - cost) / cost) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
          <Fuel size={24} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Fuel Type Manager
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add, edit, and manage all fuel types at your station
          </p>
        </div>
      </div>

      {/* Sub-tab switcher: Fuel Types / Pump Settings / Price Board / Quality */}
      <SubTabBar
        tabs={[
          { id: "fueltypes", label: "Fuel Types", icon: Fuel },
          { id: "pumps", label: "Pump Settings", icon: Gauge },
          { id: "priceboard", label: "Price Board", icon: Monitor },
          { id: "quality", label: "Fuel Quality", icon: FlaskConical },
        ]}
        active={activeView}
        onChange={(id) =>
          setActiveView(id as "fueltypes" | "pumps" | "priceboard" | "quality")
        }
      />

      {activeView === "priceboard" ? (
        <PriceBoard />
      ) : activeView === "quality" ? (
        <FuelQualityTesting />
      ) : activeView === "pumps" ? (
        <PumpSettingsPanel />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {(fuelTypes || []).length}
              </p>
              <p className="text-[10px] text-gray-500">Fuel Types</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {(fuelTypes || []).filter((f) => f.active).length}
              </p>
              <p className="text-[10px] text-gray-500">Active</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {(fuelTypes || []).reduce((s, f) => s + (f.pumpCount || 0), 0)}
              </p>
              <p className="text-[10px] text-gray-500">Total Pumps</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {marginPercent(
                  fuelTypes.find((f) => f.id === "pms")?.price || 0,
                  fuelTypes.find((f) => f.id === "pms")?.costPrice || 0,
                )}
                %
              </p>
              <p className="text-[10px] text-gray-500">PMS Margin</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setShowPresets(false);
              }}
              className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              <Plus size={18} />{" "}
              {showAddForm ? "Cancel" : "Add Custom Fuel Type"}
            </button>
            <button
              onClick={() => {
                setShowPresets(!showPresets);
                setShowAddForm(false);
              }}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              <Fuel size={18} /> {showPresets ? "Hide" : "Add from Presets"}
            </button>
          </div>

          {/* Add Custom Form */}
          {showAddForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-700 p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings size={18} className="text-amber-500" /> Add New Fuel
                Type
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Code *
                  </label>
                  <input
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. V-PWR"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Name *
                  </label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. V-Power"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Local Name
                  </label>
                  <input
                    value={formLocalName}
                    onChange={(e) => setFormLocalName(e.target.value)}
                    placeholder="e.g. V-Power Premium"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Selling Price ({currencySymbol}/L)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) =>
                      setFormPrice(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Cost Price ({currencySymbol}/L)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCostPrice}
                    onChange={(e) =>
                      setFormCostPrice(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    VAT Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formTaxRate}
                    onChange={(e) =>
                      setFormTaxRate(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Number of Pumps
                  </label>
                  <input
                    type="number"
                    value={formPumps}
                    onChange={(e) =>
                      setFormPumps(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFormColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${c === formColor ? "border-gray-900 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                />
              </div>
              <button
                onClick={handleAdd}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Save size={18} /> Save Fuel Type
              </button>
            </div>
          )}

          {/* Presets */}
          {showPresets && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-3">
                Quick Add Preset Fuel Types
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_FUELS.map((preset) => {
                  const exists = fuelTypes.some((f) => f.code === preset.code);
                  return (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Fuel size={14} className="text-blue-500" />
                        <div>
                          <p className="text-xs font-medium text-gray-900 dark:text-white">
                            {preset.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {preset.code} | {currencySymbol}{" "}
                            {preset.price.toFixed(2)}/L
                          </p>
                        </div>
                      </div>
                      {exists ? (
                        <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-full">
                          Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddPreset(preset)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium rounded-lg flex items-center gap-1"
                        >
                          <Plus size={12} /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fuel Types List */}
          <div className="space-y-3">
            {(fuelTypes || []).map((ft) => {
              const isExpanded = expandedId === ft.id;
              const colorClass = FUEL_COLORS[ft.color || ""] || FUEL_COLORS.red;
              return (
                <div
                  key={ft.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden transition-all ${ft.active ? "border-gray-200 dark:border-gray-700" : "border-gray-100 dark:border-gray-800 opacity-60"}`}
                >
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    onClick={() => setExpandedId(isExpanded ? null : ft.id)}
                  >
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Fuel size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {ft.name || ""}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 rounded-full">
                          {ft.code || ""}
                        </span>
                        {!ft.active && (
                          <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {ft.localName || ""} | {currencySymbol}{" "}
                        {(ft.price || 0).toFixed(2)}/L | {ft.pumpCount || 0}{" "}
                        pump{(ft.pumpCount || 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(ft.id);
                        }}
                        className={`text-[10px] px-2 py-1 rounded-lg ${ft.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {ft.active ? "Active" : "Inactive"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ft.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <InfoBox
                          label="Selling Price"
                          value={`${currencySymbol} ${(ft.price || 0).toFixed(2)}`}
                        />
                        <InfoBox
                          label="Cost Price"
                          value={`${currencySymbol} ${(ft.costPrice || 0).toFixed(2)}`}
                        />
                        <InfoBox
                          label="Margin"
                          value={`${marginPercent(ft.price || 0, ft.costPrice || 0)}%`}
                        />
                        <InfoBox
                          label="VAT Rate"
                          value={`${ft.taxRate || 0}%`}
                        />
                        <InfoBox label="Pumps" value={`${ft.pumpCount || 0}`} />
                        <InfoBox
                          label="Levy Rate"
                          value={`${ft.levyRate || 0}%`}
                        />
                      </div>
                      {ft.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          {ft.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// PumpSettingsPanel — formerly the "Pump Settings" sub-tab of the
// Data Management Center. Moved here (task 6) so all fuel/pump
// configuration lives under the Fuel Type Manager. Self-contained: it
// reads pump prices/counts from FuelContext and writes back via dispatch.
// ============================================================
function PumpSettingsPanel() {
  const { state, dispatch, syncPriceToFuelTypes } = useFuel();
  const { hasPermission, isOwner } = usePermissions();
  const stationId = state.currentStationId ?? undefined;
  const fuelTypeApi = useStationFuelTypes(stationId);
  // Resolve the detected country's own petrol/diesel prices so a non-Kenya
  // station never falls back to Kenyan KSh prices when FuelContext has none.
  const detectedCountry = (() => {
    try {
      return getDetectedCountryCode();
    } catch {
      return "";
    }
  })();
  const detectedPetrol =
    detectedCountry && getCountryPrice(detectedCountry, "petrol").price;
  const detectedDiesel =
    detectedCountry && getCountryPrice(detectedCountry, "diesel").price;
  const currencySymbol = getCurrencySymbol();

  // ---- Dynamic per-fuel-type price + pump-count state ----
  // Build a list of EVERY active fuel type the station sells (petrol, diesel,
  // kerosene, LPG, V-Power, etc.) so the panel is no longer limited to only
  // PMS & AGO. Each fuel gets its own price input + pump count.
  const activeFuelTypes = fuelTypeApi.activeFuelTypes;
  const fuelRows = activeFuelTypes.map((ft) => {
    const canonical = fuelTypeApi.canonicalOf(ft.name) || "petrol";
    const label = fuelTypeApi.labelOf(ft.name);
    let defaultPrice = ft.price || 0;
    if (canonical === "petrol")
      defaultPrice = defaultPrice || state.pmsPrice || detectedPetrol || 0;
    else if (canonical === "diesel")
      defaultPrice = defaultPrice || state.agoPrice || detectedDiesel || 0;
    let defaultCount = ft.pumpCount || 0;
    if (canonical === "petrol")
      defaultCount = defaultCount || state.pmsPumps?.length || 1;
    else if (canonical === "diesel")
      defaultCount = defaultCount || state.agoPumps?.length || 1;
    defaultCount =
      defaultCount || state.fuelPumpsByType?.[canonical]?.length || 0 || 1;
    return { ft, canonical, label, defaultPrice, defaultCount };
  });

  // Local state: price + count per fuel row key (ft.id || canonical).
  const [priceByRow, setPriceByRow] = useState<Record<string, number>>({});
  const [countByRow, setCountByRow] = useState<Record<string, number>>({});
  // Initialize from defaults on first render / when fuel list changes.
  useEffect(() => {
    const prices: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const r of fuelRows) {
      const key = r.ft.id || r.canonical;
      prices[key] = r.defaultPrice;
      counts[key] = r.defaultCount;
    }
    setPriceByRow(prices);
    setCountByRow(counts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFuelTypes.length, state.pmsPrice, state.agoPrice]);

  // Fallback rows when the station has NO configured fuel types yet (legacy
  // stations / first run) so the panel is never empty.
  const rows =
    fuelRows.length > 0
      ? fuelRows
      : [
          {
            ft: {
              id: "petrol",
              name: "Super Petrol",
              code: "PMS",
              price: 0,
              pumpCount: 0,
            } as any,
            canonical: "petrol" as const,
            label: "Super Petrol",
            defaultPrice: state.pmsPrice || detectedPetrol || 0,
            defaultCount: state.pmsPumps?.length || 1,
          },
          {
            ft: {
              id: "diesel",
              name: "Diesel",
              code: "AGO",
              price: 0,
              pumpCount: 0,
            } as any,
            canonical: "diesel" as const,
            label: "Diesel",
            defaultPrice: state.agoPrice || detectedDiesel || 0,
            defaultCount: state.agoPumps?.length || 1,
          },
        ];

  return (
    <div className="space-y-6">
      {!isOwner && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            You have <strong>Member</strong> access. Changes are tracked. Some
            settings require Founder approval.
          </p>
        </div>
      )}

      {/* Fuel Prices — dynamic per fuel type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <DollarSign size={18} className="text-green-500" />
          Pump Prices (per Litre)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rows.map((r) => {
            const key = r.ft.id || r.canonical;
            const val = priceByRow[key] ?? r.defaultPrice ?? 0;
            return (
              <div
                key={key}
                className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">
                  {r.label}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={val}
                    onChange={(e) =>
                      setPriceByRow((prev) => ({
                        ...prev,
                        [key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => {
            // Dispatch prices for all fuel types. Petrol/Diesel use the legacy
            // SET_PRICES (so the whole site picks them up); others use the
            // dynamic fuelPricesByType store + the interlink bus.
            let newPmsPrice = state.pmsPrice;
            let newAgoPrice = state.agoPrice;
            const extraPrices: Record<string, number> = {};
            for (const r of rows) {
              const key = r.ft.id || r.canonical;
              const price = priceByRow[key] ?? r.defaultPrice ?? 0;
              if (r.canonical === "petrol") newPmsPrice = price;
              else if (r.canonical === "diesel") newAgoPrice = price;
              else extraPrices[r.canonical] = price;
            }
            dispatch({
              type: "SET_PRICES",
              payload: { pmsPrice: newPmsPrice, agoPrice: newAgoPrice },
            });
            if (Object.keys(extraPrices).length > 0) {
              dispatch({
                type: "SET_FUEL_PRICES_BY_TYPE",
                payload: { ...state.fuelPricesByType, ...extraPrices },
              });
              for (const [type, price] of Object.entries(extraPrices)) {
                syncPriceToFuelTypes(
                  getFuelLabel(type as CanonicalFuelType),
                  price,
                );
              }
            }
            // Sync petrol/diesel via the interlink bus too.
            syncPriceToFuelTypes("Super Petrol", newPmsPrice);
            syncPriceToFuelTypes("Diesel", newAgoPrice);
            alert(
              `Pump prices updated:\n` +
                rows
                  .map(
                    (r) =>
                      `${r.label}: ${currencySymbol} ${(priceByRow[r.ft.id || r.canonical] ?? r.defaultPrice ?? 0).toFixed(2)}`,
                  )
                  .join("\n"),
            );
          }}
          className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Save size={14} /> Save Prices
        </button>
      </div>

      {/* Pump Count — dynamic per fuel type */}
      {hasPermission("canChangePumpCount") && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Fuel size={18} className="text-blue-500" />
            Number of Pumps
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rows.map((r) => {
              const key = r.ft.id || r.canonical;
              const val = countByRow[key] ?? r.defaultCount ?? 1;
              return (
                <div
                  key={key}
                  className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">
                    {r.label} Pumps
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCountByRow((prev) => ({
                          ...prev,
                          [key]: Math.max(
                            0,
                            (prev[key] ?? r.defaultCount ?? 1) - 1,
                          ),
                        }))
                      }
                      className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white w-12 text-center">
                      {val}
                    </span>
                    <button
                      onClick={() =>
                        setCountByRow((prev) => ({
                          ...prev,
                          [key]: (prev[key] ?? r.defaultCount ?? 1) + 1,
                        }))
                      }
                      className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              const makePump = (id: string, name: string) => ({
                id,
                name,
                openingKsh: 0,
                closingKsh: 0,
                openingL: 0,
                closingL: 0,
                salesL: 0,
                salesKsh: 0,
              });
              let newPmsPumps = state.pmsPumps;
              let newAgoPumps = state.agoPumps;
              const extraPumps: Record<string, Pump[]> = {};
              const summary: string[] = [];
              for (const r of rows) {
                const key = r.ft.id || r.canonical;
                const count = countByRow[key] ?? r.defaultCount ?? 0;
                summary.push(`${r.label}: ${count} pumps`);
                if (r.canonical === "petrol") {
                  newPmsPumps = Array.from(
                    { length: count },
                    (_, i) =>
                      state.pmsPumps[i] ||
                      makePump(`pms-${i + 1}`, `PMS Pump ${i + 1}`),
                  );
                } else if (r.canonical === "diesel") {
                  newAgoPumps = Array.from(
                    { length: count },
                    (_, i) =>
                      state.agoPumps[i] ||
                      makePump(`ago-${i + 1}`, `AGO Pump ${i + 1}`),
                  );
                } else {
                  const code = r.ft.code || r.canonical;
                  extraPumps[r.canonical] = Array.from(
                    { length: count },
                    (_, i) =>
                      (state.fuelPumpsByType?.[r.canonical]?.[i] as Pump) ||
                      makePump(`${code}-${i + 1}`, `${r.label} Pump ${i + 1}`),
                  );
                }
              }
              dispatch({ type: "SET_PMS_PUMPS", payload: newPmsPumps });
              dispatch({ type: "SET_AGO_PUMPS", payload: newAgoPumps });
              if (Object.keys(extraPumps).length > 0) {
                dispatch({
                  type: "SET_FUEL_PUMPS_BY_TYPE",
                  payload: { ...state.fuelPumpsByType, ...extraPumps },
                });
              }
              alert(`Pump count updated:\n${summary.join("\n")}`);
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Save size={14} /> Save Pump Count
          </button>
        </div>
      )}

      {/* Access Level */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Lock size={18} className="text-gray-500" />
          Your Access Level
        </h3>
        <div className="space-y-2">
          {[
            {
              label: "Edit Pump Prices",
              allowed: hasPermission("canEditFuelPrices"),
            },
            {
              label: "Change Pump Count",
              allowed: hasPermission("canChangePumpCount"),
            },
            {
              label: "Edit Fuel Prices",
              allowed: hasPermission("canEditFuelPrices"),
            },
            {
              label: "Manage Inventory",
              allowed: hasPermission("canManageInventory"),
            },
            { label: "Founder Access", allowed: isOwner },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <span className="text-xs text-gray-700 dark:text-gray-300">
                {item.label}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  item.allowed
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {item.allowed ? "Allowed" : "Restricted"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
