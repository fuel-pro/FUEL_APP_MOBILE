/**
 * UNIFIED FUEL PRICING SYSTEM
 * 
 * This is the SINGLE SOURCE OF TRUTH for all fuel prices in the application.
 * All components, services, and contexts should import from this file.
 * 
 * PRICE STRATEGY:
 * - Kenya: Uses EPRA regulated prices (revised monthly)
 * - Other African countries: Regional average prices
 * - Prices are location-aware (city-based for Kenya)
 * 
 * Last Updated: July 2026
 */

// ============================================
// KENYA EPRA REGULATED PRICES (as of July 2026)
// Source: Energy and Petroleum Regulatory Authority (EPRA)
// ============================================

export const KENYA_BASE_PRICES = {
  // EPRA Official Prices (KSh per litre) - July 2026
  petrol: 220.30,      // Super Petrol (PMS)
  diesel: 250.01,      // Automotive Gas Oil (AGO)
  kerosene: 164.90,   // Lamp Oil (IK)
} as const;

// Alternative names mapped to base prices
export const KENYA_ALT_PRICES = {
  superPetrol: 220.30,
  automotiveDiesel: 250.01,
  lampKerosene: 164.90,
} as const;

// Premium/Specialty Fuels (KSh per litre)
export const KENYA_SPECIALTY_PRICES = {
  vPower: 214.35,      // V-Power Premium Petrol
  premiumDiesel: 213.72, // Premium Diesel
  lpg: 120.00,         // Liquefied Petroleum Gas (per kg)
  cng: 80.00,          // Compressed Natural Gas (per m³)
} as const;

// ============================================
// REGIONAL PRICES (Other African Countries)
// Prices in local currency per litre
// ============================================

export const REGIONAL_PRICES: Record<string, {
  currency: string;
  currencySymbol: string;
  petrol: number;
  diesel: number;
  kerosene: number;
}> = {
  UG: { currency: "UGX", currencySymbol: "USh", petrol: 4100, diesel: 3900, kerosene: 3500 },    // Uganda
  TZ: { currency: "TZS", currencySymbol: "TSh", petrol: 2750, diesel: 2650, kerosene: 2200 },  // Tanzania
  NG: { currency: "NGN", currencySymbol: "₦", petrol: 850, diesel: 950, kerosene: 700 },       // Nigeria
  ZA: { currency: "ZAR", currencySymbol: "R", petrol: 25.00, diesel: 24.50, kerosene: 18.00 }, // South Africa
  GH: { currency: "GHS", currencySymbol: "GH₵", petrol: 14.50, diesel: 13.50, kerosene: 10.00 }, // Ghana
  RW: { currency: "RWF", currencySymbol: "RF", petrol: 1450, diesel: 1400, kerosene: 1200 },   // Rwanda
  ET: { currency: "ETB", currencySymbol: "Br", petrol: 55, diesel: 52, kerosene: 45 },         // Ethiopia
  MZ: { currency: "MZN", currencySymbol: "MT", petrol: 75, diesel: 70, kerosene: 60 },         // Mozambique
  ZM: { currency: "ZMW", currencySymbol: "ZK", petrol: 28, diesel: 26, kerosene: 22 },         // Zambia
  BW: { currency: "BWP", currencySymbol: "P", petrol: 15, diesel: 14, kerosene: 12 },           // Botswana
} as const;

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
  { name: "Nairobi", lat: -1.2921, lng: 36.8219, petrolPrice: 220.30, dieselPrice: 250.01, kerosenePrice: 164.90, transportSurcharge: 0.0 },
  { name: "Mombasa", lat: -4.0435, lng: 39.6682, petrolPrice: 218.50, dieselPrice: 248.21, kerosenePrice: 163.10, transportSurcharge: -1.80 },
  { name: "Kisumu", lat: -0.1022, lng: 34.7617, petrolPrice: 226.50, dieselPrice: 256.21, kerosenePrice: 170.90, transportSurcharge: 6.20 },
  { name: "Nakuru", lat: -0.3031, lng: 36.0806, petrolPrice: 222.80, dieselPrice: 252.51, kerosenePrice: 166.40, transportSurcharge: 2.50 },
  { name: "Eldoret", lat: 0.5143, lng: 35.2698, petrolPrice: 228.90, dieselPrice: 258.61, kerosenePrice: 172.80, transportSurcharge: 8.60 },
  { name: "Kakamega", lat: 0.2827, lng: 34.7519, petrolPrice: 226.10, dieselPrice: 255.81, kerosenePrice: 170.60, transportSurcharge: 5.80 },
  { name: "Nyeri", lat: -0.4197, lng: 36.9553, petrolPrice: 223.50, dieselPrice: 253.21, kerosenePrice: 167.10, transportSurcharge: 3.20 },
  { name: "Machakos", lat: -1.5177, lng: 37.2634, petrolPrice: 221.80, dieselPrice: 251.51, kerosenePrice: 165.90, transportSurcharge: 1.50 },
  { name: "Meru", lat: 0.0500, lng: 37.6500, petrolPrice: 225.20, dieselPrice: 254.91, kerosenePrice: 169.70, transportSurcharge: 4.90 },
  { name: "Lodwar", lat: 3.1219, lng: 35.5972, petrolPrice: 236.20, dieselPrice: 265.91, kerosenePrice: 180.90, transportSurcharge: 15.92 },
  { name: "Garissa", lat: -0.4536, lng: 40.0700, petrolPrice: 234.50, dieselPrice: 264.21, kerosenePrice: 179.30, transportSurcharge: 14.20 },
  { name: "Mombasa", lat: -4.0435, lng: 39.6682, petrolPrice: 218.50, dieselPrice: 248.21, kerosenePrice: 163.10, transportSurcharge: -1.80 },
  { name: "Malindi", lat: -3.2138, lng: 40.1169, petrolPrice: 220.30, dieselPrice: 250.01, kerosenePrice: 164.90, transportSurcharge: 0.00 },
  { name: "Kitale", lat: 1.0150, lng: 35.0062, petrolPrice: 230.40, dieselPrice: 260.11, kerosenePrice: 174.30, transportSurcharge: 10.10 },
  { name: "Bungoma", lat: 0.5635, lng: 34.5606, petrolPrice: 227.80, dieselPrice: 257.51, kerosenePrice: 171.70, transportSurcharge: 7.50 },
  { name: "Kisii", lat: -0.6817, lng: 34.7660, petrolPrice: 227.20, dieselPrice: 256.91, kerosenePrice: 171.10, transportSurcharge: 6.90 },
  { name: "Thika", lat: -1.0334, lng: 37.0692, petrolPrice: 221.50, dieselPrice: 251.21, kerosenePrice: 165.60, transportSurcharge: 1.20 },
  { name: "Naivasha", lat: -0.7172, lng: 36.4320, petrolPrice: 223.80, dieselPrice: 253.51, kerosenePrice: 167.40, transportSurcharge: 3.50 },
  { name: "Mlimani", lat: -6.8000, lng: 39.2000, petrolPrice: 224.50, dieselPrice: 254.21, kerosenePrice: 168.10, transportSurcharge: 4.20 },
  { name: "Diani", lat: -4.3500, lng: 39.5833, petrolPrice: 219.80, dieselPrice: 249.51, kerosenePrice: 164.40, transportSurcharge: -0.50 },
];

// ============================================
// DEFAULT PRICES (Used when no location detected)
// ============================================

export const DEFAULT_PRICES = {
  petrol: 220.30,      // KSh per litre
  diesel: 250.01,      // KSh per litre
  kerosene: 164.90,    // KSh per litre
  currency: "KES",
  currencySymbol: "KSh",
} as const;

// ============================================
// FUEL TYPE MAPPING
// Standardizes fuel type names across the app
// ============================================

export const FUEL_TYPES = {
  PMS: "petrol",        // Premium Motor Spirit (Petrol)
  AGO: "diesel",       // Automotive Gas Oil (Diesel)
  IK: "kerosene",       // Illuminating Kerosene
  PMS_ALT: "petrol",
  DIESEL: "diesel",
  KEROSENE: "kerosene",
  VPOWER: "vPower",
  PREMIUM_DIESEL: "premiumDiesel",
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
// HELPER FUNCTIONS
// ============================================

/**
 * Get the base price for a fuel type
 */
export function getBasePrice(fuelType: string): number {
  const type = FUEL_TYPES[fuelType as keyof typeof FUEL_TYPES] || fuelType.toLowerCase();
  
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
      return KENYA_BASE_PRICES.petrol;
  }
}

/**
 * Get price for a specific country
 */
export function getCountryPrice(countryCode: string, fuelType: string): { price: number; currency: string; symbol: string } {
  if (countryCode === "KE") {
    return {
      price: getBasePrice(fuelType),
      currency: "KES",
      symbol: "KSh",
    };
  }
  
  const regional = REGIONAL_PRICES[countryCode];
  if (regional) {
    const type = FUEL_TYPES[fuelType as keyof typeof FUEL_TYPES] || fuelType.toLowerCase();
    let price = regional.petrol;
    
    switch (type) {
      case "diesel":
      case "ago":
        price = regional.diesel;
        break;
      case "kerosene":
      case "ik":
        price = regional.kerosene;
        break;
    }
    
    return {
      price,
      currency: regional.currency,
      symbol: regional.currencySymbol,
    };
  }
  
  return {
    price: DEFAULT_PRICES.petrol,
    currency: DEFAULT_PRICES.currency,
    symbol: DEFAULT_PRICES.currencySymbol,
  };
}

/**
 * Get price for a specific Kenya city
 */
export function getKenyaCityPrice(cityName: string): KenyaCityPrice | undefined {
  return KENYA_CITIES.find(
    city => city.name.toLowerCase() === cityName.toLowerCase()
  );
}

/**
 * Get the closest Kenya city price based on GPS coordinates
 */
export function getClosestKenyaCityPrice(lat: number, lng: number): KenyaCityPrice {
  let closest = KENYA_CITIES[0];
  let minDistance = Infinity;
  
  for (const city of KENYA_CITIES) {
    const distance = Math.sqrt(
      Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2)
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
export function getKenyaFuelTypes(): Array<{ id: string; name: string; price: number }> {
  return [
    { id: "pms", name: "PMS (Petrol)", price: KENYA_BASE_PRICES.petrol },
    { id: "ago", name: "AGO (Diesel)", price: KENYA_BASE_PRICES.diesel },
    { id: "ik", name: "IK (Kerosene)", price: KENYA_BASE_PRICES.kerosene },
    { id: "vpower", name: "V-Power", price: KENYA_SPECIALTY_PRICES.vPower },
    { id: "premiumDiesel", name: "Premium Diesel", price: KENYA_SPECIALTY_PRICES.premiumDiesel },
    { id: "lpg", name: "LPG", price: KENYA_SPECIALTY_PRICES.lpg },
    { id: "cng", name: "CNG", price: KENYA_SPECIALTY_PRICES.cng },
  ];
}

// ============================================
// UNIFIED TAX RATES (Single Source of Truth)
// Used across: regions.ts, compliance.ts, formatters.ts
// ============================================

export const TAX_RATES: Record<string, {
  vatRate: number;
  exciseDuty?: number;
  withholdingTax?: number;
  roadLevy?: number;
  description: string;
}> = {
  KE: { vatRate: 0.16, exciseDuty: 0.2195, withholdingTax: 0.05, roadLevy: 0.25, description: "Kenya - VAT 16%, Excise 21.95%, Withholding 5%, Road Levy 25%/" },
  UG: { vatRate: 0.18, withholdingTax: 0.06, description: "Uganda - VAT 18%, Withholding 6%" },
  TZ: { vatRate: 0.18, withholdingTax: 0.10, description: "Tanzania - VAT 18%, Withholding 10%" },
  NG: { vatRate: 0.075, description: "Nigeria - VAT 7.5%" },
  ZA: { vatRate: 0.15, description: "South Africa - VAT 15%" },
  GH: { vatRate: 0.15, description: "Ghana - VAT 15%" },
  RW: { vatRate: 0.18, description: "Rwanda - VAT 18%" },
  ET: { vatRate: 0.15, description: "Ethiopia - VAT 15%" },
};

/**
 * Get VAT rate for a country
 */
export function getVATRate(countryCode: string): number {
  return TAX_RATES[countryCode]?.vatRate || 0.16; // Default to 16%
}

/**
 * Get all tax rates for a country
 */
export function getTaxRates(countryCode: string) {
  return TAX_RATES[countryCode] || TAX_RATES.KE;
}

/**
 * Calculate tax amount from base price
 */
export function calculateTax(basePrice: number, countryCode: string): {
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
  getVATRate,
  getTaxRates,
  calculateTax,
};
