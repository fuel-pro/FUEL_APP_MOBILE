import { SignUp } from "@clerk/clerk-react";

interface ClerkSignUpProps {
  onSuccess?: () => void;
  onSignInClick?: () => void;
}

export default function ClerkSignUp({ onSuccess, onSignInClick }: ClerkSignUpProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <SignUp 
        routing="hash"
        afterSignUpUrl={onSuccess ? window.location.href : undefined}
        signInUrl={onSignInClick ? "#/sign-in" : undefined}
      />
      {onSignInClick && (
        <p className="text-center mt-4 text-sm text-gray-400">
          Already have an account?{" "}
          <button
            onClick={onSignInClick}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Sign in
          </button>
        </p>
      )}
    </div>
  );
}
