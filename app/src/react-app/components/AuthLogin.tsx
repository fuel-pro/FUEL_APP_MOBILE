import { useAuth } from "@/react-app/context/AuthContext";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Fingerprint,
  ShieldCheck,
  Lock,
  Zap,
  Cloud,
  Wifi,
  Server,
  User,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  LogIn,
  Fuel,
  ArrowLeft,
  KeyRound,
  Crown,
  Building,
} from "lucide-react";

type LoginMode = "email" | "username" | "register";

// Email validation regex
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

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Company profile fields
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
    if (user) {
      navigate("/", { replace: true });
    }
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

  // ---- EMAIL LOGIN ----
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (!email.trim()) {
      setLocalError("Please enter your email");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setLocalError("Please enter a valid email address");
      return;
    }
    if (!password) {
      setLocalError("Please enter your password");
      return;
    }

    const ok = await loginWithEmail(email.trim(), password);
    if (!ok) setLocalError("Invalid email or password");
  };

  // ---- USERNAME LOGIN ----
  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (!username.trim()) {
      setLocalError("Please enter your username");
      return;
    }
    if (!password) {
      setLocalError("Please enter your password");
      return;
    }

    const ok = await loginWithUsername(username.trim(), password);
    if (!ok) setLocalError("Invalid username or password");
  };

  // ---- REGISTER ----
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setSuccess("");

    if (!regName.trim()) {
      setLocalError("Please enter your name");
      return;
    }
    if (!regEmail.trim()) {
      setLocalError("Please enter your email");
      return;
    }
    if (!EMAIL_REGEX.test(regEmail.trim())) {
      setLocalError("Please enter a valid email address");
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return;
    }
    if (regPassword !== regConfirm) {
      setLocalError("Passwords do not match");
      return;
    }

    const ok = await registerWithEmail(
      regEmail.trim(),
      regPassword,
      regName.trim()
    );
    if (ok) {
      // Save company profile
      if (companyName || companyRegNo || taxId) {
        localStorage.setItem(
          "fuelpro_company_profile",
          JSON.stringify({
            name: companyName || regName.trim(),
            phone: companyPhone,
            address: companyAddress,
            industry: companyIndustry,
            regNo: companyRegNo,
            taxId: taxId,
            createdAt: new Date().toISOString(),
          })
        );
      }
      setSuccess("Account created successfully! Logging you in...");
      // Clear success message after navigation
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex flex-col justify-center space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-4xl">⛽</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white font-serif tracking-tight">
                FuelPro
              </h1>
              <p className="text-sm text-amber-400 font-medium">
                Professional Fuel Management
              </p>
            </div>
          </div>

          <h2 className="text-xl text-gray-200 leading-relaxed">
            Welcome to your comprehensive fuel management solution for unlimited
            stations
          </h2>

          <div className="space-y-3">
            {[
              {
                icon: Cloud,
                title: "Cloud Sync",
                desc: "Your data securely synced across all devices in real-time",
                color: "text-blue-400",
              },
              {
                icon: Lock,
                title: "Secure Authentication",
                desc: "Password-based login with encrypted local storage",
                color: "text-green-400",
              },
              {
                icon: Zap,
                title: "Real-Time Updates",
                desc: "Track sales, deliveries, and payments as they happen",
                color: "text-amber-400",
              },
              {
                icon: Server,
                title: "Multi-Station",
                desc: "Manage unlimited stations with independent data",
                color: "text-purple-400",
              },
              {
                icon: ShieldCheck,
                title: "Admin Control",
                desc: "Full system management and configuration panel",
                color: "text-emerald-400",
              },
            ].map(f => (
              <div
                key={f.title}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <f.icon size={18} className={f.color} />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{f.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "Fuel Monitoring",
              "Invoice System",
              "M-PESA Analytics",
              "Payroll System",
            ].map(label => (
              <span
                key={label}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-gray-300 border border-white/10"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex items-center">
          <div className="w-full bg-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="lg:hidden flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⛽</span>
                </div>
                <div className="text-left">
                  <h1 className="text-lg font-bold text-white font-serif">
                    FuelPro
                  </h1>
                  <p className="text-[10px] text-amber-400">
                    Professional Fuel Management
                  </p>
                </div>
              </div>
              <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                <KeyRound size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-white font-serif">
                {mode === "register" ? "Create Account" : "Sign In"}
              </h3>
              <p className="text-gray-400 text-xs mt-1">
                {mode === "register"
                  ? "Join FuelPro and manage your stations"
                  : "Enter your credentials to continue"}
              </p>
            </div>

            {/* Error / Success Messages */}
            {localError && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertCircle
                  size={14}
                  className="text-red-400 flex-shrink-0 mt-0.5"
                />
                <p className="text-xs text-red-300 flex-1">{localError}</p>
              </div>
            )}
            {success && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                <CheckCircle2
                  size={14}
                  className="text-green-400 flex-shrink-0 mt-0.5"
                />
                <p className="text-xs text-green-300 flex-1">{success}</p>
              </div>
            )}

            {/* Mode Tabs - only on login */}
            {mode !== "register" && (
              <div className="flex bg-white/5 rounded-xl p-1 mb-5 border border-white/10">
                <button
                  onClick={() => setMode("email")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    mode === "email"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  <Mail size={13} /> Email
                </button>
                <button
                  onClick={() => setMode("username")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    mode === "username"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  <User size={13} /> Username
                </button>
              </div>
            )}

            {/* === EMAIL LOGIN FORM === */}
            {mode === "email" && (
              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
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
                        setLocalError("");
                      }}
                      placeholder="you@company.com"
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate("/reset-password")}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        setLocalError("");
                      }}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={16} /> Sign In
                    </>
                  )}
                </button>
              </form>
            )}

            {/* === USERNAME LOGIN FORM === */}
            {mode === "username" && (
              <form onSubmit={handleUsernameLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <User
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="text"
                      value={username}
                      onChange={e => {
                        setUsername(e.target.value);
                        setLocalError("");
                      }}
                      placeholder="Enter your username"
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        setLocalError("");
                      }}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={16} /> Sign In
                    </>
                  )}
                </button>
              </form>
            )}

            {/* === REGISTER FORM === */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="text"
                      value={regName}
                      onChange={e => {
                        setRegName(e.target.value);
                        setLocalError("");
                      }}
                      placeholder="John Doe"
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => {
                        setRegEmail(e.target.value);
                        setLocalError("");
                      }}
                      placeholder="you@company.com"
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Password * (min 6 chars)
                  </label>
                  <div className="relative">
                    <Lock
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={e => {
                        setRegPassword(e.target.value);
                        setLocalError("");
                      }}
                      placeholder="Create a password"
                      className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={regConfirm}
                    onChange={e => {
                      setRegConfirm(e.target.value);
                      setLocalError("");
                    }}
                    placeholder="Confirm your password"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                {/* Company Profile Section */}
                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowCompanyFields(!showCompanyFields)}
                    className="flex items-center gap-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors mb-2"
                  >
                    <Building size={13} /> {showCompanyFields ? "Hide" : "Add"}{" "}
                    Company Profile (optional)
                  </button>
                  {showCompanyFields && (
                    <div className="space-y-3 animate-fadeIn">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">
                          Company Name
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          placeholder="e.g. Acme Fuel Station Ltd"
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">
                          Business Registration Number
                        </label>
                        <input
                          type="text"
                          value={companyRegNo}
                          onChange={e => setCompanyRegNo(e.target.value)}
                          placeholder="e.g. CPR/2024/001234"
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">
                          Tax ID / VAT Number
                        </label>
                        <input
                          type="text"
                          value={taxId}
                          onChange={e => setTaxId(e.target.value)}
                          placeholder="e.g. P051234567A"
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">
                          Business Phone
                        </label>
                        <input
                          type="tel"
                          value={companyPhone}
                          onChange={e => setCompanyPhone(e.target.value)}
                          placeholder="+254 700 000 000"
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">
                          Business Address
                        </label>
                        <input
                          type="text"
                          value={companyAddress}
                          onChange={e => setCompanyAddress(e.target.value)}
                          placeholder="123 Mombasa Road, Nairobi"
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">
                          Industry Type
                        </label>
                        <select
                          value={companyIndustry}
                          onChange={e => setCompanyIndustry(e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                          <option value="fuel_retail" className="bg-gray-800">
                            Fuel Retail Station
                          </option>
                          <option
                            value="fuel_wholesale"
                            className="bg-gray-800"
                          >
                            Fuel Wholesale
                          </option>
                          <option
                            value="fuel_transport"
                            className="bg-gray-800"
                          >
                            Fuel Transport
                          </option>
                          <option value="fuel_storage" className="bg-gray-800">
                            Fuel Storage Depot
                          </option>
                          <option
                            value="convenience_store"
                            className="bg-gray-800"
                          >
                            Convenience Store
                          </option>
                          <option value="other" className="bg-gray-800">
                            Other
                          </option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-green-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={16} /> Create Account
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Switch between login and register */}
            <div className="mt-5 pt-4 border-t border-white/10 text-center">
              {mode === "register" ? (
                <button
                  onClick={() => setMode("email")}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mx-auto transition-colors"
                >
                  <ArrowLeft size={12} /> Already have an account? Sign in
                </button>
              ) : (
                <button
                  onClick={() => setMode("register")}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mx-auto transition-colors"
                >
                  <UserPlus size={12} /> New to FuelPro? Create an account
                </button>
              )}
              <button
                onClick={() => navigate("/founder")}
                className="mt-2 text-xs text-amber-500/70 hover:text-amber-400 flex items-center gap-1 mx-auto transition-colors"
              >
                <Crown size={12} /> Founder Access
              </button>
            </div>

            {/* Trust indicators */}
            <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <ShieldCheck size={10} className="text-green-500" /> Secure
              </span>
              <span className="flex items-center gap-1">
                <Lock size={10} className="text-green-500" /> Encrypted
              </span>
              <span className="flex items-center gap-1">
                <Wifi size={10} className="text-green-500" /> Any Device
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
