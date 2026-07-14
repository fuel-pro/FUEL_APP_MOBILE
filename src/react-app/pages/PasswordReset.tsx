import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  KeyRound,
  ArrowLeft,
  Mail,
  Lock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

export default function PasswordReset() {
  const navigate = useNavigate();
  const {
    requestPasswordReset,
    verifyResetCode,
    resetPassword,
    isPending,
    error,
    clearError,
  } = useAuth();
  const [step, setStep] = useState<"email" | "code" | "newpass" | "success">(
    "email"
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRequestCode = async () => {
    clearError();
    setLocalError("");
    if (!email.trim() || !email.includes("@")) {
      setLocalError("Please enter a valid email address");
      return;
    }
    const result = await requestPasswordReset(email.trim().toLowerCase());
    if (result.success) {
      setGeneratedCode(result.code || "");
      setStep("code");
    }
  };

  const handleVerifyCode = () => {
    clearError();
    setLocalError("");
    if (code.length !== 6) {
      setLocalError("Enter the 6-digit code");
      return;
    }
    const valid = verifyResetCode(email, code);
    if (valid) setStep("newpass");
  };

  const handleResetPassword = async () => {
    clearError();
    setLocalError("");
    if (newPassword.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }
    const success = await resetPassword(email, newPassword);
    if (success) {
      setSuccessMsg(
        "Password reset successfully! You can now sign in with your new password."
      );
      setStep("success");
    }
  };

  const handleResendCode = async () => {
    clearError();
    setLocalError("");
    const result = await requestPasswordReset(email);
    if (result.success) setGeneratedCode(result.code || "");
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate("/login")}
          className="mb-6 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Sign In
        </button>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
              <KeyRound size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white font-serif">
              {step === "email" && "Reset Password"}
              {step === "code" && "Verify Code"}
              {step === "newpass" && "New Password"}
              {step === "success" && "All Set!"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {step === "email" && "Enter your email to receive a reset code"}
              {step === "code" && `We sent a 6-digit code to ${email}`}
              {step === "newpass" && "Create a strong new password"}
              {step === "success" && successMsg}
            </p>
          </div>

          {/* Error */}
          {displayError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              {displayError}
            </div>
          )}

          {/* Step 1: Email */}
          {step === "email" && (
            <>
              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      clearError();
                      setLocalError("");
                    }}
                    onKeyDown={e => e.key === "Enter" && handleRequestCode()}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                  />
                </div>
              </div>
              <button
                onClick={handleRequestCode}
                disabled={isPending}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} /> Send Reset Code
                  </>
                )}
              </button>
            </>
          )}

          {/* Step 2: Code Verification */}
          {step === "code" && (
            <>
              {generatedCode && (
                <div className="mb-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <p className="text-[10px] text-blue-400 mb-1">
                    Your reset code (sent to email):
                  </p>
                  <code className="text-lg font-bold text-white font-mono tracking-widest">
                    {generatedCode}
                  </code>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  6-Digit Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={e => e.key === "Enter" && handleVerifyCode()}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all font-mono tracking-widest text-center"
                  autoFocus
                />
              </div>
              <button
                onClick={handleVerifyCode}
                disabled={code.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:shadow-none flex items-center justify-center gap-2 mb-3"
              >
                <ShieldCheck size={16} /> Verify Code
              </button>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep("email")}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Change email
                </button>
                <button
                  onClick={handleResendCode}
                  disabled={isPending}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {isPending ? "Sending..." : "Resend code"}
                </button>
              </div>
            </>
          )}

          {/* Step 3: New Password */}
          {step === "newpass" && (
            <>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type={showPw ? "text" : "password"}
                      value={newPassword}
                      onChange={e => {
                        setNewPassword(e.target.value);
                        setLocalError("");
                        clearError();
                      }}
                      onKeyDown={e =>
                        e.key === "Enter" && handleResetPassword()
                      }
                      placeholder="Min 6 characters"
                      className="w-full pl-10 pr-12 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value);
                        setLocalError("");
                        clearError();
                      }}
                      onKeyDown={e =>
                        e.key === "Enter" && handleResetPassword()
                      }
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-12 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={handleResetPassword}
                disabled={isPending}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />{" "}
                    Resetting...
                  </>
                ) : (
                  <>
                    <KeyRound size={16} /> Reset Password
                  </>
                )}
              </button>
            </>
          )}

          {/* Step 4: Success */}
          {step === "success" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <p className="text-sm text-emerald-400 mb-6">{successMsg}</p>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} /> Go to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
