import { useUser } from "@clerk/clerk-react";
import { useAuth } from "@/react-app/context/AuthContext";

/**
 * Hook that combines Clerk authentication with the app's existing AuthContext.
 * 
 * Use this hook when you want to:
 * - Check if user is signed in via Clerk
 * - Get Clerk user information
 * - Access Clerk session tokens for API authentication
 * 
 * The existing useAuth() hook is still available for app-specific auth logic
 * like station bindings and roles.
 */
export function useClerkAuth() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { user: appUser, token: appToken, logout: appLogout } = useAuth();
  
  // Check if Clerk is configured
  const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  return {
    // Clerk configuration status
    isClerkConfigured,
    
    // Clerk-specific
    clerkUser: user,
    isClerkSignedIn: isSignedIn,
    isClerkLoaded: isLoaded,
    clerkUserId: user?.id,
    clerkEmail: user?.primaryEmailAddress?.emailAddress,
    clerkName: user?.fullName || user?.firstName,
    clerkImageUrl: user?.imageUrl,
    
    // App-specific
    appUser,
    appToken,
    
    // Combined state
    // User is considered authenticated if either Clerk or app auth is active
    isAuthenticated: isSignedIn || !!appUser,
    
    // Display name (prefers Clerk, falls back to app user)
    displayName: user?.fullName || user?.firstName || appUser?.name || "User",
    
    // Email (prefers Clerk, falls back to app user)
    email: user?.primaryEmailAddress?.emailAddress || appUser?.email || "",
    
    // Profile image
    imageUrl: user?.imageUrl || appUser?.picture || "",
    
    // Helper to get Clerk session token for API calls
    getClerkToken: async () => {
      if (!isSignedIn) return null;
      return user?.getSessionToken();
    },
    
    // Helper to get auth token (Clerk token when signed in, otherwise app token)
    getAuthToken: async () => {
      if (isSignedIn) {
        return user?.getSessionToken();
      }
      return appToken;
    },
    
    // Sign out from Clerk
    clerkSignOut: async () => {
      if (isSignedIn) {
        const { signOut } = await import("@clerk/clerk-react");
        await signOut();
      }
    },
    
    // Sign out from app (legacy)
    appSignOut: appLogout,
    
    // Combined sign out (clears both Clerk and app auth)
    signOut: async () => {
      if (isSignedIn) {
        const { signOut } = await import("@clerk/clerk-react");
        await signOut();
      }
      appLogout();
    },
  };
}
