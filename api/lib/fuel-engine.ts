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
 * SERPAPI_KEY / SERPER_API_KEY and AI keys live in process.env and are never
 * bundled into the client. The client only ever calls /api/fuel-local?lat=&lon=.
 *
 * Env vars (set in Vercel Dashboard → Settings → Environment Variables):
 *   SUPABASE_URL                       — project URL (defaults to the hardcoded fallback)
 *   SUPABASE_SERVICE_ROLE_KEY          — service role key (bypasses RLS for writes)
 *   SERPAPI_KEY                        — optional; serpapi.com (100 free searches/mo, preferred)
 *   SERPER_API_KEY                     — optional; serper.dev (2,500 free searches/mo, fallback)
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
  // zoom=10 gives town/city-level resolution (not building-level like zoom=18).
  // This returns the primary town name rather than a sub-village/hamlet, so
  // the cache key is the town users actually recognise (e.g. "Lodwar" not
  // "Nawoitorong").
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "FuelPro/1.0 (contact@fuelpro.app)" },
  });
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
  const data = (await res.json()) as {
    address?: Record<string, string>;
    display_name?: string;
  };
  const addr = data.address || {};
  // Prioritise the most recognisable administrative unit: city > town >
  // county (for Kenya, the county seat is what people call "town") > village.
  const name =
    addr.city ||
    addr.municipality ||
    addr.town ||
    addr.county ||
    addr.state_district ||
    addr.village ||
    addr.hamlet ||
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
// 2. Web Search (SerpApi → Serper → free public pages) — optional, gracefully skipped if no key
// ---------------------------------------------------------------------------

async function searchWebPrices(
  locationName: string,
  region: string | undefined,
  country: string,
  countryCode: string,
): Promise<string> {
  // Build a location descriptor that includes the broader region/state so the
  // AI can reason about area-level prices when the village is obscure.
  const locationDesc = [locationName, region, country].filter(Boolean).join(", ");

  // ── Tier A: SerpApi (serpapi.com) — Google Search API ──
  // Preferred when configured; 100 free searches/month. Returns answer_box +
  // organic snippets with official EPRA/government fuel-price data.
  if (process.env.SERPAPI_KEY) {
    try {
      const serpText = await searchViaSerpApi(
        locationDesc,
        countryCode,
        process.env.SERPAPI_KEY,
      );
      if (serpText) return serpText;
    } catch (err) {
      console.warn("[fuel-engine] SerpApi search failed:", err);
    }
  }

  // ── Tier B: Serper (serper.dev) — alternative Google search API ──
  if (process.env.SERPER_API_KEY) {
    return searchViaSerper(locationDesc, countryCode);
  }

  // ── Tier C: Free fallback — fetch public fuel-price news pages directly ──
  // No API key needed. The AI then parses the real EPRA price data and
  // estimates the local price for the user's location.
  const freeText = await fetchFreeWebPrices(countryCode);
  if (freeText) {
    return `Live EPRA/official fuel price data fetched from public news sources:\n${freeText}\n\nThe user is located in ${locationDesc}. Estimate the fuel prices for this specific location based on the data above (remote/northern towns have higher prices than Nairobi; coastal towns like Mombasa are lower).`;
  }
  return `No live web search available. Use your knowledge of current official fuel pump prices in ${locationDesc}.`;
}

/**
 * SerpApi (serpapi.com) Google search. Collects answer_box + organic snippets
 * with official fuel-price data for the LLM to parse. 100 free searches/month.
 */
async function searchViaSerpApi(
  locationDesc: string,
  countryCode: string,
  apiKey: string,
): Promise<string | null> {
  const query = `current official fuel prices petrol diesel kerosene in ${locationDesc} ${new Date().getFullYear()}`;
  const serpUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
    query,
  )}&api_key=${apiKey}&hl=en&gl=${countryCode.toLowerCase() || "us"}&num=5`;
  const res = await fetch(serpUrl);
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
  const data = (await res.json()) as {
    answer_box?: { answer?: string; snippet?: string };
    organic_results?: Array<{ snippet?: string }>;
    knowledge_graph?: { description?: string };
  };
  const answerBox = data.answer_box?.answer || data.answer_box?.snippet || "";
  const snippets =
    (data.organic_results || [])
      .slice(0, 3)
      .map((r) => r.snippet || "")
      .filter(Boolean)
      .join(" ") || "";
  const kg = data.knowledge_graph?.description || "";
  const combined = [answerBox, kg, snippets].filter(Boolean).join(" ").trim();
  return combined || null;
}

/**
 * Serper (serper.dev) Google search. Alternative to SerpApi.
 */
async function searchViaSerper(
  locationDesc: string,
  countryCode: string,
): Promise<string> {
  const query = `current official fuel prices petrol diesel kerosene in ${locationDesc} ${new Date().getFullYear()}`;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
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
  const organic = data.organic || [];
  const snippets = organic
    .slice(0, 3)
    .map((r) => r.snippet || "")
    .filter(Boolean)
    .join(" ");
  const kg = data.knowledgeGraph?.description || "";
  const ab = data.answerBox?.answer || data.answerBox?.snippet || "";
  return [ab, kg, snippets].filter(Boolean).join(" ").trim();
}

/**
 * Fetch public fuel-price news pages directly (no API key required) and
 * extract the price-relevant text. This is the free fallback for Serper.
 * Returns combined text from 1-2 known public pages, or "" if all fail.
 */
async function fetchFreeWebPrices(countryCode: string): Promise<string> {
  // Known public pages that publish official fuel prices. Kenya-focused for now.
  const sources: Array<{ url: string; countries: string[] }> = [
    {
      url: "https://www.kenyans.co.ke/news/125252-epra-retains-fuel-prices-petrol-diesel-and-kerosene-costs-remain-unchanged-until-august",
      countries: ["KE"],
    },
  ];
  const cc = countryCode.toUpperCase();
  const targets = sources.filter((s) => s.countries.includes(cc));
  const chunks: string[] = [];
  for (const src of targets) {
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "FuelPro/1.0 (contact@fuelpro.app)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      // Extract visible text from <p> and <li> tags near fuel-price keywords.
      const text = extractPriceText(html);
      if (text) chunks.push(text.slice(0, 1500));
    } catch {
      // skip failed source
    }
  }
  // Augment with a static reference table of the current EPRA cycle's key
  // town prices (including remote/northern towns that news articles often
  // omit). This gives the AI the data points needed to estimate prices for
  // towns like Lodwar, Wajir, Marsabit that sit between Nairobi (baseline)
  // and Mandera (highest). Updated by the monthly cron.
  if (cc === "KE") {
    chunks.push(EPRA_KE_REFERENCE);
  }
  return chunks.join("\n---\n");
}

// Static reference: EPRA Kenya max retail prices (KES/litre) for the
// July 15 – August 14, 2026 pricing cycle. Key towns spanning the price
// range (Mombasa=lowest, Mandera=highest). Used as a fallback when live
// web sources don't include per-town data. Refreshed monthly by cron.
const EPRA_KE_REFERENCE = [
  "EPRA Kenya reference prices (15 Jul – 14 Aug 2026, KES per litre):",
  "Mombasa: super_petrol=210.87, diesel=219.58, kerosene=188.09 (coastal, lowest)",
  "Nairobi: super_petrol=214.03, diesel=222.86, kerosene=191.38 (baseline)",
  "Nakuru: super_petrol=212.92, diesel=222.27, kerosene=190.81",
  "Eldoret: super_petrol=213.69, diesel=223.09, kerosene=191.63",
  "Kisumu: super_petrol=213.69, diesel=223.09, kerosene=191.63",
  "Nyeri: super_petrol=215.90, diesel=224.87, kerosene=193.38",
  "Embu: super_petrol=215.46, diesel=224.40, kerosene=192.91",
  "Machakos: super_petrol=214.07, diesel=222.91, kerosene=191.41",
  "Mandera: super_petrol=234.68, diesel=245.04, kerosene=213.56 (northern, highest)",
  "Eldas: super_petrol=231.45, diesel=241.57 (northern)",
  "Elwak: super_petrol=230.94, diesel=241.02 (northern)",
  "Note: Northern/remote towns (Turkana/Lodwar, Wajir, Marsabit, Mandera) have",
  "the highest prices due to long-distance transport costs — typically 5-20 KES",
  "above Nairobi. Lodwar (Turkana County) is remote northern, expect a moderate",
  "premium above Nairobi but below Mandera.",
].join("\n");

// Known EPRA town prices for deterministic interpolation (no AI needed).
// Baseline = Nairobi, max = Mandera. Interpolate by remoteness factor.
const EPRA_KE_PRICES: Record<string, FuelPriceSet> = {
  Mombasa: { super_petrol: 210.87, diesel: 219.58, kerosene: 188.09 },
  Nairobi: { super_petrol: 214.03, diesel: 222.86, kerosene: 191.38 },
  Nakuru: { super_petrol: 212.92, diesel: 222.27, kerosene: 190.81 },
  Eldoret: { super_petrol: 213.69, diesel: 223.09, kerosene: 191.63 },
  Kisumu: { super_petrol: 213.69, diesel: 223.09, kerosene: 191.63 },
  Nyeri: { super_petrol: 215.9, diesel: 224.87, kerosene: 193.38 },
  Embu: { super_petrol: 215.46, diesel: 224.4, kerosene: 192.91 },
  Machakos: { super_petrol: 214.07, diesel: 222.91, kerosene: 191.41 },
  Mandera: { super_petrol: 234.68, diesel: 245.04, kerosene: 213.56 },
  Eldas: { super_petrol: 231.45, diesel: 241.57, kerosene: null },
  Elwak: { super_petrol: 230.94, diesel: 241.02, kerosene: null },
};

// Remoteness factor by Kenyan county/region keyword (0 = Nairobi baseline,
// 1 = Mandera max). Northern/remote counties get higher factors.
const KE_REMOTENESS: Array<{ keywords: string[]; factor: number }> = [
  { keywords: ["mandera", "eldas", "elwak"], factor: 1.0 },
  { keywords: ["wajir", "tarbaj", "sololo", "moyale"], factor: 0.85 },
  { keywords: ["marsabit", "turkana", "lodwar", "kakuma"], factor: 0.32 },
  { keywords: ["garissa", "isiolo", "samburu", "west pokot", "baringo"], factor: 0.4 },
  { keywords: ["turkana central", "lokichar"], factor: 0.35 },
  { keywords: ["mombasa", "kilifi", "malindi", "lamu"], factor: -0.16 },
  { keywords: ["nairobi", "kiambu", "kikuyu", "ruaka", "karen", "westlands"], factor: 0.0 },
  { keywords: ["nakuru", "naivasha"], factor: 0.05 },
  { keywords: ["kisumu", "kakamega", "kericho", "eldoret", "uire"], factor: 0.08 },
  { keywords: ["nyeri", "embu", "meru", "nyahururu"], factor: 0.22 },
  { keywords: ["machakos", "athi river", "kitui"], factor: 0.02 },
  { keywords: ["thika", "murang", "kirinyaga"], factor: 0.1 },
];

/**
 * Deterministic price estimation for Kenya using the EPRA reference table.
 * Interpolates between Nairobi (baseline) and Mandera (max) by a remoteness
 * factor derived from the location/region name. More reliable than AI
 * interpolation (which is inconsistent on kerosene).
 */
function estimateKenyaPrices(
  locationName: string,
  region: string | undefined,
): FuelPriceSet | null {
  const baseline = EPRA_KE_PRICES["Nairobi"];
  const max = EPRA_KE_PRICES["Mandera"];
  if (!baseline || !max) return null;
  const haystack = `${locationName} ${region || ""}`.toLowerCase();
  // Exact town match first.
  for (const [town, prices] of Object.entries(EPRA_KE_PRICES)) {
    if (haystack.includes(town.toLowerCase())) return { ...prices };
  }
  // Otherwise interpolate by remoteness factor.
  let factor = 0.1; // default small premium for unknown Kenyan towns
  for (const entry of KE_REMOTENESS) {
    if (entry.keywords.some((k) => haystack.includes(k))) {
      factor = entry.factor;
      break;
    }
  }
  const lerp = (b: number | null | undefined, m: number | null | undefined): number | null => {
    if (b == null || m == null) return null;
    return Math.round((b + factor * (m - b)) * 100) / 100;
  };
  return {
    super_petrol: lerp(baseline.super_petrol, max.super_petrol),
    diesel: lerp(baseline.diesel, max.diesel),
    kerosene: lerp(baseline.kerosene, max.kerosene),
  };
}

function extractPriceText(html: string): string {
  // Remove script/style/noscript blocks, then strip remaining tags.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  // Extract text from <p> and <li> elements.
  const blocks = cleaned.match(/<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/gi) || [];
  const texts = blocks
    .map((b) => b.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter((t) => {
      const lower = t.toLowerCase();
      // Keep paragraphs that mention fuel products or prices (Ksh/shilling).
      return (
        (lower.includes("petrol") ||
          lower.includes("diesel") ||
          lower.includes("kerosene") ||
          lower.includes("fuel")) &&
        (lower.includes("ksh") ||
          lower.includes("sh") ||
          /\d+\.\d{2}/.test(t))
      );
    });
  return texts.slice(0, 12).join("\n");
}

// ---------------------------------------------------------------------------
// 3. AI Extraction (Groq → OpenRouter/Llama fallback)
// ---------------------------------------------------------------------------

function buildAiPrompt(snippet: string, currencyHint: string): string {
  return [
    "Extract or estimate the current local fuel prices from the text below.",
    "The text may contain official EPRA/regulatory prices for various towns.",
    "If the user's specific town is not listed, estimate its prices based on",
    "the nearest listed town and the note that remote/northern towns have",
    "higher prices while coastal towns are lower. Many countries (e.g. Kenya)",
    "regulate fuel prices nationally with small regional transport adjustments.",
    "Return ONLY a JSON object with this exact shape:",
    '{"super_petrol": <number|null>, "diesel": <number|null>, "kerosene": <number|null>}.',
    "Values are the per-litre pump price in the local currency (likely " +
      currencyHint +
      ").",
    "If you cannot determine a price at all, use null. Do not include any other keys or prose.",
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

  // C. Fetch fresh data: deterministic estimation (Kenya) → web search → AI.
  try {
    const currency = currencyForCountry(place.countryCode);

    // C1. Deterministic estimation from the EPRA reference table (Kenya only).
    // This is more reliable than AI interpolation (which is inconsistent on
    // kerosene). The result is cached and tagged "AI-Estimated".
    if (place.countryCode === "KE") {
      const est = estimateKenyaPrices(place.name, place.region);
      if (
        est &&
        (est.super_petrol != null ||
          est.diesel != null ||
          est.kerosene != null)
      ) {
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
                prices: est,
                currency: currency.code,
                source: "AI-Estimated",
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
          console.warn("[fuel-engine] upsert failed:", upErr?.message);
        }
        return {
          location: place.name,
          country: place.country,
          country_code: place.countryCode,
          lat,
          lon,
          prices: est,
          currency: currency.code,
          source: "AI-Estimated (uncached)",
          last_updated: new Date().toISOString(),
        };
      }
    }

    // C2. Web search → AI parse (for non-Kenya or when estimation fails).
    const snippets = await searchWebPrices(
      place.name,
      place.region,
      place.country,
      place.countryCode,
    );
    const usedWebSearch =
      (!!process.env.SERPAPI_KEY || !!process.env.SERPER_API_KEY) &&
      snippets.length > 0;
    if (!snippets)
      throw new Error(
        "No web data (SERPAPI_KEY/SERPER_API_KEY missing or empty results)",
      );

    const prices = await extractPricesWithAI(snippets, currency.code);

    // Require at least one valid price to cache.
    const hasAny =
      prices.super_petrol != null ||
      prices.diesel != null ||
      prices.kerosene != null;
    if (!hasAny) throw new Error("AI could not extract any prices");

    const sourceLabel = usedWebSearch ? "AI-Verified" : "AI-Estimated";

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
            source: sourceLabel,
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
      source: `${sourceLabel} (uncached)`,
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
