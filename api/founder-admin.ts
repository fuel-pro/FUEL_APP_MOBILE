/**
 * /api/founder-admin?action=grant|setpw|lookup
 *
 * Consolidated server-side endpoint for Founder Access administration:
 *   ?action=grant   — create/resolve auth user, set password, set founder
 *                     role, upsert profile (grant Founder Access to email)
 *   ?action=setpw   — set password for a uid
 *   ?action=lookup  — resolve email -> uid
 *
 * Security: the caller must be an authenticated founder (Bearer token
 * verified against Supabase Auth + users table role check).
 *
 * POST body depends on action (see below).
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
async function isFounder(token: string): Promise<{ ok: boolean; uid?: string }> {
  if (!token) return { ok: false };
  try {
    const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE || "",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!me.ok) return { ok: false };
    const user = (await me.json()) as { id?: string };
    if (!user.id) return { ok: false };
    const roleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=role`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      },
    );
    if (!roleRes.ok) return { ok: false };
    const rows = (await roleRes.json()) as Array<{ role?: string }>;
    if (rows.some((r) => r.role === "founder" || r.role === "admin")) {
      return { ok: true, uid: user.id };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function lookupUidByEmail(email: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?emails=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { users?: Array<{ id: string }> };
  return data.users?.[0]?.id ?? null;
}

async function createAuthUser(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

async function setFounderRole(uid: string, email: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: uid,
      email,
      role: "founder",
      created_at: new Date().toISOString(),
    }),
  });
  return res.ok;
}

async function upsertProfile(
  uid: string,
  email: string,
  uniqueId: string | null,
  username: string | null,
): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: uid,
      email,
      unique_id: uniqueId,
      username: username,
    }),
  }).catch(() => {});
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const founder = await isFounder(token);
    if (!founder.ok) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "";
    const body = (await request.json()) as Record<string, string | null>;

    if (action === "lookup") {
      const email = body.email;
      if (!email) return json({ uid: null, error: "email required" }, 400);
      const uid = await lookupUidByEmail(email);
      return json({ uid });
    }

    if (action === "setpw") {
      const uid = body.uid;
      const password = body.password;
      if (!uid || !password) {
        return json({ success: false, error: "uid and password required" }, 400);
      }
      if (password.length < 8) {
        return json(
          { success: false, error: "Password must be at least 8 characters" },
          400,
        );
      }
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
        method: "PUT",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, email_confirm: true }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string; msg?: string };
        return json({
          success: false,
          error: err.message || err.msg || "Failed to set password",
        });
      }
      return json({ success: true });
    }

    if (action === "grant") {
      const email = body.email;
      const password = body.password;
      const uniqueId = body.uniqueId ?? null;
      const username = body.username ?? null;
      if (!email || !password) {
        return json(
          { success: false, error: "email and password required" },
          400,
        );
      }
      if (password.length < 8) {
        return json(
          { success: false, error: "Password must be at least 8 characters" },
          400,
        );
      }

      let uid = await lookupUidByEmail(email);
      let created = false;
      if (!uid) {
        uid = await createAuthUser(email, password);
        created = !!uid;
      } else {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
          method: "PUT",
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password, email_confirm: true }),
        });
      }
      if (!uid) {
        return json({
          success: false,
          error: "Could not find or create the auth account",
        });
      }

      const roleOk = await setFounderRole(uid, email);
      if (!roleOk) {
        return json({
          success: false,
          error: "Account ready but could not set founder role",
          uid,
        });
      }

      await upsertProfile(uid, email, uniqueId, username);
      return json({ success: true, uid, created });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (err) {
    return json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      500,
    );
  }
}
