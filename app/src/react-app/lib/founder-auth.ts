/**
 * Founder Authentication
 *
 * SECURITY FIX: this module previously validated the Founder login entirely
 * client-side against a hardcoded default password ("fuelpro2026") baked
 * into the JS bundle, plus a base64-"obfuscated" legacy fallback. Anyone
 * could read the password straight out of the deployed bundle, or just call
 * startFounderSession() from devtools to bypass the login screen entirely --
 * with no server ever checking anything.
 *
 * This now delegates to the real backend auth system (/api/auth/login),
 * which already has a proper 'founder' role, bcrypt-hashed passwords, and
 * JWT issuance (see backend/routes/authRoutes.js). A session is only valid
 * if the backend actually issued a token for a user whose role is
 * 'founder' or 'admin' -- every subsequent admin API call is verified
 * server-side via that token, not trusted based on local state.
 */

import { getBackendUrl, getApiPath } from "@/utils/apiConfig";

const API_URL = getBackendUrl();

const TOKEN_KEY = "fuelpro_auth_token";
const SESSION_META_KEY = "fuelpro_founder_session_meta";

export interface FounderLoginResult {
  success: boolean;
  error?: string;
  role?: string;
}

/** Attempt to log in against the real backend. Only 'founder'/'admin' roles
 *  are accepted for the Founder panel. */
export async function loginFounder(
  username: string,
  password: string
): Promise<FounderLoginResult> {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, password }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, error: result?.error || "Invalid credentials" };
    }

    if (result.role !== "founder" && result.role !== "admin") {
      return { success: false, error: "This account does not have Founder access" };
    }

    if (!result.token) {
      return { success: false, error: "Login succeeded but no session token was returned" };
    }

    // Store the real, server-issued JWT. All future admin API calls
    // (see restApiSync.ts) use this token, and the backend independently
    // re-verifies the role on every request via the `protect`/`authorize`
    // middleware -- so this is not a client-trust decision.
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(
      SESSION_META_KEY,
      JSON.stringify({ loginTime: Date.now(), role: result.role, username })
    );

    return { success: true, role: result.role };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unable to reach the server",
    };
  }
}

/** Get the currently stored auth token, if any (used by restApiSync.ts). */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Local UI check only -- NOT a security boundary. Every real admin action
 *  is re-verified against the backend using the stored token. This just
 *  decides whether to show the login screen or the dashboard shell. */
export function hasFounderSession(): boolean {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const metaRaw = localStorage.getItem(SESSION_META_KEY);
    if (!token || !metaRaw) return false;

    const meta = JSON.parse(metaRaw);
    if (meta.role !== "founder" && meta.role !== "admin") return false;

    // Mirrors the backend's default 7-day JWT expiry as a UI hint; the
    // token itself is what actually gets validated server-side.
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - meta.loginTime < maxAgeMs;
  } catch {
    return false;
  }
}

export function endFounderSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_META_KEY);
}

// Backwards compatibility aliases
export const founderLogin = loginFounder;
export const getFounderToken = getAuthToken;
export const endFounderSessionLegacy = endFounderSession;
export function isLoggedIn(): boolean { return hasFounderSession(); }
export async function verifyFounderToken(): Promise<boolean> { return hasFounderSession(); }
export function getFounderAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}


// Legacy function used by SecuritySection - returns default founder credentials
// Note: This is a placeholder and actual credentials should come from backend
export function getFounderCredentials() {
  return {
    username: "founder@fuelpro.com",
    password: ""
  };
}


// Legacy function used by FounderAccess - validates founder auth
export async function validateFounderAuth(): Promise<{ valid: boolean }> {
  const token = localStorage.getItem(TOKEN_KEY);
  return { valid: !!token };
}
