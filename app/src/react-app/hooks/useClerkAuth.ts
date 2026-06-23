import { useUser, useClerk } from "@clerk/clerk-react";
import { useAuth } from "@/react-app/context/AuthContext";

export function useClerkAuth() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { user: appUser, token: appToken, logout: appLogout } = useAuth();
  
  const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  return {
    isClerkConfigured,
    clerkUser: user,
    isClerkSignedIn: isSignedIn,
    isClerkLoaded: isLoaded,
    clerkUserId: user?.id,
    clerkEmail: user?.primaryEmailAddress?.emailAddress,
    clerkName: user?.fullName || user?.firstName,
    clerkImageUrl: user?.imageUrl,
    appUser,
    appToken,
    isAuthenticated: isSignedIn || !!appUser,
    displayName: user?.fullName || user?.firstName || appUser?.name || "User",
    email: user?.primaryEmailAddress?.emailAddress || appUser?.email || "",
    imageUrl: user?.imageUrl || appUser?.picture || "",
    getClerkToken: async () => isSignedIn ? appToken : null,
    getAuthToken: async () => isSignedIn ? appToken : appToken,
    clerkSignOut: async () => { try { await signOut(); } catch {} },
    appSignOut: appLogout,
    signOut: async () => { try { await signOut(); } catch {} appLogout(); },
  };
}
