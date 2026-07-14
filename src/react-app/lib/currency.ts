/**
 * Currency detection utility - resolves station currency from station context,
 * localStorage country detection, or timezone-based fallback.
 * Returns the correct currency code (KES, UGX, TZS, USD, etc.)
 */
import { getCountryByCode } from "./world-country-utils";

const CURRENCY_CACHE: Record<string, string> = {};

export function getDetectedCurrency(): string {
  const cacheKey = "_default";
  if (CURRENCY_CACHE[cacheKey]) return CURRENCY_CACHE[cacheKey];

  // 1. Try station data (highest priority)
  try {
    const stationsJson = localStorage.getItem("fuelpro_stations_v3");
    const currentStationId = localStorage.getItem("fuelpro_current_station");
    if (stationsJson && currentStationId) {
      const stations = JSON.parse(stationsJson);
      const current = stations.find((s: any) => s.id === currentStationId);
      if (current?.country) {
        const country = getCountryByCode(current.country);
        if (country?.currency) {
          CURRENCY_CACHE[cacheKey] = country.currency;
          return country.currency;
        }
      }
    }
  } catch {
    /* */
  }

  // 2. Try location country detection
  try {
    const saved = localStorage.getItem("fuelpro_location_country");
    if (saved) {
      const parsed = JSON.parse(saved);
      const cc = parsed.currentCountry || parsed.country;
      if (cc) {
        const country = getCountryByCode(cc);
        if (country?.currency) {
          CURRENCY_CACHE[cacheKey] = country.currency;
          return country.currency;
        }
      }
    }
  } catch {
    /* */
  }

  // 3. Fallback: detect from timezone
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (
    tz.includes("Nairobi") ||
    tz.includes("Kampala") ||
    tz.includes("Dar") ||
    tz.includes("Kigali") ||
    tz.includes("Addis")
  ) {
    CURRENCY_CACHE[cacheKey] = "KES";
    return "KES";
  }
  if (tz.includes("Lagos") || tz.includes("Accra")) {
    CURRENCY_CACHE[cacheKey] = "NGN";
    return "NGN";
  }
  if (tz.includes("Johannesburg")) {
    CURRENCY_CACHE[cacheKey] = "ZAR";
    return "ZAR";
  }
  if (tz.includes("London")) {
    CURRENCY_CACHE[cacheKey] = "GBP";
    return "GBP";
  }
  if (
    tz.includes("Berlin") ||
    tz.includes("Paris") ||
    tz.includes("Rome") ||
    tz.includes("Madrid")
  ) {
    CURRENCY_CACHE[cacheKey] = "EUR";
    return "EUR";
  }

  CURRENCY_CACHE[cacheKey] = "USD";
  return "USD";
}

/** Get currency symbol for display */
export function getCurrencySymbol(currency?: string): string {
  const c = currency || getDetectedCurrency();
  const SYMBOLS: Record<string, string> = {
    KES: "Ksh",
    UGX: "USh",
    TZS: "TSh",
    NGN: "\u20A6",
    ZAR: "R",
    GHS: "GH\u20B5",
    RWF: "RF",
    BIF: "FBu",
    SSP: "SS\u00A3",
    USD: "$",
    GBP: "\u00A3",
    EUR: "\u20AC",
    JPY: "\u00A5",
    CNY: "\u00A5",
    INR: "\u20B9",
    AUD: "A$",
    CAD: "C$",
    CHF: "CHF",
    BRL: "R$",
    MXN: "Mex$",
    ARS: "AR$",
    ZMW: "K",
    BWP: "P",
    MZN: "MT",
  };
  return SYMBOLS[c] || c;
}

/** Format amount with detected currency */
export function formatMoney(amount: number, currency?: string): string {
  const c = currency || getDetectedCurrency();
  const sym = getCurrencySymbol(c);
  return `${sym} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Get currency from country code */
export function getCurrencyByCountry(countryCode: string): string {
  const country = getCountryByCode(countryCode);
  return country?.currency || "USD";
}
