import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { getSupabaseClient } from "@/supabase/client";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

// ============================================================
// AUTH CONTEXT v2 - Supabase Production Mode
// All authentication uses Supabase Auth
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
  user_metadata?: Record<string, any>;
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
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<boolean>;
  loginWithUsername: (username: string, password: string) => Promise<boolean>;
  registerWithUsername: (username: string, password: string, name: string, email: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  refreshAuth: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; code?: string; message: string }>;
  verifyResetCode: (email: string, code: string) => boolean;
  resetPassword: (email: string, newPassword: string) => Promise<boolean>;
  bindRole: (stationId: string, stationName: string, role: StationRoleBinding["role"], invitedBy: string, expiresAt?: string) => void;
  terminateRole: (stationId: string) => void;
  getActiveBinding: (stationId: string) => StationRoleBinding | null;
  hasAnyBinding: () => boolean;
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

// Convert Supabase User to AuthIdentity
function supabaseUserToIdentity(user: User, session?: Session | null): AuthIdentity {
  return {
    id: user.id,
    authId: `supabase_${user.id}`,
    authMethod: user.app_metadata?.provider === "google" ? "google" : "email",
    email: user.email || "",
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
    picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
    role: user.user_metadata?.role || "owner",
    permissions: ["read", "write"],
    user_metadata: user.user_metadata,
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
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleLogoutRef = useRef<(() => void) | null>(null);
  const refreshAuthRef = useRef<(() => Promise<boolean>) | null>(null);

  // Initialize - listen to Supabase auth state
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const client = getSupabaseClient();
        
        // Get initial session
        const { data: { session } } = await client.auth.getSession();
        
        if (cancelled) return;
        
        if (session?.user) {
          const supabaseUser = session.user;
          const newUser = supabaseUserToIdentity(supabaseUser, session);
          setUser(newUser);
          setToken(session.access_token);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
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

    initAuth();

    // Subscribe to auth state changes
    const client = getSupabaseClient();
    const { data: { subscription } } = client.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return;
        
        if (event === "SIGNED_IN" && session?.user) {
          const newUser = supabaseUserToIdentity(session.user, session);
          setUser(newUser);
          setToken(session.access_token);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
          localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
          broadcastAuthUpdate(newUser, session.access_token);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setToken(null);
          broadcastAuthUpdate(null, null);
        } else if (event === "TOKEN_REFRESHED" && session) {
          setToken(session.access_token);
          localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
        } else if (event === "USER_UPDATED" && session?.user) {
          const newUser = supabaseUserToIdentity(session.user, session);
          setUser(newUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Broadcast auth update - stable callback
  const broadcastAuthUpdate = useCallback((newUser: AuthIdentity | null, newToken: string | null) => {
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type: newUser ? "AUTH_UPDATE" : "LOGOUT", user: newUser, token: newToken });
      } catch {
        // ignore
      }
    }
  }, []);

  // ---- EMAIL AUTH ----
  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      setIsPending(true);
      setError(null);

      console.info("[AuthContext] Starting Supabase login for:", email);

      try {
        const client = getSupabaseClient();
        
        // Sign in with Supabase
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        const supabaseUser = data.user;
        const session = data.session;
        
        // Create AuthIdentity from Supabase user
        const newUser = supabaseUserToIdentity(supabaseUser, session);

        setUser(newUser);
        setToken(session.access_token);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
        broadcastAuthUpdate(newUser, session.access_token);
        setIsPending(false);
        return { success: true };
      } catch (err: any) {
        console.error("[AuthContext] Supabase login error:", err.message);
        
        let errorMsg = "Invalid email or password.";
        
        if (err.message?.includes("Invalid login credentials")) {
          errorMsg = "Invalid email or password.";
        } else if (err.message?.includes("Email not confirmed")) {
          errorMsg = "Please verify your email address.";
        } else if (err.message?.includes("User not found")) {
          errorMsg = "No account found with this email.";
        } else if (err.status === 429) {
          errorMsg = "Too many failed attempts. Please try again later.";
        } else if (err.message?.includes("fetch")) {
          errorMsg = "Network error. Please check your connection.";
        }
        
        setError(errorMsg);
        setIsPending(false);
        return { success: false, error: errorMsg };
      }
    },
    [broadcastAuthUpdate]
  );

  // ---- EMAIL REGISTRATION ----
  const registerWithEmail = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      console.info("[AuthContext] Registering new user with Supabase:", email);

      try {
        const client = getSupabaseClient();
        
        // Sign up with Supabase
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          const supabaseUser = data.user;
          const session = data.session;
          
          // Create AuthIdentity from Supabase user
          const newUser = supabaseUserToIdentity(supabaseUser, session);

          setUser(newUser);
          if (session) {
            setToken(session.access_token);
            localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
          }
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
          if (session) {
            broadcastAuthUpdate(newUser, session.access_token);
          }
          setIsPending(false);
          return true;
        }
        
        setIsPending(false);
        return false;
      } catch (err: any) {
        console.error("[AuthContext] Supabase registration error:", err.message);
        
        if (err.message?.includes("already registered")) {
          setError("An account with this email already exists.");
        } else if (err.message?.includes("invalid email")) {
          setError("Invalid email address.");
        } else if (err.message?.includes("Password should be at least")) {
          setError(err.message);
        } else {
          setError("Registration failed. Please try again.");
        }
        
        setIsPending(false);
        return false;
      }
    },
    [broadcastAuthUpdate]
  );

  // ---- USERNAME AUTH (Supabase - email format) ----
  const loginWithUsername = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      // Convert username to email format for Supabase
      const email = `${username}@fuelpro.local`;
      
      try {
        const client = getSupabaseClient();
        
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        const supabaseUser = data.user;
        const session = data.session;
        
        const newUser: AuthIdentity = {
          id: supabaseUser.id,
          authId: `supabase_${supabaseUser.id}`,
          authMethod: "username",
          email: supabaseUser.email || email,
          name: supabaseUser.user_metadata?.full_name || username,
          role: "owner",
          permissions: ["read", "write"],
        };

        setUser(newUser);
        setToken(session.access_token);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
        broadcastAuthUpdate(newUser, session.access_token);
        setIsPending(false);
        return true;
      } catch (err: any) {
        console.error("[AuthContext] Username login error:", err.message);
        setError("Invalid username or password");
        setIsPending(false);
        return false;
      }
    },
    [broadcastAuthUpdate]
  );

  const registerWithUsername = useCallback(
    async (username: string, password: string, name: string, email: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      // Convert username to email format for Supabase
      const supabaseEmail = `${username}@fuelpro.local`;
      
      try {
        const client = getSupabaseClient();
        
        const { data, error } = await client.auth.signUp({
          email: supabaseEmail,
          password,
          options: {
            data: {
              full_name: name,
              username,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          const supabaseUser = data.user;
          const session = data.session;
          
          const newUser: AuthIdentity = {
            id: supabaseUser.id,
            authId: `supabase_${supabaseUser.id}`,
            authMethod: "username",
            email: supabaseEmail,
            name,
            role: "owner",
            permissions: ["read", "write"],
          };

          setUser(newUser);
          if (session) {
            setToken(session.access_token);
            localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
          }
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
          setIsPending(false);
          return true;
        }
        
        setIsPending(false);
        return false;
      } catch (err: any) {
        console.error("[AuthContext] Username registration error:", err.message);
        
        if (err.message?.includes("already registered")) {
          setError("Username already exists");
        } else {
          setError("Registration failed. Please try again.");
        }
        
        setIsPending(false);
        return false;
      }
    },
    []
  );

  // ---- LOGOUT ----
  const handleLogout = useCallback(async () => {
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) {
        console.error("[AuthContext] Supabase sign out error:", error);
      }
    } catch (err) {
      console.error("[AuthContext] Sign out error:", err);
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
      const client = getSupabaseClient();
      const { data: { session } } = await client.auth.getSession();
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
  useEffect(() => { handleLogoutRef.current = handleLogout; }, [handleLogout]);
  useEffect(() => { refreshAuthRef.current = refreshAuth; }, [refreshAuth]);

  // Token refresh - Supabase handles this automatically via autoRefreshToken
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (token) {
      // Check session every 5 minutes
      refreshIntervalRef.current = setInterval(() => {
        refreshAuthRef.current?.();
      }, 5 * 60 * 1000);
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [token, refreshAuth]);

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
    (stationId: string, stationName: string, role: StationRoleBinding["role"], invitedBy: string, expiresAt?: string) => {
      if (!user) return;
      setBindings(prev => {
        const filtered = prev.filter(b => b.stationId !== stationId);
        return [...filtered, { stationId, stationName, role, invitedBy, joinedAt: new Date().toISOString(), expiresAt, active: true, authId: user.authId }];
      });
    },
    [user]
  );

  const terminateRole = useCallback((stationId: string) => {
    setBindings(prev => prev.map(b => b.stationId === stationId ? { ...b, active: false } : b));
  }, []);

  const getActiveBinding = useCallback(
    (stationId: string): StationRoleBinding | null =>
      bindings.find(b => b.stationId === stationId && b.active && (!b.authId || b.authId === user?.authId)) || null,
    [bindings, user]
  );

  const hasAnyBinding = useCallback(() => {
    if (!user) return false;
    return bindings.some(b => b.active && b.authId === user.authId);
  }, [bindings, user]);

  // ---- PASSWORD RESET (Supabase) ----
  const requestPasswordReset = useCallback(
    async (email: string): Promise<{ success: boolean; code?: string; message: string }> => {
      setIsPending(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/#/reset-password`,
        });

        if (error) {
          throw error;
        }

        console.log("[Password Reset] Reset email sent to:", email);
        setIsPending(false);
        return { success: true, message: "Password reset email sent. Check your inbox." };
      } catch (err: any) {
        console.error("[AuthContext] Password reset error:", err.message);
        
        let errorMsg = "Failed to send reset email.";
        if (err.message?.includes("User not found")) {
          errorMsg = "No account found with this email.";
        }
        
        setError(errorMsg);
        setIsPending(false);
        return { success: false, message: errorMsg };
      }
    },
    []
  );

  const verifyResetCode = useCallback(
    (email: string, code: string): boolean => {
      // Supabase handles password reset via email link, not code verification
      setError("Supabase handles password reset via email link.");
      return false;
    },
    []
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
        const client = getSupabaseClient();
        
        const { error } = await client.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          throw error;
        }

        setIsPending(false);
        return true;
      } catch (err: any) {
        setError(err.message || "Failed to reset password");
        setIsPending(false);
        return false;
      }
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user, bindings, isPending, isLoading, error, token,
        loginWithEmail, registerWithEmail, loginWithUsername, registerWithUsername,
        logout, clearError, refreshAuth,
        requestPasswordReset, verifyResetCode, resetPassword,
        bindRole, terminateRole, getActiveBinding, hasAnyBinding,
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
