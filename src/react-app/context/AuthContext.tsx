import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { supabase } from "@/supabase/client";
import { getSupabaseClient } from "@/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// ============================================================
// AUTH CONTEXT v10 - Supabase Production Mode
// ============================================================

export type AuthMethod = "google" | "email" | "username";

export interface AuthIdentity {
  id: string;
  authId: string;
  authMethod: AuthMethod;
  email: string;
  name: string;
  picture?: string;
  role?: string;
  permissions?: string[];
  phone?: string;
  username?: string;
}

export interface StationRoleBinding {
  stationId: string;
  stationName: string;
  role: string; // base role (owner/manager/staff/auditor) or custom role slug
  invitedBy: string;
  joinedAt: string;
  expiresAt?: string;
  active: boolean;
  authId?: string;
}

interface AuthContextType {
  user: AuthIdentity | null;
  bindings: StationRoleBinding[];
  isPending: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  loginWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (
    email: string,
    password: string,
    name: string,
  ) => Promise<boolean>;
  loginWithUsername: (username: string, password: string) => Promise<boolean>;
  registerWithUsername: (
    username: string,
    password: string,
    name: string,
    email: string,
  ) => Promise<boolean>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  /**
   * Google Identity Services (GIS) client-side token flow. Renders Google's
   * own "Sign in with Google" flow, receives an ID token (JWT) in the browser,
   * and exchanges it with Supabase via signInWithIdToken. Uses "Authorized
   * JavaScript origins" (not redirect URIs), so it works without the OAuth
   * redirect-URI registration that the server-side flow requires.
   */
  loginWithGoogleToken: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  clearError: () => void;
  refreshAuth: () => Promise<boolean>;
  requestPasswordReset: (
    email: string,
  ) => Promise<{ success: boolean; code?: string; message: string }>;
  verifyResetCode: (email: string, code: string) => boolean;
  resetPassword: (email: string, newPassword: string) => Promise<boolean>;
  updateProfile: (updates: {
    name?: string;
    phone?: string;
    username?: string;
    avatarUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateEmail: (
    newEmail: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  bindRole: (
    stationId: string,
    stationName: string,
    role: StationRoleBinding["role"],
    invitedBy: string,
    expiresAt?: string,
  ) => void;
  terminateRole: (stationId: string) => void;
  getActiveBinding: (stationId: string) => StationRoleBinding | null;
  hasAnyBinding: () => boolean;
  syncBindingsFromCloud: () => Promise<void>;
}

const AUTH_STORAGE_KEY = "fuelpro_auth_identity";
const BINDINGS_STORAGE_KEY = "fuelpro_role_bindings";
const TOKEN_STORAGE_KEY = "fuelpro_token";
const DEVICE_ID_KEY = "fuelpro_device_id";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function loadUser(): AuthIdentity | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.warn("[AuthContext] Failed to load user from storage:", err);
  }
  return null;
}

function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function loadBindings(): StationRoleBinding[] {
  try {
    const stored = localStorage.getItem(BINDINGS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

// Convert Supabase user to AuthIdentity (enriched with profiles table data)
async function supabaseUserToIdentityEnriched(
  user: User,
  session: Session | null,
): Promise<AuthIdentity> {
  const base: AuthIdentity = {
    id: user.id,
    authId: `supabase_${user.id}`,
    authMethod: user.app_metadata?.provider === "google" ? "google" : "email",
    email: user.email || "",
    name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
    picture: user.user_metadata?.avatar_url || undefined,
    role: "owner",
    permissions: ["read", "write"],
    phone: user.user_metadata?.phone || undefined,
    username: user.user_metadata?.username || undefined,
  };
  // Enrich from profiles table if available
  try {
    const sc = getSupabaseClient();
    const { data: profile } = await sc
      .from("profiles")
      .select("name, phone, username, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      if (profile.name) base.name = profile.name;
      if (profile.phone) base.phone = profile.phone;
      if (profile.username) base.username = profile.username;
      if (profile.avatar_url) base.picture = profile.avatar_url;
      if (profile.role) base.role = profile.role;
    }
  } catch {
    // profiles table may not be accessible yet; fall back to base identity
  }
  return base;
}

// Convert Supabase user to AuthIdentity (synchronous, from metadata only)
function supabaseUserToIdentity(
  user: User,
  session: Session | null,
): AuthIdentity {
  return {
    id: user.id,
    authId: `supabase_${user.id}`,
    authMethod: user.app_metadata?.provider === "google" ? "google" : "email",
    email: user.email || "",
    name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
    picture: user.user_metadata?.avatar_url || undefined,
    role: "owner",
    permissions: ["read", "write"],
    phone: user.user_metadata?.phone || undefined,
    username: user.user_metadata?.username || undefined,
  };
}

let syncChannel: BroadcastChannel | null = null;
try {
  syncChannel = new BroadcastChannel("fuelpro_auth_sync");
} catch {
  // BroadcastChannel not supported
}

// Translate raw Supabase auth-email rate-limit / throttling errors into a
// clear, actionable user message. Supabase returns these when the caller
// exceeds the per-email send limit (~3-4/hour) or resends too quickly.
function friendlyAuthEmailError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("email rate limit") ||
    m.includes("rate limit exceeded") ||
    m.includes("for security purposes, you can only request") ||
    m.includes("you can only request this after") ||
    m.includes("429")
  ) {
    return "Too many emails sent. For security, Supabase limits reset emails to a few per hour. Please wait a few minutes before trying again.";
  }
  return message;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthIdentity | null>(loadUser);
  const [bindings, setBindings] = useState<StationRoleBinding[]>(loadBindings);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(loadToken);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const handleLogoutRef = useRef<(() => void) | null>(null);
  const refreshAuthRef = useRef<(() => Promise<boolean>) | null>(null);

  // Cooldown tracking for auth-email operations (password reset, signup) to
  // prevent hitting Supabase's "email rate limit exceeded" (429). Supabase
  // limits auth emails to ~3-4 per hour per address; rapid retries (double
  // clicks, page re-renders) exhaust this almost instantly. We enforce a
  // client-side cooldown so the user can't fire a second request until it
  // has elapsed, and translate the rate-limit error into a friendly message.
  const RESET_COOLDOWN_MS = 60_000; // 60 seconds between reset emails
  const lastResetRequestRef = useRef<Record<string, number>>({});

  // Initialize - listen to Supabase auth state
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        // Get current session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          const identity = await supabaseUserToIdentityEnriched(
            session.user,
            session,
          );
          setUser(identity);
          setToken(session.access_token);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(identity));
          localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
        }
      } catch (err) {
        console.error("[AuthContext] Auth initialization error:", err);
        // Use cached data if available
        if (!cancelled) {
          const cachedUser = loadUser();
          if (cachedUser) setUser(cachedUser);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // Initial session check
    initAuth();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (event === "SIGNED_IN" && session?.user) {
        const identity = await supabaseUserToIdentityEnriched(
          session.user,
          session,
        );
        setUser(identity);
        setToken(session.access_token);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(identity));
        localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setToken(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        const identity = await supabaseUserToIdentityEnriched(
          session.user,
          session,
        );
        setUser(identity);
        setToken(session.access_token);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(identity));
        localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
      }
    });

    // ── Cross-tab auth sync (receiver side) ──
    // Other tabs post AUTH_UPDATE / LOGOUT on the BroadcastChannel. We also
    // listen to the `storage` event as a fallback (fires in other tabs when
    // localStorage is mutated). This keeps every open tab's auth state in sync:
    // sign-in / sign-out / token refresh in one tab reflects everywhere.
    const applyRemoteAuth = (
      newUser: AuthIdentity | null,
      newToken: string | null,
    ) => {
      setUser(newUser);
      setToken(newToken);
      if (newUser) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      if (newToken) {
        localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    };

    if (syncChannel) {
      syncChannel.onmessage = (ev: MessageEvent) => {
        const data = ev.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "AUTH_UPDATE" && data.user) {
          applyRemoteAuth(data.user as AuthIdentity, data.token as string);
        } else if (data.type === "LOGOUT") {
          applyRemoteAuth(null, null);
        }
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        if (e.newValue) {
          try {
            applyRemoteAuth(JSON.parse(e.newValue) as AuthIdentity, null);
          } catch {
            // ignore malformed
          }
        } else {
          applyRemoteAuth(null, null);
        }
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (syncChannel) syncChannel.onmessage = null;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Broadcast auth update - stable callback
  const broadcastAuthUpdate = useCallback(
    (newUser: AuthIdentity | null, newToken: string | null) => {
      if (syncChannel) {
        try {
          syncChannel.postMessage({
            type: newUser ? "AUTH_UPDATE" : "LOGOUT",
            user: newUser,
            token: newToken,
          });
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  // ---- EMAIL AUTH ----
  const loginWithEmail = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ success: boolean; error?: string }> => {
      setIsPending(true);
      setError(null);

      console.info("[AuthContext] Starting Supabase login for:", email);

      try {
        const { data, error: supabaseError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (supabaseError) {
          console.error(
            "[AuthContext] Supabase login error:",
            supabaseError.message,
          );
          setError(supabaseError.message);
          setIsPending(false);
          return { success: false, error: supabaseError.message };
        }

        if (data.user && data.session) {
          const newUser = await supabaseUserToIdentityEnriched(
            data.user,
            data.session,
          );

          setUser(newUser);
          setToken(data.session.access_token);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
          localStorage.setItem(TOKEN_STORAGE_KEY, data.session.access_token);
          broadcastAuthUpdate(newUser, data.session.access_token);
        }

        setIsPending(false);
        return { success: true };
      } catch (err: any) {
        console.error("[AuthContext] Supabase login error:", err.message);
        setError(err.message || "Login failed. Please try again.");
        setIsPending(false);
        return { success: false, error: err.message };
      }
    },
    [broadcastAuthUpdate],
  );

  // ---- EMAIL REGISTRATION ----
  const registerWithEmail = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      console.info("[AuthContext] Registering new user with Supabase:", email);

      try {
        const { data, error: supabaseError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (supabaseError) {
          console.error(
            "[AuthContext] Supabase registration error:",
            supabaseError.message,
          );
          const friendly = friendlyAuthEmailError(supabaseError.message);
          setError(friendly);
          setIsPending(false);
          return false;
        }

        if (data.user && data.session) {
          const newUser = supabaseUserToIdentity(data.user, data.session);

          setUser(newUser);
          setToken(data.session.access_token);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
          localStorage.setItem(TOKEN_STORAGE_KEY, data.session.access_token);
          broadcastAuthUpdate(newUser, data.session.access_token);

          // Explicitly upsert profiles row (the DB trigger should also do this, but
          // we add a belt-and-suspenders upsert in case trigger timing or RLS blocks it)
          try {
            await supabase.from("profiles").upsert(
              {
                id: data.user.id,
                email: email,
                name: name,
              },
              { onConflict: "id" },
            );
          } catch (profileErr) {
            console.warn(
              "[AuthContext] profiles upsert failed (trigger should handle it):",
              profileErr,
            );
          }
        } else if (data.user && !data.session) {
          // Supabase may return a user without a session even when
          // autoconfirm is enabled (it doesn't always embed the session in
          // the signup response). Since email confirmation is now automatic,
          // the credentials are valid immediately — sign in explicitly so the
          // user is logged in right away instead of being stranded on the
          // register screen with a "Logging you in..." message that never
          // completes.
          console.info(
            "[AuthContext] Registration succeeded without session; signing in automatically",
          );
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({ email, password });

          if (signInError) {
            console.error(
              "[AuthContext] Auto sign-in after registration failed:",
              signInError.message,
            );
            setError(
              "Account created, but automatic sign-in failed. Please sign in with your credentials.",
            );
            setIsPending(false);
            return true;
          }

          if (signInData.user && signInData.session) {
            const newUser = await supabaseUserToIdentityEnriched(
              signInData.user,
              signInData.session,
            );
            setUser(newUser);
            setToken(signInData.session.access_token);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
            localStorage.setItem(
              TOKEN_STORAGE_KEY,
              signInData.session.access_token,
            );
            broadcastAuthUpdate(newUser, signInData.session.access_token);

            try {
              await supabase.from("profiles").upsert(
                {
                  id: signInData.user.id,
                  email: email,
                  name: name,
                },
                { onConflict: "id" },
              );
            } catch (profileErr) {
              console.warn(
                "[AuthContext] profiles upsert failed (post auto-signin):",
                profileErr,
              );
            }
          }
        }

        setIsPending(false);
        return true;
      } catch (err: any) {
        console.error(
          "[AuthContext] Supabase registration error:",
          err.message,
        );
        setError(err.message || "Registration failed. Please try again.");
        setIsPending(false);
        return false;
      }
    },
    [broadcastAuthUpdate],
  );

  // ---- GOOGLE AUTH (Supabase OAuth / Google Identity Services) ----
  // Fully free: uses Supabase's hosted Google OAuth provider (Google Identity
  // Services / OAuth 2.0). No billing required on Google or Supabase. The
  // redirect callback is handled automatically by the Supabase client
  // (detectSessionInUrl: true) and the onAuthStateChange listener above, so we
  // do not set the user here — the SIGNED_IN event enriches and persists it.
  const loginWithGoogle = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    setIsPending(true);
    setError(null);

    console.info("[AuthContext] Starting Google login (Supabase OAuth)");

    try {
      const { error: supabaseError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Redirect back to the app root; Supabase will append the auth tokens
          // as a URL hash which the client auto-detects on load.
          redirectTo: window.location.origin + "/",
          scopes: "openid email profile",
        },
      });

      if (supabaseError) {
        console.error(
          "[AuthContext] Google login error:",
          supabaseError.message,
        );
        const msg =
          supabaseError.message?.includes("provider") ||
          supabaseError.message?.includes("not enabled")
            ? "Google sign-in is not enabled yet. Please ask an admin to enable the Google provider in Supabase (it's free)."
            : supabaseError.message;
        setError(msg);
        setIsPending(false);
        return { success: false, error: msg };
      }

      // Browser is navigating away to Google's consent screen; the
      // onAuthStateChange listener will resume the session on return.
      return { success: true };
    } catch (err: any) {
      console.error("[AuthContext] Google login error:", err.message);
      setError(err.message || "Google login failed. Please try again.");
      setIsPending(false);
      return { success: false, error: err.message };
    }
  }, []);

  // ---- GOOGLE AUTH (GIS client-side token flow) ----
  // Uses Google Identity Services to obtain an ID token in-browser, then
  // exchanges it with Supabase via signInWithIdToken. This flow relies on
  // "Authorized JavaScript origins" (not redirect URIs), so it works even
  // when the OAuth client's redirect-URI list is not yet configured.
  // Client ID is configurable via VITE_GOOGLE_CLIENT_ID; falls back to the
  // project's hard-coded Google OAuth client for zero-config deploys.
  const GOOGLE_CLIENT_ID =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "186024815542-fp0p5lrc6ensfg2i6o1vvf2jbnktan7f.apps.googleusercontent.com";

  const loginWithGoogleToken = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    setIsPending(true);
    setError(null);

    const finishWithError = (msg: string) => {
      setError(msg);
      setIsPending(false);
      return { success: false, error: msg };
    };

    try {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        return finishWithError(
          "Google Identity Services failed to load. Check your connection and try again.",
        );
      }

      // Request an ID token (JWT credential) from Google.
      const credential: string | null = await new Promise((resolve) => {
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => {
              resolve(response?.credential || null);
            },
          });
          // One Tap prompt; if it cannot show (e.g. no active session or
          // blocked), fall back to the redirect-based OAuth flow below.
          google.accounts.id.prompt((notification: any) => {
            if (
              notification?.isNotDisplayed() ||
              notification?.isSkippedMoment()
            ) {
              resolve(null);
            }
          });
        } catch {
          resolve(null);
        }
      });

      if (!credential) {
        // Fall back to the server-side OAuth redirect flow.
        console.info(
          "[AuthContext] GIS One Tap unavailable; falling back to OAuth redirect",
        );
        return loginWithGoogle();
      }

      const { data, error: supabaseError } =
        await supabase.auth.signInWithIdToken({
          provider: "google",
          token: credential,
        });

      if (supabaseError || !data?.user) {
        const msg = supabaseError?.message
          ? `Google sign-in failed: ${supabaseError.message}`
          : "Google sign-in failed. Please try again.";
        return finishWithError(msg);
      }

      // onAuthStateChange (SIGNED_IN) will enrich + persist the user.
      return { success: true };
    } catch (err: any) {
      console.error("[AuthContext] GIS Google login error:", err.message);
      return finishWithError(err.message || "Google login failed.");
    }
  }, [loginWithGoogle]);

  // ---- USERNAME AUTH (Local Fallback) ----
  const loginWithUsername = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      const users: Record<string, any> = JSON.parse(
        localStorage.getItem("fuelpro_username_users") || "{}",
      );
      const found = Object.values(users).find(
        (u: any) => u.username === username && u.password === password,
      );
      if (found) {
        const u = found as any;
        console.info("[AuthContext] Username login successful for:", u.name);
        const newUser: AuthIdentity = {
          id: `username_${username}`,
          authId: `username_${username}`,
          authMethod: "username",
          email: u.email || "",
          name: u.name || username,
          role: u.role || "user",
        };
        setUser(newUser);
        setIsPending(false);
        return true;
      }
      setError("Invalid username or password");
      setIsPending(false);
      return false;
    },
    [],
  );

  const registerWithUsername = useCallback(
    async (
      username: string,
      password: string,
      name: string,
      email: string,
    ): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      const users: Record<string, any> = JSON.parse(
        localStorage.getItem("fuelpro_username_users") || "{}",
      );
      if (users[username]) {
        setError("Username already exists");
        setIsPending(false);
        return false;
      }

      users[username] = {
        username,
        password,
        name,
        email,
        role: "user",
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem("fuelpro_username_users", JSON.stringify(users));
      setUser({
        id: `username_${username}`,
        authId: `username_${username}`,
        authMethod: "username",
        email: email || "",
        name: name || username,
      });
      setIsPending(false);
      return true;
    },
    [],
  );

  // ---- LOGOUT ----
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[AuthContext] Supabase sign out error:", err);
    }

    setUser(null);
    setToken(null);
    setBindings([]);
    setError(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(BINDINGS_STORAGE_KEY);
    broadcastAuthUpdate(null, null);
  }, [broadcastAuthUpdate]);

  const logout = handleLogout;

  // ---- REFRESH AUTH ----
  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;
      if (session) {
        setToken(session.access_token);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, []);

  // Keep refs in sync
  useEffect(() => {
    handleLogoutRef.current = handleLogout;
  }, [handleLogout]);
  useEffect(() => {
    refreshAuthRef.current = refreshAuth;
  }, [refreshAuth]);

  // Token refresh interval
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (token) {
      refreshIntervalRef.current = setInterval(
        () => {
          refreshAuthRef.current?.();
        },
        14 * 60 * 1000,
      );
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [token]);

  // Cross-tab sync
  useEffect(() => {
    if (!syncChannel) return;
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "AUTH_UPDATE") {
        setUser(e.data.user);
        setToken(e.data.token);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(e.data.user));
        localStorage.setItem(TOKEN_STORAGE_KEY, e.data.token);
      } else if (e.data?.type === "LOGOUT") {
        handleLogoutRef.current?.();
      }
    };
    syncChannel.addEventListener("message", handleMessage);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        if (e.newValue) setUser(JSON.parse(e.newValue));
        else setUser(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      syncChannel?.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  }, [user]);

  useEffect(() => {
    localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  }, [bindings]);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, [token]);

  const clearError = useCallback(() => setError(null), []);

  // ---- ROLE BINDING ----
  const bindRole = useCallback(
    (
      stationId: string,
      stationName: string,
      role: StationRoleBinding["role"],
      invitedBy: string,
      expiresAt?: string,
    ) => {
      if (!user) return;
      setBindings((prev) => {
        const filtered = prev.filter((b) => b.stationId !== stationId);
        return [
          ...filtered,
          {
            stationId,
            stationName,
            role,
            invitedBy,
            joinedAt: new Date().toISOString(),
            expiresAt,
            active: true,
            authId: user.authId,
          },
        ];
      });
    },
    [user],
  );

  const terminateRole = useCallback((stationId: string) => {
    setBindings((prev) =>
      prev.map((b) =>
        b.stationId === stationId ? { ...b, active: false } : b,
      ),
    );
  }, []);

  const getActiveBinding = useCallback(
    (stationId: string): StationRoleBinding | null =>
      bindings.find(
        (b) =>
          b.stationId === stationId &&
          b.active &&
          (!b.authId || b.authId === user?.authId),
      ) || null,
    [bindings, user],
  );

  const hasAnyBinding = useCallback(() => {
    if (!user) return false;
    return bindings.some((b) => b.active && b.authId === user.authId);
  }, [bindings, user]);

  // Sync role bindings from cloud (station_members table) — ensures cross-device station access
  const syncBindingsFromCloud = useCallback(async () => {
    if (!user) return;
    try {
      const sc = getSupabaseClient();
      // Fetch accepted memberships for this user (by user_id or invited_email),
      // joining stations to get the real station name (not the member's name).
      const { data: members, error } = await sc
        .from("station_members")
        .select("station_id, role, status, name, stations:station_id(name)")
        .or(`user_id.eq.${user.id},invited_email.eq.${user.email}`)
        .in("status", ["accepted", "active"]);
      if (error) {
        console.warn(
          "[AuthContext] syncBindingsFromCloud error:",
          error.message,
        );
        return;
      }
      if (members && members.length > 0) {
        setBindings((prev) => {
          const cloudBindings: StationRoleBinding[] = members.map((m: any) => ({
            stationId: m.station_id,
            stationName: m.stations?.name || m.name || "Shared Station",
            role: (m.role as StationRoleBinding["role"]) || "staff",
            invitedBy: "cloud",
            joinedAt: new Date().toISOString(),
            active: true,
            authId: user.authId,
          }));
          // Merge: keep existing owner bindings, add/update cloud bindings
          const existingIds = new Set(cloudBindings.map((b) => b.stationId));
          const merged = [
            ...prev.filter((b) => !existingIds.has(b.stationId)),
            ...cloudBindings,
          ];
          return merged;
        });
      }
    } catch (err) {
      console.warn("[AuthContext] syncBindingsFromCloud failed:", err);
    }
  }, [user]);

  // Sync cloud station_members → local bindings whenever user changes (login, device switch)
  useEffect(() => {
    if (user) {
      syncBindingsFromCloud().catch(() => {});
    }
  }, [user, syncBindingsFromCloud]);

  // ---- PASSWORD RESET ----
  const requestPasswordReset = useCallback(
    async (
      email: string,
    ): Promise<{ success: boolean; code?: string; message: string }> => {
      // Client-side cooldown: prevent rapid retries that exhaust Supabase's
      // email rate limit. If a request was made for this email within the
      // cooldown window, return a friendly message instead of hitting the API.
      const key = email.trim().toLowerCase();
      const now = Date.now();
      const lastReq = lastResetRequestRef.current[key] || 0;
      const elapsed = now - lastReq;
      if (elapsed < RESET_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESET_COOLDOWN_MS - elapsed) / 1000);
        const msg = `Please wait ${waitSec}s before requesting another reset email.`;
        return { success: false, message: msg };
      }

      setIsPending(true);
      setError(null);

      try {
        const { error: supabaseError } =
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });

        // Record the attempt time regardless of outcome so a failed request
        // also counts toward the cooldown (prevents immediate retry storms).
        lastResetRequestRef.current[key] = Date.now();

        if (supabaseError) {
          console.error(
            "[AuthContext] Password reset error:",
            supabaseError.message,
          );
          const friendly = friendlyAuthEmailError(supabaseError.message);
          setError(friendly);
          setIsPending(false);
          return { success: false, message: friendly };
        }

        console.log("[Password Reset] Reset email sent to:", email);
        setIsPending(false);
        return {
          success: true,
          message: "Password reset email sent. Check your inbox.",
        };
      } catch (err: any) {
        lastResetRequestRef.current[key] = Date.now();
        console.error("[AuthContext] Password reset error:", err.message);
        const friendly = friendlyAuthEmailError(
          err.message || "Failed to send reset email.",
        );
        setError(friendly);
        setIsPending(false);
        return {
          success: false,
          message: friendly,
        };
      }
    },
    [],
  );

  const verifyResetCode = useCallback(
    (email: string, code: string): boolean => {
      setError(
        "Supabase handles password reset via email link. Code verification not needed.",
      );
      return false;
    },
    [],
  );

  const resetPassword = useCallback(
    async (email: string, newPassword: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      if (!newPassword || newPassword.length < 6) {
        setError("Password must be at least 6 characters");
        setIsPending(false);
        return false;
      }

      try {
        // For Supabase, password update requires the user to be logged in
        // or use the reset password flow with the token from email
        setError(
          "Please use the password reset link from your email to change your password.",
        );
        setIsPending(false);
        return false;
      } catch (err: any) {
        setError(err.message || "Failed to reset password");
        setIsPending(false);
        return false;
      }
    },
    [],
  );

  const updateProfile = useCallback(
    async (updates: {
      name?: string;
      phone?: string;
      username?: string;
      avatarUrl?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in" };
      setIsPending(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();

        // 1. Update auth.user metadata (for name, avatar)
        const authUpdates: { data?: Record<string, string> } = {};
        if (updates.name)
          authUpdates.data = { ...authUpdates.data, full_name: updates.name };
        if (updates.avatarUrl)
          authUpdates.data = {
            ...authUpdates.data,
            avatar_url: updates.avatarUrl,
          };
        if (updates.phone)
          authUpdates.data = { ...authUpdates.data, phone: updates.phone };
        if (updates.username)
          authUpdates.data = {
            ...authUpdates.data,
            username: updates.username,
          };

        if (Object.keys(authUpdates).length > 0) {
          const { error: authErr } =
            await supabase.auth.updateUser(authUpdates);
          if (authErr) {
            setError(authErr.message);
            setIsPending(false);
            return { success: false, error: authErr.message };
          }
        }

        // 2. Update profiles table (phone, username, avatar_url, name)
        const profileUpdates: Record<string, string> = {};
        if (updates.name !== undefined) profileUpdates.name = updates.name;
        if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
        if (updates.username !== undefined)
          profileUpdates.username = updates.username;
        if (updates.avatarUrl !== undefined)
          profileUpdates.avatar_url = updates.avatarUrl;

        if (Object.keys(profileUpdates).length > 0) {
          const { error: profileErr } = await supabase
            .from("profiles")
            .update(profileUpdates)
            .eq("id", user.id);
          if (profileErr) {
            // Unique username constraint violation
            if (profileErr.code === "23505") {
              const msg =
                "That username is already taken. Please choose another.";
              setError(msg);
              setIsPending(false);
              return { success: false, error: msg };
            }
            setError(profileErr.message);
            setIsPending(false);
            return { success: false, error: profileErr.message };
          }
        }

        // 3. Update local state
        const updatedUser: AuthIdentity = {
          ...user,
          name: updates.name ?? user.name,
          phone: updates.phone ?? user.phone,
          username: updates.username ?? user.username,
          picture: updates.avatarUrl ?? user.picture,
        };
        setUser(updatedUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
        broadcastAuthUpdate(updatedUser, token);

        setIsPending(false);
        return { success: true };
      } catch (err: any) {
        setError(err.message || "Failed to update profile");
        setIsPending(false);
        return { success: false, error: err.message };
      }
    },
    [user, token, broadcastAuthUpdate],
  );

  const updateEmail = useCallback(
    async (newEmail: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in" };
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return { success: false, error: "Please enter a valid email address" };
      }
      setIsPending(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const { error: authErr } = await supabase.auth.updateUser({
          email: newEmail,
        });
        if (authErr) {
          setError(authErr.message);
          setIsPending(false);
          return { success: false, error: authErr.message };
        }

        // Update profiles table email
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ email: newEmail })
          .eq("id", user.id);
        if (profileErr) {
          console.warn(
            "[AuthContext] profiles email update failed:",
            profileErr.message,
          );
        }

        // Update local state (email change may require confirmation)
        const updatedUser = { ...user, email: newEmail };
        setUser(updatedUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
        broadcastAuthUpdate(updatedUser, token);

        setIsPending(false);
        return { success: true };
      } catch (err: any) {
        setError(err.message || "Failed to update email");
        setIsPending(false);
        return { success: false, error: err.message };
      }
    },
    [user, token, broadcastAuthUpdate],
  );

  const updatePassword = useCallback(
    async (
      newPassword: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!newPassword || newPassword.length < 8) {
        return {
          success: false,
          error: "Password must be at least 8 characters",
        };
      }
      setIsPending(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const { error: authErr } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (authErr) {
          setError(authErr.message);
          setIsPending(false);
          return { success: false, error: authErr.message };
        }
        setIsPending(false);
        return { success: true };
      } catch (err: any) {
        setError(err.message || "Failed to update password");
        setIsPending(false);
        return { success: false, error: err.message };
      }
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        bindings,
        isPending,
        isLoading,
        error,
        token,
        loginWithEmail,
        registerWithEmail,
        loginWithUsername,
        registerWithUsername,
        loginWithGoogle,
        loginWithGoogleToken,
        logout,
        clearError,
        refreshAuth,
        requestPasswordReset,
        verifyResetCode,
        resetPassword,
        updateProfile,
        updateEmail,
        updatePassword,
        bindRole,
        terminateRole,
        getActiveBinding,
        hasAnyBinding,
        syncBindingsFromCloud,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
