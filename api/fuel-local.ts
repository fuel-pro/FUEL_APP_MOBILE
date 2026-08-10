/**
 * /api/fuel-local
 *
 * Returns hyper-local fuel prices for the caller's GPS coordinates.
 * Delegates to the fuel-engine (reverse-geocode → cache → web search →
 * AI parse → PostGIS nearest-neighbour fallback).
 *
 * Query params:
 *   lat  (required) — latitude
 *   lon  (required) — longitude
 *
 * Response 200: LocalFuelPrices JSON
 * Response 400: missing/invalid coords
 * Response 500: engine error (no data available for the region)
 *
 * All third-party keys (Supabase service role, Serper, Groq/OpenRouter)
 * stay server-side. The client only sees the parsed result.
 */

import { getLocalFuelPrices } from "./lib/fuel-engine.js";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lon = parseFloat(url.searchParams.get("lon") || "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing or invalid 'lat' / 'lon' query parameters.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const data = await getLocalFuelPrices(lat, lon);
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Brief CDN cache (5 min) keyed by lat/lon — the engine itself has a
        // 14-day DB cache, this just absorbs burst traffic for the same spot.
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message, lat, lon }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
