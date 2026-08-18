/**
 * Station Access Code Service
 *
 * Allows a station OWNER to create a username + password "access code" linked
 * to a team-member role, so a team member can access the station data WITHOUT
 * signing up for their own account. The owner shares a link
 * (/#/station-access) where the member enters the username + password to gain
 * restricted access (read-only or tab-limited, set by the owner).
 *
 * The credentials + access config are stored in Supabase `app_kv`
 * (cloud-backed, cross-device) under key `station_access_codes`.
 *
 * SECURITY NOTE: this is a convenience feature for low-sensitivity station
 * data access (shifts, sales, pumps). The password is hashed (SHA-256) before
 * storage. It is NOT a replacement for full Supabase Auth — it grants
 * read-only access to the station's cloud data by loading it into a temporary
 * read-only session. The owner can revoke access at any time.
 */

import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";

const ACCESS_CODES_KEY = "station_access_codes";

export interface StationAccessCode {
  id: string;
  username: string; // must be unique per station
  passwordHash: string; // SHA-256 hex
  memberName: string;
  memberRole: string; // e.g. "Manager", "Cashier", "Attendant"
  // Restrictions: which tabs this member can access. Empty = all tabs.
  allowedTabs: string[];
  // If true, the member can only VIEW data (no edits). Recommended.
  readOnly: boolean;
  enabled: boolean;
  createdAt: number;
  lastAccessedAt: number | null;
  accessCount: number;
}

// A lightweight session for a member who logged in via access code.
export interface StationAccessSession {
  accessCodeId: string;
  memberName: string;
  memberRole: string;
  allowedTabs: string[];
  readOnly: boolean;
  stationId: string;
  stationOwnerId: string; // the owner whose data we're viewing
  loginTime: number;
}

const SESSION_STORAGE_KEY = "fuelpro_station_access_session";

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getAccessCodes(
  stationId?: string,
): Promise<StationAccessCode[]> {
  const data = await cloudStorageService.get<StationAccessCode[]>(
    ACCESS_CODES_KEY,
    stationId,
  );
  return Array.isArray(data) ? data : [];
}

async function saveAccessCodes(
  codes: StationAccessCode[],
  stationId?: string,
): Promise<void> {
  await cloudStorageService.set(ACCESS_CODES_KEY, codes, stationId);
}

export async function createAccessCode(
  params: {
    username: string;
    password: string;
    memberName: string;
    memberRole: string;
    allowedTabs: string[];
    readOnly: boolean;
  },
  stationId?: string,
): Promise<StationAccessCode> {
  const existing = await getAccessCodes(stationId);
  const username = params.username.trim().toLowerCase();
  if (existing.some((c) => c.username === username)) {
    throw new Error("Username already exists. Choose a different username.");
  }
  if (params.password.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }
  const code: StationAccessCode = {
    id: `access_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    username,
    passwordHash: await sha256(params.password),
    memberName: params.memberName.trim(),
    memberRole: params.memberRole,
    allowedTabs: params.allowedTabs,
    readOnly: params.readOnly,
    enabled: true,
    createdAt: Date.now(),
    lastAccessedAt: null,
    accessCount: 0,
  };
  await saveAccessCodes([...existing, code], stationId);
  return code;
}

export async function deleteAccessCode(
  id: string,
  stationId?: string,
): Promise<void> {
  const existing = await getAccessCodes(stationId);
  await saveAccessCodes(
    existing.filter((c) => c.id !== id),
    stationId,
  );
}

export async function toggleAccessCode(
  id: string,
  stationId?: string,
): Promise<void> {
  const existing = await getAccessCodes(stationId);
  await saveAccessCodes(
    existing.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
    stationId,
  );
}

/**
 * Attempt to log in with a username + password. On success, returns a session
 * and records the access. The `stationOwnerId` is needed to know whose cloud
 * data to load (the member accesses the OWNER's data, not their own).
 *
 * NOTE: because cloudStorageService scopes data by owner_id (RLS), a member
 * logging in via access code CANNOT read the owner's data through the normal
 * RLS path — they have no Supabase session. This function stores the session
 * locally and the StationAccessView page will show a read-only snapshot of
 * the data that the owner has shared via a PUBLIC app_kv key
 * (`station_public_snapshot_<stationId>`). The owner's app writes a periodic
 * read-only snapshot to this public key.
 */
export async function loginWithAccessCode(
  username: string,
  password: string,
  stationOwnerId: string,
  stationId: string,
): Promise<StationAccessSession> {
  const codes = await getAccessCodes(stationId);
  const code = codes.find(
    (c) => c.username === username.trim().toLowerCase() && c.enabled,
  );
  if (!code) {
    throw new Error("Invalid username or the access has been disabled.");
  }
  const hash = await sha256(password);
  if (hash !== code.passwordHash) {
    throw new Error("Invalid password.");
  }
  // Record access.
  code.lastAccessedAt = Date.now();
  code.accessCount += 1;
  await saveAccessCodes(codes, stationId);
  const session: StationAccessSession = {
    accessCodeId: code.id,
    memberName: code.memberName,
    memberRole: code.memberRole,
    allowedTabs: code.allowedTabs,
    readOnly: code.readOnly,
    stationId,
    stationOwnerId,
    loginTime: Date.now(),
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function getAccessSession(): StationAccessSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StationAccessSession;
  } catch {
    return null;
  }
}

export function clearAccessSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
