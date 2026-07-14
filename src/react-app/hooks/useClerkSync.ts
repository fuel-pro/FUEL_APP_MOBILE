/**
 * useClerkSync - Simplified Clerk Authentication Integration
 * 
 * Provides seamless integration between Clerk and the app's
 * existing authentication system with correct Clerk React SDK APIs.
 */

import { useEffect, useCallback, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuth } from "@clerk/clerk-react";

// Check if Clerk is configured
export const isClerkConfigured = () => {
  return !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
};

export interface ClerkSyncState {
  isClerkConfigured: boolean;
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string | null;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  authMethod: "clerk" | "legacy" | "none";
}

export function useClerkSync(): ClerkSyncState {
  const { user, isLoaded, isSignedIn } = useUser();
  const [clerkConfigured, setClerkConfigured] = useState(isClerkConfigured());

  // Re-check configuration periodically
  useEffect(() => {
    setClerkConfigured(isClerkConfigured());
  }, []);

  // Sync Clerk user to localStorage
  useEffect(() => {
    if (!clerkConfigured) return;

    if (isSignedIn && user) {
      localStorage.setItem("clerk_user_id", user.id);
      localStorage.setItem("clerk_email", user.primaryEmailAddress?.emailAddress || "");
      localStorage.setItem("clerk_name", user.fullName || user.firstName || "");
    } else if (!isSignedIn) {
      localStorage.removeItem("clerk_user_id");
      localStorage.removeItem("clerk_email");
      localStorage.removeItem("clerk_name");
    }
  }, [clerkConfigured, isSignedIn, user]);

  return {
    isClerkConfigured: clerkConfigured,
    isSignedIn: clerkConfigured ? isSignedIn : false,
    isLoaded: clerkConfigured ? isLoaded : true,
    userId: clerkConfigured && isSignedIn ? user?.id || null : null,
    email: clerkConfigured && isSignedIn 
      ? user?.primaryEmailAddress?.emailAddress || null : null,
    name: clerkConfigured && isSignedIn
      ? user?.fullName || user?.firstName || null : null,
    imageUrl: clerkConfigured && isSignedIn
      ? user?.imageUrl || null : null,
    authMethod: clerkConfigured && isSignedIn ? "clerk" : "legacy",
  };
}
