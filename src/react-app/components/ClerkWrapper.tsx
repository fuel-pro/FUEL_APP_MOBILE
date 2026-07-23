import { ClerkProvider } from "@clerk/clerk-react";
import { ReactNode, useMemo } from "react";

// Get publishable key from multiple sources - called at render time
function getPublishableKey(): string {
  // Check environment variable first
  const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (envKey) return envKey;
  
  // Check window object
  const windowKey = (window as any).__CLERK_PUBLISHABLE_KEY__;
  if (windowKey) return windowKey;
  
  // Check meta tag (document might not be ready at module load)
  if (typeof document !== 'undefined') {
    const metaKey = document.querySelector('meta[name="clerk-publishable-key"]')?.getAttribute('content');
    if (metaKey) return metaKey;
  }
  
  return "";
}

// Get frontend API from multiple sources
function getClerkFrontendApi(): string {
  const envKey = import.meta.env.VITE_CLERK_FRONTEND_API;
  if (envKey) return envKey;
  
  const windowKey = (window as any).__CLERK_FRONTEND_API__;
  if (windowKey) return windowKey;
  
  if (typeof document !== 'undefined') {
    const metaKey = document.querySelector('meta[name="clerk-frontend-api"]')?.getAttribute('content');
    if (metaKey) return metaKey;
  }
  
  return "clerk.fuelpro.com";
}

interface ClerkWrapperProps {
  children: ReactNode;
}

export default function ClerkWrapper({ children }: ClerkWrapperProps) {
  // Get keys at render time when DOM is available
  const publishableKey = useMemo(() => getPublishableKey(), []);
  const clerkFrontendApi = useMemo(() => getClerkFrontendApi(), []);
  const isClerkConfigured = !!publishableKey;

  // Skip ClerkProvider if not configured
  if (!isClerkConfigured) {
    return <>{children}</>;
  }
  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      routerDebug={true}
      afterSignInUrl="/#/dashboard"
      afterSignUpUrl="/#/welcome"
      afterSignOutUrl="/#/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
