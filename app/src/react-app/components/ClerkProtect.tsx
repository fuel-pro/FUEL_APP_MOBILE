import { ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import ClerkSignIn from "./ClerkSignIn";

interface ClerkProtectProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectUrl?: string;
}

/**
 * ClerkProtect - Protected route wrapper
 * 
 * Shows children only when user is signed in via Clerk.
 * Shows ClerkSignIn when not signed in.
 * Shows fallback or nothing while loading.
 * 
 * Usage:
 * ```tsx
 * <ClerkProtect fallback={<Loading />}>
 *   <Dashboard />
 * </ClerkProtect>
 * ```
 */
export function ClerkProtect({ 
  children, 
  fallback = null,
  redirectUrl = "/#/sign-in" 
}: ClerkProtectProps) {
  const { isSignedIn, isLoaded } = useUser();

  // Still loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20 text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-amber-400 mx-auto mb-4" />
          <p className="text-gray-300 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not signed in - show sign in or fallback
  if (!isSignedIn) {
    return (
      <>
        {fallback}
        <ClerkSignIn />
      </>
    );
  }

  // Signed in - show protected content
  return <>{children}</>;
}

/**
 * ClerkShow - Conditional rendering based on auth state
 */
interface ClerkShowProps {
  when: "signed-in" | "signed-out";
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClerkShow({ when, children, fallback = null }: ClerkShowProps) {
  const { isSignedIn, isLoaded } = useUser();

  // Still loading
  if (!isLoaded) {
    return null;
  }

  if (when === "signed-in") {
    return isSignedIn ? <>{children}</> : <>{fallback}</>;
  }

  if (when === "signed-out") {
    return !isSignedIn ? <>{children}</> : <>{fallback}</>;
  }

  return <>{fallback}</>;
}

/**
 * ClerkLoading - Shows content while Clerk is loading
 */
interface ClerkLoadingProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClerkLoading({ children, fallback = null }: ClerkLoadingProps) {
  const { isLoaded } = useUser();
  return isLoaded ? <>{children}</> : <>{fallback}</>;
}
