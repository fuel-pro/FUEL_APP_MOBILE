/**
 * UNIFIED FUEL PRICING SYSTEM
 *
 * This is the SINGLE SOURCE OF TRUTH for all fuel prices in the application.
 * All components, services, and contexts should import from this file.
 *
 * PRICE STRATEGY (WORLD-WIDE):
 * - All 250+ countries are covered — no country ever falls back to Kenya prices.
 * - Kenya: EPRA regulated prices (revised monthly)
 * - Other African countries: regional average prices (REGIONAL_PRICES)
 * - Every other country: USD-denominated baseline × local currency exchange
 *   rate (WORLD_FUEL_PRICES, derived from world-country-utils). This gives a
 *   reasonable offline fallback denominated in the user's OWN currency, never
 *   Kenyan Shillings for a non-Kenyan user.
 * - The live path (/api/fuel-local, /api/fuel-prices) is preferred whenever
 *   the network is available; the tables here are the OFFLINE fallback only.
 *
 * Last Updated: 2026-08-11 (EPRA cycle: 15 Jul 2026 - 14 Aug 2026)
 */

// ============================================
// KENYA EPRA REGULATED PRICES
// Source: Energy and Petroleum Regulatory Authority (EPRA), Nairobi reference prices
// This is a FALLBACK baseline only — the live path (/api/fuel-prices, see
// FuelPriceService.ts) is used whenever OILPRICE_API_KEY is configured.
// Update this baseline if you're not using the live API, since EPRA revises
// prices on the 15th of every month.
// ============================================

export const KENYA_BASE_PRICES = {
  // EPRA Official Prices (KSh per litre) — cycle 15 Jul 2026 to 14 Aug 2026
  petrol: 214.03, // Super Petrol (PMS)
  diesel: 222.86, // Automotive Gas Oil (AGO)
  kerosene: 191.38, // Illuminating Kerosene (IK)
} as const;

// Alternative names mapped to base prices
export const KENYA_ALT_PRICES = {
  superPetrol: 214.03,
  automotiveDiesel: 222.86,
  lampKerosene: 191.38,
} as const;

// Premium/Specialty Fuels (KSh per litre)
export const KENYA_SPECIALTY_PRICES = {
  vPower: 214.35, // V-Power Premium Petrol
  premiumDiesel: 213.72, // Premium Diesel
  lpg: 120.0, // Liquefied Petroleum Gas (per kg)
  cng: 80.0, // Compressed Natural Gas (per m³)
} as const;

// ============================================
// REGIONAL PRICES (Other African Countries)
// Prices in local currency per litre
// ============================================

export const REGIONAL_PRICES: Record<
  string,
  {
    currency: string;
    currencySymbol: string;
    petrol: number;
    diesel: number;
    kerosene: number;
  }
> = {
  UG: {
    currency: "UGX",
    currencySymbol: "USh",
    petrol: 4100,
    diesel: 3900,
    kerosene: 3500,
  }, // Uganda
  TZ: {
    currency: "TZS",
    currencySymbol: "TSh",
    petrol: 2750,
    diesel: 2650,
    kerosene: 2200,
  }, // Tanzania
  NG: {
    currency: "NGN",
    currencySymbol: "₦",
    petrol: 850,
    diesel: 950,
    kerosene: 700,
  }, // Nigeria
  ZA: {
    currency: "ZAR",
    currencySymbol: "R",
    petrol: 25.0,
    diesel: 24.5,
    kerosene: 18.0,
  }, // South Africa
  GH: {
    currency: "GHS",
    currencySymbol: "GH₵",
    petrol: 14.5,
    diesel: 13.5,
    kerosene: 10.0,
  }, // Ghana
  RW: {
    currency: "RWF",
    currencySymbol: "RF",
    petrol: 1450,
    diesel: 1400,
    kerosene: 1200,
  }, // Rwanda
  ET: {
    currency: "ETB",
    currencySymbol: "Br",
    petrol: 55,
    diesel: 52,
    kerosene: 45,
  }, // Ethiopia
  MZ: {
    currency: "MZN",
    currencySymbol: "MT",
    petrol: 75,
    diesel: 70,
    kerosene: 60,
  }, // Mozambique
  ZM: {
    currency: "ZMW",
    currencySymbol: "ZK",
    petrol: 28,
    diesel: 26,
    kerosene: 22,
  }, // Zambia
  BW: {
    currency: "BWP",
    currencySymbol: "P",
    petrol: 15,
    diesel: 14,
    kerosene: 12,
  }, // Botswana
} as const;

// ============================================
// WORLD-WIDE FUEL PRICES (offline fallback for ALL 250+ countries)
//
// Every country that is NOT in REGIONAL_PRICES gets a price derived from a
// USD-denominated baseline × the local-currency exchange rate, so a user in
// the United States, Germany, India, Brazil, Japan, etc. always sees prices
// in their OWN currency — never Kenyan Shillings. The numbers are an
// approximate offline fallback only; the live /api/fuel-local engine
// (reverse-geocode → web search → AI extract → PostGIS nearest) is always
// preferred when the network is available.
//
// USD base prices (per litre, approximate global averages):
//   petrol  ≈ $1.05, diesel ≈ $1.10, kerosene ≈ $0.90
// Exchange rates (units per 1 USD) mirror world-country-utils.
// ============================================

const USD_BASE_PER_LITRE = {
  petrol: 1.05,
  diesel: 1.1,
  kerosene: 0.9,
} as const;

// Exchange rates: local currency units per 1 USD. Covers every currency used
// by WORLD_PAYMENT_CONFIGS so no country is left without a local price.
const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 150,
  CHF: 0.88,
  KES: 129,
  UGX: 3800,
  TZS: 2530,
  NGN: 900,
  ZAR: 18.9,
  GHS: 12.5,
  RWF: 1300,
  ETB: 56,
  MAD: 10.1,
  DZD: 135,
  XOF: 605,
  XAF: 605,
  CVE: 102,
  GMD: 63,
  MGA: 4550,
  MRU: 40,
  MZN: 64,
  NAD: 18.9,
  SZL: 18.9,
  SDG: 600,
  SOS: 571,
  SSP: 13000,
  TND: 3.11,
  CNY: 7.19,
  INR: 83.1,
  PKR: 278,
  LKR: 300,
  IDR: 15600,
  PHP: 56,
  THB: 35.5,
  MYR: 4.75,
  VND: 24500,
  KRW: 1330,
  SGD: 1.34,
  HKD: 7.82,
  NZD: 1.61,
  BRL: 4.97,
  MXN: 17.1,
  ARS: 350,
  COP: 3920,
  CLP: 880,
  PEN: 3.73,
  UYU: 39.2,
  AED: 3.67,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.38,
  OMR: 0.38,
  RUB: 91,
  UAH: 38,
  PLN: 4,
  CZK: 23.2,
  HUF: 360,
  RON: 4.6,
  SEK: 10.4,
  NOK: 10.5,
  DKK: 6.9,
  ILS: 3.7,
  TRY: 31,
  EGP: 31,
  IRR: 42000,
  IQD: 1310,
  LBP: 89500,
  SYP: 13000,
  YER: 250,
  ALL: 95,
  MKD: 56.8,
  BAM: 1.8,
  HRK: 7,
  RSD: 108,
  BGN: 1.8,
  GEL: 2.7,
  AMD: 405,
  AZN: 1.7,
  KZT: 500,
  TMT: 3.5,
  UZS: 12500,
  TJS: 11,
  KGS: 89,
  MNT: 3400,
  LAK: 20700,
  MMK: 2100,
  KHR: 4100,
  FJD: 2.22,
  PGK: 3.7,
  SBD: 8.4,
  VUV: 120,
  WST: 2.74,
  TOP: 2.36,
  JMD: 156,
  TTD: 6.76,
  XCD: 2.7,
  HTG: 132,
  DOP: 59,
  GTQ: 7.82,
  HNL: 24.7,
  NIO: 36.6,
  CRC: 514,
  PAB: 1,
  BZD: 2,
  CUP: 24,
  ANG: 1.79,
  AWG: 1.79,
  BMD: 1,
  PYG: 7300,
  BOB: 6.91,
  VEF: 36.2,
  GYD: 209,
  SRD: 38,
  XPF: 109,
  BND: 1.34,
  MOP: 8,
  TWD: 31.3,
  AFN: 71,
  BTN: 83.1,
  NPR: 133,
  SCR: 13.5,
  MVR: 15.4,
  GNF: 8600,
  SLL: 22.5,
  LRD: 189,
  DJF: 178,
  ERN: 15,
  ZWL: 5800,
  BWP: 13.6,
  ZMW: 26,
  ISK: 138,
  JOD: 0.71,
  LBP2: 89500,
  LYD: 4.8,
  BIF: 2950,
  KMF: 460,
  CDF: 2500,
  GMD2: 63,
  GIP: 0.79,
  KMF2: 460,
  LSL: 18.9,
  MDL: 18,
  MUR: 45,
  MTP: 0.43,
  PRS: 1,
  SHP: 0.79,
  SLL2: 22.5,
  SLL3: 22.5,
  SPL: 1,
  SVC: 8.75,
  SVC2: 8.75,
  SYP2: 13000,
  TJS2: 11,
  TMT2: 3.5,
  TVD: 1.6,
  VES: 36.2,
  ZMK: 26,
};

/** Round to a "nice" number for display (avoid absurd decimals). */
function niceRound(value: number): number {
  if (value < 1) return Math.round(value * 100) / 100;
  if (value < 10) return Math.round(value * 10) / 10;
  if (value < 100) return Math.round(value);
  if (value < 10000) return Math.round(value / 5) * 5;
  return Math.round(value / 100) * 100;
}

/**
 * Compute a fuel-price fallback (petrol/diesel/kerosene) for ANY currency code,
 * in local-currency units per litre. Returns the country's own currency so the
 * UI never shows Kenyan Shillings to a non-Kenyan user.
 */
function computeWorldPrices(currency: string): {
  petrol: number;
  diesel: number;
  kerosene: number;
} {
  const rate = USD_EXCHANGE_RATES[currency] || 1;
  return {
    petrol: niceRound(USD_BASE_PER_LITRE.petrol * rate),
    diesel: niceRound(USD_BASE_PER_LITRE.diesel * rate),
    kerosene: niceRound(USD_BASE_PER_LITRE.kerosene * rate),
  };
}

/**
 * World-wide fuel price table. Built lazily on first access to avoid a startup
 * cost for users who never need it. Maps ISO country code → local-currency
 * prices per litre for every country in WORLD_PAYMENT_CONFIGS (250+).
 */
import { WORLD_PAYMENT_CONFIGS } from "./worldPaymentConfigs";

let _worldFuelPricesCache: Record<
  string,
  {
    currency: string;
    currencySymbol: string;
    petrol: number;
    diesel: number;
    kerosene: number;
  }
> | null = null;

export function getWorldFuelPrices(): Record<
  string,
  {
    currency: string;
    currencySymbol: string;
    petrol: number;
    diesel: number;
    kerosene: number;
  }
> {
  if (_worldFuelPricesCache) return _worldFuelPricesCache;
  const table: Record<
    string,
    {
      currency: string;
      currencySymbol: string;
      petrol: number;
      diesel: number;
      kerosene: number;
    }
  > = {};
  for (const [code, config] of Object.entries(WORLD_PAYMENT_CONFIGS)) {
    const currency = config.defaultCurrency;
    const prices = computeWorldPrices(currency);
    // Resolve a display symbol; WORLD_PAYMENT_CONFIGS may store a symbol.
    const symbol =
      (config as any).currencySymbol || currencySymbolFor(currency);
    table[code] = { currency, currencySymbol: symbol, ...prices };
  }
  _worldFuelPricesCache = table;
  return table;
}

/** Minimal currency → symbol map for currencies not in REGIONAL_PRICES. */
export function currencySymbolFor(currency: string): string {
  const map: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
    CHF: "CHF",
    BRL: "R$",
    MXN: "Mex$",
    ARS: "AR$",
    RUB: "₽",
    CNY2: "¥",
    KRW: "₩",
    TRY: "₺",
    ZŁ: "zł",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "zł",
    CZK: "Kč",
    HUF: "Ft",
    RON: "lei",
    BGN: "лв",
    HRK: "kn",
    ISK: "kr",
    ILS: "₪",
    SAR: "﷼",
    AED: "د.إ",
    QAR: "﷼",
    KWD: "د.ك",
    BHD: ".د.ب",
    OMR: "﷼",
    JOD: "د.ا",
    THB: "฿",
    VND: "₫",
    IDR: "Rp",
    MYR: "RM",
    PHP: "₱",
    SGD: "S$",
    HKD: "HK$",
    TWD: "NT$",
    NZD: "NZ$",
    EGP: "E£",
    ZAR: "R",
    NGN: "₦",
    GHS: "GH₵",
    KES: "KSh",
    UGX: "USh",
    TZS: "TSh",
    RWF: "RF",
    ETB: "Br",
    MAD: "د.م.",
    TND: "د.ت",
    DZD: "د.ج",
    LYD: "ل.د",
    COP: "$",
    CLP: "$",
    PEN: "S/",
    UYU: "$U",
    BOB: "Bs",
    PYG: "₲",
    GYD: "G$",
    SRD: "Sr$",
    GTQ: "Q",
    HNL: "L",
    NIO: "C$",
    CRC: "₡",
    DOP: "RD$",
    HTG: "G",
    JMD: "J$",
    TTD: "TT$",
    BBD: "Bds$",
    XOF: "CFA",
    XAF: "FCFA",
    XCD: "EC$",
    XPF: "₣",
    BDT: "৳",
    PKR: "₨",
    NPR: "₨",
    LKR: "Rs",
    MVR: "Rf",
    MUR: "₨",
    BTN: "Nu.",
    AFN: "؋",
    AMD: "֏",
    AZN: "₼",
    GEL: "₾",
    KZT: "₸",
    UZS: "so'm",
    KGS: "с",
    MNT: "₮",
    KHR: "៛",
    LAK: "₭",
    MMK: "K",
    VUV: "Vt",
    PGK: "K",
    SBD: "Si$",
    TOP: "T$",
    WST: "WS$",
    FJD: "FJ$",
    BND: "B$",
    MOP: "MOP$",
    BWP: "P",
    ZMW: "K",
    MZN: "MT",
    ZWL: "Z$",
    SDG: "ج.س.",
    SOS: "Sh",
    SSP: "SS£",
    ERN: "Nfk",
    DJF: "Fdj",
    GNF: "FG",
    LRD: "L$",
    SLL: "Le",
    TJS: "ЅМ",
    TMT: "m",
    MGA: "Ar",
    MRU: "UM",
    CVE: "$",
    GMD: "D",
    STN: "Db",
    SLL4: "Le",
    ANG: "ƒ",
    AWG: "ƒ",
    CUP: "₱",
    BZD: "BZ$",
    PAB: "B/.",
    GTQ2: "Q",
    KMF: "CF",
    BIF: "FBu",
    CDF: "FC",
    XOF2: "CFA",
  };
  return map[currency] || currency;
}

// ============================================
// KENYA CITY-SPECIFIC PRICES (with transport surcharges)
// Based on distance from Nairobi
// ============================================

export interface KenyaCityPrice {
  name: string;
  lat: number;
  lng: number;
  petrolPrice: number;
  dieselPrice: number;
  kerosenePrice: number;
  transportSurcharge: number; // KSh per litre added due to transport costs
}

export const KENYA_CITIES: KenyaCityPrice[] = [
  {
    name: "Nairobi",
    lat: -1.2921,
    lng: 36.8219,
    petrolPrice: 214.03,
    dieselPrice: 222.86,
    kerosenePrice: 191.38,
    transportSurcharge: 0.0,
  },
  {
    name: "Mombasa",
    lat: -4.0435,
    lng: 39.6682,
    petrolPrice: 212.23,
    dieselPrice: 221.06,
    kerosenePrice: 189.58,
    transportSurcharge: -1.8,
  },
  {
    name: "Kisumu",
    lat: -0.1022,
    lng: 34.7617,
    petrolPrice: 220.23,
    dieselPrice: 229.06,
    kerosenePrice: 197.38,
    transportSurcharge: 6.2,
  },
  {
    name: "Nakuru",
    lat: -0.3031,
    lng: 36.0806,
    petrolPrice: 216.53,
    dieselPrice: 225.36,
    kerosenePrice: 192.88,
    transportSurcharge: 2.5,
  },
  {
    name: "Eldoret",
    lat: 0.5143,
    lng: 35.2698,
    petrolPrice: 222.63,
    dieselPrice: 231.46,
    kerosenePrice: 199.28,
    transportSurcharge: 8.6,
  },
  {
    name: "Kakamega",
    lat: 0.2827,
    lng: 34.7519,
    petrolPrice: 219.83,
    dieselPrice: 228.66,
    kerosenePrice: 197.08,
    transportSurcharge: 5.8,
  },
  {
    name: "Nyeri",
    lat: -0.4197,
    lng: 36.9553,
    petrolPrice: 217.23,
    dieselPrice: 226.06,
    kerosenePrice: 193.58,
    transportSurcharge: 3.2,
  },
  {
    name: "Machakos",
    lat: -1.5177,
    lng: 37.2634,
    petrolPrice: 215.53,
    dieselPrice: 224.36,
    kerosenePrice: 192.38,
    transportSurcharge: 1.5,
  },
  {
    name: "Meru",
    lat: 0.05,
    lng: 37.65,
    petrolPrice: 218.93,
    dieselPrice: 227.76,
    kerosenePrice: 196.18,
    transportSurcharge: 4.9,
  },
  {
    name: "Lodwar",
    lat: 3.1219,
    lng: 35.5972,
    petrolPrice: 229.93,
    dieselPrice: 238.76,
    kerosenePrice: 207.38,
    transportSurcharge: 15.92,
  },
  {
    name: "Garissa",
    lat: -0.4536,
    lng: 40.07,
    petrolPrice: 228.23,
    dieselPrice: 237.06,
    kerosenePrice: 205.78,
    transportSurcharge: 14.2,
  },
  {
    name: "Mombasa",
    lat: -4.0435,
    lng: 39.6682,
    petrolPrice: 212.23,
    dieselPrice: 221.06,
    kerosenePrice: 189.58,
    transportSurcharge: -1.8,
  },
  {
    name: "Malindi",
    lat: -3.2138,
    lng: 40.1169,
    petrolPrice: 214.03,
    dieselPrice: 222.86,
    kerosenePrice: 191.38,
    transportSurcharge: 0.0,
  },
  {
    name: "Kitale",
    lat: 1.015,
    lng: 35.0062,
    petrolPrice: 224.13,
    dieselPrice: 232.96,
    kerosenePrice: 200.78,
    transportSurcharge: 10.1,
  },
  {
    name: "Bungoma",
    lat: 0.5635,
    lng: 34.5606,
    petrolPrice: 221.53,
    dieselPrice: 230.36,
    kerosenePrice: 198.18,
    transportSurcharge: 7.5,
  },
  {
    name: "Kisii",
    lat: -0.6817,
    lng: 34.766,
    petrolPrice: 220.93,
    dieselPrice: 229.76,
    kerosenePrice: 197.58,
    transportSurcharge: 6.9,
  },
  {
    name: "Thika",
    lat: -1.0334,
    lng: 37.0692,
    petrolPrice: 215.23,
    dieselPrice: 224.06,
    kerosenePrice: 192.08,
    transportSurcharge: 1.2,
  },
  {
    name: "Naivasha",
    lat: -0.7172,
    lng: 36.432,
    petrolPrice: 217.53,
    dieselPrice: 226.36,
    kerosenePrice: 193.88,
    transportSurcharge: 3.5,
  },
  {
    name: "Mlimani",
    lat: -6.8,
    lng: 39.2,
    petrolPrice: 218.23,
    dieselPrice: 227.06,
    kerosenePrice: 194.58,
    transportSurcharge: 4.2,
  },
  {
    name: "Diani",
    lat: -4.35,
    lng: 39.5833,
    petrolPrice: 213.53,
    dieselPrice: 222.36,
    kerosenePrice: 190.88,
    transportSurcharge: -0.5,
  },
];

// ============================================
// DEFAULT PRICES (Used when no location detected)
// ============================================

export const DEFAULT_PRICES = {
  petrol: 220.3, // KSh per litre
  diesel: 250.01, // KSh per litre
  kerosene: 164.9, // KSh per litre
  currency: "KES",
  currencySymbol: "KSh",
} as const;

// ============================================
// FUEL TYPE MAPPING
// Standardizes fuel type names across the app
// ============================================

export const FUEL_TYPES = {
  PMS: "petrol", // Premium Motor Spirit (Petrol)
  AGO: "diesel", // Automotive Gas Oil (Diesel)
  IK: "kerosene", // Illuminating Kerosene
  PMS_ALT: "petrol",
  DIESEL: "diesel",
  KEROSENE: "kerosene",
  VPOWER: "vpower",
  PREMIUM_DIESEL: "premium_diesel",
  LPG: "lpg",
  CNG: "cng",
} as const;

// Map to price keys
export const PRICE_KEYS = {
  pmsPrice: "petrol",
  agoPrice: "diesel",
  petrolPrice: "petrol",
  dieselPrice: "diesel",
  kerosenePrice: "kerosene",
} as const;

// ============================================
// CANONICAL FUEL TYPE NORMALIZATION
// Single source of truth for fuel-type aliases.
// Every part of the app (Dashboard, POS, PriceBoard, FuelSalesReport,
// FuelTracker, FuelPriceLocator, backend APIs) MUST normalize raw fuel
// names through normalizeFuelType() before comparing/storing them, so
// "Super Petrol", "Petrol", "PMS", "Premium Motor Spirit", and
// "Gasoline" are all treated as the SAME fuel.
// ============================================

export type CanonicalFuelType =
  | "petrol"
  | "diesel"
  | "kerosene"
  | "vpower"
  | "premium_diesel"
  | "lpg"
  | "cng";

export interface FuelTypeAlias {
  canonical: CanonicalFuelType;
  /** Display label shown to users (uniform across the whole app). */
  label: string;
  /** Short code used in pricing tables / legacy refs. */
  code: string;
}

/**
 * Canonical fuel registry. The label is the ONLY display string that
 * should appear in the UI; the code matches EPRA/industry shorthand.
 */
export const CANONICAL_FUEL_TYPES: Record<CanonicalFuelType, FuelTypeAlias> = {
  petrol: { canonical: "petrol", label: "Super Petrol", code: "PMS" },
  diesel: { canonical: "diesel", label: "Diesel", code: "AGO" },
  kerosene: { canonical: "kerosene", label: "Kerosene", code: "IK" },
  vpower: { canonical: "vpower", label: "V-Power", code: "VPW" },
  premium_diesel: {
    canonical: "premium_diesel",
    label: "Premium Diesel",
    code: "PDS",
  },
  lpg: { canonical: "lpg", label: "LPG", code: "LPG" },
  cng: { canonical: "cng", label: "CNG", code: "CNG" },
};

/**
 * Alias map — every known spelling/abbreviation maps to a canonical type.
 * Keys are upper-cased before lookup, so matching is case-insensitive.
 * Add new aliases here as they are discovered; nothing else needs to change.
 */
const FUEL_ALIAS_MAP: Record<string, CanonicalFuelType> = {
  // Petrol
  PETROL: "petrol",
  SUPER: "petrol",
  "SUPER PETROL": "petrol",
  "SUPER UNLEADED": "petrol",
  UNLEADED: "petrol",
  "UNLEADED PETROL": "petrol",
  "UNLEADED GASOLINE": "petrol",
  GASOLINE: "petrol",
  PETROLI: "petrol", // localized (IT/PT)
  PMS: "petrol",
  "PMS (PETROL)": "petrol",
  "PREMIUM MOTOR SPIRIT": "petrol",
  REGULAR: "petrol",
  "REGULAR PETROL": "petrol",
  "REGULAR GASOLINE": "petrol",
  SUPER_PETROL: "petrol",
  // Diesel
  DIESEL: "diesel",
  "GAS OIL": "diesel",
  "AUTOMOTIVE GAS OIL": "diesel",
  AGO: "diesel",
  "AGO (DIESEL)": "diesel",
  DERV: "diesel", // UK term
  GASOIL: "diesel", // localized (FR)
  AUTOMOTIVE_DIESEL: "diesel",
  PREMIUMDIESEL: "premium_diesel", // edge: no space
  // Kerosene
  KEROSENE: "kerosene",
  "ILLUMINATING KEROSENE": "kerosene",
  IK: "kerosene",
  "IK (KEROSENE)": "kerosene",
  "DUAL PURPOSE KEROSENE": "kerosene",
  DPK: "kerosene", // Nigeria uses DPK for the same product
  KERO: "kerosene",
  LAMPKEROSENE: "kerosene",
  "LAMP KEROSENE": "kerosene",
  // V-Power / Premium Petrol
  VPOWER: "vpower",
  "V-POWER": "vpower",
  "V POWER": "vpower",
  "V-POWER PREMIUM PETROL": "vpower",
  "V-POWER PREMIUM": "vpower",
  "PREMIUM PETROL": "vpower", // commonly V-Power
  "PREMIUM GASOLINE": "vpower",
  // Premium Diesel
  "PREMIUM DIESEL": "premium_diesel",
  PREMIUM_DIESEL: "premium_diesel",
  // LPG
  LPG: "lpg",
  "LIQUEFIED PETROLEUM GAS": "lpg",
  "COOKING GAS": "lpg",
  GAS: "lpg",
  // CNG
  CNG: "cng",
  "COMPRESSED NATURAL GAS": "cng",
};

/**
 * Normalize any raw fuel-type string to its canonical type.
 * Returns the canonical key (e.g. "petrol") or null if unknown.
 */
export function normalizeFuelType(raw: string): CanonicalFuelType | null {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase();
  if (FUEL_ALIAS_MAP[key]) return FUEL_ALIAS_MAP[key];
  // Substring fallback: a raw name like "Shell V-Power" or "Total V-Power
  // 95" should still resolve to "vpower" even though only "V-POWER" is a
  // registered alias. Try each alias key (length >= 4, to avoid short
  // codes like "IK"/"GAS"/"PMS" false-matching inside words) as a
  // substring of the raw name — longest match first so "V-POWER PREMIUM"
  // wins over "V-POWER".
  const keys = Object.keys(FUEL_ALIAS_MAP)
    .filter((k) => k.length >= 4)
    .sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (key.includes(k)) return FUEL_ALIAS_MAP[k];
  }
  return null;
}

/**
 * Get the canonical display label for any fuel-type string.
 * Falls back to the trimmed original string if no alias is known.
 */
export function getFuelLabel(raw: string): string {
  const canonical = normalizeFuelType(raw);
  if (canonical) return CANONICAL_FUEL_TYPES[canonical].label;
  return String(raw).trim();
}

/**
 * Get the canonical short code for any fuel-type string.
 * Falls back to "" if unknown.
 */
export function getFuelCode(raw: string): string {
  const canonical = normalizeFuelType(raw);
  if (canonical) return CANONICAL_FUEL_TYPES[canonical].code;
  return "";
}

/**
 * Check whether two raw fuel-type strings refer to the SAME fuel.
 */
export function isSameFuelType(a: string, b: string): boolean {
  const ca = normalizeFuelType(a);
  const cb = normalizeFuelType(b);
  if (ca && cb) return ca === cb;
  // Fall back to case-insensitive string compare for unknown types
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the base price for a fuel type. Normalizes through the canonical
 * alias map so any known spelling (PMS, Super Petrol, Gasoline, AGO, DPK,
 * etc.) resolves to the correct price.
 */
export function getBasePrice(fuelType: string): number {
  const canonical = normalizeFuelType(fuelType);
  switch (canonical) {
    case "petrol":
      return KENYA_BASE_PRICES.petrol;
    case "diesel":
      return KENYA_BASE_PRICES.diesel;
    case "kerosene":
      return KENYA_BASE_PRICES.kerosene;
    case "vpower":
      return KENYA_SPECIALTY_PRICES.vPower;
    case "premium_diesel":
      return KENYA_SPECIALTY_PRICES.premiumDiesel;
    case "lpg":
      return KENYA_SPECIALTY_PRICES.lpg;
    case "cng":
      return KENYA_SPECIALTY_PRICES.cng;
    default: {
      // Fall back to legacy lookup for backward compatibility
      const type =
        FUEL_TYPES[fuelType as keyof typeof FUEL_TYPES] ||
        fuelType.toLowerCase();
      switch (type) {
        case "petrol":
        case "pms":
          return KENYA_BASE_PRICES.petrol;
        case "diesel":
        case "ago":
          return KENYA_BASE_PRICES.diesel;
        case "kerosene":
        case "ik":
          return KENYA_BASE_PRICES.kerosene;
        case "vpower":
          return KENYA_SPECIALTY_PRICES.vPower;
        case "premiumdiesel":
          return KENYA_SPECIALTY_PRICES.premiumDiesel;
        case "lpg":
          return KENYA_SPECIALTY_PRICES.lpg;
        case "cng":
          return KENYA_SPECIALTY_PRICES.cng;
        default:
          return 0;
      }
    }
  }
}

/**
 * Get price for a specific country
 */
export function getCountryPrice(
  countryCode: string,
  fuelType: string,
): { price: number; currency: string; symbol: string } {
  if (countryCode === "KE") {
    return {
      price: getBasePrice(fuelType),
      currency: "KES",
      symbol: "KSh",
    };
  }

  const regional = REGIONAL_PRICES[countryCode];
  if (regional) {
    const canonical = normalizeFuelType(fuelType);
    let price = regional.petrol;

    switch (canonical) {
      case "diesel":
        price = regional.diesel;
        break;
      case "kerosene":
        price = regional.kerosene;
        break;
    }

    return {
      price,
      currency: regional.currency,
      symbol: regional.currencySymbol,
    };
  }

  // WORLD-WIDE: any country not in REGIONAL_PRICES (US, DE, IN, BR, JP, …)
  // gets a price derived from the USD baseline × its own currency exchange
  // rate — NEVER Kenya's KSh fallback.
  const world = getWorldFuelPrices()[countryCode.toUpperCase()];
  if (world) {
    const canonical = normalizeFuelType(fuelType);
    let price = world.petrol;
    switch (canonical) {
      case "diesel":
        price = world.diesel;
        break;
      case "kerosene":
        price = world.kerosene;
        break;
    }
    return {
      price,
      currency: world.currency,
      symbol: world.currencySymbol,
    };
  }

  // Truly unknown country code: use a neutral USD baseline rather than Kenya.
  return {
    price: USD_BASE_PER_LITRE.petrol,
    currency: "USD",
    symbol: "$",
  };
}

/**
 * Get price for a specific Kenya city
 */
export function getKenyaCityPrice(
  cityName: string,
): KenyaCityPrice | undefined {
  return KENYA_CITIES.find(
    (city) => city.name.toLowerCase() === cityName.toLowerCase(),
  );
}

/**
 * Get the closest Kenya city price based on GPS coordinates
 */
export function getClosestKenyaCityPrice(
  lat: number,
  lng: number,
): KenyaCityPrice {
  let closest = KENYA_CITIES[0];
  let minDistance = Infinity;

  for (const city of KENYA_CITIES) {
    const distance = Math.sqrt(
      Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2),
    );
    if (distance < minDistance) {
      minDistance = distance;
      closest = city;
    }
  }

  return closest;
}

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number, symbol: string = "KSh"): string {
  return `${symbol} ${price.toFixed(2)}`;
}

/**
 * Get all Kenya fuel types with prices
 */
export function getKenyaFuelTypes(): Array<{
  id: string;
  name: string;
  price: number;
}> {
  return [
    {
      id: "petrol",
      name: CANONICAL_FUEL_TYPES.petrol.label,
      price: KENYA_BASE_PRICES.petrol,
    },
    {
      id: "diesel",
      name: CANONICAL_FUEL_TYPES.diesel.label,
      price: KENYA_BASE_PRICES.diesel,
    },
    {
      id: "kerosene",
      name: CANONICAL_FUEL_TYPES.kerosene.label,
      price: KENYA_BASE_PRICES.kerosene,
    },
    {
      id: "vpower",
      name: CANONICAL_FUEL_TYPES.vpower.label,
      price: KENYA_SPECIALTY_PRICES.vPower,
    },
    {
      id: "premium_diesel",
      name: CANONICAL_FUEL_TYPES.premium_diesel.label,
      price: KENYA_SPECIALTY_PRICES.premiumDiesel,
    },
    {
      id: "lpg",
      name: CANONICAL_FUEL_TYPES.lpg.label,
      price: KENYA_SPECIALTY_PRICES.lpg,
    },
    {
      id: "cng",
      name: CANONICAL_FUEL_TYPES.cng.label,
      price: KENYA_SPECIALTY_PRICES.cng,
    },
  ];
}

// ============================================
// UNIFIED TAX RATES (Single Source of Truth)
// Used across: regions.ts, compliance.ts, formatters.ts
// ============================================

export const TAX_RATES: Record<
  string,
  {
    vatRate: number;
    exciseDuty?: number;
    withholdingTax?: number;
    roadLevy?: number;
    description: string;
  }
> = {
  KE: {
    vatRate: 0.16,
    exciseDuty: 0.2195,
    withholdingTax: 0.05,
    roadLevy: 0.25,
    description:
      "Kenya - VAT 16%, Excise 21.95%, Withholding 5%, Road Levy 25%/",
  },
  UG: {
    vatRate: 0.18,
    withholdingTax: 0.06,
    description: "Uganda - VAT 18%, Withholding 6%",
  },
  TZ: {
    vatRate: 0.18,
    withholdingTax: 0.1,
    description: "Tanzania - VAT 18%, Withholding 10%",
  },
  NG: { vatRate: 0.075, description: "Nigeria - VAT 7.5%" },
  ZA: { vatRate: 0.15, description: "South Africa - VAT 15%" },
  GH: { vatRate: 0.15, description: "Ghana - VAT 15%" },
  RW: { vatRate: 0.18, description: "Rwanda - VAT 18%" },
  ET: { vatRate: 0.15, description: "Ethiopia - VAT 15%" },
  // Worldwide coverage
  US: {
    vatRate: 0,
    description: "United States - Sales tax varies by state (0-10.25%)",
  },
  GB: { vatRate: 0.2, description: "United Kingdom - VAT 20%" },
  DE: { vatRate: 0.19, description: "Germany - VAT 19%" },
  FR: { vatRate: 0.2, description: "France - VAT 20%" },
  IT: { vatRate: 0.22, description: "Italy - VAT 22%" },
  ES: { vatRate: 0.21, description: "Spain - VAT 21%" },
  NL: { vatRate: 0.21, description: "Netherlands - VAT 21%" },
  BE: { vatRate: 0.21, description: "Belgium - VAT 21%" },
  CH: { vatRate: 0.081, description: "Switzerland - VAT 8.1%" },
  AT: { vatRate: 0.2, description: "Austria - VAT 20%" },
  IE: { vatRate: 0.23, description: "Ireland - VAT 23%" },
  PT: { vatRate: 0.23, description: "Portugal - VAT 23%" },
  GR: { vatRate: 0.24, description: "Greece - VAT 24%" },
  PL: { vatRate: 0.23, description: "Poland - VAT 23%" },
  SE: { vatRate: 0.25, description: "Sweden - VAT 25%" },
  DK: { vatRate: 0.25, description: "Denmark - VAT 25%" },
  NO: { vatRate: 0.25, description: "Norway - VAT 25%" },
  FI: { vatRate: 0.255, description: "Finland - VAT 25.5%" },
  CZ: { vatRate: 0.21, description: "Czech Republic - VAT 21%" },
  HU: { vatRate: 0.27, description: "Hungary - VAT 27%" },
  RO: { vatRate: 0.19, description: "Romania - VAT 19%" },
  BG: { vatRate: 0.2, description: "Bulgaria - VAT 20%" },
  HR: { vatRate: 0.25, description: "Croatia - VAT 25%" },
  SK: { vatRate: 0.2, description: "Slovakia - VAT 20%" },
  SI: { vatRate: 0.22, description: "Slovenia - VAT 22%" },
  LT: { vatRate: 0.21, description: "Lithuania - VAT 21%" },
  LV: { vatRate: 0.21, description: "Latvia - VAT 21%" },
  EE: { vatRate: 0.22, description: "Estonia - VAT 22%" },
  IS: { vatRate: 0.24, description: "Iceland - VAT 24%" },
  LU: { vatRate: 0.17, description: "Luxembourg - VAT 17%" },
  MT: { vatRate: 0.18, description: "Malta - VAT 18%" },
  CY: { vatRate: 0.19, description: "Cyprus - VAT 19%" },
  CA: { vatRate: 0.05, description: "Canada - GST 5% (provincial tax varies)" },
  AU: { vatRate: 0.1, description: "Australia - GST 10%" },
  NZ: { vatRate: 0.15, description: "New Zealand - GST 15%" },
  JP: { vatRate: 0.1, description: "Japan - Consumption Tax 10%" },
  KR: { vatRate: 0.1, description: "South Korea - VAT 10%" },
  CN: { vatRate: 0.13, description: "China - VAT 13%" },
  IN: { vatRate: 0.18, description: "India - GST 18%" },
  SG: { vatRate: 0.09, description: "Singapore - GST 9%" },
  MY: { vatRate: 0.06, description: "Malaysia - SST 6%" },
  TH: { vatRate: 0.07, description: "Thailand - VAT 7%" },
  ID: { vatRate: 0.11, description: "Indonesia - VAT 11%" },
  PH: { vatRate: 0.12, description: "Philippines - VAT 12%" },
  VN: { vatRate: 0.1, description: "Vietnam - VAT 10%" },
  AE: { vatRate: 0.05, description: "UAE - VAT 5%" },
  SA: { vatRate: 0.15, description: "Saudi Arabia - VAT 15%" },
  QA: { vatRate: 0, description: "Qatar - No VAT" },
  KW: { vatRate: 0, description: "Kuwait - No VAT" },
  BH: { vatRate: 0.1, description: "Bahrain - VAT 10%" },
  OM: { vatRate: 0.05, description: "Oman - VAT 5%" },
  EG: { vatRate: 0.14, description: "Egypt - VAT 14%" },
  MA: { vatRate: 0.2, description: "Morocco - VAT 20%" },
  TN: { vatRate: 0.19, description: "Tunisia - VAT 19%" },
  BR: { vatRate: 0.17, description: "Brazil - ICMS ~17% (varies by state)" },
  MX: { vatRate: 0.16, description: "Mexico - IVA 16%" },
  AR: { vatRate: 0.21, description: "Argentina - VAT 21%" },
  CL: { vatRate: 0.19, description: "Chile - IVA 19%" },
  CO: { vatRate: 0.19, description: "Colombia - IVA 19%" },
  PE: { vatRate: 0.18, description: "Peru - IGV 18%" },
  TR: { vatRate: 0.2, description: "Turkey - VAT 20%" },
  IL: { vatRate: 0.17, description: "Israel - VAT 17%" },
  PK: { vatRate: 0.17, description: "Pakistan - GST 17%" },
  BD: { vatRate: 0.15, description: "Bangladesh - VAT 15%" },
  LK: { vatRate: 0.15, description: "Sri Lanka - VAT 15%" },
};

/**
 * Get VAT rate for a country
 */
export function getVATRate(countryCode: string): number {
  return TAX_RATES[countryCode]?.vatRate ?? 0; // Default to 0% (no VAT) for unknown countries
}

/**
 * Get all tax rates for a country
 */
export function getTaxRates(countryCode: string) {
  return (
    TAX_RATES[countryCode] || {
      vatRate: 0,
      description: `${countryCode} - No tax data (VAT 0%)`,
    }
  );
}

/**
 * Calculate tax amount from base price
 */
export function calculateTax(
  basePrice: number,
  countryCode: string,
): {
  vat: number;
  excise: number;
  withholding: number;
  roadLevy: number;
  totalTax: number;
} {
  const rates = getTaxRates(countryCode);
  const vat = basePrice * (rates.vatRate || 0);
  const excise = basePrice * (rates.exciseDuty || 0);
  const withholding = basePrice * (rates.withholdingTax || 0);
  const roadLevy = basePrice * (rates.roadLevy || 0);

  return {
    vat,
    excise,
    withholding,
    roadLevy,
    totalTax: vat + excise + withholding + roadLevy,
  };
}

// Export everything as default for convenience
export default {
  KENYA_BASE_PRICES,
  KENYA_SPECIALTY_PRICES,
  REGIONAL_PRICES,
  KENYA_CITIES,
  DEFAULT_PRICES,
  FUEL_TYPES,
  PRICE_KEYS,
  TAX_RATES,
  getBasePrice,
  getCountryPrice,
  getKenyaCityPrice,
  getClosestKenyaCityPrice,
  formatPrice,
  getKenyaFuelTypes,
  getWorldFuelPrices,
  getVATRate,
  getTaxRates,
  calculateTax,
};
