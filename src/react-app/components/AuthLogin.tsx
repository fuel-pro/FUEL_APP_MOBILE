import { useAuth } from "@/react-app/context/AuthContext";
import { useState, useEffect } from "react";
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

type LoginMode = "email" | "username" | "register";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyIndustry, setCompanyIndustry] = useState("fuel_retail");
  const [companyRegNo, setCompanyRegNo] = useState("");
  const [taxId, setTaxId] = useState("");
  const [showCompanyFields, setShowCompanyFields] = useState(false);
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  // Clear errors when switching modes
  useEffect(() => {
    setLocalError("");
    setSuccess("");
    clearError();
  }, [mode, clearError]);

  // Sync auth context error to local
  useEffect(() => {
    if (error) setLocalError(error);
  }, [error]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (!email.trim()) { setLocalError("Please enter your email"); return; }
    if (!EMAIL_REGEX.test(email.trim())) { setLocalError("Please enter a valid email address"); return; }
    if (!password) { setLocalError("Please enter your password"); return; }
    const result = await loginWithEmail(email.trim(), password);
    if (!result.success) setLocalError(result.error || "Invalid email or password");
  };

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (!username.trim()) { setLocalError("Please enter your username"); return; }
    if (!password) { setLocalError("Please enter your password"); return; }
    const ok = await loginWithUsername(username.trim(), password);
    if (!ok) setLocalError(error || "Invalid username or password");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setSuccess("");
    if (!regName.trim()) { setLocalError("Please enter your name"); return; }
    if (!regEmail.trim()) { setLocalError("Please enter your email"); return; }
    if (!EMAIL_REGEX.test(regEmail.trim())) { setLocalError("Please enter a valid email address"); return; }
    if (!regPassword || regPassword.length < 6) { setLocalError("Password must be at least 6 characters"); return; }
    if (regPassword !== regConfirm) { setLocalError("Passwords do not match"); return; }
    const ok = await registerWithEmail(regEmail.trim(), regPassword, regName.trim());
    if (ok) {
      if (companyName || companyRegNo || taxId) {
        localStorage.setItem("fuelpro_company_profile", JSON.stringify({
          name: companyName || regName.trim(), phone: companyPhone, address: companyAddress,
          industry: companyIndustry, regNo: companyRegNo, taxId, createdAt: new Date().toISOString(),
        }));
      }
      setSuccess("Account created! Logging you in...");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  // Demo credentials function removed for production mode

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
                    value={email}
                    onChange={e => { setEmail(e.target.value); setLocalError(""); }}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                    autoComplete="email"
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
                    value={password}
                    onChange={e => { setPassword(e.target.value); setLocalError(""); }}
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
                    value={username}
                    onChange={e => { setUsername(e.target.value); setLocalError(""); }}
                    placeholder="Enter your username"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setLocalError(""); }}
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
                <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Your full name" autoComplete="name"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">Email Address *</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="you@company.com" autoComplete="email"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">Password *</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Min 6 characters" autoComplete="new-password"
                    className="w-full pl-4 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">Confirm Password *</label>
                <input type={showPassword ? "text" : "password"} value={regConfirm} onChange={e => setRegConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              {/* Optional company fields */}
              <button type="button" onClick={() => setShowCompanyFields(!showCompanyFields)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                <Fuel className="w-3 h-3" /> {showCompanyFields ? "Hide" : "Add"} company details (optional)
              </button>
              {showCompanyFields && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input type="text" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="Phone number" className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input type="text" value={companyRegNo} onChange={e => setCompanyRegNo(e.target.value)} placeholder="Registration number" className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <input type="text" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="Tax ID / KRA PIN" className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
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
