import { SignIn } from "@clerk/clerk-react";

interface ClerkSignInProps {
  onSuccess?: () => void;
  onSignUpClick?: () => void;
}

export default function ClerkSignIn({ onSuccess, onSignUpClick }: ClerkSignInProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <SignIn 
        routing="hash"
        afterSignInUrl={onSuccess ? window.location.href : undefined}
        signUpUrl={onSignUpClick ? "#/sign-up" : undefined}
      />
      {onSignUpClick && (
        <p className="text-center mt-4 text-sm text-gray-400">
          Don't have an account?{" "}
          <button
            onClick={onSignUpClick}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Sign up
          </button>
        </p>
      )}
    </div>
  );
}
