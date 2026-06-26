import { ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuth } from "@/react-app/context/AuthContext";
import ClerkSignIn from "./ClerkSignIn";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

interface ClerkProtectProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectUrl?: string;
}

export function ClerkProtect({ children, fallback = null }: ClerkProtectProps) {
  if (!publishableKey) {
    const { user } = useAuth();
    if (!user) return <>{fallback || <ClerkSignIn />}</>;
    return <>{children}</>;
  }
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return <div className="animate-spin">Loading...</div>;
  if (!isSignedIn) return <>{fallback || <ClerkSignIn />}</>;
  return <>{children}</>;
}

interface ClerkShowProps {
  when: "signed-in" | "signed-out";
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClerkShow({ when, children, fallback = null }: ClerkShowProps) {
  if (!publishableKey) {
    const { user } = useAuth();
    const isSignedIn = !!user;
    if (when === "signed-in") return isSignedIn ? <>{children}</> : <>{fallback}</>;
    if (when === "signed-out") return !isSignedIn ? <>{children}</> : <>{fallback}</>;
    return <>{fallback}</>;
  }
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (when === "signed-in") return isSignedIn ? <>{children}</> : <>{fallback}</>;
  if (when === "signed-out") return !isSignedIn ? <>{children}</> : <>{fallback}</>;
  return <>{fallback}</>;
}

interface ClerkLoadingProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClerkLoading({ children, fallback = null }: ClerkLoadingProps) {
  if (!publishableKey) return <>{children}</>;
  const { isLoaded } = useUser();
  return isLoaded ? <>{children}</> : <>{fallback}</>;
}
