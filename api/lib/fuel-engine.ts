/**
 * fuel-engine.ts — Global hyper-local fuel price engine.
 *
 * Pipeline:
 *   1. Reverse-geocode GPS → "Village, Region, Country" (Nominatim / OSM).
 *   2. Check the Supabase fuel_prices cache (exact match, fresh < 14 days).
 *   3. If missing/stale: web-search local prices (Serper), then parse the
 *      snippets with an LLM (Groq → OpenRouter/Llama fallback) into a
 *      structured {super_petrol, diesel, kerosene} JSON object. Upsert to DB.
 *   4. If web/AI fails (remote village): fall back to PostGIS nearest-neighbour
 *      within 50 km and return the closest town's price tagged "approximate".
 *
 * Runs SERVER-SIDE only (Vercel serverless). The Supabase service_role key,
 * SERPER_API_KEY and AI keys live in process.env and are never bundled into
 * the client. The client only ever calls /api/fuel-local?lat=&lon=.
 *
 * Env vars (set in Vercel Dashboard → Settings → Environment Variables):
 *   SUPABASE_URL                       — project URL (defaults to the hardcoded fallback)
 *   SUPABASE_SERVICE_ROLE_KEY          — service role key (bypasses RLS for writes)
 *   SERPER_API_KEY                     — optional; serper.dev (2,500 free searches/mo)
 *   GROQ_API_KEY                       — optional; console.groq.com (Llama-3, fast+free)
 *   OPENROUTER_API_KEY                 — optional; openrouter.ai (Llama fallback)
 *   FUEL_AI_MODEL                      — optional; override the AI model id
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ojjscjwatikixlpshmub.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SEXTANT_SUPABASE_SERVICE_ROLE_KEY ||
  "";

// Cache freshness window. EPRA/regulatory prices change roughly monthly, so 14
// days is a safe balance between freshness and API quota.
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
// Nearest-neighbour search radius when no exact match exists.
const NEAREST_RADIUS_KM = 50;

// LLM model ids per provider.
const GROQ_MODEL = process.env.FUEL_AI_MODEL || "llama-3.1-8b-instant";
const OPENROUTER_MODEL =
  process.env.FUEL_AI_MODEL || "meta-llama/llama-3.1-8b-instruct";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaceInfo {
  name: string;
  country: string;
  countryCode: string;
  region?: string;
  raw: string;
}

export interface FuelPriceSet {
  super_petrol?: number | null;
  diesel?: number | null;
  kerosene?: number | null;
  [key: string]: number | null | undefined;
}

export interface LocalFuelPrices {
  location: string;
  country: string;
  country_code?: string;
  lat: number;
  lon: number;
  prices: FuelPriceSet;
  currency: string;
  source: string;
  last_updated: string;
  is_approximate?: boolean;
  nearest_town?: string;
  distance_km?: number;
}

// ---------------------------------------------------------------------------
// Supabase server client (service_role — server-side only)
// ---------------------------------------------------------------------------

let serverClient: SupabaseClient | null = null;
function getServerSupabase(): SupabaseClient | null {
  if (!SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!serverClient) {
    serverClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}

// ---------------------------------------------------------------------------
// 1. Reverse Geocoding (GPS → place name)
// ---------------------------------------------------------------------------

async function getPlaceName(lat: number, lon: number): Promise<PlaceInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "FuelPro/1.0 (contact@fuelpro.app)" },
  });
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
  const data = (await res.json()) as {
    address?: Record<string, string>;
    display_name?: string;
  };
  const addr = data.address || {};
  // Prioritize the most local administrative unit: village > town > city.
  const name =
    addr.village ||
    addr.town ||
    addr.city ||
    addr.county ||
    addr.state_district ||
    addr.state ||
    "Unknown";
  const country = addr.country || "Unknown";
  const countryCode = (addr.country_code || "").toUpperCase() || "GLOBAL";
  return {
    name,
    country,
    countryCode,
    region: addr.state || addr.region,
    raw: data.display_name || `${name}, ${country}`,
  };
}

// ---------------------------------------------------------------------------
// 2. Web Search (Serper) — optional, gracefully skipped if no key
// ---------------------------------------------------------------------------

async function searchWebPrices(
  locationName: string,
  country: string,
  countryCode: string,
): Promise<string> {
  if (!process.env.SERPER_API_KEY) return "";
  const query = `current official fuel prices petrol diesel kerosene in ${locationName} ${country} ${new Date().getFullYear()}`;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: countryCode.toLowerCase() || "us",
      num: 5,
    }),
  });
  if (!res.ok) throw new Error(`Serper HTTP ${res.status}`);
  const data = (await res.json()) as {
    organic?: Array<{ snippet?: string }>;
    knowledgeGraph?: { description?: string };
    answerBox?: { answer?: string; snippet?: string };
  };
  // Combine snippets from the top organic results for richer AI context.
  const organic = data.organic || [];
  const snippets = organic
    .slice(0, 3)
    .map((r) => r.snippet || "")
    .filter(Boolean)
    .join(" ");
  // Include knowledge-graph / answer-box text when available.
  const kg = data.knowledgeGraph?.description || "";
  const ab = data.answerBox?.answer || data.answerBox?.snippet || "";
  return [ab, kg, snippets].filter(Boolean).join(" ").trim();
}

// ---------------------------------------------------------------------------
// 3. AI Extraction (Groq → OpenRouter/Llama fallback)
// ---------------------------------------------------------------------------

function buildAiPrompt(snippet: string, currencyHint: string): string {
  return [
    "Extract the current local fuel prices from the text below.",
    "Return ONLY a JSON object with this exact shape:",
    '{"super_petrol": <number|null>, "diesel": <number|null>, "kerosene": <number|null>}.',
    "Values are the per-litre price in the local currency (likely " +
      currencyHint +
      ").",
    "If a price is not mentioned, use null. Do not include any other keys or prose.",
    "Text:",
    '"""',
    snippet,
    '"""',
  ].join("\n");
}

function parsePriceJson(content: string): FuelPriceSet {
  // Strip markdown code fences if the model wrapped the JSON.
  const cleaned = content
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as FuelPriceSet;
  // Coerce numeric strings and drop non-numeric values.
  const out: FuelPriceSet = {};
  for (const key of ["super_petrol", "diesel", "kerosene"]) {
    const v = (parsed as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
    } else if (typeof v === "string") {
      const n = parseFloat(v.replace(/[^0-9.]/g, ""));
      out[key] = Number.isFinite(n) ? n : null;
    } else {
      out[key] = null;
    }
  }
  return out;
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 200,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI HTTP ${res.status}: ${txt.slice(0, 120)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned no content");
  return content;
}

async function extractPricesWithAI(
  snippet: string,
  currencyHint: string,
): Promise<FuelPriceSet> {
  const prompt = buildAiPrompt(snippet, currencyHint);

  // Try Groq first (fastest, free, matches the spec).
  if (process.env.GROQ_API_KEY) {
    try {
      const content = await callOpenAiCompatible(
        "https://api.groq.com/openai/v1",
        process.env.GROQ_API_KEY,
        GROQ_MODEL,
        prompt,
      );
      return parsePriceJson(content);
    } catch (e) {
      console.warn("[fuel-engine] Groq failed, trying fallback:", e);
    }
  }

  // Fallback: OpenRouter (Llama-3.1-8b-instruct), same OpenAI-compatible API.
  if (process.env.OPENROUTER_API_KEY) {
    const content = await callOpenAiCompatible(
      "https://openrouter.ai/api/v1",
      process.env.OPENROUTER_API_KEY,
      OPENROUTER_MODEL,
      prompt,
    );
    return parsePriceJson(content);
  }

  throw new Error(
    "No AI provider configured (GROQ_API_KEY / OPENROUTER_API_KEY)",
  );
}

// ---------------------------------------------------------------------------
// Currency hint from country code (best-effort)
// ---------------------------------------------------------------------------

function currencyForCountry(
  countryCode: string,
): { code: string; symbol: string } {
  const map: Record<string, { code: string; symbol: string }> = {
    KE: { code: "KES", symbol: "KSh" },
    UG: { code: "UGX", symbol: "USh" },
    TZ: { code: "TZS", symbol: "TSh" },
    NG: { code: "NGN", symbol: "₦" },
    ZA: { code: "ZAR", symbol: "R" },
    GH: { code: "GHS", symbol: "GH₵" },
    RW: { code: "RWF", symbol: "RF" },
    ET: { code: "ETB", symbol: "Br" },
    US: { code: "USD", symbol: "$" },
    GB: { code: "GBP", symbol: "£" },
    EU: { code: "EUR", symbol: "€" },
    IN: { code: "INR", symbol: "₹" },
  };
  return map[countryCode] || { code: "Local", symbol: "" };
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

interface FuelPriceRow {
  id: string;
  location_name: string;
  country: string;
  country_code?: string | null;
  lat: number | null;
  lon: number | null;
  prices: FuelPriceSet;
  currency: string;
  source: string;
  last_updated: string;
  query_count?: number;
}

function rowToPrices(
  row: FuelPriceRow,
  lat: number,
  lon: number,
  isApprox = false,
  nearestTown?: string,
  distanceKm?: number,
): LocalFuelPrices {
  return {
    location: row.location_name,
    country: row.country,
    country_code: row.country_code || undefined,
    lat,
    lon,
    prices: row.prices || {},
    currency: row.currency,
    source: row.source,
    last_updated: row.last_updated,
    is_approximate: isApprox,
    nearest_town: nearestTown,
    distance_km: distanceKm,
  };
}

// ---------------------------------------------------------------------------
// 🚀 MAIN ORCHESTRATOR
// ---------------------------------------------------------------------------

export async function getLocalFuelPrices(
  lat: number,
  lon: number,
): Promise<LocalFuelPrices> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid coordinates");
  }

  // A. Reverse-geocode.
  const place = await getPlaceName(lat, lon);
  if (place.name === "Unknown") throw new Error("Location not found");

  const supabase = getServerSupabase();

  // B. Exact-match cache check (server-side, service_role).
  if (supabase) {
    const { data: cached, error } = await supabase
      .from("fuel_prices")
      .select("*")
      .eq("location_name", place.name)
      .eq("country", place.country)
      .maybeSingle();

    if (!error && cached) {
      const row = cached as FuelPriceRow;
      const age = Date.now() - new Date(row.last_updated).getTime();
      if (age < CACHE_TTL_MS) {
        // Bump the query_count so the monthly cron refreshes busy spots first.
        try {
          await supabase.rpc("bump_fuel_query_count", {
            p_location_name: place.name,
            p_country: place.country,
          });
        } catch {
          /* non-fatal: query-count bump is best-effort */
        }
        return rowToPrices(row, lat, lon);
      }
    }
  }

  // C. Fetch fresh data: web search → AI parse → upsert.
  try {
    const snippets = await searchWebPrices(
      place.name,
      place.country,
      place.countryCode,
    );
    if (!snippets)
      throw new Error(
        "No web data (SERPER_API_KEY missing or empty results)",
      );

    const currency = currencyForCountry(place.countryCode);
    const prices = await extractPricesWithAI(snippets, currency.code);

    // Require at least one valid price to cache.
    const hasAny =
      prices.super_petrol != null ||
      prices.diesel != null ||
      prices.kerosene != null;
    if (!hasAny) throw new Error("AI could not extract any prices");

    if (supabase) {
      const { data: saved, error: upErr } = await supabase
        .from("fuel_prices")
        .upsert(
          {
            location_name: place.name,
            country: place.country,
            country_code: place.countryCode,
            lat,
            lon,
            location: `POINT(${lon} ${lat})`,
            prices,
            currency: currency.code,
            source: "AI-Verified",
            last_updated: new Date().toISOString(),
            query_count: 1,
          },
          { onConflict: "location_name,country" },
        )
        .select()
        .single();

      if (!upErr && saved) {
        return rowToPrices(saved as FuelPriceRow, lat, lon);
      }
      // Upsert failed: still return the freshly parsed prices.
      console.warn("[fuel-engine] upsert failed:", upErr?.message);
    }

    return {
      location: place.name,
      country: place.country,
      country_code: place.countryCode,
      lat,
      lon,
      prices,
      currency: currency.code,
      source: "AI-Verified (uncached)",
      last_updated: new Date().toISOString(),
    };
  } catch (e) {
    // D. Fallback: nearest cached town within radius (PostGIS).
    if (supabase) {
      const { data: nearest } = await supabase.rpc("get_nearest_fuel", {
        user_lat: lat,
        user_lon: lon,
        radius_km: NEAREST_RADIUS_KM,
      });
      if (nearest && Array.isArray(nearest) && nearest.length > 0) {
        const n = nearest[0] as {
          location_name: string;
          distance_km: number;
          prices: FuelPriceSet;
          currency: string;
          source: string;
          last_updated: string;
        };
        return {
          location: place.name,
          country: place.country,
          country_code: place.countryCode,
          lat,
          lon,
          prices: n.prices || {},
          currency: n.currency,
          source: `Approx. (nearest: ${n.location_name})`,
          last_updated: n.last_updated,
          is_approximate: true,
          nearest_town: n.location_name,
          distance_km: n.distance_km,
        };
      }
    }

    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No fuel data for ${place.name}: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Monthly refresh — used by the cron handler.
// ---------------------------------------------------------------------------

export async function refreshTopLocations(limit = 50): Promise<number> {
  const supabase = getServerSupabase();
  if (!supabase)
    throw new Error("No server Supabase client (missing service role key)");

  const { data: top, error } = await supabase
    .from("fuel_prices")
    .select("lat, lon")
    .order("query_count", { ascending: false })
    .limit(limit);

  if (error || !top) throw new Error("Could not fetch top locations");

  let updated = 0;
  for (const loc of top as Array<{
    lat: number | null;
    lon: number | null;
  }>) {
    if (loc.lat == null || loc.lon == null) continue;
    try {
      await getLocalFuelPrices(loc.lat, loc.lon);
      updated++;
    } catch {
      /* ignore individual failures */
    }
  }
  return updated;
}
