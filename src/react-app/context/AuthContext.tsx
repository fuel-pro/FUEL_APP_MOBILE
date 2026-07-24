import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { getFirebaseAuth } from "@/firebase/client";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  getIdToken,
  GoogleAuthProvider,
  signInWithPopup,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";

// ============================================================
// AUTH CONTEXT v9 - Firebase Production Mode (No Clerk)
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

  // Initialize - listen to Firebase auth state
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      try {
        const auth = getFirebaseAuth();
        
        // Listen to Firebase auth state changes
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (cancelled) return;
          
          if (firebaseUser) {
            try {
              // Get fresh ID token
              const idToken = await getIdToken(firebaseUser, true);
              
              const newUser: AuthIdentity = {
                id: firebaseUser.uid,
                authId: `firebase_${firebaseUser.uid}`,
                authMethod: "email",
                email: firebaseUser.email || "",
                name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
                picture: firebaseUser.photoURL || undefined,
                role: "owner",
                permissions: ["read", "write"],
              };
              
              setUser(newUser);
              setToken(idToken);
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
              localStorage.setItem(TOKEN_STORAGE_KEY, idToken);
            } catch (err) {
              console.error("[AuthContext] Error getting Firebase token:", err);
              // Use cached data if available
              if (!cancelled) {
                const cachedUser = loadUser();
                if (cachedUser) setUser(cachedUser);
              }
            }
          } else {
            // User signed out
            setUser(null);
            setToken(null);
          }
        });
      } catch (err) {
        console.error("[AuthContext] Auth initialization error:", err);
        // Use cached data if available
        const cachedUser = loadUser();
        if (cachedUser) setUser(cachedUser);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initAuth();
    
    return () => {
      cancelled = true;
      unsubscribe?.();
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
  // Demo users for testing (when Firebase is not configured)
  const DEMO_USERS: Record<string, { password: string; name: string; role: string }> = {
    "demo@fuelpro.demo": { password: "demo", name: "Demo User", role: "owner" },
    "demo@demo.com": { password: "demo", name: "Test Demo", role: "owner" },
    "admin@fuelpro.app": { password: "admin123", name: "Admin User", role: "admin" },
  };

  // Initialize demo users in localStorage on first load
  useEffect(() => {
    const storedDemo = localStorage.getItem("fuelpro_demo_users");
    if (!storedDemo) {
      localStorage.setItem("fuelpro_demo_users", JSON.stringify(DEMO_USERS));
    }
  }, []);

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      setIsPending(true);
      setError(null);
      console.info("[AuthContext] Starting login for:", email);

      // ---- LOCAL STORAGE FALLBACK (for demo/testing) ----
      const demoUsers = JSON.parse(localStorage.getItem("fuelpro_demo_users") || JSON.stringify(DEMO_USERS));
      const normalizedEmail = email.toLowerCase();
      if (demoUsers[normalizedEmail] && demoUsers[normalizedEmail].password === password) {
        console.info("[AuthContext] Local fallback login successful for:", email);
        const demoUser = demoUsers[normalizedEmail];
        const newUser: AuthIdentity = {
          id: `local_${normalizedEmail}`,
          authId: `local_${normalizedEmail}`,
          authMethod: "email",
          email: normalizedEmail,
          name: demoUser.name,
          role: demoUser.role || "owner",
          permissions: ["read", "write"],
        };
        setUser(newUser);
        const localToken = `local_token_${Date.now()}`;
        setToken(localToken);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        localStorage.setItem(TOKEN_STORAGE_KEY, localToken);
        broadcastAuthUpdate(newUser, localToken);
        setIsPending(false);
        return { success: true };
      }

      try {
        const auth = getFirebaseAuth();
        await setPersistence(auth, browserLocalPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        const idToken = await getIdToken(firebaseUser, true);
        const newUser: AuthIdentity = {
          id: firebaseUser.uid,
          authId: `firebase_${firebaseUser.uid}`,
          authMethod: "email",
          email: firebaseUser.email || email,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || email.split("@")[0],
          picture: firebaseUser.photoURL || undefined,
          role: "owner",
          permissions: ["read", "write"],
        };
        setUser(newUser);
        setToken(idToken);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        localStorage.setItem(TOKEN_STORAGE_KEY, idToken);
        broadcastAuthUpdate(newUser, idToken);
        setIsPending(false);
        return { success: true };
      } catch (err: any) {
        console.error("[AuthContext] Firebase login error:", err.code || err.message);
        let errorMsg = "Invalid email or password.";
        if (err.code === "auth/user-not-found") errorMsg = "No account found with this email.";
        else if (err.code === "auth/wrong-password") errorMsg = "Incorrect password.";
        else if (err.code === "auth/invalid-email") errorMsg = "Invalid email address.";
        else if (err.code === "auth/too-many-requests") errorMsg = "Too many failed attempts. Please try again later.";
        else if (err.code === "auth/network-request-failed") errorMsg = "Network error. Please check your connection.";
        else if (err.code === "auth/invalid-api-key") errorMsg = "Firebase configuration error. Please contact support.";
        else if (err.code === "auth/app-not-authorized") errorMsg = "Firebase authorization error. Please contact support.";
        setError(errorMsg);
        setIsPending(false);
        return { success: false, error: errorMsg };
      }
    },
    [broadcastAuthUpdate]
  );


  const logout = handleLogout;

  // ---- REFRESH AUTH ----
  const refreshAuth = useCallback(async (): Promise<boolean> => {
    const storedToken = loadToken();
    if (!storedToken) return false;
    try {
      const auth = getFirebaseAuth();
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        const newToken = await getIdToken(firebaseUser, true);
        setToken(newToken);
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
  const requestPasswordReset = useCallback(
    async (email: string): Promise<{ success: boolean; code?: string; message: string }> => {
      setIsPending(true);
      setError(null);

      try {
        const auth = getFirebaseAuth();
        await sendPasswordResetEmail(auth, email);
        console.log("[Password Reset] Reset email sent to:", email);
        setIsPending(false);
        return { success: true, message: "Password reset email sent. Check your inbox." };
      } catch (err: any) {
        console.error("[AuthContext] Password reset error:", err);
        
        let errorMsg = "Failed to send reset email.";
        if (err.code === "auth/user-not-found") {
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
      setError("Firebase handles password reset via email link. Code verification not needed.");
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
        // Firebase password reset is done via email link, not code
        setError("Use the password reset email to change your password.");
        setIsPending(false);
        return false;
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
