/**
 * /api/founder-grant-access
 *
 * Server-side endpoint that grants Founder Access to an email:
 *   1. If the email already has a Supabase auth account, use its uid.
 *      Otherwise, create a new auth user with the given password (email_confirm=true).
 *   2. Set the user's role to 'founder' in the `users` table (upsert).
 *   3. Ensure a `profiles` row exists with the unique_id + username.
 *
 * Security: the caller must be an authenticated founder.
 *
 * POST body: { email: string, password: string, uniqueId?: string, username?: string }
 * Response: { success: boolean, uid?: string, error?: string }
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
  // Upsert into the users table with role=founder
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
  // Ensure a profiles row exists; the table has a trigger or the app may
  // have already created it. We upsert with the unique_id + username.
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

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      uniqueId?: string | null;
      username?: string | null;
    };
    if (!body.email || !body.password) {
      return json(
        { success: false, error: "email and password required" },
        400,
      );
    }
    if (body.password.length < 8) {
      return json(
        { success: false, error: "Password must be at least 8 characters" },
        400,
      );
    }

    // 1. Find or create the auth user
    let uid = await lookupUidByEmail(body.email);
    let created = false;
    if (!uid) {
      uid = await createAuthUser(body.email, body.password);
      created = !!uid;
    } else {
      // Update the password on the existing account
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
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
      });
    }
    if (!uid) {
      return json({
        success: false,
        error: "Could not find or create the auth account",
      });
    }

    // 2. Set the role to founder
    const roleOk = await setFounderRole(uid, body.email);
    if (!roleOk) {
      return json({
        success: false,
        error: "Account ready but could not set founder role",
        uid,
      });
    }

    // 3. Ensure profiles row
    await upsertProfile(uid, body.email, body.uniqueId ?? null, body.username ?? null);

    return json({
      success: true,
      uid,
      created,
    });
  } catch (err) {
    return json({
      success: false,
      error: err instanceof Error ? err.message : "Server error",
    }, 500);
  }
}
