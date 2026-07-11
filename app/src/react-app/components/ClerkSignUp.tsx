import { SignUp } from "@clerk/clerk-react";
import AuthLogin from "@/react-app/components/AuthLogin";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * ClerkSignUp - Full Clerk-powered sign-up component
 * Falls back to local AuthLogin if Clerk is not configured.
 */
export default function ClerkSignUp() {
  if (!publishableKey) {
    return <AuthLogin />;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SignUp 
          routing="hash"
          fallbackRedirectUrl="/#/welcome"
          signInUrl="/#/sign-in"
        />
      </div>
    </div>
  );
}
