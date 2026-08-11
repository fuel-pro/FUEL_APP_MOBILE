/**
 * /api/founder-set-password
 *
 * Server-side endpoint that sets a password for a Supabase auth account by
 * uid, using the service_role key (never exposed to the client). This powers
 * the "grant Founder Access to another email" + "change password of a founder
 * account" flows — the founder enters an email, the server resolves the uid
 * and sets the password via the Supabase Auth admin API.
 *
 * Security: the caller must be an authenticated founder. We verify the
 * Bearer access_token against Supabase Auth AND check the users table role
 * before setting the password.
 *
 * POST body: { uid: string, password: string }
 * Response: { success: boolean, error?: string }
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
    // Check the users table for the role
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
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const body = (await request.json()) as { uid?: string; password?: string };
    if (!body.uid || !body.password) {
      return json({ success: false, error: "uid and password required" }, 400);
    }
    if (body.password.length < 8) {
      return json(
        { success: false, error: "Password must be at least 8 characters" },
        400,
      );
    }

    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${body.uid}`,
      {
        method: "PUT",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: body.password,
          email_confirm: true,
        }),
      },
    );

    if (!res.ok) {
      const err = (await res.json()) as { message?: string; msg?: string };
      return json({
        success: false,
        error: err.message || err.msg || "Failed to set password",
      });
    }

    return json({ success: true });
  } catch (err) {
    return json({
      success: false,
      error: err instanceof Error ? err.message : "Server error",
    }, 500);
  }
}
