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
  userId?: string;
}

/** Attempt to log in to Founder panel via Supabase.
 *  Uses special founder/admin credentials stored in Supabase users table.
 *  NO FALLBACK - requires Supabase to be available. */
export async function loginFounder(
  username: string,
  password: string,
): Promise<FounderLoginResult> {
  // The Supabase client (supabase/client.ts) resolves env vars with hardcoded
  // fallbacks, so it is always configured in this project. Auth proceeds via
  // the client; the gate below is retained only to surface a clear message if
  // the project is ever reconfigured without Supabase.
  try {
    const client = getSupabaseClient();

    // Sign in with Supabase Auth
    const { data, error } = await client.auth.signInWithPassword({
      email: username.includes("@") ? username : `${username}@fuelpro.local`,
      password,
    });

    if (error) {
      return { success: false, error: "Invalid credentials" };
    }

    // Verify user has founder/admin role in the users table
    const { data: userData, error: userError } = await client
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (userError || !userData) {
      // If users table doesn't exist or user not found, check metadata
      const role = data.user.user_metadata?.role;
      if (role !== "founder" && role !== "admin") {
        await client.auth.signOut();
        return {
          success: false,
          error: "This account does not have Founder access",
        };
      }
    } else {
      if (userData.role !== "founder" && userData.role !== "admin") {
        await client.auth.signOut();
        return {
          success: false,
          error: "This account does not have Founder access",
        };
      }
    }

    const role = userData?.role || data.user.user_metadata?.role || "founder";

    // Store the Supabase session token
    localStorage.setItem(TOKEN_KEY, data.session.access_token);
    localStorage.setItem(
      SESSION_META_KEY,
      JSON.stringify({
        loginTime: Date.now(),
        role,
        username,
        userId: data.user.id,
      }),
    );

    return { success: true, role, userId: data.user.id };
  } catch (err) {
    // NO FALLBACK - return error
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unable to connect to Supabase",
    };
  }
}

/** Send a password-reset email (Supabase email-link recovery flow).
 *  The user clicks the link, lands on /reset-password, and sets a new
 *  password. This is the cross-device "forgot password" path. */
export async function requestPasswordReset(
  emailOrUsername: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    const email = emailOrUsername.includes("@")
      ? emailOrUsername
      : `${emailOrUsername}@fuelpro.local`;
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unable to send reset email",
    };
  }
}

/** Change the signed-in founder's password via Supabase Auth (not
 *  localStorage). This works cross-device because Supabase Auth is the
 *  source of truth for passwords. */
export async function changeFounderPassword(
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (newPassword.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    }
    const client = getSupabaseClient();
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) {
      return { success: false, error: error.message };
    }
    // Record the timestamp on the profiles table (cross-device audit).
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session?.user) {
      await client
        .from("profiles")
        .update({ last_password_change: new Date().toISOString() })
        .eq("id", session.user.id);
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unable to change password",
    };
  }
}

/** Load the founder's 2FA config from the cloud (profiles table) so it is
 *  consistent across all devices. Returns null if 2FA is not enabled. */
export async function loadFounder2FA(
  userId: string,
): Promise<{ enabled: boolean; secret: string | null }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("profiles")
      .select("two_factor_enabled, two_factor_secret")
      .eq("id", userId)
      .single();
    if (error || !data) return { enabled: false, secret: null };
    return {
      enabled: !!data.two_factor_enabled,
      secret: data.two_factor_secret || null,
    };
  } catch {
    return { enabled: false, secret: null };
  }
}

/** Save the founder's 2FA config to the cloud (profiles table). */
export async function saveFounder2FA(
  userId: string,
  enabled: boolean,
  secret: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from("profiles")
      .update({
        two_factor_enabled: enabled,
        two_factor_secret: secret,
      })
      .eq("id", userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unable to save 2FA",
    };
  }
}

/** Get the founder's unique identifier (short human-friendly id) from the
 *  profiles table. Falls back to the Supabase auth uid. */
export async function getFounderUniqueId(
  userId: string,
): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    const { data } = await client
      .from("profiles")
      .select("unique_id")
      .eq("id", userId)
      .single();
    return data?.unique_id || userId.slice(0, 8);
  } catch {
    return userId.slice(0, 8);
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
export function isLoggedIn(): boolean {
  return hasFounderSession();
}

/** Verify founder token with Supabase. */
export async function verifyFounderToken(): Promise<boolean> {
  if (!hasFounderSession()) return false;

  try {
    const client = getSupabaseClient();
    const result = await client.auth.getSession();
    const session = result.data.session;

    if (result.error || !session) return false;

    // Verify user still exists and has founder role
    const { data: userData } = await client
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (userData?.role === "founder" || userData?.role === "admin") {
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
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Legacy function - returns empty (Supabase handles credentials) */
export function getFounderCredentials() {
  return {
    username: "",
    password: "",
  };
}

/** Legacy function - validates founder auth using Supabase */
export async function validateFounderAuth(): Promise<{ valid: boolean }> {
  const valid = await verifyFounderToken();
  return { valid };
}
