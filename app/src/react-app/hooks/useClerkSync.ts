/**
 * useClerkSync - Comprehensive Clerk Authentication Integration
 * 
 * This hook provides seamless integration between Clerk and the app's
 * existing authentication system. It:
 * - Detects Clerk configuration status
 * - Syncs Clerk user state with AuthContext
 * - Provides unified auth state for the entire app
 * - Falls back to legacy auth when Clerk is not configured
 * 
 * Usage:
 * const { isClerkConfigured, isSignedIn, user, signOut } = useClerkSync();
 */

import { useEffect, useCallback, useState } from "react";
import { useUser, useClerk, useAuth } from "@clerk/clerk-react";

// Check if Clerk is configured
const isClerkConfigured = () => {
  return !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
};

export interface ClerkSyncState {
  // Configuration
  isClerkConfigured: boolean;
  
  // Clerk state
  clerkUser: ReturnType<typeof useUser>["user"];
  clerkSession: ReturnType<typeof useUser>["session"];
  isSignedIn: boolean;
  isLoaded: boolean;
  
  // Unified user state
  userId: string | null;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  
  // Auth method
  authMethod: "clerk" | "legacy" | "none";
  
  // Legacy app user (from AuthContext)
  appUser: ReturnType<typeof useAuth>["user"];
  
  // Token helpers
  getToken: () => Promise<string | null>;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

export function useClerkSync(): ClerkSyncState {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const { user: appUser, token: appToken } = useAuth();
  
  const [clerkConfigured, setClerkConfigured] = useState(isClerkConfigured());
  
  // Re-check configuration periodically (for hot reload support)
  useEffect(() => {
    setClerkConfigured(isClerkConfigured());
  }, []);
  
  // Sync Clerk user to app's AuthContext
  useEffect(() => {
    if (!clerkConfigured) return;
    
    if (isSignedIn && user) {
      // Clerk user signed in - sync to localStorage for app use
      localStorage.setItem("clerk_user_id", user.id);
      localStorage.setItem("clerk_session_id", user.sessionId || "");
      localStorage.setItem("clerk_email", user.primaryEmailAddress?.emailAddress || "");
      localStorage.setItem("clerk_name", user.fullName || user.firstName || "");
    } else if (!isSignedIn) {
      // Clerk signed out - clear Clerk-specific storage
      localStorage.removeItem("clerk_user_id");
      localStorage.removeItem("clerk_session_id");
      localStorage.removeItem("clerk_email");
      localStorage.removeItem("clerk_name");
    }
  }, [clerkConfigured, isSignedIn, user]);
  
  // Get Clerk session token
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!clerkConfigured || !isSignedIn) {
      return appToken;
    }
    
    try {
      const session = user?.getSessionToken();
      return session || null;
    } catch {
      return appToken;
    }
  }, [clerkConfigured, isSignedIn, user, appToken]);
  
  // Get auth headers for API calls
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    if (token) {
      return {
        "Authorization": `Bearer ${token}`,
      };
    }
    return {};
  }, [getToken]);
  
  // Determine auth method
  const authMethod: ClerkSyncState["authMethod"] = 
    clerkConfigured && isSignedIn ? "clerk" :
    appUser ? "legacy" : "none";
  
  return {
    isClerkConfigured: clerkConfigured,
    clerkUser: user,
    clerkSession: user?.session,
    isSignedIn: clerkConfigured ? isSignedIn : false,
    isLoaded: clerkConfigured ? isLoaded : true,
    userId: clerkConfigured && isSignedIn ? user?.id || null : 
            appUser?.id || null,
    email: clerkConfigured && isSignedIn ? 
           user?.primaryEmailAddress?.emailAddress || null :
           appUser?.email || null,
    name: clerkConfigured && isSignedIn ?
           user?.fullName || user?.firstName || null :
           appUser?.name || null,
    imageUrl: clerkConfigured && isSignedIn ?
              user?.imageUrl || null :
              appUser?.picture || null,
    authMethod,
    appUser,
    getToken,
    getAuthHeaders,
  };
}

/**
 * useClerkSignOut - Hook for signing out from Clerk or app auth
 */
export function useClerkSignOut() {
  const { signOut: clerkSignOut } = useClerk();
  const { logout: appLogout } = useAuth();
  const clerkConfigured = isClerkConfigured();
  
  return useCallback(async (redirectUrl?: string) => {
    if (clerkConfigured) {
      await clerkSignOut({ redirectUrl });
    }
    appLogout();
  }, [clerkConfigured, clerkSignOut, appLogout]);
}

/**
 * isClerkConfigured - Check if Clerk is set up
 */
export { isClerkConfigured };
