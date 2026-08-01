import { useAuth } from "@/react-app/context/AuthContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ShieldCheck,
  Lock,
  Zap,
  Cloud,
  Server,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  LogIn,
  Fuel,
  User,
} from "lucide-react";
import { useInputStability, useClickGuard } from "@/react-app/hooks/useInputStability";

type LoginMode = "email" | "username" | "register";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Load persisted email from localStorage
function loadPersistedEmail(): string {
  try {
    return localStorage.getItem("fuelpro_login_email") || "";
  } catch {
    return "";
  }
}

export default function AuthLogin() {
  const navigate = useNavigate();
  const {
    loginWithEmail,
    registerWithEmail,
    loginWithUsername,
    user,
    isPending,
    error,
    clearError,
  } = useAuth();

  const [mode, setMode] = useState<LoginMode>("email");
  
  // Use stable input hooks to prevent clearing
  const emailState = useInputStability(loadPersistedEmail());
  const passwordState = useInputStability("");
  const usernameState = useInputStability("");
  const regNameState = useInputStability("");
  const regEmailState = useInputStability("");
  const regPasswordState = useInputStability("");
  const regConfirmState = useInputStability("");
  const companyNameState = useInputStability("");
  const companyPhoneState = useInputStability("");
  const companyAddressState = useInputStability("");
  const companyRegNoState = useInputStability("");
  const taxIdState = useInputStability("");
  
  const [companyIndustry, setCompanyIndustry] = useState("fuel_retail");
  const [showCompanyFields, setShowCompanyFields] = useState(false);
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Use click guard to prevent rapid clicking
  const { withClickGuard } = useClickGuard({ minClickInterval: 300 });
  
  // Refs to track values for form submission
  const emailRef = useRef(emailState.value);
  const passwordRef = useRef(passwordState.value);
  const usernameRef = useRef(usernameState.value);
  const regNameRef = useRef(regNameState.value);
  const regEmailRef = useRef(regEmailState.value);
  const regPasswordRef = useRef(regPasswordState.value);
  const regConfirmRef = useRef(regConfirmState.value);
  const companyNameRef = useRef(companyNameState.value);
  const companyPhoneRef = useRef(companyPhoneState.value);
  const companyAddressRef = useRef(companyAddressState.value);
  const companyRegNoRef = useRef(companyRegNoState.value);
  const taxIdRef = useRef(taxIdState.value);

  // Sync refs with stable state values
  useEffect(() => { emailRef.current = emailState.value; }, [emailState.value]);
  useEffect(() => { passwordRef.current = passwordState.value; }, [passwordState.value]);
  useEffect(() => { usernameRef.current = usernameState.value; }, [usernameState.value]);
  useEffect(() => { regNameRef.current = regNameState.value; }, [regNameState.value]);
  useEffect(() => { regEmailRef.current = regEmailState.value; }, [regEmailState.value]);
  useEffect(() => { regPasswordRef.current = regPasswordState.value; }, [regPasswordState.value]);
  useEffect(() => { regConfirmRef.current = regConfirmState.value; }, [regConfirmState.value]);
  useEffect(() => { companyNameRef.current = companyNameState.value; }, [companyNameState.value]);
  useEffect(() => { companyPhoneRef.current = companyPhoneState.value; }, [companyPhoneState.value]);
  useEffect(() => { companyAddressRef.current = companyAddressState.value; }, [companyAddressState.value]);
  useEffect(() => { companyRegNoRef.current = companyRegNoState.value; }, [companyRegNoState.value]);
  useEffect(() => { taxIdRef.current = taxIdState.value; }, [taxIdState.value]);

  // Persist email to localStorage (for convenience)
  const handleEmailChange = useCallback((value: string) => {
    emailState.setValue(value);
    try {
      localStorage.setItem("fuelpro_login_email", value);
    } catch {}
  }, [emailState]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  // Clear errors when switching modes (but preserve form values)
  useEffect(() => {
    setLocalError("");
    setSuccess("");
    clearError();
  }, [mode, clearError]);

  // Sync auth context error to local
  useEffect(() => {
    if (error) setLocalError(error);
  }, [error]);
  
  // Get current values from refs for form submission
  const email = emailRef.current;
  const password = passwordRef.current;
  const username = usernameRef.current;
  const regName = regNameRef.current;
  const regEmail = regEmailRef.current;
  const regPassword = regPasswordRef.current;
  const regConfirm = regConfirmRef.current;
  const companyName = companyNameRef.current;
  const companyPhone = companyPhoneRef.current;
  const companyAddress = companyAddressRef.current;
  const companyRegNo = companyRegNoRef.current;
  const taxId = taxIdRef.current;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    // Use refs to get latest values
    const currentEmail = emailRef.current;
    const currentPassword = passwordRef.current;
    
    if (!currentEmail.trim()) { setLocalError("Please enter your email"); return; }
    if (!EMAIL_REGEX.test(currentEmail.trim())) { setLocalError("Please enter a valid email address"); return; }
    if (!currentPassword) { setLocalError("Please enter your password"); return; }
    
    const result = await loginWithEmail(currentEmail.trim(), currentPassword);
    if (!result.success) setLocalError(result.error || "Invalid email or password");
  };

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    // Use refs to get latest values
    const currentUsername = usernameRef.current;
    const currentPassword = passwordRef.current;
    
    if (!currentUsername.trim()) { setLocalError("Please enter your username"); return; }
    if (!currentPassword) { setLocalError("Please enter your password"); return; }
    
    const ok = await loginWithUsername(currentUsername.trim(), currentPassword);
    if (!ok) setLocalError(error || "Invalid username or password");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setSuccess("");
    // Use refs to get latest values
    const currentRegName = regNameRef.current;
    const currentRegEmail = regEmailRef.current;
    const currentRegPassword = regPasswordRef.current;
    const currentRegConfirm = regConfirmRef.current;
    const currentCompanyName = companyNameRef.current;
    const currentCompanyPhone = companyPhoneRef.current;
    const currentCompanyAddress = companyAddressRef.current;
    const currentCompanyRegNo = companyRegNoRef.current;
    const currentTaxId = taxIdRef.current;
    
    if (!currentRegName.trim()) { setLocalError("Please enter your name"); return; }
    if (!currentRegEmail.trim()) { setLocalError("Please enter your email"); return; }
    if (!EMAIL_REGEX.test(currentRegEmail.trim())) { setLocalError("Please enter a valid email address"); return; }
    if (!currentRegPassword || currentRegPassword.length < 6) { setLocalError("Password must be at least 6 characters"); return; }
    if (currentRegPassword !== currentRegConfirm) { setLocalError("Passwords do not match"); return; }
    
    const ok = await registerWithEmail(currentRegEmail.trim(), currentRegPassword, currentRegName.trim());
    if (ok) {
      if (currentCompanyName || currentCompanyRegNo || currentTaxId) {
        localStorage.setItem("fuelpro_company_profile", JSON.stringify({
          name: currentCompanyName || currentRegName.trim(), phone: currentCompanyPhone, address: currentCompanyAddress,
          industry: companyIndustry, regNo: currentCompanyRegNo, taxId: currentTaxId, createdAt: new Date().toISOString(),
        }));
      }
      setSuccess("Account created! Logging you in...");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  // Production mode - no demo credentials

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex overflow-hidden">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Left Side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-center px-12 w-1/2 relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl shadow-xl">
            ⛽
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">FuelPro</h1>
            <p className="text-indigo-300 text-sm">Professional Fuel Management</p>
          </div>
        </div>
        <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
          Manage your fuel stations<br />
          <span className="text-indigo-400">from anywhere</span>
        </h2>
        <div className="space-y-4 mt-8">
          {[
            { icon: Cloud, title: "Cloud Sync", desc: "Real-time sync across all devices", color: "text-blue-400" },
            { icon: Lock, title: "Secure Auth", desc: "Encrypted storage & session management", color: "text-green-400" },
            { icon: Zap, title: "Real-Time Updates", desc: "Live sales, delivery & payment tracking", color: "text-amber-400" },
            { icon: Server, title: "Multi-Station", desc: "Manage unlimited stations independently", color: "text-purple-400" },
            { icon: ShieldCheck, title: "Admin Control", desc: "Full system management panel", color: "text-emerald-400" },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-3">
              <f.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${f.color}`} />
              <div>
                <p className="text-white text-sm font-semibold">{f.title}</p>
                <p className="text-gray-400 text-xs">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 lg:hidden">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-xl">⛽</div>
            <div>
              <h1 className="text-xl font-black text-white">FuelPro</h1>
              <p className="text-indigo-300 text-xs">Professional Fuel Management</p>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mb-1">
            {mode === "register" ? "Create Account" : "Sign In"}
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            {mode === "register" ? "Join FuelPro and manage your stations" : "Enter your credentials to continue"}
          </p>

          {/* Error / Success Messages */}
          {localError && (
            <div className="mb-4 flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{localError}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-center gap-2 text-green-400 bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Mode Tabs */}
          {mode !== "register" && (
            <div className="flex bg-white/5 rounded-xl p-1 mb-5 gap-1">
              <button
                type="button"
                onClick={() => setMode("email")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${mode === "email" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400 hover:text-gray-300"}`}
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
              <button
                type="button"
                onClick={() => setMode("username")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${mode === "username" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400 hover:text-gray-300"}`}
              >
                <User className="w-3.5 h-3.5" /> Username
              </button>
            </div>
          )}

          {/* EMAIL LOGIN FORM */}
          {mode === "email" && (
            <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={emailState.value}
                    onChange={e => { handleEmailChange(e.target.value); }}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                    autoComplete="email"
                    onBlur={emailState.handleBlur}
                    onFocus={emailState.handleFocus}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-300">Password</label>
                  <button type="button" onClick={() => navigate("/reset-password")} className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordState.value}
                    onChange={e => passwordState.setValue(e.target.value)}
                    onBlur={passwordState.handleBlur}
                    onFocus={passwordState.handleFocus}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> Sign In
                  </>
                )}
              </button>
            </form>
          )}

          {/* USERNAME LOGIN FORM */}
          {mode === "username" && (
            <form onSubmit={handleUsernameLogin} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1.5 block">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={usernameState.value}
                    onChange={e => usernameState.setValue(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                    autoComplete="username"
                    onBlur={usernameState.handleBlur}
                    onFocus={usernameState.handleFocus}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordState.value}
                    onChange={e => passwordState.setValue(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    autoComplete="current-password"
                    onBlur={passwordState.handleBlur}
                    onFocus={passwordState.handleFocus}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
                ) : (
                  <><LogIn className="w-4 h-4" />Sign In</>
                )}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-3" noValidate>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">Full Name *</label>
                <input 
                  type="text" 
                  value={regNameState.value} 
                  onChange={e => regNameState.setValue(e.target.value)} 
                  onBlur={regNameState.handleBlur}
                  onFocus={regNameState.handleFocus}
                  placeholder="Your full name" 
                  autoComplete="name"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">Email Address *</label>
                <input 
                  type="email" 
                  value={regEmailState.value} 
                  onChange={e => regEmailState.setValue(e.target.value)} 
                  onBlur={regEmailState.handleBlur}
                  onFocus={regEmailState.handleFocus}
                  placeholder="you@company.com" 
                  autoComplete="email"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">Password *</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={regPasswordState.value} 
                    onChange={e => regPasswordState.setValue(e.target.value)} 
                    onBlur={regPasswordState.handleBlur}
                    onFocus={regPasswordState.handleFocus}
                    placeholder="Min 6 characters" 
                    autoComplete="new-password"
                    className="w-full pl-4 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">Confirm Password *</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={regConfirmState.value} 
                  onChange={e => regConfirmState.setValue(e.target.value)} 
                  onBlur={regConfirmState.handleBlur}
                  onFocus={regConfirmState.handleFocus}
                  placeholder="Repeat password" 
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              {/* Optional company fields */}
              <button type="button" onClick={() => setShowCompanyFields(!showCompanyFields)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                <Fuel className="w-3 h-3" /> {showCompanyFields ? "Hide" : "Add"} company details (optional)
              </button>
              {showCompanyFields && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <input 
                    type="text" 
                    value={companyNameState.value} 
                    onChange={e => companyNameState.setValue(e.target.value)} 
                    onBlur={companyNameState.handleBlur}
                    onFocus={companyNameState.handleFocus}
                    placeholder="Company name" 
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input 
                    type="text" 
                    value={companyPhoneState.value} 
                    onChange={e => companyPhoneState.setValue(e.target.value)} 
                    onBlur={companyPhoneState.handleBlur}
                    onFocus={companyPhoneState.handleFocus}
                    placeholder="Phone number" 
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input 
                    type="text" 
                    value={companyRegNoState.value} 
                    onChange={e => companyRegNoState.setValue(e.target.value)} 
                    onBlur={companyRegNoState.handleBlur}
                    onFocus={companyRegNoState.handleFocus}
                    placeholder="Registration number" 
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input 
                    type="text" 
                    value={taxIdState.value} 
                    onChange={e => taxIdState.setValue(e.target.value)} 
                    onBlur={taxIdState.handleBlur}
                    onFocus={taxIdState.handleFocus}
                    placeholder="Tax ID / KRA PIN" 
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
                ) : (
                  <><UserPlus className="w-4 h-4" />Create Account</>
                )}
              </button>
            </form>
          )}

          {/* Toggle between login / register */}
          <div className="mt-5 text-center text-xs text-gray-400">
            {mode === "register" ? (
              <>Already have an account?{" "}
                <button type="button" onClick={() => setMode("email")} className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">Sign In</button>
              </>
            ) : (
              <>Don't have an account?{" "}
                <button type="button" onClick={() => setMode("register")} className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">Create one</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
