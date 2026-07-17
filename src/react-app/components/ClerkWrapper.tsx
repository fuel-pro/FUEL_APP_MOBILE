import { ClerkProvider } from "@clerk/clerk-react";
import { ReactNode } from "react";

// Get publishable key from multiple sources
function getPublishableKey(): string {
  const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (envKey) return envKey;
  
  // Try window object (for runtime injection)
  const windowKey = (window as any).__CLERK_PUBLISHABLE_KEY__;
  if (windowKey) return windowKey;
  
  // Try meta tag
  const metaKey = document.querySelector('meta[name="clerk-publishable-key"]')?.getAttribute('content');
  if (metaKey) return metaKey;
  
  return "";
}

// Get frontend API from multiple sources
function getClerkFrontendApi(): string {
  const envKey = import.meta.env.VITE_CLERK_FRONTEND_API;
  if (envKey) return envKey;
  
  // Try window object
  const windowKey = (window as any).__CLERK_FRONTEND_API__;
  if (windowKey) return windowKey;
  
  // Try meta tag
  const metaKey = document.querySelector('meta[name="clerk-frontend-api"]')?.getAttribute('content');
  if (metaKey) return metaKey;
  
  return "clerk.fuelpro.com";
}

const publishableKey = getPublishableKey();
const clerkFrontendApi = getClerkFrontendApi();
const isClerkConfigured = !!publishableKey;

interface ClerkWrapperProps {
  children: ReactNode;
}

export default function ClerkWrapper({ children }: ClerkWrapperProps) {
  // Skip ClerkProvider if not configured
  if (!isClerkConfigured) {
    return <>{children}</>;
  }
  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      frontendApi={clerkFrontendApi}
      afterSignInUrl="/#/dashboard"
      afterSignUpUrl="/#/welcome"
      afterSignOutUrl="/#/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
