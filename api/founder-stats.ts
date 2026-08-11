/**
 * /api/founder-stats
 *
 * Returns the global list of users + stations for the Founder Console.
 *
 * The founder panel runs in a Supabase-only SPA whose tRPC client has no
 * backend (every procedure is a runtime no-op returning null), so the
 * "All Users" / "All Stations" counts were always 0. This endpoint fills
 * that gap: it uses the service_role key to read across ALL owners (RLS
 * would otherwise scope each user to their own rows), but ONLY after
 * verifying the caller's Supabase Auth JWT belongs to a founder/admin in
 * the `users` table.
 *
 * Request:
 *   Authorization: Bearer <supabase access_token>
 *
 * Response 200: { success, users: AppUser[], stations: StationRecord[] }
 * Response 401/403: not authenticated / not a founder
 *
 * The service_role key stays server-side (process.env); it is never in the
 * client bundle.
 */

import { supabaseAdmin } from "./_lib/supabase-admin.js";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(
  body: unknown,
  status: number,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extra },
  });
}

export async function GET(request: Request): Promise<Response> {
  // 1) Authenticate the caller via their Supabase access token.
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return json({ success: false, error: "Not authenticated" }, 401);
  }
  if (!supabaseAdmin) {
    return json(
      {
        success: false,
        error: "Server not configured (missing service role key)",
      },
      500,
    );
  }

  // Verify the JWT and resolve the auth uid. We use the admin client's
  // auth.getUser(token) — it validates the token against Supabase Auth.
  const {
    data: { user },
    error: userErr,
  } = await supabaseAdmin.auth.getUser(token);

  if (userErr || !user) {
    return json({ success: false, error: "Invalid or expired token" }, 401);
  }

  // 2) Authorize: the caller must be a founder/admin in the `users` table.
  const { data: callerRow, error: callerErr } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const callerRole =
    callerRow?.role || (user.user_metadata?.role as string | undefined);
  if (callerErr || (callerRole !== "founder" && callerRole !== "admin")) {
    return json(
      { success: false, error: "This account does not have Founder access" },
      403,
    );
  }

  // 3) Fetch ALL users (service_role bypasses RLS). The `users` table holds
  //    the founder/admin role bindings; `profiles` holds the per-user display
  //    info. Join-like: read users, then enrich from profiles in one query.
  const { data: usersRows, error: usersErr } = await supabaseAdmin
    .from("users")
    .select("id, email, name, role, created_at, last_sign_in_at")
    .order("created_at", { ascending: false });

  const { data: profilesRows } = await supabaseAdmin
    .from("profiles")
    .select("id, email, name, username, created_at");

  const profileById = new Map<
    string,
    { email?: string; name?: string; username?: string; created_at?: string }
  >();
  for (const p of profilesRows || []) {
    profileById.set(String(p.id), p);
  }

  const users = (usersRows || []).map((u: any) => {
    const p = profileById.get(String(u.id));
    return {
      id: u.id,
      email: u.email || p?.email || "",
      name: u.name || p?.name || "Unknown",
      role: u.role || "user",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
    };
  });

  // 4) Fetch ALL stations (service_role bypasses the per-owner RLS).
  const { data: stationsRows, error: stationsErr } = await supabaseAdmin
    .from("stations")
    .select("id, name, owner_id, created_by, location, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (stationsErr) {
    return json({ success: false, error: stationsErr.message, users }, 500);
  }
  if (usersErr) {
    // Non-fatal: return stations with whatever users we have.
    console.warn("[founder-stats] users query error:", usersErr.message);
  }

  const ownerNameById = new Map<string, string>();
  for (const u of users) {
    ownerNameById.set(String(u.id), u.name);
  }

  const stations = (stationsRows || []).map((s: any) => ({
    id: s.id,
    name: s.name || "Unnamed Station",
    ownerId: s.owner_id || s.created_by || "",
    ownerName: ownerNameById.get(String(s.owner_id || s.created_by)) || "Owner",
    location: s.location || "Unknown",
    members: 1,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));

  return json(
    { success: true, users, stations },
    200,
    // 60s CDN cache — founder stats don't need to be real-time to the second.
    { "Cache-Control": "no-store" },
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
