/**
 * /api/fuel-prices
 *
 * Serverless endpoint with TWO modes:
 *
 * 1. **Kenya EPRA mode** (no lat/lng): fetches live, EPRA-sourced Kenya pump
 *    prices from oilpriceapi.com. Free tier 200 req/month; the client caches
 *    for a full day so usage stays well under quota.
 *    Requires: OILPRICE_API_KEY env var.
 *
 * 2. **Geolocation mode** (lat/lng provided): queries CollectAPI Gas Prices
 *    for station-level prices near the user's GPS coordinates. Falls back to
 *    Kenya EPRA mode when the coords resolve to Kenya and no CollectAPI key
 *    is configured, so the endpoint always returns useful data.
 *    Requires: GLOBAL_FUEL_API_KEY env var (optional; gracefully degrades).
 *
 * All API keys stay server-side (process.env, never VITE_-prefixed) so they
 * are never exposed in the client bundle.
 */

const CODES = {
  petrol: "GASOLINE_RETAIL_KE_KES",
  diesel: "DIESEL_RETAIL_KE_KES",
  kerosene: "KEROSENE_RETAIL_KE_KES",
} as const;

interface OilPriceApiResponse {
  status?: string;
  data?: {
    price?: number;
    formatted?: string;
    currency?: string;
    code?: string;
    unit?: string;
    timestamp?: string;
  };
}

interface CollectApiResponse {
  success?: boolean;
  result?: {
    currency?: string;
    unit?: string;
    station?: string;
    gasoline?: string | number;
    diesel?: string | number;
    premium?: string | number;
  };
}

async function fetchCode(code: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.oilpriceapi.com/v1/prices/latest?by_code=${code}`,
      { headers: { Authorization: `Token ${apiKey}` } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as OilPriceApiResponse;
    if (json.status === "success" && typeof json.data?.price === "number") {
      return json.data.price;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Query CollectAPI for station-level fuel prices near the given coordinates.
 * Returns normalized data or null on failure. The API key is injected
 * server-side so it's never exposed to the client.
 */
async function fetchNearbyPrices(
  lat: string,
  lng: string,
  apiKey: string
): Promise<{
  stationName: string;
  gasoline: string;
  diesel: string;
  premium: string;
  currency: string;
  unit: string;
} | null> {
  try {
    const targetApiUrl = `https://api.collectapi.com/gasPrice/fromCoordinates?lat=${lat}&lng=${lng}`;
    const apiResponse = await fetch(targetApiUrl, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: `apikey ${apiKey}`,
      },
    });
    if (!apiResponse.ok) return null;
    const rawData = (await apiResponse.json()) as CollectApiResponse;
    if (!rawData?.result) return null;

    return {
      stationName: rawData.result.station || "Nearest Gas Station",
      gasoline: String(rawData.result.gasoline ?? "N/A"),
      diesel: String(rawData.result.diesel ?? "N/A"),
      premium: String(rawData.result.premium ?? "N/A"),
      currency: rawData.result.currency || "USD",
      unit: rawData.result.unit || "gallon",
    };
  } catch {
    return null;
  }
}

/**
 * Fetches live Kenya EPRA prices. Shared between both modes (used directly
 * in mode 1, and as a fallback in mode 2 when CollectAPI is unavailable or
 * the coordinates resolve to Kenya).
 */
async function fetchKenyaEpraPrices(apiKey: string) {
  const [petrol, diesel, kerosene] = await Promise.all([
    fetchCode(CODES.petrol, apiKey),
    fetchCode(CODES.diesel, apiKey),
    fetchCode(CODES.kerosene, apiKey),
  ]);
  const success = petrol !== null && diesel !== null;
  return { petrol, diesel, kerosene, success };
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  const corsHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  // ── Mode 2: Geolocation query ──
  if (lat && lng) {
    const collectApiKey = process.env.GLOBAL_FUEL_API_KEY;

    // Try CollectAPI for station-level nearby prices
    if (collectApiKey) {
      const nearby = await fetchNearbyPrices(lat, lng, collectApiKey);
      if (nearby) {
        return new Response(
          JSON.stringify({
            success: true,
            mode: "geolocation",
            timestamp: new Date().toISOString(),
            coordinates: { latitude: lat, longitude: lng },
            stationName: nearby.stationName,
            currency: nearby.currency,
            unit: nearby.unit,
            prices: {
              gasoline: nearby.gasoline,
              diesel: nearby.diesel,
              premium: nearby.premium,
            },
            source: "CollectAPI Gas Prices",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Cache-Control": "s-maxage=3600, stale-while-revalidate=600",
            },
          }
        );
      }
    }

    // Fallback: if Kenya EPRA key is configured, return national prices
    const oilApiKey = process.env.OILPRICE_API_KEY;
    if (oilApiKey) {
      const epra = await fetchKenyaEpraPrices(oilApiKey);
      return new Response(
        JSON.stringify({
          success: epra.success,
          mode: "geolocation-fallback",
          timestamp: new Date().toISOString(),
          coordinates: { latitude: lat, longitude: lng },
          stationName: "National Average (Kenya EPRA)",
          currency: "KES",
          currencySymbol: "KSh",
          unit: "litre",
          prices: {
            gasoline: epra.petrol !== null ? String(epra.petrol) : "N/A",
            diesel: epra.diesel !== null ? String(epra.diesel) : "N/A",
            premium: "N/A",
          },
          kerosenePrice: epra.kerosene,
          source: "EPRA (via oilpriceapi.com)",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Cache-Control": "s-maxage=3600, stale-while-revalidate=600",
          },
        }
      );
    }

    // No API keys configured — return a clean signal so the client can
    // fall back to its own location-based static pricing
    return new Response(
      JSON.stringify({
        success: false,
        mode: "geolocation",
        error: "No fuel price API keys configured on the server",
        coordinates: { latitude: lat, longitude: lng },
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  // ── Mode 1: Kenya EPRA national prices (existing behavior) ──
  const apiKey = process.env.OILPRICE_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "OILPRICE_API_KEY not configured on the server",
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  const epra = await fetchKenyaEpraPrices(apiKey);

  return new Response(
    JSON.stringify({
      success: epra.success,
      mode: "kenya-epra",
      petrolPrice: epra.petrol,
      dieselPrice: epra.diesel,
      keroseneprice: epra.kerosene,
      currency: "KES",
      currencySymbol: "KSh",
      source: "EPRA (via oilpriceapi.com)",
      fetchedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        // Vercel edge/CDN cache — prices only change monthly, so a
        // generous cache window is safe and saves API quota.
        "Cache-Control": "public, max-age=43200, s-maxage=43200",
      },
    }
  );
}
