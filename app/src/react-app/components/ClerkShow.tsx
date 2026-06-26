import { ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuth } from "@/react-app/context/AuthContext";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

interface ClerkShowProps {
  when: "signed-in" | "signed-out";
  children: ReactNode;
  fallback?: ReactNode;
}

export default function ClerkShow({ when, children, fallback = null }: ClerkShowProps) {
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
