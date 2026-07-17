import { ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuth } from "@/react-app/context/AuthContext";
import { useMemo } from "react";

// Get publishable key from multiple sources
function getPublishableKey(): string {
  const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (envKey) return envKey;
  
  const windowKey = (window as any).__CLERK_PUBLISHABLE_KEY__;
  if (windowKey) return windowKey;
  
  if (typeof document !== 'undefined') {
    const metaKey = document.querySelector('meta[name="clerk-publishable-key"]')?.getAttribute('content');
    if (metaKey) return metaKey;
  }
  
  return "";
}

interface ClerkShowProps {
  when: "signed-in" | "signed-out";
  children: ReactNode;
  fallback?: ReactNode;
}

export default function ClerkShow({ when, children, fallback = null }: ClerkShowProps) {
  const publishableKey = useMemo(() => getPublishableKey(), []);
  
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
