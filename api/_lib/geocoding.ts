/**
 * Reverse-geocoding helper using OpenStreetMap Nominatim (free, no API key).
 *
 * Server-side only (called from serverless functions) to resolve a lat/lon
 * pair to a human-readable location name + country for the fuel-prices cache.
 * Nominatim's usage policy requires a descriptive User-Agent.
 */

export interface ResolvedLocation {
  village: string | null;
  town: string | null;
  city: string | null;
  country: string;
  countryCode: string | null;
  /** Best single display name for caching (prefers city > town > village). */
  displayName: string;
}

export async function getExactLocation(
  lat: number,
  lon: number
): Promise<ResolvedLocation> {
  // zoom=10 gives town/city-level resolution (not building-level like zoom=18).
  // This returns the primary town name rather than a sub-village/hamlet, so
  // the cache key is the town users actually recognise (e.g. "Lodwar" not
  // "Nawoitorong").
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "FuelAppMobile/1.0 (fuel-app-mobile.vercel.app)" },
  });
  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }
  const data = await res.json();
  const addr = data.address || {};

  // Prioritise the most recognisable administrative unit: city > town >
  // county (for Kenya, the county seat is what people call "town") > village.
  const village = addr.village || addr.hamlet || addr.suburb || null;
  const town = addr.town || null;
  const city =
    addr.city ||
    addr.municipality ||
    addr.county ||
    addr.state_district ||
    null;
  const country = addr.country || "Unknown";
  const countryCode = addr.country_code?.toUpperCase() || null;

  const displayName = city || town || village || "Unknown Location";

  return { village, town, city, country, countryCode, displayName };
}
