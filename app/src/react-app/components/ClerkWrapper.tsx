import { ClerkProvider } from "@clerk/clerk-react";
import { ReactNode } from "react";

// Get the publishable key from environment variables
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Router type: hash for React Router v7 (HashRouter), path for browser router
const routerType = "hash";

interface ClerkWrapperProps {
  children: ReactNode;
}

export default function ClerkWrapper({ children }: ClerkWrapperProps) {
  return (
    <ClerkProvider 
      publishableKey={publishableKey || ""}
      routerType={routerType}
      afterSignInUrl="/#/dashboard"
      afterSignUpUrl="/#/welcome"
      afterSignOutUrl="/#/sign-in"
      signInFallbackRedirectUrl="/#/dashboard"
      signUpFallbackRedirectUrl="/#/welcome"
    >
      {children}
    </ClerkProvider>
  );
}
