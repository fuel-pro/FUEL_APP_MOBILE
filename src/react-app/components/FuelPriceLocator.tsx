import { useState, useCallback, useEffect, useRef } from "react";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";
import { useAuth } from "@/react-app/context/AuthContext";
import { useLocation } from "@/react-app/context/LocationContext";
import { useStations } from "@/react-app/context/StationContext";
import { useFuelPrices } from "@/react-app/hooks/useFuelPrices";
import { getClosestKenyaCityPrice, KENYA_BASE_PRICES, REGIONAL_PRICES } from "@/react-app/config/pricing";
import {
  MapPin,
  Navigation,
  Fuel,
  Gauge,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Zap,
  Droplet,
} from "lucide-react";

// ── Types ──

interface NearbyPriceResult {
  success: boolean;
  mode?: string;
  timestamp?: string;
  coordinates?: { latitude: string; longitude: string };
  locationName?: string;
  country?: string;
  stationName?: string;
  currency?: string;
  currencySymbol?: string;
  unit?: string;
  prices?: {
    gasoline?: string;
    petrol?: string;
    diesel?: string;
    premium?: string;
    kerosene?: string;
  };
  kerosenePrice?: number | null;
  source?: string;
  distance_km?: number;
  last_updated?: string;
  error?: string;
}

interface StationPriceInfo {
  stationName: string;
  gasoline: number | null;
  diesel: number | null;
  premium: number | null;
  kerosene: number | null;
  currency: string;
  currencySymbol: string;
  unit: string;
  source: string;
  location?: string;
}

const CLOUD_CACHE_KEY = "fuel_price_locator_cache";
const CACHE_TTL_MS = 3600_000; // 1 hour

// ── Component ──

export default function FuelPriceLocator() {
  const { user } = useAuth();
  const { preciseLocation, preciseLocationLoading, detectPreciseLocation, currentCountry } = useLocation();
  const { stations } = useStations();
  const { prices: unifiedPrices, refreshPrices, source: unifiedSource, cityName } = useFuelPrices();

  const [loading, setLoading] = useState(false);
  const [nearbyResult, setNearbyResult] = useState<StationPriceInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null);
  const echoSkipRef = useRef(false);

  // Load cached result from cloud on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const cached = await cloudStorageService.get<{ data: StationPriceInfo; ts: number } | null>(CLOUD_CACHE_KEY);
      if (!cancelled && cached?.data) {
        const age = Date.now() - (cached.ts || 0);
        if (age < CACHE_TTL_MS) {
          setNearbyResult(cached.data);
          setLastFetchAt(new Date(cached.ts).toISOString());
        }
      }
    })();

    // Subscribe to real-time cache updates from other devices
    const unsub = cloudStorageService.subscribe<{ data: StationPriceInfo; ts: number } | null>(
      CLOUD_CACHE_KEY,
      undefined,
      (val) => {
        if (echoSkipRef.current) {
          echoSkipRef.current = false;
          return;
        }
        if (val?.data) {
          setNearbyResult(val.data);
          setLastFetchAt(new Date(val.ts).toISOString());
        }
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  // Auto-detect location on first mount if not already available
  useEffect(() => {
    if (!preciseLocation && !preciseLocationLoading && user) {
      detectPreciseLocation().catch(() => {});
    }
  }, [user, preciseLocation, preciseLocationLoading, detectPreciseLocation]);

  const saveToCloud = useCallback(
    (data: StationPriceInfo) => {
      if (!user) return;
      echoSkipRef.current = true;
      cloudStorageService.set(CLOUD_CACHE_KEY, { data, ts: Date.now() }).catch(() => {});
    },
    [user]
  );

  /**
   * Fetch nearby fuel prices from the serverless API using GPS coordinates.
   * Falls back to the unified pricing system (location-aware static prices)
   * if the API is unavailable or returns no data.
   */
  const fetchNearbyPrices = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    // Use precise GPS if available, otherwise prompt for it
    let lat = preciseLocation?.lat;
    let lng = preciseLocation?.lng;

    if (!lat || !lng) {
      try {
        await detectPreciseLocation();
      } catch {
        // detectPreciseLocation handles its own errors; fall through
      }
      // Re-read from context after detection — but since state updates are
      // async, we'll use the unified prices as fallback in this cycle
    }

    // Try the serverless API with coordinates
    if (lat && lng) {
      try {
        // Pass location name + country so the API uses the Smart-Cache
        // hybrid fetcher (exact cache → PostGIS nearest 50km → live AI).
        const locName =
          preciseLocation?.city ||
          preciseLocation?.address ||
          cityName ||
          "";
        const locCountry = currentCountry?.name || "";
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
        });
        if (locName) params.set("name", locName);
        if (locCountry) params.set("country", locCountry);

        const response = await fetch(`/api/fuel-prices?${params.toString()}`);
        if (response.ok) {
          const data: NearbyPriceResult = await response.json();
          if (data.success && data.prices) {
            // Smart-cache mode uses petrol/diesel/kerosene keys; legacy
            // geolocation mode uses gasoline/diesel/premium. Support both.
            const petrolVal =
              data.prices.petrol ?? data.prices.gasoline ?? "N/A";
            const dieselVal = data.prices.diesel ?? "N/A";
            const keroseneVal =
              data.prices.kerosene ??
              (data.kerosenePrice !== null && data.kerosenePrice !== undefined
                ? String(data.kerosenePrice)
                : "N/A");

            const result: StationPriceInfo = {
              stationName: data.stationName || data.locationName || "Nearby Station",
              gasoline: parseFloat(petrolVal) || null,
              diesel: parseFloat(dieselVal) || null,
              premium: parseFloat(data.prices.premium || "N/A") || null,
              kerosene: parseFloat(keroseneVal) || null,
              currency: data.currency || "USD",
              currencySymbol: data.currencySymbol || "",
              unit: data.unit || "litre",
              source: data.source || "Live API",
              location:
                data.distance_km !== undefined
                  ? `${data.locationName || locName} (${data.distance_km.toFixed(1)} km away)`
                  : `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            };
            setNearbyResult(result);
            setLastFetchAt(new Date().toISOString());
            saveToCloud(result);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Network error — fall through to unified pricing
      }
    }

    // Fallback: use the unified pricing system (location-aware static prices)
    // This integrates with the existing LocationContext + pricing.ts config
    const countryCode = currentCountry?.id || "KE";
    const currency = currentCountry?.currency?.code || "KES";
    const symbol = currentCountry?.currency?.symbol || "KSh";

    let petrol = unifiedPrices.petrol;
    let diesel = unifiedPrices.diesel;
    let kerosene = unifiedPrices.kerosene;
    let stationName = unifiedSource || "Regional Average";
    let location = cityName || currentCountry?.name || countryCode;

    // If in Kenya with GPS, use city-specific prices with transport surcharge
    if (countryCode === "KE" && lat && lng) {
      const cityPrice = getClosestKenyaCityPrice(lat, lng);
      petrol = cityPrice.petrolPrice;
      diesel = cityPrice.dieselPrice;
      kerosene = cityPrice.kerosenePrice;
      stationName = `EPRA - ${cityPrice.name} (${cityPrice.transportSurcharge >= 0 ? "+" : ""}${cityPrice.transportSurcharge.toFixed(2)} transport)`;
      location = cityPrice.name;
    } else if (!REGIONAL_PRICES[countryCode] && countryCode !== "KE") {
      // Unknown country — use Kenya defaults as universal fallback
      petrol = KENYA_BASE_PRICES.petrol;
      diesel = KENYA_BASE_PRICES.diesel;
      kerosene = KENYA_BASE_PRICES.kerosene;
    }

    const result: StationPriceInfo = {
      stationName,
      gasoline: petrol,
      diesel,
      premium: unifiedPrices.vPower ?? null,
      kerosene,
      currency,
      currencySymbol: symbol,
      unit: "litre",
      source: preciseLocation ? `${unifiedSource} (GPS)` : unifiedSource,
      location,
    };

    setNearbyResult(result);
    setLastFetchAt(new Date().toISOString());
    saveToCloud(result);
    setLoading(false);
  }, [
    preciseLocation,
    detectPreciseLocation,
    currentCountry,
    unifiedPrices,
    unifiedSource,
    cityName,
    saveToCloud,
  ]);

  // ── Render helpers ──

  const formatPrice = (val: number | null, currency: string, symbol: string, unit: string): string => {
    if (val === null || isNaN(val)) return "N/A";
    const formatted = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return symbol ? `${symbol} ${formatted} / ${unit}` : `${currency} ${formatted} / ${unit}`;
  };

  const priceCard = (
    label: string,
    val: number | null,
    icon: React.ReactNode,
    colorClass: string
  ) => (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className={colorClass}>{icon}</span>
        <span className="text-xs text-slate-400 uppercase font-semibold">{label}</span>
      </div>
      <span className={`text-lg font-bold ${val !== null ? "text-white" : "text-slate-600"}`}>
        {val !== null
          ? formatPrice(val, nearbyResult?.currency || "KES", nearbyResult?.currencySymbol || "KSh", nearbyResult?.unit || "litre")
          : "N/A"}
      </span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-600/20 rounded-xl">
          <Navigation className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Fuel Price Finder</h2>
          <p className="text-sm text-slate-400">
            Find real-time fuel prices near your location using GPS coordinates
          </p>
        </div>
      </div>

      {/* Location status bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className={`w-4 h-4 ${preciseLocation ? "text-emerald-400" : "text-slate-500"}`} />
          {preciseLocationLoading ? (
            <span className="text-amber-400">Detecting location...</span>
          ) : preciseLocation ? (
            <span className="text-slate-300">
              {preciseLocation.city || preciseLocation.address} ({preciseLocation.lat.toFixed(4)}, {preciseLocation.lng.toFixed(4)})
            </span>
          ) : (
            <span className="text-slate-500">Location not detected</span>
          )}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => detectPreciseLocation()}
          disabled={preciseLocationLoading}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Update Location
        </button>
      </div>

      {/* Action button */}
      <button
        onClick={fetchNearbyPrices}
        disabled={loading || preciseLocationLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-4 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Finding Nearby Prices...
          </>
        ) : (
          <>
            <Fuel className="w-5 h-5" />
            Scan Local Fuel Rates
          </>
        )}
      </button>

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <span className="text-xs text-red-400">{errorMessage}</span>
        </div>
      )}

      {/* Results */}
      {nearbyResult && (
        <div className="space-y-4">
          {/* Station info */}
          <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block uppercase font-semibold">Closest Tracked Station</span>
                <p className="text-md font-medium text-slate-200 mt-0.5">{nearbyResult.stationName}</p>
                {nearbyResult.location && (
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {nearbyResult.location}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Live</span>
              </div>
            </div>
          </div>

          {/* Price grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {priceCard("Gasoline / Petrol", nearbyResult.gasoline, <Fuel className="w-4 h-4" />, "text-emerald-400")}
            {priceCard("Automotive Diesel", nearbyResult.diesel, <Droplet className="w-4 h-4" />, "text-amber-400")}
            {priceCard("Premium / V-Power", nearbyResult.premium, <Zap className="w-4 h-4" />, "text-purple-400")}
            {priceCard("Kerosene", nearbyResult.kerosene, <Gauge className="w-4 h-4" />, "text-blue-400")}
          </div>

          {/* Source + timestamp */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingUp className="w-3.5 h-3.5" />
              Source: {nearbyResult.source}
            </div>
            {lastFetchAt && (
              <div className="text-xs text-slate-500">
                Updated {new Date(lastFetchAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Your stations comparison */}
      {stations.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-blue-400" />
            Your Station Prices
          </h3>
          <div className="space-y-2">
            {stations.slice(0, 5).map((station) => {
              const stationPetrol = station.data?.pmsPrice || station.data?.petrolPrice;
              const stationDiesel = station.data?.agoPrice || station.data?.dieselPrice;
              return (
                <div
                  key={station.id}
                  className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/30"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">{station.name}</p>
                    {station.location && (
                      <p className="text-xs text-slate-500">{station.location}</p>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs">
                    {stationPetrol && (
                      <div className="text-right">
                        <span className="block text-slate-500">Petrol</span>
                        <span className="font-medium text-emerald-400">
                          {(unifiedPrices.currencySymbol || "KSh")} {stationPetrol.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {stationDiesel && (
                      <div className="text-right">
                        <span className="block text-slate-500">Diesel</span>
                        <span className="font-medium text-amber-400">
                          {(unifiedPrices.currencySymbol || "KSh")} {stationDiesel.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unified prices refresh */}
      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Unified prices from: <span className="text-slate-400">{unifiedSource}</span>
          {cityName && <span className="text-slate-400"> ({cityName})</span>}
        </div>
        <button
          onClick={refreshPrices}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh Prices
        </button>
      </div>
    </div>
  );
}
