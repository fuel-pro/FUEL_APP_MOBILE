/**
 * Company Grant Service — the secure backbone of the "Company QR Code"
 * feature (Header → Branding & Tools → Company QR Code).
 *
 * A company grant is a crypto-random, revocable, expiring credential that
 * lets anyone with the shared link view this station's read-only data for a
 * specified period, WITHOUT an account or password.
 *
 * SECURITY MODEL (mirrors the station access-code system):
 *  - The grant network is the `code` (~93 bits, crypto-random, generated
 *    client-side with Web Crypto and stored hashed-side in the table as the
 *    literal code — only the RPC ever matches on it; other rows never reveal
 *    it because we never SELECT codes out).
 *  - The owner CRUDs grants through their own RLS-guarded Supabase session
 *    (company_grants.owner_id = auth.uid()).
 *  - An UNAUTHENTICATED member redeems a link through the SECURITY DEFINER
 *    RPC `redeem_company_grant` (callable by anon), exactly like
 *    `verify_access_code`.
 *  - Revocation: revoking a grant sets revoked=true (server-side, so even a
 *    replayed old code fails). Rotating deletes the old code and issues a
 *    new one.
 *  - Expiry is enforced SERVER-side by the RPC (expires_at) — the client
 *    display of expiry is informational only.
 *
 * The redeemed member has NO Supabase session, so they read the station's
 * data through the public station snapshot (station-snapshots/…), which the
 * owner publishes from Team Manager / the QR modal.
 */

import { getSupabaseClient } from "@/supabase/client";

const TABLE = "company_grants";
const GRANTS_CACHE_KEY = "fuelpro_company_grants_cache";

/** Allowed-tab shortcut presets offered in the QR modal. */
export const GRANT_TAB_PRESETS: Array<{
  id: string;
  label: string;
  tabs: string[];
}> = [
  { id: "dashboard", label: "Dashboard", tabs: ["dashboard"] },
  { id: "prices", label: "Prices", tabs: ["dashboard", "fueltypes"] },
  {
    id: "sales",
    label: "Sales & Reports",
    tabs: ["sales", "fuelsalesreport", "reports"],
  },
  { id: "payments", label: "Payments", tabs: ["livetransaction", "mpesa"] },
  { id: "all", label: "All sections", tabs: [] },
];

export interface CompanyGrant {
  id: string;
  code: string;
  stationId: string;
  ownerId: string;
  memberName: string;
  memberRole: string;
  allowedTabs: string[];
  readOnly: boolean;
  enabled: boolean;
  revoked: boolean;
  createdAt: number;
  expiresAt: number | null;
  maxUses: number | null;
  uses: number;
  lastRedeemedAt: number | null;
}

export interface GrantCreateParams {
  memberName: string;
  memberRole?: string;
  allowedTabs: string[];
  readOnly?: boolean;
  expiresInDays?: number; // null = never
  maxUses?: number | null; // null = unlimited
}

export interface GrantRedeemResult {
  grantId: string;
  memberName: string;
  memberRole: string;
  allowedTabs: string[];
  readOnly: boolean;
  stationId: string;
  stationOwnerId: string;
  expiresAt: string | null;
}

/** Crypto-random URL-safe code (~93 bits of entropy → 15 chars × 6.2 bits). */
export function generateGrantCode(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous 0/O/1/l/I
    let out = "";
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return out;
  }
  // Fallback (tests / older runtimes): Math.random in chunks.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 18; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function rowToGrant(
  r: Record<string, unknown> | undefined | null,
): CompanyGrant | null {
  if (!r) return null;
  return {
    id: String(r.id ?? ""),
    code: String(r.code ?? ""),
    stationId: String(r.station_id ?? ""),
    ownerId: String(r.owner_id ?? ""),
    memberName: String(r.member_name ?? ""),
    memberRole: String(r.member_role ?? "Staff"),
    allowedTabs: Array.isArray(r.allowed_tabs)
      ? (r.allowed_tabs as string[])
      : [],
    readOnly: r.read_only !== false,
    enabled: r.enabled !== false,
    revoked: r.revoked === true,
    createdAt: r.created_at
      ? new Date(String(r.created_at)).getTime()
      : Date.now(),
    expiresAt: r.expires_at ? new Date(String(r.expires_at)).getTime() : null,
    maxUses: r.max_uses == null ? null : Number(r.max_uses),
    uses: Number(r.uses ?? 0),
    lastRedeemedAt: r.last_redeemed_at
      ? new Date(String(r.last_redeemed_at)).getTime()
      : null,
  };
}

async function currentOwnerId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function readGrantsCache(): CompanyGrant[] {
  try {
    const raw = localStorage.getItem(GRANTS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeGrantsCache(grants: CompanyGrant[]) {
  try {
    localStorage.setItem(GRANTS_CACHE_KEY, JSON.stringify(grants));
  } catch {
    /* read-through cache only */
  }
}

/** Owner: list all grants for a station. Only the owner's session can see
 *  them (RLS). Never include the code when it would matter — but we include
 *  the code here because the owner needs it to copy the share link; the
 *  cloud row's RLS already limits reads to the owner. */
export async function listCompanyGrants(
  stationId?: string,
): Promise<CompanyGrant[]> {
  if (!stationId) return [];
  try {
    const supabase = getSupabaseClient();
    const ownerId = await currentOwnerId();
    if (!ownerId) return [];
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("owner_id", ownerId)
      .eq("station_id", stationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const grants = Array.isArray(data)
      ? data.map(rowToGrant).filter((g): g is CompanyGrant => g !== null)
      : [];
    writeGrantsCache(grants);
    return grants;
  } catch (e) {
    console.warn("[company-grants] list failed:", e);
    return readGrantsCache().filter((g) => g.stationId === stationId);
  }
}

/** Owner: create a grant. Returns the full grant INCLUDING the secret code
 *  so the caller can build the share link + QR. */
export async function createCompanyGrant(
  params: GrantCreateParams,
  stationId?: string,
): Promise<CompanyGrant> {
  if (!stationId) throw new Error("No station selected.");
  const supabase = getSupabaseClient();
  const ownerId = await currentOwnerId();
  if (!ownerId)
    throw new Error("You must be signed in to create a company QR grant.");

  const code = generateGrantCode();
  const id = `grant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresAt =
    params.expiresInDays && params.expiresInDays > 0
      ? new Date(Date.now() + params.expiresInDays * 86400000).toISOString()
      : null;

  const row = {
    id,
    code,
    station_id: stationId,
    owner_id: ownerId,
    member_name: (params.memberName || "Team Member").trim(),
    member_role: params.memberRole || "Staff",
    allowed_tabs: params.allowedTabs || [],
    read_only: params.readOnly !== false,
    enabled: true,
    revoked: false,
    expires_at: expiresAt,
    max_uses: params.maxUses ?? null,
    created_at: new Date().toISOString(),
  };
  const { created_at: _createdAt, ...insertRow } = row;
  const { error } = await supabase.from(TABLE).insert(insertRow);
  if (error) throw new Error(error.message || "Failed to create grant.");

  const grant = rowToGrant({
    ...row,
    created_at: new Date().toISOString(),
    uses: 0,
  });
  if (grant) {
    writeGrantsCache([
      grant,
      ...readGrantsCache().filter((g) => g.stationId !== stationId),
    ]);
  }
  return (
    grant ??
    ({
      id,
      code,
      stationId,
      ownerId,
      memberName: (params.memberName || "Team Member").trim(),
      memberRole: params.memberRole || "Staff",
      allowedTabs: params.allowedTabs || [],
      readOnly: params.readOnly !== false,
      enabled: true,
      revoked: false,
      createdAt: Date.now(),
      expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
      maxUses: params.maxUses ?? null,
      uses: 0,
      lastRedeemedAt: null,
    } as CompanyGrant)
  );
}

/** Owner: revoke a grant (server-side revoked=true → RPC refuses it even on
 *  replay). */
export async function revokeCompanyGrant(
  id: string,
  stationId?: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const ownerId = await currentOwnerId();
  if (!ownerId) return;
  const { error } = await supabase
    .from(TABLE)
    .update({ revoked: true, enabled: false })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
  if (stationId) {
    writeGrantsCache(
      readGrantsCache().map((g) =>
        g.id === id ? { ...g, revoked: true, enabled: false } : g,
      ),
    );
  }
}

/** Owner: hard-delete a grant row (removes it entirely). */
export async function deleteCompanyGrant(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const ownerId = await currentOwnerId();
  if (!ownerId) return;
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
  writeGrantsCache(readGrantsCache().filter((g) => g.id !== id));
}

/** Owner: rotate — create a brand-new code/grant and revoke the old one in
 *  one step (the old link dies immediately). */
export async function rotateCompanyGrant(
  id: string,
  stationId?: string,
): Promise<CompanyGrant> {
  const grants = await listCompanyGrants(stationId);
  const old = grants.find((g) => g.id === id);
  if (!old) throw new Error("Grant not found.");
  const fresh = await createCompanyGrant(
    {
      memberName: old.memberName,
      memberRole: old.memberRole,
      allowedTabs: old.allowedTabs,
      readOnly: old.readOnly,
      expiresInDays: old.expiresAt
        ? Math.max(1, Math.ceil((old.expiresAt - Date.now()) / 86400000))
        : undefined,
      maxUses: old.maxUses,
    },
    stationId,
  );
  await revokeCompanyGrant(id, stationId);
  return fresh;
}

/**
 * Member-side redemption — an UNAUTHENTICATED member calls the SECURITY
 * DEFINER RPC with the code from the shared link. On success we get the
 * owner + station ids (to fetch the snapshot) + the access config.
 * Returns null on any failure (invalid / revoked / expired / disabled).
 */
export async function redeemCompanyGrant(
  code: string,
): Promise<GrantRedeemResult | null> {
  const clean = code.trim();
  if (!clean) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("redeem_company_grant", {
      p_code: clean,
    });
    if (error) {
      // PGRST202 = RPC not deployed yet → grace.
      console.warn("[company-grants] redeem RPC unavailable:", error.message);
      return null;
    }
    if (!data) return null;
    const r = data as Record<string, unknown>;
    if (r.locked === true) {
      throw new Error(
        "Too many attempts. This link is temporarily locked — contact the station owner.",
      );
    }
    if (!r.grantId) return null;
    return {
      grantId: String(r.grantId),
      memberName: String(r.memberName ?? ""),
      memberRole: String(r.memberRole ?? "Staff"),
      allowedTabs: Array.isArray(r.allowedTabs)
        ? (r.allowedTabs as string[])
        : [],
      readOnly: r.readOnly !== false,
      stationId: String(r.stationId ?? ""),
      stationOwnerId: String(r.stationOwnerId ?? ""),
      expiresAt: r.expiresAt ? String(r.expiresAt) : null,
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes("locked")) throw e;
    console.warn("[company-grants] redeem failed:", e);
    return null;
  }
}

/** Build the share link for a grant (the same link the QR encodes). */
export function buildGrantLink(code: string): string {
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://fuel-app-mobile.pages.dev";
  return `${origin}/#/station-access?grant=${encodeURIComponent(code)}`;
}

/** Official WhatsApp deep link (wa.me) — opens WhatsApp Web on desktop and
 *  the WhatsApp app on mobile, with the message pre-filled. No API key. */
export function buildWhatsAppShareUrl(
  phoneDigits: string,
  message: string,
): string {
  const to = String(phoneDigits || "").replace(/\D/g, "");
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

/** mailto: deep link — opens the default mail client with the recipient,
 *  subject and body pre-filled. mailto cannot attach files, so the body
 *  carries the share link. */
export function buildMailtoShareUrl(opts: {
  to: string;
  subject: string;
  body: string;
}): string {
  const q = new URLSearchParams({
    subject: opts.subject,
    body: opts.body,
  }).toString();
  return `mailto:${encodeURIComponent(opts.to)}?${q}`;
}
