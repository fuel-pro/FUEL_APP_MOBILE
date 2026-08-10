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
  role: "owner" | "manager" | "staff" | "auditor";
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
    authMethod: "email",
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
    authMethod: "email",
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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
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
          setError(supabaseError.message);
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
          // Email confirmation required
          console.info(
            "[AuthContext] Registration successful, email confirmation required",
          );
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

  // ---- GOOGLE AUTH (Supabase OAuth) ----
  const loginWithGoogle = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    setIsPending(true);
    setError(null);

    console.info("[AuthContext] Starting Google login with Supabase");

    try {
      const { data, error: supabaseError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
          },
        });

      if (supabaseError) {
        console.error(
          "[AuthContext] Supabase Google login error:",
          supabaseError.message,
        );
        setError(supabaseError.message);
        setIsPending(false);
        return { success: false, error: supabaseError.message };
      }

      // OAuth will redirect, so we don't set user here
      // The auth state change will be handled by onAuthStateChange
      setIsPending(false);
      return { success: true };
    } catch (err: any) {
      console.error("[AuthContext] Supabase Google login error:", err.message);
      setError(err.message || "Google login failed. Please try again.");
      setIsPending(false);
      return { success: false, error: err.message };
    }
  }, []);

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
      // Fetch accepted memberships for this user (by user_id or invited_email)
      const { data: members, error } = await sc
        .from("station_members")
        .select("station_id, role, status, name")
        .or(`user_id.eq.${user.id},invited_email.eq.${user.email}`)
        .eq("status", "accepted");
      if (error) {
        console.warn(
          "[AuthContext] syncBindingsFromCloud error:",
          error.message,
        );
        return;
      }
      if (members && members.length > 0) {
        setBindings((prev) => {
          const cloudBindings: StationRoleBinding[] = members.map((m) => ({
            stationId: m.station_id,
            stationName: m.name || "Shared Station",
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
      setIsPending(true);
      setError(null);

      try {
        const { error: supabaseError } =
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });

        if (supabaseError) {
          console.error(
            "[AuthContext] Password reset error:",
            supabaseError.message,
          );
          setError(supabaseError.message);
          setIsPending(false);
          return { success: false, message: supabaseError.message };
        }

        console.log("[Password Reset] Reset email sent to:", email);
        setIsPending(false);
        return {
          success: true,
          message: "Password reset email sent. Check your inbox.",
        };
      } catch (err: any) {
        console.error("[AuthContext] Password reset error:", err.message);
        setError(err.message || "Failed to send reset email.");
        setIsPending(false);
        return {
          success: false,
          message: err.message || "Failed to send reset email.",
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
