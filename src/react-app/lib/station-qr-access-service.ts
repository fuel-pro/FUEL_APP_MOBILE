/**
 * station-qr-access-service.ts
 * Secure, revocable, expiry-scoped one-tap QR access grants.
 *
 * The Header "Company QR Code" renders a QR encoding
 *   <origin>/#/station-access?qr=<opaqueToken>&sid=<stationId>
 * The token is 32 random bytes (crypto.getRandomValues) — never derived
 * from company data — so the QR is unguessable and shares a capability,
 * not a credential. The owner sets an EXPIRY and (optionally) a max-uses
 * cap. The recipient's device redeems the token through the SECURITY
 * DEFINER RPC `redeem_station_qr_access`, which validates enabled/expiry/
 * uses server-side, bumps the counter ONCE, and returns the access config
 * (read-only tabs) so the Station Access page can open the read-only
 * snapshot viewer with NO username/password prompt.
 *
 * Revocation: the owner deletes/disables the grant row (crud below) — the
 * already-scanned QR instantly stops redeeming.
 *
 * STORAGE: dedicated `station_qr_grants` Supabase table (migration 027),
 * owner-scoped RLS (auth.uid() = owner_id) for CRUD; the redeem RPC is
 * anon-callable + SECURITY DEFINER so it can cross the RLS boundary for
 * unauthenticated recipients.
 */
import { getSupabaseClient } from "@/supabase/client";

const TABLE = "station_qr_grants";

export interface StationQrGrant {
  token: string;
  stationId: string;
  ownerId: string;
  memberLabel: string;
  memberRole: string;
  allowedTabs: string[];
  readOnly: boolean;
  expiresAt: string; // ISO
  maxUses: number; // 0 = unlimited
  usedCount: number;
  enabled: boolean;
  note: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface QrRedeemResult {
  ok: boolean;
  reason?: "not_found" | "disabled" | "expired" | "max_uses" | "error";
  stationId?: string;
  ownerId?: string;
  memberLabel?: string;
  memberRole?: string;
  allowedTabs?: string[];
  readOnly?: boolean;
  expiresAt?: string;
  maxUses?: number;
  usedCount?: number;
}

// Map a DB row (snake_case) -> client shape.
function rowToGrant(r: Record<string, unknown>): StationQrGrant {
  const tabsRaw = r.allowed_tabs;
  let allowedTabs: string[] = [];
  if (Array.isArray(tabsRaw)) {
    allowedTabs = tabsRaw.filter((t): t is string => typeof t === "string");
  }
  return {
    token: String(r.token || ""),
    stationId: String(r.station_id || ""),
    ownerId: String(r.owner_id || ""),
    memberLabel: String(r.member_label || "Guest"),
    memberRole: String(r.member_role || "Guest"),
    allowedTabs,
    readOnly: r.read_only !== false,
    expiresAt: r.expires_at ? String(r.expires_at) : "",
    maxUses: Number(r.max_uses) || 0,
    usedCount: Number(r.used_count) || 0,
    enabled: r.enabled !== false,
    note: String(r.note || ""),
    createdAt: r.created_at ? String(r.created_at) : "",
    lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
  };
}

/** Generate an opaque random token (32 bytes → ~43-char base64url). */
export function generateQrToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Build the deep-link URL a QR encodes. */
export function buildQrGrantUrl(
  token: string,
  stationId: string,
  baseUrl?: string,
): string {
  const origin =
    baseUrl ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://fuel-app-mobile.pages.dev");
  return `${origin}/#/station-access?qr=${encodeURIComponent(
    token,
  )}&sid=${encodeURIComponent(stationId)}`;
}

/** Create a new QR grant (owner-side, authenticated). */
export async function createQrGrant(input: {
  stationId: string;
  memberLabel?: string;
  memberRole?: string;
  allowedTabs?: string[];
  readOnly?: boolean;
  expiresAt: string; // ISO — how long the QR stays valid
  maxUses?: number;
  note?: string;
}): Promise<StationQrGrant> {
  const token = generateQrToken();
  const client = getSupabaseClient();
  const row = {
    token,
    station_id: input.stationId,
    member_label: input.memberLabel || "Guest",
    member_role: input.memberRole || "Guest",
    allowed_tabs: input.allowedTabs || ([] as string[]),
    read_only: input.readOnly !== false,
    expires_at: input.expiresAt,
    max_uses: Math.max(0, Math.floor(input.maxUses || 0)),
    note: input.note || "",
    enabled: true,
  };
  const { data, error } = await client
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) {
    throw new Error(`Could not create QR grant: ${error.message}`);
  }
  if (!data) throw new Error("Could not create QR grant (no row returned).");
  return rowToGrant(data);
}

/** List the owner's QR grants for a station. */
export async function listQrGrants(
  stationId: string,
): Promise<StationQrGrant[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("station_id", stationId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[station-qr-access] list error:", error.message);
    return [];
  }
  return (data || []).map(rowToGrant);
}

/** Toggle a grant enabled/disabled (revocation). */
export async function setQrGrantEnabled(
  token: string,
  enabled: boolean,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from(TABLE)
    .update({ enabled })
    .eq("token", token);
  if (error) throw new Error(`Could not update QR grant: ${error.message}`);
}

/** Delete a grant (hard revocation). */
export async function deleteQrGrant(token: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from(TABLE).delete().eq("token", token);
  if (error) throw new Error(`Could not delete QR grant: ${error.message}`);
}

/** Redeem a token (recipient-side, anon via SECURITY DEFINER RPC). */
export async function redeemQrAccess(
  stationId: string,
  token: string,
): Promise<QrRedeemResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("redeem_station_qr_access", {
    p_station_id: stationId,
    p_token: token,
  });
  if (error) {
    console.error("[station-qr-access] redeem RPC error:", error.message);
    // RPC missing (migration 027 not applied yet) → degrade gracefully.
    return { ok: false, reason: "error" };
  }
  if (!data) return { ok: false, reason: "not_found" };
  return data as QrRedeemResult;
}

/** Format an expiry date for display. */
export function formatGrantExpiry(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

/** True when a grant is still redeemable (not expired, enabled, uses left). */
export function isGrantActive(g: StationQrGrant): boolean {
  if (!g.enabled) return false;
  if (g.expiresAt) {
    const exp = new Date(g.expiresAt).getTime();
    if (!Number.isNaN(exp) && exp < Date.now()) return false;
  }
  if (g.maxUses > 0 && g.usedCount >= g.maxUses) return false;
  return true;
}
