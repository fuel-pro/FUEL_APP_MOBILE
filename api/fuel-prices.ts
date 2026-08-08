/**
 * /api/fuel-prices
 *
 * Serverless endpoint that fetches live, EPRA-sourced Kenya pump prices
 * from oilpriceapi.com. The API key stays server-side (process.env, not
 * VITE_-prefixed) so it's never exposed in the client bundle.
 *
 * Free tier: 200 requests/month. We fetch at most 3 codes/request and the
 * client caches results for a full day, so usage stays well under quota.
 *
 * Set OILPRICE_API_KEY in your Vercel project's Environment Variables
 * (not .env.local, which only affects the Vite frontend build).
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

export async function GET(): Promise<Response> {
  const apiKey = process.env.OILPRICE_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "OILPRICE_API_KEY not configured on the server",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const [petrol, diesel, kerosene] = await Promise.all([
    fetchCode(CODES.petrol, apiKey),
    fetchCode(CODES.diesel, apiKey),
    fetchCode(CODES.kerosene, apiKey),
  ]);

  // Only report success if we got at least petrol and diesel —
  // partial/garbage data is worse than a clean fallback signal.
  const success = petrol !== null && diesel !== null;

  return new Response(
    JSON.stringify({
      success,
      petrolPrice: petrol,
      dieselPrice: diesel,
      keroseneprice: kerosene,
      currency: "KES",
      currencySymbol: "KSh",
      source: "EPRA (via oilpriceapi.com)",
      fetchedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Vercel edge/CDN cache — prices only change monthly, so a
        // generous cache window is safe and saves API quota.
        "Cache-Control": "public, max-age=43200, s-maxage=43200",
      },
    }
  );
}
