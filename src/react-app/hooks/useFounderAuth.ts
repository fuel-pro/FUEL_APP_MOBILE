/**
 * useFounderAuth - React hook for Founder Access authentication.
 * Uses localStorage-based founder session for admin access.
 * Clerk is no longer used - Firebase Auth is the primary auth method.
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/providers/trpc";

const SESSION_KEY = "fuelpro_founder_session";

// Clerk is deprecated - always return false
const isClerkConfigured = () => false;

interface FounderSession {
  username: string;
  loginTime: number;
  active: boolean;
  token: string;
  authMethod?: "legacy";
}

export function useFounderAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState<"legacy" | null>(null);

  // Legacy clerk user stubs (no longer used)
  const clerkUser = null;
  const isClerkSignedIn = false;
  const signOut = async () => {};

  const loginMutation = trpc.founderAuth.login.useMutation();
  const logoutMutation = trpc.founderAuth.logout.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => { checkSession(); }, []);

  const checkSession = useCallback(() => {
    // Legacy session check only
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) { setIsAuthenticated(false); setAuthMethod(null); setIsLoading(false); return; }
      const session: FounderSession = JSON.parse(raw);
      const isValid = session.active && session.token && session.loginTime && 
                      Date.now() - session.loginTime < 8 * 60 * 60 * 1000;
      if (isValid) {
        setIsAuthenticated(true); setUsername(session.username); setAuthMethod("legacy");
      } else {
        localStorage.removeItem(SESSION_KEY); setIsAuthenticated(false); setAuthMethod(null);
      }
    } catch { setIsAuthenticated(false); setAuthMethod(null); }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (user: string, pw: string): Promise<boolean> => {
    setError("");
    try {
      const result = await loginMutation.mutateAsync({ username: user, password: pw });
      if (result.success && result.token) {
        const session: FounderSession = { username: result.username || user, loginTime: Date.now(), active: true, token: result.token, authMethod: "legacy" };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setIsAuthenticated(true); setUsername(session.username); setAuthMethod("legacy"); utils.invalidate();
        return true;
      } else { setError(result.error || "Login failed"); return false; }
    } catch (e: any) { setError(e?.message || "Network error"); return false; }
  }, [loginMutation, utils]);

  const logout = useCallback(async () => {
    try { await logoutMutation.mutateAsync(); } catch {}
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false); setUsername(""); setError(""); setAuthMethod(null);
    window.location.reload();
  }, [logoutMutation]);

  const changePassword = useCallback(async (currentPw: string, newPw: string): Promise<{ success: boolean; error?: string }> => {
    try { return await trpc.founderAuth.changePassword.useMutation().mutateAsync({ currentPassword: currentPw, newPassword: newPw }); }
    catch (e: any) { return { success: false, error: e?.message || "Failed" }; }
  }, []);

  const getClerkUser = useCallback(() => {
    return null;
  }, []);

  return { isAuthenticated, isLoading, username, error, authMethod, login, logout, changePassword, checkSession, getClerkUser, isClerkConfigured: isClerkConfigured(), isClerkSignedIn };
}
