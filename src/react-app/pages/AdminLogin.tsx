/**
 * FuelPro Admin Login Page
 * Secure authentication with MFA support
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAdminAuth, PERMISSIONS } from "../lib/adminAuth";
import { AuditLogger } from "../lib/auditLogger";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAdminAuth();
  const auditLogger = AuditLogger.getInstance();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [localError, setLocalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setIsSubmitting(true);

    try {
      if (!email || !password) {
        setLocalError("Please enter email and password");
        return;
      }

      if (requiresMFA && !mfaCode) {
        setLocalError("Please enter MFA code");
        return;
      }

      await login({
        email,
        password,
        mfaCode: requiresMFA ? mfaCode : undefined,
      });

      // Log successful login
      auditLogger.log({
        action: "LOGIN",
        userId: email,
        details: { email, role: "admin" },
      } as any);

      navigate("/admin/dashboard");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Login failed";
      setLocalError(errorMessage);

      // If MFA required, continue to MFA step
      if (errorMessage.includes("MFA")) {
        setRequiresMFA(true);
      }

      // Log failed login
      auditLogger.log({
        action: "LOGIN_FAILED",
        userId: email,
        details: { email, error: errorMessage },
      } as any);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px)`,
            backgroundSize: "30px 30px",
          }}
        />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Shield size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">FuelPro Admin</h1>
            <p className="text-amber-100 text-sm mt-1">
              Sign in to access admin panel
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Error Message */}
            {(localError || error) && (
              <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
                <AlertCircle size={18} />
                <span className="text-sm">{localError || error}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@fuelpro.app"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* MFA Field (conditional) */}
            {requiresMFA && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  MFA Code
                </label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={e =>
                    setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-center text-2xl tracking-widest focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  maxLength={6}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Enter the code from your authenticator app
                </p>
              </div>
            )}

            {/* Forgot Password */}
            <div className="text-right">
              <a
                href="#/admin/forgot-password"
                className="text-sm text-amber-600 hover:text-amber-700"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  {requiresMFA ? "Verify" : "Sign In"}
                </>
              )}
            </button>

            {/* Security Notice */}
            <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
              <Lock size={12} />
              <span>Secured with 256-bit encryption</span>
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 text-center">
            <p className="text-sm text-gray-500">
              Not an admin?{" "}
              <a
                href="/#/login"
                className="text-amber-600 hover:text-amber-700 font-medium"
              >
                Return to login
              </a>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to our{" "}
            <a href="#/terms" className="text-gray-400 hover:text-white">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#/privacy" className="text-gray-400 hover:text-white">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
