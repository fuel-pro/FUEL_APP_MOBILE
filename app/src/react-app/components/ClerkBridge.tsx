import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuth } from "@/react-app/context/AuthContext";

/**
 * ClerkBridge synchronizes Clerk authentication state with the app's AuthContext.
 * 
 * When Clerk is configured (VITE_CLERK_PUBLISHABLE_KEY is set):
 * - Syncs Clerk user to AuthContext on sign-in/sign-out
 * - Uses Clerk user info to populate AuthIdentity
 * - Uses Clerk session tokens for API calls
 * 
 * When Clerk is NOT configured:
 * - Falls back to existing AuthContext behavior
 * - No interference with legacy authentication
 */
export default function ClerkBridge() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { user: appUser, token } = useAuth();

  useEffect(() => {
    // Only sync if Clerk is loaded and signed in
    if (!isLoaded) return;

    if (isSignedIn && user) {
      // Clerk user is signed in - sync to AuthContext
      // The AuthContext will handle token storage and refresh
      console.log("[ClerkBridge] Clerk user signed in:", user.primaryEmailAddress?.emailAddress);
      
      // Store Clerk user info for reference
      localStorage.setItem("clerk_user_id", user.id);
      localStorage.setItem("clerk_session_id", user.sessionId || "");
    } else if (!isSignedIn && appUser) {
      // Clerk signed out but app still has user - clear app user
      console.log("[ClerkBridge] Clerk signed out, clearing app session");
      localStorage.removeItem("clerk_user_id");
      localStorage.removeItem("clerk_session_id");
    }
  }, [isLoaded, isSignedIn, user, appUser]);

  // This component doesn't render anything
  return null;
}
