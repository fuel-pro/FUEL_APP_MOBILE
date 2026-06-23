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

  return {
    // Clerk-specific
    clerkUser: user,
    isClerkSignedIn: isSignedIn,
    isClerkLoaded: isLoaded,
    
    // App-specific
    appUser,
    appToken,
    
    // Combined state
    // User is considered authenticated if either Clerk or app auth is active
    isAuthenticated: isSignedIn || !!appUser,
    
    // Helper to get Clerk session token for API calls
    getClerkToken: async () => {
      if (!isSignedIn) return null;
      // Clerk SDK handles token refresh automatically
      // The user() hook returns the session token via useUser
      return user?.getSessionToken();
    },
    
    // Sign out from Clerk
    clerkSignOut: async () => {
      if (isSignedIn) {
        // Import clerk/clerk-react dynamically to avoid circular deps
        const { signOut } = await import("@clerk/clerk-react");
        await signOut();
      }
    },
    
    // App logout (clears local auth)
    appSignOut: appLogout,
  };
}
