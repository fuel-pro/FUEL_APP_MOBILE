import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";

/**
 * ClerkBridge synchronizes Clerk authentication state with localStorage.
 * This allows the app to read Clerk auth state from non-Clerk contexts.
 */
export default function ClerkBridge() {
  const { user, isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user) {
      localStorage.setItem("clerk_user_id", user.id);
      localStorage.setItem("clerk_email", user.primaryEmailAddress?.emailAddress || "");
      localStorage.setItem("clerk_name", user.fullName || user.firstName || "");
    } else if (!isSignedIn) {
      localStorage.removeItem("clerk_user_id");
      localStorage.removeItem("clerk_email");
      localStorage.removeItem("clerk_name");
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}
