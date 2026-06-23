import { ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";

interface ClerkShowProps {
  when: "signed-in" | "signed-out";
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * ClerkShow - Conditional rendering based on Clerk authentication state
 * 
 * Usage:
 * ```tsx
 * <ClerkShow when="signed-in">
 *   <Dashboard />
 * </ClerkShow>
 * 
 * <ClerkShow when="signed-out" fallback={<Loading />}>
 *   <LoginForm />
 * </ClerkShow>
 * ```
 */
export default function ClerkShow({ when, children, fallback = null }: ClerkShowProps) {
  const { isSignedIn, isLoaded } = useUser();

  // Show nothing while loading
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
