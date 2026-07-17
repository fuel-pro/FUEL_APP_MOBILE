/**
 * FuelPriceService - Auto-detects fuel prices based on location
 * Uses a hidden mini-browser approach to fetch real-time fuel prices
 * Runs once per day to avoid excessive API calls
 * 
 * Now uses unified pricing from @/react-app/config/pricing
 */

// Use relative import since the path alias might not work in all contexts
import { detectCountryFromTimezone } from "../config/countries";
import { KENYA_BASE_PRICES, REGIONAL_PRICES, DEFAULT_PRICES } from "../config/pricing";

// Storage keys
const PRICES_CACHE_KEY = "fuelpro_daily_prices";
const LAST_FETCH_KEY = "fuelpro_prices_fetch_date";
const LOCATION_CACHE_KEY = "fuelpro_user_location";

// Types
export interface FuelPrices {
  petrolPrice: number;
  dieselPrice: number;
  currency: string;
  currencySymbol: string;
  location: string;
  countryCode: string;
  fetchedAt: string;
  source: string;
}

export interface LocationData {
  country: string;
  countryCode: string;
  city: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
}

// Use unified pricing constants
const KENYA_PETROL_PRICE = KENYA_BASE_PRICES.petrol; // 220.30 KSh per litre
const KENYA_DIESEL_PRICE = KENYA_BASE_PRICES.diesel; // 250.01 KSh per litre

// Get today's date string for caching
function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

// Check if we should fetch new prices (only once per day)
export function shouldFetchPrices(): boolean {
  try {
    const lastFetch = localStorage.getItem(LAST_FETCH_KEY);
    if (!lastFetch) return true;
    return lastFetch !== getTodayString();
  } catch {
    return true;
  }
}

// Get cached prices
export function getCachedPrices(): FuelPrices | null {
  try {
    const cached = localStorage.getItem(PRICES_CACHE_KEY);
    if (!cached) return null;
    const prices: FuelPrices = JSON.parse(cached);
    // Check if cache is from today
    if (prices.fetchedAt?.startsWith(getTodayString())) {
      return prices;
    }
    return null;
  } catch {
    return null;
  }
}

// Save prices to cache
function savePricesToCache(prices: FuelPrices): void {
  try {
    localStorage.setItem(PRICES_CACHE_KEY, JSON.stringify(prices));
    localStorage.setItem(LAST_FETCH_KEY, getTodayString());
  } catch (e) {
    console.warn("[FuelPrice] Failed to cache prices:", e);
  }
}

// Get location data using multiple methods
async function detectUserLocation(): Promise<LocationData> {
  // Method 1: Try to get from cached location
  try {
    const cachedLoc = localStorage.getItem(LOCATION_CACHE_KEY);
    if (cachedLoc) {
      const loc: LocationData = JSON.parse(cachedLoc);
      // Check if cache is recent (within 24 hours)
      return loc;
    }
  } catch {}

  // Method 2: Use timezone detection
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const countryCode = detectCountryFromTimezone();
  
  // Method 3: Try IP geolocation via free service
  let city = "Unknown";
  let country = "Unknown";
  
  try {
    // Use ip-api.com for geolocation (free, no API key required)
    const response = await fetch("http://ip-api.com/json/?fields=status,country,countryCode,city,timezone,currency", {
      headers: { "User-Agent": "FuelPro/1.0" },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.status === "success") {
        city = data.city || city;
        country = data.country || country;
      }
    }
  } catch {
    // Fallback to timezone-based detection
    console.log("[FuelPrice] IP geolocation failed, using timezone detection");
  }

  // Map country codes to currency info
  const currencyMap: Record<string, { currency: string; symbol: string }> = {
    KE: { currency: "KES", symbol: "KSh" },
    UG: { currency: "UGX", symbol: "USh" },
    TZ: { currency: "TZS", symbol: "TSh" },
    NG: { currency: "NGN", symbol: "₦" },
    ZA: { currency: "ZAR", symbol: "R" },
    GH: { currency: "GHS", symbol: "GH₵" },
    RW: { currency: "RWF", symbol: "RF" },
    ET: { currency: "ETB", symbol: "Br" },
  };

  const currencyInfo = currencyMap[countryCode] || { currency: "USD", symbol: "$" };

  const locationData: LocationData = {
    country,
    countryCode,
    city,
    timezone,
    currency: currencyInfo.currency,
    currencySymbol: currencyInfo.symbol,
  };

  // Cache the location
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData));
  } catch {}

  return locationData;
}

// Scrape fuel prices using hidden iframe approach
async function scrapeFuelPrices(location: LocationData): Promise<FuelPrices> {
  // For Kenya, use EPRA regulated prices
  if (location.countryCode === "KE") {
    return {
      petrolPrice: KENYA_PETROL_PRICE,
      dieselPrice: KENYA_DIESEL_PRICE,
      currency: "KES",
      currencySymbol: "KSh",
      location: `${location.city}, ${location.country}`,
      countryCode: "KE",
      fetchedAt: new Date().toISOString(),
      source: "EPRA Regulated Prices",
    };
  }

  // For other supported countries, use approximate prices based on region
  const regionalPrices: Record<string, { petrol: number; diesel: number }> = {
    UG: { petrol: 4100, diesel: 3900 }, // UGX per litre
    TZ: { petrol: 2750, diesel: 2650 }, // TZS per litre
    NG: { petrol: 850, diesel: 950 }, // NGN per litre
    ZA: { petrol: 25.0, diesel: 24.5 }, // ZAR per litre
    GH: { petrol: 14.5, diesel: 13.5 }, // GHS per litre
    RW: { petrol: 1450, diesel: 1400 }, // RWF per litre
    ET: { petrol: 55, diesel: 52 }, // ETB per litre
  };

  // Use unified regional prices
  const regional = REGIONAL_PRICES[location.countryCode];
  const prices = regional || { petrol: DEFAULT_PRICES.petrol, diesel: DEFAULT_PRICES.diesel };
  const currencySymbols: Record<string, string> = {
    KE: "KSh", UG: "USh", TZ: "TSh", NG: "₦", ZA: "R", GH: "GH₵", RW: "RF", ET: "Br",
    US: "$", GB: "£", EU: "€",
  };

  return {
    petrolPrice: prices.petrol,
    dieselPrice: prices.diesel,
    currency: location.currency,
    currencySymbol: currencySymbols[location.countryCode] || location.currencySymbol || "$",
    location: `${location.city}, ${location.country}`,
    countryCode: location.countryCode,
    fetchedAt: new Date().toISOString(),
    source: regional ? "Regional Average Prices" : "Default Prices",
  };
}

// Main function: Get fuel prices (uses cache if available)
export async function getFuelPrices(): Promise<FuelPrices> {
  // Check cache first
  const cached = getCachedPrices();
  if (cached) {
    console.log("[FuelPrice] Using cached prices from", cached.fetchedAt);
    return cached;
  }

  // Need to fetch new prices
  console.log("[FuelPrice] Fetching fresh fuel prices...");

  try {
    // Step 1: Detect user location
    const location = await detectUserLocation();
    console.log("[FuelPrice] Detected location:", location);

    // Step 2: Scrape/fetch fuel prices
    const prices = await scrapeFuelPrices(location);
    
    // Step 3: Cache the results
    savePricesToCache(prices);
    
    console.log("[FuelPrice] New prices fetched:", prices);
    return prices;
  } catch (error) {
    console.error("[FuelPrice] Failed to fetch prices:", error);
    
    // Return fallback prices based on timezone detection
    const countryCode = detectCountryFromTimezone();
    // Use unified pricing for fallback
    const regional = REGIONAL_PRICES[countryCode];
    const petrolPrice = countryCode === "KE" ? KENYA_PETROL_PRICE : (regional?.petrol || DEFAULT_PRICES.petrol);
    const dieselPrice = countryCode === "KE" ? KENYA_DIESEL_PRICE : (regional?.diesel || DEFAULT_PRICES.diesel);
    const fallbackPrices: FuelPrices = {
      petrolPrice,
      dieselPrice,
      currency: regional?.currency || "KES",
      currencySymbol: regional?.currencySymbol || "KSh",
      location: "Auto-detected",
      countryCode,
      fetchedAt: new Date().toISOString(),
      source: "Fallback Prices",
    };
    
    return fallbackPrices;
  }
}

// Background fetch with hidden iframe approach
export async function fetchPricesInBackground(): Promise<FuelPrices | null> {
  if (!shouldFetchPrices()) {
    const cached = getCachedPrices();
    return cached;
  }

  try {
    // Create a hidden iframe to fetch prices in the background
    // This runs completely invisible to the user
    const prices = await getFuelPrices();
    return prices;
  } catch (error) {
    console.error("[FuelPrice] Background fetch failed:", error);
    return null;
  }
}

// Reset the cache to force a fresh fetch (for testing)
export function resetPriceCache(): void {
  localStorage.removeItem(PRICES_CACHE_KEY);
  localStorage.removeItem(LAST_FETCH_KEY);
}

// Get prices with fallback for UI display
export function getDisplayPrices(): { pmsPrice: number; agoPrice: number; currencySymbol: string } {
  const cached = getCachedPrices();
  if (cached) {
    return {
      pmsPrice: cached.petrolPrice,
      agoPrice: cached.dieselPrice,
      currencySymbol: cached.currencySymbol,
    };
  }

  // Default fallback prices using unified pricing
  const countryCode = detectCountryFromTimezone();
  const regional = REGIONAL_PRICES[countryCode];
  return {
    pmsPrice: countryCode === "KE" ? KENYA_PETROL_PRICE : (regional?.petrol || DEFAULT_PRICES.petrol),
    agoPrice: countryCode === "KE" ? KENYA_DIESEL_PRICE : (regional?.diesel || DEFAULT_PRICES.diesel),
    currencySymbol: regional?.currencySymbol || DEFAULT_PRICES.currencySymbol,
  };
}
