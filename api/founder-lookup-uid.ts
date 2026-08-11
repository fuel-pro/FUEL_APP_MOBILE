/**
 * /api/founder-lookup-uid
 *
 * Server-side endpoint that looks up a Supabase auth user's uid by email,
 * using the service_role key. Used by the "grant Founder Access to another
 * email" flow so the founder can resolve an email to its auth uid before
 * setting a password / role.
 *
 * Security: the caller must be an authenticated founder.
 *
 * POST body: { email: string }
 * Response: { uid: string | null, error?: string }
 */

const SUPABASE_URL = "https://ojjscjwatikixlpshmub.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

async function json(body: Record<string, unknown>, status = 200): Promise<Response> {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Verify the caller is a founder via their Bearer token. */
async function isFounder(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE || "",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!me.ok) return false;
    const user = (await me.json()) as { id?: string };
    if (!user.id) return false;
    const roleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=role`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      },
    );
    if (!roleRes.ok) return false;
    const rows = (await roleRes.json()) as Array<{ role?: string }>;
    return rows.some((r) => r.role === "founder" || r.role === "admin");
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!(await isFounder(token))) {
      return json({ uid: null, error: "Unauthorized" }, 401);
    }

    const body = (await request.json()) as { email?: string };
    if (!body.email) {
      return json({ uid: null, error: "email required" }, 400);
    }

    // List users filtered by email via the admin API
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?emails=${encodeURIComponent(body.email)}`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      },
    );
    if (!res.ok) {
      const err = (await res.json()) as { message?: string };
      return json({ uid: null, error: err.message || "Lookup failed" });
    }
    const data = (await res.json()) as { users?: Array<{ id: string }> };
    const uid = data.users?.[0]?.id ?? null;
    return json({ uid });
  } catch (err) {
    return json({
      uid: null,
      error: err instanceof Error ? err.message : "Server error",
    }, 500);
  }
}
