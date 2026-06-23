import { ClerkProvider } from "@clerk/clerk-react";
import { ReactNode } from "react";

// Get the publishable key from environment variables
// For Clerk, this is typically VITE_CLERK_PUBLISHABLE_KEY
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  console.warn(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Clerk authentication will not work."
  );
}

interface ClerkWrapperProps {
  children: ReactNode;
}

export default function ClerkWrapper({ children }: ClerkWrapperProps) {
  return (
    <ClerkProvider 
      publishableKey={publishableKey || ""}
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
