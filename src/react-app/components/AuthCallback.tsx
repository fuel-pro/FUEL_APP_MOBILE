import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

/**
 * Legacy auth callback handler - redirects to home.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "error">("processing");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");

    if (error) {
      setStatus("error");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    // Redirect to home
    setTimeout(() => {
      navigate("/");
    }, 1000);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 max-w-md w-full text-center">
        {status === "processing" ? (
          <>
            <Loader2
              size={48}
              className="animate-spin mx-auto mb-4 text-blue-400"
            />
            <h2 className="text-xl font-semibold text-white mb-2">
              Redirecting...
            </h2>
          </>
        ) : (
          <>
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Authentication Error
            </h2>
          </>
        )}
      </div>
    </div>
  );
}
