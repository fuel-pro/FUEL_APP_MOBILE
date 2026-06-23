import { SignIn } from "@clerk/clerk-react";

/**
 * ClerkSignIn - Full Clerk-powered sign-in component
 * 
 * Uses Clerk's prebuilt SignIn component with hash routing
 * for React Router v7 HashRouter compatibility.
 */
export default function ClerkSignIn() {
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
