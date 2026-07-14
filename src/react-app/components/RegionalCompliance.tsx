import { useState } from "react";
import {
  Globe,
  Shield,
  Receipt,
  Fuel,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Building,
  Landmark,
  Calendar,
  Scale,
  ChevronDown,
} from "lucide-react";
import { getRegionalConfig, getAllCountries } from "@/react-app/config/regions";
import type { RegionalConfig } from "@/react-app/config/regions";
import SearchableCountryDropdown from "@/react-app/components/SearchableCountryDropdown";

export default function RegionalCompliance() {
  const [selectedCountryKey, setSelectedCountryKey] = useState("kenya");
  const [selectedCountryCode, setSelectedCountryCode] = useState("KE");
  const [expandedSection, setExpandedSection] = useState<string | null>("tax");

  const config = getRegionalConfig(selectedCountryKey);
  const countries = getAllCountries();

  // Convert country code (from dropdown) to config key
  const handleCountryChange = (code: string) => {
    setSelectedCountryCode(code);
    // Map code to key (country code lowercase)
    const lower = code.toLowerCase();
    const byKey = countries.find(c => c.key === lower);
    if (byKey) {
      setSelectedCountryKey(byKey.key);
      return;
    }
    // Fallback: try to get config and use returned country code
    try {
      const cfg = getRegionalConfig(code);
      if (cfg) {
        setSelectedCountryKey(code.toLowerCase());
        return;
      }
    } catch {
      /* */
    }
    setSelectedCountryKey(lower);
  };

  const sections = [
    { id: "tax", label: "Tax & Compliance", icon: Shield },
    { id: "fuel", label: "Fuel Regulation", icon: Fuel },
    { id: "permits", label: "Required Permits", icon: FileCheck },
    { id: "receipts", label: "Receipt Requirements", icon: Receipt },
    { id: "features", label: "Compliance Features", icon: CheckCircle2 },
    { id: "payments", label: "Payment Methods", icon: Landmark },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <Globe size={24} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Regional Compliance
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Country-specific regulations, permits, and compliance requirements
          </p>
        </div>
      </div>

      {/* Country Selector — searchable dropdown for all 250+ countries */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="w-full max-w-md">
          <SearchableCountryDropdown
            value={selectedCountryCode}
            onChange={handleCountryChange}
          />
        </div>
      </div>

      {/* Country Overview Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <OverviewItem icon={Globe} label="Country" value={config.country} />
          <OverviewItem
            icon={Receipt}
            label="VAT Rate"
            value={`${config.vatRate}% ${config.vatName}`}
          />
          <OverviewItem
            icon={Shield}
            label="Tax Authority"
            value={config.taxAuthorityShort}
          />
          <OverviewItem
            icon={Fuel}
            label="Fuel Regulator"
            value={config.fuelRegulatorShort}
          />
          <OverviewItem
            icon={Building}
            label="Currency"
            value={`${config.currencySymbol} ${config.currency}`}
          />
          <OverviewItem
            icon={Calendar}
            label="Reporting"
            value={config.reportingFrequency}
          />
          <OverviewItem
            icon={Scale}
            label={config.hasETR ? "ETR Required" : "No ETR"}
            value={config.hasETR ? config.etrName : "Standard Invoice"}
          />
          <OverviewItem
            icon={FileCheck}
            label="Permits Required"
            value={`${config.requiredPermits.length}`}
          />
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="space-y-3">
        {sections.map(section => {
          const isExpanded = expandedSection === section.id;
          const SectionIcon = section.icon;
          return (
            <div
              key={section.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedSection(isExpanded ? null : section.id)
                }
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
              >
                <SectionIcon size={18} className="text-blue-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1 text-left">
                  {section.label}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 p-4">
                  {section.id === "tax" && <TaxSection config={config} />}
                  {section.id === "fuel" && <FuelSection config={config} />}
                  {section.id === "permits" && (
                    <PermitsSection config={config} />
                  )}
                  {section.id === "receipts" && (
                    <ReceiptsSection config={config} />
                  )}
                  {section.id === "features" && (
                    <FeaturesSection config={config} />
                  )}
                  {section.id === "payments" && (
                    <PaymentsSection config={config} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ETR Info Banner */}
      {config.hasETR && (
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={18}
              className="text-amber-500 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {config.etrName} Required
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                All fuel sales in {config.country} must be invoiced through the{" "}
                {config.taxAuthorityShort} registered
                {config.etrName} system. Format: {config.etrFormat}. Ensure your
                ETR device is connected via the Integration Hub.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewItem({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className="text-blue-400" />
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function TaxSection({ config }: { config: RegionalConfig }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard
          title="Tax Authority"
          value={config.taxAuthority}
          desc={`Short: ${config.taxAuthorityShort}`}
        />
        <InfoCard
          title="VAT Rate"
          value={`${config.vatRate}%`}
          desc={config.vatName}
        />
        <InfoCard
          title="Reporting Frequency"
          value={config.reportingFrequency}
          desc="VAT returns due"
        />
        <InfoCard
          title="Date Format"
          value={config.dateFormat}
          desc={`Timezone: ${config.timeZone}`}
        />
      </div>
      {config.hasETR && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
            {config.etrName}
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400">
            Format: {config.etrFormat}
          </p>
        </div>
      )}
    </div>
  );
}

function FuelSection({ config }: { config: RegionalConfig }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Regulated by: <strong>{config.fuelRegulator}</strong>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {config.fuelTypes.map(ft => (
          <div
            key={ft.code}
            className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {ft.localName}
              </p>
              <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {ft.code}
              </span>
            </div>
            <p className="text-xs text-gray-500">{ft.name}</p>
            {ft.taxRate > 0 && (
              <p className="text-xs text-amber-600 mt-1">Tax: {ft.taxRate}%</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PermitsSection({ config }: { config: RegionalConfig }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-2">
        {config.requiredPermits.length} permits/licenses required to operate:
      </p>
      {config.requiredPermits.map((permit, i) => (
        <div
          key={i}
          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
        >
          <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {permit}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReceiptsSection({ config }: { config: RegionalConfig }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-2">
        Every receipt/invoice must include:
      </p>
      {config.receiptRequirements.map((req, i) => (
        <div
          key={i}
          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
        >
          <Receipt size={14} className="text-blue-500 flex-shrink-0" />
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {req}
          </span>
        </div>
      ))}
    </div>
  );
}

function FeaturesSection({ config }: { config: RegionalConfig }) {
  return (
    <div className="space-y-2">
      {config.complianceFeatures.map(f => (
        <div
          key={f.id}
          className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
        >
          <div
            className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${f.required ? "bg-red-500" : "bg-gray-400"}`}
          />
          <div>
            <p className="text-xs font-medium text-gray-900 dark:text-white">
              {f.name}
              {f.required && (
                <span className="ml-2 text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                  Required
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">{f.description}</p>
            <span className="text-[10px] text-gray-400">{f.category}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentsSection({ config }: { config: RegionalConfig }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {config.paymentMethods.map(pm => (
          <div
            key={pm.id}
            className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {pm.name}
              </p>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  pm.type === "mobile"
                    ? "bg-green-100 text-green-700"
                    : pm.type === "card"
                      ? "bg-blue-100 text-blue-700"
                      : pm.type === "bank"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                }`}
              >
                {pm.type}
              </span>
            </div>
            {pm.provider && (
              <p className="text-xs text-gray-500">{pm.provider}</p>
            )}
            {pm.chargeRate > 0 && (
              <p className="text-xs text-amber-600">Fee: {pm.chargeRate}%</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
          Supported Banks
        </p>
        <div className="flex flex-wrap gap-2 mt-1">
          {config.bankSupport.map(b => (
            <span
              key={b.code}
              className="text-[10px] px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
            >
              {b.name}{" "}
              {b.supportsApi && <span className="text-green-500">API</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  value,
  desc,
}: {
  title: string;
  value: string;
  desc?: string;
}) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
        {title}
      </p>
      <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
      {desc && <p className="text-[10px] text-gray-400">{desc}</p>}
    </div>
  );
}
