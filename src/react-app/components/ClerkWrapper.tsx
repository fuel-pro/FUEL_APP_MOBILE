import { ClerkProvider } from "@clerk/clerk-react";
import { ReactNode } from "react";

// Get the publishable key from environment variables
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
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
      afterSignInUrl="/#/dashboard"
      afterSignUpUrl="/#/welcome"
      afterSignOutUrl="/#/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
