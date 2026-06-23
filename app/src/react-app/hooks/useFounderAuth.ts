/**
 * useFounderAuth - React hook for Founder Access authentication.
 * Supports Clerk Authentication (when configured) and legacy founder auth.
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { useUser, useClerk } from "@clerk/clerk-react";

const SESSION_KEY = "fuelpro_founder_session";

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

  const { user: clerkUser, isSignedIn: isClerkSignedIn } = useUser();
  const { signOut } = useClerk();

  const loginMutation = trpc.founderAuth.login.useMutation();
  const logoutMutation = trpc.founderAuth.logout.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => { checkSession(); }, []);

  const checkSession = useCallback(() => {
    if (isClerkConfigured() && isClerkSignedIn && clerkUser) {
      setIsAuthenticated(true);
      setUsername(clerkUser.fullName || clerkUser.firstName || "Founder");
      setAuthMethod("clerk");
      setIsLoading(false);
      return;
    }

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
  }, [clerkUser, isClerkSignedIn]);

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
    if (isClerkConfigured() && authMethod === "clerk") { try { await signOut(); } catch {} }
    try { await logoutMutation.mutateAsync(); } catch {}
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false); setUsername(""); setError(""); setAuthMethod(null);
    window.location.reload();
  }, [logoutMutation, signOut, authMethod]);

  const changePassword = useCallback(async (currentPw: string, newPw: string): Promise<{ success: boolean; error?: string }> => {
    if (authMethod === "clerk") return { success: false, error: "Use Clerk settings" };
    try { return await trpc.founderAuth.changePassword.useMutation().mutateAsync({ currentPassword: currentPw, newPassword: newPw }); }
    catch (e: any) { return { success: false, error: e?.message || "Failed" }; }
  }, [authMethod]);

  const getClerkUser = useCallback(() => {
    if (authMethod === "clerk" && clerkUser) {
      return { id: clerkUser.id, email: clerkUser.primaryEmailAddress?.emailAddress, name: clerkUser.fullName || clerkUser.firstName, imageUrl: clerkUser.imageUrl };
    }
    return null;
  }, [clerkUser, authMethod]);

  return { isAuthenticated, isLoading, username, error, authMethod, login, logout, changePassword, checkSession, getClerkUser, isClerkConfigured: isClerkConfigured(), isClerkSignedIn };
}
