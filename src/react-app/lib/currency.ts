/**
 * Currency detection utility - resolves station currency from station context,
 * localStorage country detection, or timezone-based fallback.
 * Returns the correct currency code (KES, UGX, TZS, USD, etc.)
 *
 * Uses unified currency symbols from config/pricing.ts for consistency.
 */
import {
  getCountryByCode,
  getCountryFromLocation,
} from "./world-country-utils";
import { REGIONAL_PRICES } from "@/react-app/config/pricing";

// Build currency symbols from unified pricing config
const UNIFIED_SYMBOLS: Record<string, string> = {};
Object.entries(REGIONAL_PRICES).forEach(([code, config]) => {
  UNIFIED_SYMBOLS[code] = config.currencySymbol;
});

const CURRENCY_CACHE: Record<string, string> = {};

export function getDetectedCurrency(): string {
  const cacheKey = "_default";
  if (CURRENCY_CACHE[cacheKey]) return CURRENCY_CACHE[cacheKey];

  // 1. Try station data (highest priority)
  try {
    const stationsJson = localStorage.getItem("fuelpro_stations_v3");
    // The current-station key is fuelpro_current_station_v3 (the older
    // fuelpro_current_station key is no longer written anywhere).
    const currentStationId =
      localStorage.getItem("fuelpro_current_station_v3") ||
      localStorage.getItem("fuelpro_current_station");
    if (stationsJson && currentStationId) {
      const parsed = JSON.parse(stationsJson);
      const stationList = Array.isArray(parsed) ? parsed : parsed?.stations;
      const current = stationList?.find((s: any) => s.id === currentStationId);
      // A station may carry either a country code (e.g. "KE") or a full
      // currency code (e.g. "KES"); resolve whichever is present.
      if (current) {
        if (current.currency) {
          CURRENCY_CACHE[cacheKey] = current.currency;
          return current.currency;
        }
        const cc = current.country || current.countryCode;
        if (cc) {
          const country = getCountryByCode(cc);
          if (country?.currency) {
            CURRENCY_CACHE[cacheKey] = country.currency;
            return country.currency;
          }
        }
        // No explicit country/currency stored on the station. Try to derive
        // one from the free-text location string (e.g. "Nairobi, Kenya" →
        // Kenya → KES). This fixes the common case where a station is created
        // with a location but no country code, which otherwise falls through
        // to the (often server-IP-based, inaccurate) cached user location.
        if (current.location) {
          const country = getCountryFromLocation(current.location);
          if (country?.currency) {
            CURRENCY_CACHE[cacheKey] = country.currency;
            return country.currency;
          }
        }
      }
    }
  } catch {
    /* */
  }

  // 2. Try location country detection (fuelpro_user_location, written by
  //    FuelPriceService, or the legacy fuelpro_location_country key)
  try {
    for (const key of ["fuelpro_user_location", "fuelpro_location_country"]) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        const cc =
          parsed.countryCode || parsed.currentCountry || parsed.country;
        if (cc) {
          const country = getCountryByCode(cc);
          if (country?.currency) {
            CURRENCY_CACHE[cacheKey] = country.currency;
            return country.currency;
          }
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

/** Get currency symbol for display - uses unified symbols from pricing config */
export function getCurrencySymbol(currency?: string): string {
  const c = currency || getDetectedCurrency();
  // First try unified symbols from pricing config
  if (UNIFIED_SYMBOLS[c]) return UNIFIED_SYMBOLS[c];

  // Fallback to standard symbols
  const SYMBOLS: Record<string, string> = {
    KES: "KSh", // Unified format
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
