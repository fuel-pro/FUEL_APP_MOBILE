import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  REGIONAL_CONFIGS,
  getRegionalConfig,
} from "@/react-app/config/regions";

// ============================================================
// LOCALIZATION CONTEXT
// Full country localization: currency, dates, numbers, language
// ============================================================

export interface LocalizationConfig {
  country: string;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  language: string;
  dateFormat: string;
  timeZone: string;
  decimalSeparator: string;
  thousandSeparator: string;
  phoneCode: string;
  unitVolume: string;
  unitDistance: string;
  unitTemperature: string;
  vatName: string;
  vatRate: number;
}

const COUNTRY_KEY_MAP: Record<string, string> = {
  kenya: "kenya",
  uganda: "uganda",
  tanzania: "tanzania",
  nigeria: "nigeria",
  southafrica: "southafrica",
  ghana: "ghana",
  rwanda: "rwanda",
  ethiopia: "ethiopia",
};

function resolveCountryKey(): string {
  try {
    const saved = localStorage.getItem("fuelpro_location_country");
    if (saved) {
      const parsed = JSON.parse(saved);
      const key = (parsed.currentCountry || parsed.country || "kenya")
        .toLowerCase()
        .replace(/\s+/g, "");
      if (COUNTRY_KEY_MAP[key]) return COUNTRY_KEY_MAP[key];
    }
  } catch {}
  return "kenya";
}

function buildLocalization(countryKey: string): LocalizationConfig {
  const config = getRegionalConfig(countryKey);
  return {
    country: config.country,
    countryCode: config.countryCode,
    currency: config.currency,
    currencySymbol: config.currencySymbol,
    language: config.languages[0] || "English",
    dateFormat: config.dateFormat,
    timeZone: config.timeZone,
    decimalSeparator: config.decimalSeparator,
    thousandSeparator: config.thousandSeparator,
    phoneCode: config.phoneCode,
    unitVolume: config.units.volume,
    unitDistance: config.units.distance,
    unitTemperature: config.units.temperature,
    vatName: config.vatName,
    vatRate: config.vatRate,
  };
}

interface LocalizationContextType {
  config: LocalizationConfig;
  countryKey: string;
  refresh: () => void;
  // Format helpers
  formatCurrency: (amount: number, decimals?: number) => string;
  formatNumber: (value: number, decimals?: number) => string;
  formatDate: (date: string | Date) => string;
  formatTime: (date: string | Date) => string;
  formatPhone: (phone: string) => string;
  formatVolume: (value: number) => string;
}

const LocalizationContext = createContext<LocalizationContextType>({
  config: buildLocalization("kenya"),
  countryKey: "kenya",
  refresh: () => {},
  formatCurrency: a => `Ksh ${a.toFixed(2)}`,
  formatNumber: n => n.toLocaleString(),
  formatDate: d => String(d),
  formatTime: d => String(d),
  formatPhone: p => p,
  formatVolume: v => `${v} L`,
});

export function LocalizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [countryKey, setCountryKey] = useState<string>(resolveCountryKey);
  const [config, setConfig] = useState<LocalizationConfig>(
    buildLocalization(resolveCountryKey())
  );

  const refresh = useCallback(() => {
    const key = resolveCountryKey();
    setCountryKey(key);
    setConfig(buildLocalization(key));
  }, []);

  // Auto-refresh every 5 seconds to catch country changes
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const formatCurrency = useCallback(
    (amount: number, decimals = 2) => {
      const ds = config.decimalSeparator;
      const ts = config.thousandSeparator;
      const fixed = amount.toFixed(decimals);
      const [whole, fraction] = fixed.split(".");
      const formattedWhole = parseInt(whole)
        .toLocaleString("en")
        .replace(/,/g, ts);
      return `${config.currencySymbol}${ds === "," ? " " : ""}${formattedWhole}${fraction ? ds + fraction : ""}`;
    },
    [config]
  );

  const formatNumber = useCallback(
    (value: number, decimals = 0) => {
      const ds = config.decimalSeparator;
      const ts = config.thousandSeparator;
      const fixed =
        decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
      const [whole, fraction] = fixed.split(".");
      const formattedWhole = parseInt(whole)
        .toLocaleString("en")
        .replace(/,/g, ts);
      return fraction ? `${formattedWhole}${ds}${fraction}` : formattedWhole;
    },
    [config]
  );

  const formatDate = useCallback(
    (date: string | Date) => {
      const d = typeof date === "string" ? new Date(date) : date;
      const fmt = config.dateFormat;
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();
      return fmt
        .replace("DD", day)
        .replace("MM", month)
        .replace("YYYY", String(year));
    },
    [config]
  );

  const formatTime = useCallback(
    (date: string | Date) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: config.timeZone,
      });
    },
    [config]
  );

  const formatPhone = useCallback(
    (phone: string) => {
      if (phone.startsWith(config.phoneCode)) return phone;
      if (phone.startsWith("0")) return `${config.phoneCode} ${phone.slice(1)}`;
      return `${config.phoneCode} ${phone}`;
    },
    [config]
  );

  const formatVolume = useCallback(
    (value: number) => {
      return `${formatNumber(value, 2)} ${config.unitVolume}`;
    },
    [formatNumber, config]
  );

  return (
    <LocalizationContext.Provider
      value={{
        config,
        countryKey,
        refresh,
        formatCurrency,
        formatNumber,
        formatDate,
        formatTime,
        formatPhone,
        formatVolume,
      }}
    >
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  return useContext(LocalizationContext);
}
