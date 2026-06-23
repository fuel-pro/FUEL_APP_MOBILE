/**
 * useFounderAuth — React hook for Founder Access authentication.
 * 
 * Supports TWO authentication methods:
 * 1. Clerk Authentication (when configured)
 *    - Uses Clerk session tokens
 *    - Falls back to legacy founder auth
 * 
 * 2. Legacy Founder Auth (always available)
 *    - Uses hardcoded credentials (FOUNDER/fuelpro2026)
 *    - Connects to backend tRPC founderAuth router
 *    - Token is automatically included in all tRPC requests via TRPCProvider headers.
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { useUser, useClerk } from "@clerk/clerk-react";

const SESSION_KEY = "fuelpro_founder_session";

// Check if Clerk is configured
const isClerkConfigured = () => !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

interface FounderSession {
  username: string;
  loginTime: number;
  active: boolean;
  token: string;
  authMethod?: "clerk" | "legacy";
}

export function useFounderAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState<"clerk" | "legacy" | null>(null);

  // Clerk integration
  const { user: clerkUser, isSignedIn: isClerkSignedIn, isLoaded: isClerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const loginMutation = trpc.founderAuth.login.useMutation();
  const logoutMutation = trpc.founderAuth.logout.useMutation();
  const utils = trpc.useUtils();

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = useCallback(() => {
    // Check Clerk first if configured
    if (isClerkConfigured() && isClerkSignedIn && clerkUser) {
      setIsAuthenticated(true);
      setUsername(clerkUser.fullName || clerkUser.firstName || "Founder");
      setAuthMethod("clerk");
      setIsLoading(false);
      return;
    }

    // Fall back to legacy session
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        setIsAuthenticated(false);
        setAuthMethod(null);
        setIsLoading(false);
        return;
      }

      const session: FounderSession = JSON.parse(raw);
      const isValid =
        session.active &&
        session.token &&
        session.loginTime &&
        Date.now() - session.loginTime < 8 * 60 * 60 * 1000;
  
      if (isValid) {
        setIsAuthenticated(true);
        setUsername(session.username);
        setAuthMethod("legacy");
      } else {
        localStorage.removeItem(SESSION_KEY);
        setIsAuthenticated(false);
        setAuthMethod(null);
      }
    } catch {
      setIsAuthenticated(false);
      setAuthMethod(null);
    }
    setIsLoading(false);
  }, [clerkUser, isClerkSignedIn, isClerkLoaded]);

  /** Login via tRPC — token is stored and sent with all subsequent requests */
  const login = useCallback(
    async (user: string, pw: string): Promise<boolean> => {
      setError("");
      try {
        const result = await loginMutation.mutateAsync({
          username: user,
          password: pw,
        });
        if (result.success && result.token) {
          const session: FounderSession = {
            username: result.username || user,
            loginTime: Date.now(),
            active: true,
            token: result.token,
            authMethod: "legacy",
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          setIsAuthenticated(true);
          setUsername(session.username);
          setAuthMethod("legacy");
          utils.invalidate();
          return true;
        } else {
          setError(result.error || "Login failed");
          return false;
        }
      } catch (e: any) {
        setError(e?.message || "Network error. Please try again.");
        return false;
      }
    },
    [loginMutation, utils]
  );

  /** Logout — clears local session and notifies backend */
  const logout = useCallback(async () => {
    // If using Clerk, sign out from Clerk
    if (isClerkConfigured() && authMethod === "clerk") {
      try {
        await clerkSignOut();
      } catch {
        /* ignore Clerk signout errors */
      }
    }

    // Clear legacy session
    try {
      await logoutMutation.mutateAsync();
    } catch {
      /* backend logout can fail silently */
    }
    
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
    setUsername("");
    setError("");
    setAuthMethod(null);
    
    window.location.reload();
  }, [logoutMutation, clerkSignOut, authMethod]);

  /** Change founder password */
  const changePassword = useCallback(
    async (
      currentPw: string,
      newPw: string
    ): Promise<{ success: boolean; error?: string }> => {
      // Can't change password via Clerk through this method
      if (authMethod === "clerk") {
        return {
          success: false,
          error: "Please change your password through Clerk's user settings",
        };
      }

      try {
        const result = await trpc.founderAuth.changePassword
          .useMutation()
          .mutateAsync({
            currentPassword: currentPw,
            newPassword: newPw,
          });
        return result;
      } catch (e: any) {
        return {
          success: false,
          error: e?.message || "Failed to change password",
        };
      }
    },
    [authMethod]
  );

  /** Get Clerk user info if using Clerk auth */
  const getClerkUser = useCallback(() => {
    if (authMethod === "clerk" && clerkUser) {
      return {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress,
        name: clerkUser.fullName || clerkUser.firstName,
        imageUrl: clerkUser.imageUrl,
      };
    }
    return null;
  }, [clerkUser, authMethod]);

  return {
    isAuthenticated,
    isLoading,
    username,
    error,
    authMethod,
    login,
    logout,
    changePassword,
    checkSession,
    getClerkUser,
    isClerkConfigured: isClerkConfigured(),
    isClerkSignedIn,
  };
}
