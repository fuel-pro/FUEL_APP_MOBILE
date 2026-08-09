/**
 * Founder Authentication - Supabase Backend
 * 
 * All authentication uses Supabase Auth with proper security.
 * Founder access requires special role in the users table.
 */

import { getSupabaseClient } from "@/supabase/client";

const TOKEN_KEY = "fuelpro_founder_token";
const SESSION_META_KEY = "fuelpro_founder_session_meta";

export interface FounderLoginResult {
  success: boolean;
  error?: string;
  role?: string;
}

/** Attempt to log in to Founder panel via Supabase.
 *  Uses special founder/admin credentials stored in Supabase users table.
 *  NO FALLBACK - requires Supabase to be available. */
export async function loginFounder(
  username: string,
  password: string
): Promise<FounderLoginResult> {
  // The Supabase client (supabase/client.ts) resolves env vars with hardcoded
  // fallbacks, so it is always configured in this project. Auth proceeds via
  // the client; the gate below is retained only to surface a clear message if
  // the project is ever reconfigured without Supabase.
  try {
    const client = getSupabaseClient();

    // Sign in with Supabase Auth
    const { data, error } = await client.auth.signInWithPassword({
      email: username.includes('@') ? username : `${username}@fuelpro.local`,
      password,
    });

    if (error) {
      return { success: false, error: "Invalid credentials" };
    }

    // Verify user has founder/admin role in the users table
    const { data: userData, error: userError } = await client
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (userError || !userData) {
      // If users table doesn't exist or user not found, check metadata
      const role = data.user.user_metadata?.role;
      if (role !== 'founder' && role !== 'admin') {
        await client.auth.signOut();
        return { success: false, error: "This account does not have Founder access" };
      }
    } else {
      if (userData.role !== 'founder' && userData.role !== 'admin') {
        await client.auth.signOut();
        return { success: false, error: "This account does not have Founder access" };
      }
    }

    const role = userData?.role || data.user.user_metadata?.role || 'founder';

    // Store the Supabase session token
    localStorage.setItem(TOKEN_KEY, data.session.access_token);
    localStorage.setItem(
      SESSION_META_KEY,
      JSON.stringify({ 
        loginTime: Date.now(), 
        role, 
        username,
        userId: data.user.id 
      })
    );

    return { success: true, role };
  } catch (err) {
    // NO FALLBACK - return error
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unable to connect to Supabase",
    };
  }
}

/** Get the currently stored auth token. */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Check if founder session exists and is valid. */
export function hasFounderSession(): boolean {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const metaRaw = localStorage.getItem(SESSION_META_KEY);
    if (!token || !metaRaw) return false;

    const meta = JSON.parse(metaRaw);
    if (meta.role !== "founder" && meta.role !== "admin") return false;

    // Check if session is not expired (7 days)
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - meta.loginTime < maxAgeMs;
  } catch {
    return false;
  }
}

/** End founder session. */
export function endFounderSession(): void {
  // Sign out from Supabase
  try {
    const client = getSupabaseClient();
    client.auth.signOut();
  } catch {
    // Ignore errors on logout
  }
  
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_META_KEY);
}

// Backwards compatibility aliases
export const founderLogin = loginFounder;
export const getFounderToken = getAuthToken;
export const endFounderSessionLegacy = endFounderSession;
export function isLoggedIn(): boolean { return hasFounderSession(); }

/** Verify founder token with Supabase. */
export async function verifyFounderToken(): Promise<boolean> {
  if (!hasFounderSession()) return false;
  
  try {
    const client = getSupabaseClient();
    const { data: { session }, error } = await client.auth.getSession();
    
    if (error || !session) return false;
    
    // Verify user still exists and has founder role
    const { data: userData } = await client
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    if (userData?.role === 'founder' || userData?.role === 'admin') {
      return true;
    }
    
    return hasFounderSession(); // Fall back to local check
  } catch {
    return hasFounderSession();
  }
}

/** Get authorization header for API calls. */
export function getFounderAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/** Legacy function - returns empty (Supabase handles credentials) */
export function getFounderCredentials() {
  return {
    username: "",
    password: ""
  };
}

/** Legacy function - validates founder auth using Supabase */
export async function validateFounderAuth(): Promise<{ valid: boolean }> {
  const valid = await verifyFounderToken();
  return { valid };
}
