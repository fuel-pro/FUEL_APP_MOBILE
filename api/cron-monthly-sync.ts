/**
 * /api/cron-monthly-sync
 *
 * Triggered by Vercel Cron on the 1st of every month (see vercel.json).
 * Refreshes the top 20 most-queried locations in the `fuel_prices` cache so
 * their prices stay current without exceeding SerpApi's 100/month free quota.
 *
 * Protected by CRON_SECRET: the `Authorization: Bearer <CRON_SECRET>` header
 * must match. Vercel Cron automatically sends this header.
 */
import { supabaseAdmin } from "./_lib/supabase-admin.js";
import { getHyperLocalPrices } from "./_lib/hybrid-fetcher.js";

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!supabaseAdmin) {
    return new Response(
      JSON.stringify({ error: "Supabase admin client not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: topLocations, error } = await supabaseAdmin
    .from("fuel_prices")
    .select("*")
    .order("query_count", { ascending: false })
    .limit(20);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const results: Array<{ location: string; success: boolean; error?: string }> =
    [];

  for (const loc of topLocations || []) {
    try {
      await getHyperLocalPrices(
        loc.lat,
        loc.lon,
        loc.location_name,
        loc.country
      );
      results.push({ location: loc.location_name, success: true });
    } catch (err) {
      results.push({
        location: loc.location_name,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;

  return new Response(
    JSON.stringify({
      success: true,
      refreshed: succeeded,
      failed,
      results,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
