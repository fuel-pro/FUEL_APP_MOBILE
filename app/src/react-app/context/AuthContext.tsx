import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { getBackendUrl } from "@/utils/apiConfig";

// ============================================================
// AUTH CONTEXT v6 - Production Mode
// ============================================================

const API_BASE = getBackendUrl();

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
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
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

  // Initialize - verify token with backend (runs once on mount)
  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
      try {
        const storedToken = loadToken();
        if (storedToken && API_BASE) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${API_BASE}/api/auth/me`, {
              headers: { Authorization: `Bearer ${storedToken}` },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!cancelled) {
              if (res.ok) {
                const data = await res.json();
                const backendUser = data.user || data;
                setUser({
                  id: backendUser.id,
                  authId: `email_${backendUser.email}`,
                  authMethod: "email",
                  email: backendUser.email,
                  name: backendUser.name,
                  role: backendUser.role,
                  permissions: backendUser.permissions,
                });
                setToken(storedToken);
              } else {
                localStorage.removeItem(AUTH_STORAGE_KEY);
                localStorage.removeItem(TOKEN_STORAGE_KEY);
                setUser(null);
                setToken(null);
              }
            }
          } catch {
            // Offline - keep cached data, do not clear
            console.info("[AuthContext] Using cached auth (offline or API unavailable)");
          }
        }
      } catch (err) {
        console.error("[AuthContext] Auth initialization error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    initAuth();
    return () => { cancelled = true; };
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
    async (email: string, password: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      // Try backend first if API_BASE is configured
      if (API_BASE) {
        try {
          const deviceId = getDeviceId();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, deviceId }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            const backendUser = data.user;
            const newUser: AuthIdentity = {
              id: backendUser.id,
              authId: `email_${backendUser.email}`,
              authMethod: "email",
              email: backendUser.email,
              name: backendUser.name,
              role: backendUser.role,
              permissions: backendUser.permissions,
            };
            setUser(newUser);
            setToken(data.token);
            localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
            broadcastAuthUpdate(newUser, data.token);
            setIsPending(false);
            return true;
          } else {
            const data = await res.json().catch(() => ({}));
            setError((data as any).error || "Login failed. Check your credentials.");
            setIsPending(false);
            return false;
          }
        } catch {
          setError("Connection error. Please check your internet connection and try again.");
          setIsPending(false);
          return false;
        }
      }

      setError("Login failed. Please try again.");
      setIsPending(false);
      return false;
    },
    [broadcastAuthUpdate]
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      try {
        const deviceId = getDeviceId();
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, deviceId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data as any).error || "Registration failed");
          setIsPending(false);
          return false;
        }
        return loginWithEmail(email, password);
      } catch {
        setError("Connection error. Please try again.");
        setIsPending(false);
        return false;
      }
    },
    [loginWithEmail]
  );

  // ---- USERNAME AUTH ----
  const loginWithUsername = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);
      if (!username || !password) {
        setError("Username and password are required");
        setIsPending(false);
        return false;
      }
      try {
        const users = JSON.parse(localStorage.getItem("fuelpro_username_users") || "{}");
        const found = users[username];
        if (!found || found.password !== password) {
          setError("Invalid username or password");
          setIsPending(false);
          return false;
        }
        const usernameToken = `username_token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newUser: AuthIdentity = {
          id: `username_${username}`,
          authId: `username_${username}`,
          authMethod: "username",
          email: found.email || "",
          name: found.name || username,
        };
        setUser(newUser);
        setToken(usernameToken);
        localStorage.setItem(TOKEN_STORAGE_KEY, usernameToken);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        broadcastAuthUpdate(newUser, usernameToken);
        setIsPending(false);
        return true;
      } catch {
        setError("Login failed. Please try again.");
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
      if (!username || !password || password.length < 4) {
        setError("Username required, password must be at least 4 characters");
        setIsPending(false);
        return false;
      }
      const users = JSON.parse(localStorage.getItem("fuelpro_username_users") || "{}");
      if (users[username]) {
        setError("This username is already taken");
        setIsPending(false);
        return false;
      }
      users[username] = { password, name, email, createdAt: new Date().toISOString() };
      localStorage.setItem("fuelpro_username_users", JSON.stringify(users));
      setUser({ id: `username_${username}`, authId: `username_${username}`, authMethod: "username", email: email || "", name: name || username });
      setIsPending(false);
      return true;
    },
    []
  );

  // ---- LOGOUT ----
  const handleLogout = useCallback(() => {
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
    const storedToken = loadToken();
    if (!storedToken || !API_BASE) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const backendUser = data.user || data;
        const newUser: AuthIdentity = {
          id: backendUser.id,
          authId: `email_${backendUser.email}`,
          authMethod: "email",
          email: backendUser.email,
          name: backendUser.name,
          role: backendUser.role,
          permissions: backendUser.permissions,
        };
        setUser(newUser);
        setToken(storedToken);
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

  // Token refresh interval
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (token) {
      refreshIntervalRef.current = setInterval(() => {
        refreshAuthRef.current?.();
      }, 14 * 60 * 1000);
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

  // ---- PASSWORD RESET ----
  const RESET_CODES_KEY = "fuelpro_password_reset_codes";

  const requestPasswordReset = useCallback(
    async (email: string): Promise<{ success: boolean; code?: string; message: string }> => {
      setIsPending(true);
      setError(null);
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codes: Record<string, { code: string; expiresAt: string }> = JSON.parse(localStorage.getItem(RESET_CODES_KEY) || "{}");
      codes[email] = { code, expiresAt: new Date(Date.now() + 15 * 60000).toISOString() };
      localStorage.setItem(RESET_CODES_KEY, JSON.stringify(codes));
      console.log(`[Password Reset] Code for ${email}: ${code}`);
      setIsPending(false);
      return { success: true, code, message: `Reset code: ${code} (valid 15 min)` };
    },
    []
  );

  const verifyResetCode = useCallback(
    (email: string, code: string): boolean => {
      const codes: Record<string, { code: string; expiresAt: string }> = JSON.parse(localStorage.getItem(RESET_CODES_KEY) || "{}");
      const entry = codes[email];
      if (!entry) { setError("No reset code found. Request a new one."); return false; }
      if (new Date(entry.expiresAt) < new Date()) { setError("Reset code has expired. Request a new one."); return false; }
      if (entry.code !== code) { setError("Invalid reset code"); return false; }
      return true;
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
      const users: Record<string, any> = JSON.parse(localStorage.getItem("fuelpro_email_users") || "{}");
      const entry = Object.entries(users).find(([, u]: [string, any]) => u.email === email);
      if (!entry) { setError("Account not found"); setIsPending(false); return false; }
      const [userId, userData] = entry;
      users[userId] = { ...userData, password: newPassword };
      localStorage.setItem("fuelpro_email_users", JSON.stringify(users));
      const codes: Record<string, any> = JSON.parse(localStorage.getItem(RESET_CODES_KEY) || "{}");
      delete codes[email];
      localStorage.setItem(RESET_CODES_KEY, JSON.stringify(codes));
      setIsPending(false);
      return true;
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
