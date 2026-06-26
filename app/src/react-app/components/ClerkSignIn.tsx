import { SignIn } from "@clerk/clerk-react";
import AuthLogin from "@/react-app/components/AuthLogin";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * ClerkSignIn - Full Clerk-powered sign-in component
 * Falls back to local AuthLogin if Clerk is not configured (demo mode).
 */
export default function ClerkSignIn() {
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
