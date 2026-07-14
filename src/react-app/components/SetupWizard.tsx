import React, { useState } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Fuel,
  Gauge,
  DollarSign,
  FileCheck,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Plus,
  Minus,
} from "lucide-react";
import { useFuel } from "../context/FuelContext";
import { useStations } from "../context/StationContext";

const DEFAULT_CURRENCY = "KSh ";

interface WizardData {
  // Step 1: Station Info
  stationName: string;
  location: string;
  contacts: string;
  email: string;
  // Step 2: Tanks
  pmsTankCapacity: number;
  agoTankCapacity: number;
  pmsTankOpening: number;
  agoTankOpening: number;
  // Step 3: Pumps
  pmsCount: number;
  agoCount: number;
  // Step 4: Pricing
  pmsPrice: number;
  agoPrice: number;
  // Step 5: KRA (optional)
  kraPin: string;
  vatRegNo: string;
  physicalAddress: string;
  etrSerialNo: string;
}

const STEPS = [
  { id: 1, title: "Station Info", icon: Building2 },
  { id: 2, title: "Fuel Tanks", icon: Fuel },
  { id: 3, title: "Pumps", icon: Gauge },
  { id: 4, title: "Pricing", icon: DollarSign },
  { id: 5, title: "KRA Setup", icon: FileCheck },
];

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { state, dispatch } = useFuel();
  const { createStation, switchStation } = useStations();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    stationName: "",
    location: "Auto-detected",
    contacts: "",
    email: "",
    pmsTankCapacity: 20000,
    agoTankCapacity: 20000,
    pmsTankOpening: 0,
    agoTankOpening: 0,
    pmsCount: 2,
    agoCount: 2,
    pmsPrice: 220.3, // EPRA Lodwar Super Petrol price (AI confirmed May 2026)
    agoPrice: 250.01, // EPRA Lodwar Diesel price (AI confirmed May 2026)
    kraPin: "",
    vatRegNo: "",
    physicalAddress: "Auto-detected location",
    etrSerialNo: "",
  });

  const updateField = (field: keyof WizardData, value: string | number) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.stationName.trim() !== "";
      case 2:
        return data.pmsTankCapacity > 0 || data.agoTankCapacity > 0;
      case 3:
        return data.pmsCount > 0 || data.agoCount > 0;
      case 4:
        return data.pmsPrice > 0 || data.agoPrice > 0;
      case 5:
        return true; // KRA is optional
      default:
        return true;
    }
  };

  const handleComplete = () => {
    // Create pumps based on count
    const pmsPumps = Array.from({ length: data.pmsCount }, (_, i) => ({
      id: `pms-${i + 1}`,
      openingKsh: 0,
      closingKsh: 0,
      openingL: 0,
      closingL: 0,
      salesL: 0,
      salesKsh: 0,
    }));

    const agoPumps = Array.from({ length: data.agoCount }, (_, i) => ({
      id: `ago-${i + 1}`,
      openingKsh: 0,
      closingKsh: 0,
      openingL: 0,
      closingL: 0,
      salesL: 0,
      salesKsh: 0,
    }));

    // Update company data
    dispatch({
      type: "SET_COMPANY_DATA",
      payload: {
        ...state.companyData,
        name: data.stationName,
        contacts: data.contacts,
        email: data.email,
        kraPin: data.kraPin,
        vatRegNo: data.vatRegNo,
        physicalAddress: data.physicalAddress || data.location,
        etrSerialNo: data.etrSerialNo,
      },
    });

    // Update pumps
    dispatch({ type: "SET_PMS_PUMPS", payload: pmsPumps });
    dispatch({ type: "SET_AGO_PUMPS", payload: agoPumps });

    // Update tank levels
    dispatch({
      type: "SET_TANK_VALUES",
      payload: {
        pmsTankOpening: data.pmsTankOpening,
        agoTankOpening: data.agoTankOpening,
        pmsTankClosing: data.pmsTankOpening,
        agoTankClosing: data.agoTankOpening,
      },
    });

    // Update prices
    dispatch({
      type: "SET_PRICES",
      payload: {
        pmsPrice: data.pmsPrice,
        agoPrice: data.agoPrice,
      },
    });

    // Mark setup as complete
    localStorage.setItem("fuelpro_setup_complete", "true");

    // Create the station in StationContext so it's registered and loaded
    let newStationId = "";
    try {
      const newStation = createStation({
        name: data.stationName || "My Fuel Station",
        location: data.location || "Auto-detected",
        description: `PMS: ${data.pmsCount || 0} pumps, AGO: ${data.agoCount || 0} pumps`,
      });
      if (newStation && newStation.id) {
        newStationId = newStation.id;
        // Switch to the new station immediately
        switchStation(newStation.id);
      }
    } catch (err) {
      console.error("Station creation failed:", err);
    }

    // Also write directly to localStorage as fallback
    // This ensures the station is available even if state hasn't propagated
    try {
      const fallbackStation = {
        id: newStationId || `st_${Date.now()}`,
        name: data.stationName || "My Fuel Station",
        location: data.location || "Auto-detected",
        description: `PMS: ${data.pmsCount || 0} pumps, AGO: ${data.agoCount || 0} pumps`,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fuelTypes: ["PMS", "AGO"],
        pumpCount: (data.pmsCount || 0) + (data.agoCount || 0),
        tankCount: 2,
        managerName: "",
        operatingHours: "24/7",
        kraPin: data.kraPin || "",
        phone: data.contacts || "",
        email: data.email || "",
        data: {},
        theme: "dark",
        logo: "",
        licenseNumber: "",
        city: "",
        countryCode: "KE",
        timezone: "Africa/Nairobi",
        coordinates: null,
        managerPhone: "",
        etrSerial: "",
        taxRate: 16,
        access: [
          {
            username: (data.stationName || "station")
              .toLowerCase()
              .replace(/\s+/g, "_"),
            passwordHash: "",
            role: "owner" as const,
            permissions: ["all"],
            grantedAt: new Date().toISOString(),
            grantedBy: "system",
          },
        ],
        sharedUsers: [],
      };

      // Read existing stations
      const existingData = localStorage.getItem("fuelpro_stations_v3");
      let existing = existingData
        ? JSON.parse(existingData)
        : { stations: [], version: "3.0" };

      // Add new station if not exists
      if (!existing.stations.some((s: any) => s.id === fallbackStation.id)) {
        existing.stations = [...(existing.stations || []), fallbackStation];
        localStorage.setItem("fuelpro_stations_v3", JSON.stringify(existing));
      }

      // Set current station
      localStorage.setItem("fuelpro_current_station_v3", fallbackStation.id);
      newStationId = fallbackStation.id;
    } catch (e) {
      console.error("Fallback station save failed:", e);
    }

    // Save wizard data to station-specific storage
    // Use detected location as fallback instead of hardcoded text
    const detectedLocation = (() => {
      try {
        const saved = localStorage.getItem("fuelpro_location_country");
        if (saved) {
          const p = JSON.parse(saved);
          return p.address || p.city || p.countryName;
        }
      } catch {
        /* */
      }
      return null;
    })();
    localStorage.setItem(
      `fuelpro_station_${newStationId || "default"}_name`,
      data.stationName || "My Fuel Station"
    );
    localStorage.setItem(
      `fuelpro_station_${newStationId || "default"}_location`,
      data.location || detectedLocation || "Main Station Location"
    );

    // Mark setup complete and signal completion
    // Home.tsx will handle the reload
    onComplete();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <StationInfoStep data={data} updateField={updateField} />;
      case 2:
        return <TanksStep data={data} updateField={updateField} />;
      case 3:
        return <PumpsStep data={data} updateField={updateField} />;
      case 4:
        return <PricingStep data={data} updateField={updateField} />;
      case 5:
        return <KRAStep data={data} updateField={updateField} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mb-4 shadow-lg">
            <Fuel className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to FuelPro
          </h1>
          <p className="text-blue-200">
            Let's set up your fuel station in a few easy steps
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all
                    ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isActive
                          ? "bg-amber-500 text-white ring-4 ring-amber-500/30"
                          : "bg-slate-700 text-slate-400"
                    }
                  `}
                  >
                    {isCompleted ? <Check size={18} /> : <StepIcon size={18} />}
                  </div>
                  <span
                    className={`text-xs mt-1 hidden md:block ${isActive ? "text-amber-400" : "text-slate-500"}`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 ${isCompleted ? "bg-green-500" : "bg-slate-700"}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
            {STEPS[currentStep - 1].title}
          </h2>

          {renderStepContent()}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} />
              Back
            </button>

            {currentStep < 5 ? (
              <button
                onClick={() => setCurrentStep(s => s + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/30"
              >
                Continue
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-green-500/30"
              >
                <Sparkles size={18} />
                Complete Setup
              </button>
            )}
          </div>
        </div>

        {/* Skip option */}
        {currentStep === 1 && (
          <button
            onClick={() => {
              localStorage.setItem("fuelpro_setup_complete", "true");
              onComplete();
            }}
            className="w-full mt-4 text-center text-sm text-slate-400 hover:text-white transition-colors"
          >
            Skip setup and configure later
          </button>
        )}
      </div>
    </div>
  );
}

// Step Components
interface StepProps {
  data: WizardData;
  updateField: (field: keyof WizardData, value: string | number) => void;
}

function StationInfoStep({ data, updateField }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Station Name *
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={data.stationName}
            onChange={e => updateField("stationName", e.target.value)}
            placeholder="e.g., Sunrise Petrol Station"
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Location
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={data.location}
            onChange={e => updateField("location", e.target.value)}
            placeholder="e.g., Mombasa Road, Nairobi"
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="tel"
              value={data.contacts}
              onChange={e => updateField("contacts", e.target.value)}
              placeholder="e.g., 0712 345 678"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="email"
              value={data.email}
              onChange={e => updateField("email", e.target.value)}
              placeholder="e.g., info@station.co.ke"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TanksStep({ data, updateField }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Configure your fuel storage tanks. You can adjust capacities and current
        stock levels.
      </p>

      {/* PMS Tank */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <h3 className="font-semibold text-green-800 dark:text-green-300">
            PMS (Petrol) Tank
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-green-700 dark:text-green-400 mb-1">
              Capacity (Litres)
            </label>
            <input
              type="number"
              value={data.pmsTankCapacity}
              onChange={e =>
                updateField("pmsTankCapacity", Number(e.target.value))
              }
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-green-700 dark:text-green-400 mb-1">
              Current Stock (Litres)
            </label>
            <input
              type="number"
              value={data.pmsTankOpening}
              onChange={e =>
                updateField("pmsTankOpening", Number(e.target.value))
              }
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* AGO Tank */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            AGO (Diesel) Tank
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-amber-700 dark:text-amber-400 mb-1">
              Capacity (Litres)
            </label>
            <input
              type="number"
              value={data.agoTankCapacity}
              onChange={e =>
                updateField("agoTankCapacity", Number(e.target.value))
              }
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-amber-700 dark:text-amber-400 mb-1">
              Current Stock (Litres)
            </label>
            <input
              type="number"
              value={data.agoTankOpening}
              onChange={e =>
                updateField("agoTankOpening", Number(e.target.value))
              }
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PumpsStep({ data, updateField }: StepProps) {
  const PumpCounter = ({
    label,
    value,
    onChange,
    color,
  }: {
    label: string;
    value: number;
    onChange: (n: number) => void;
    color: string;
  }) => (
    <div className={`p-5 rounded-xl border ${color}`}>
      <h3 className="font-medium mb-4">{label}</h3>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center justify-center transition-colors"
        >
          <Minus size={18} />
        </button>
        <span className="text-4xl font-bold w-16 text-center">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center justify-center transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
        {value === 1 ? "1 pump" : `${value} pumps`}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How many dispensing pumps does your station have for each fuel type?
      </p>

      <div className="grid grid-cols-2 gap-4">
        <PumpCounter
          label="PMS Pumps"
          value={data.pmsCount}
          onChange={n => updateField("pmsCount", n)}
          color="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
        />
        <PumpCounter
          label="AGO Pumps"
          value={data.agoCount}
          onChange={n => updateField("agoCount", n)}
          color="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
        />
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          You can add more pumps or rename them later from the Sales Tracking
          section.
        </p>
      </div>
    </div>
  );
}

function PricingStep({ data, updateField }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Set your current fuel prices. These are used for sales calculations and
        receipts.
      </p>

      <div className="grid grid-cols-2 gap-6">
        {/* PMS Price */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-green-800 dark:text-green-300">
              PMS (Petrol)
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-green-600">
              {DEFAULT_CURRENCY}
            </span>
            <input
              type="number"
              value={data.pmsPrice}
              onChange={e => updateField("pmsPrice", Number(e.target.value))}
              className="w-full pl-14 pr-4 py-4 text-2xl font-bold bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-slate-900 dark:text-white text-center"
            />
          </div>
          <p className="text-xs text-center text-green-600 dark:text-green-400 mt-2">
            per litre
          </p>
        </div>

        {/* AGO Price */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              AGO (Diesel)
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-amber-600">
              {DEFAULT_CURRENCY}
            </span>
            <input
              type="number"
              value={data.agoPrice}
              onChange={e => updateField("agoPrice", Number(e.target.value))}
              className="w-full pl-14 pr-4 py-4 text-2xl font-bold bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white text-center"
            />
          </div>
          <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-2">
            per litre
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Prices can be updated anytime from the Sales Tracking or Point of Sale
          tabs
        </p>
      </div>
    </div>
  );
}

function KRAStep({ data, updateField }: StepProps) {
  return (
    <div className="space-y-5">
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 mb-6">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          This section is optional. You can configure KRA eTIMS compliance later
          from Settings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            KRA PIN
          </label>
          <input
            type="text"
            value={data.kraPin}
            onChange={e => updateField("kraPin", e.target.value.toUpperCase())}
            placeholder="e.g., P001234567X"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            VAT Registration No.
          </label>
          <input
            type="text"
            value={data.vatRegNo}
            onChange={e => updateField("vatRegNo", e.target.value)}
            placeholder="Optional"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Physical Address
        </label>
        <input
          type="text"
          value={data.physicalAddress}
          onChange={e => updateField("physicalAddress", e.target.value)}
          placeholder="e.g., Plot 123, Mombasa Road, Nairobi"
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          ETR Serial Number
        </label>
        <input
          type="text"
          value={data.etrSerialNo}
          onChange={e => updateField("etrSerialNo", e.target.value)}
          placeholder="Optional - from your ETR device"
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
        />
      </div>

      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mt-6">
        <p className="text-sm text-green-700 dark:text-green-300">
          You're almost done! Click "Complete Setup" to start using FuelPro.
        </p>
      </div>
    </div>
  );
}
