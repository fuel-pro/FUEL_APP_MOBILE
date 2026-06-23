import { SignUp } from "@clerk/clerk-react";

/**
 * ClerkSignUp - Full Clerk-powered sign-up component
 * 
 * Uses Clerk's prebuilt SignUp component with hash routing
 * for React Router v7 HashRouter compatibility.
 */
export default function ClerkSignUp() {
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
