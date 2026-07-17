import { SignIn } from "@clerk/clerk-react";
import AuthLogin from "@/react-app/components/AuthLogin";
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

/**
 * ClerkSignIn - Full Clerk-powered sign-in component
 * Falls back to local AuthLogin if Clerk is not configured.
 */
export default function ClerkSignIn() {
  const publishableKey = useMemo(() => getPublishableKey(), []);
  const clerkFrontendApi = useMemo(() => getClerkFrontendApi(), []);
  
  if (!publishableKey) {
    return <AuthLogin />;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SignIn 
          routing="hash"
          fallbackRedirectUrl="/#/dashboard"
          signUpUrl="/#/sign-up"
        />
      </div>
    </div>
  );
}
