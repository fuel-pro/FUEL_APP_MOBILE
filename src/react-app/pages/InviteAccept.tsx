import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Link2,
  User,
  LogIn,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  Eye,
  Clock,
  Mail,
  Lock,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import type { UserRole } from "@/react-app/context/PermissionContext";

interface InviteData {
  id: string;
  role: UserRole;
  stationName: string;
  stationId: string;
  createdBy: string;
  expiresAt?: string;
  maxUses: number;
}

const ROLE_INFO: Record<
  string,
  { label: string; desc: string; icon: any; color: string }
> = {
  manager: {
    label: "Manager",
    desc: "Operational control, can invite Staff/Auditor",
    icon: UserCheck,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  staff: {
    label: "Staff",
    desc: "Daily tasks, assigned pumps/shifts",
    icon: User,
    color: "text-green-600 bg-green-50 border-green-200",
  },
  auditor: {
    label: "Auditor",
    desc: "Read-only audit and reports",
    icon: Eye,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  owner: {
    label: "Owner",
    desc: "Full system control",
    icon: ShieldCheck,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
};

/** Decode URL-safe base64 back to JSON */
function decodeInviteData(encoded: string): InviteData | null {
  try {
    // Reverse URL-safe base64: replace - with +, _ with /
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding back
    while (base64.length % 4 !== 0) base64 += "=";
    const json = atob(base64);
    return JSON.parse(json) as InviteData;
  } catch {
    return null;
  }
}

export default function InviteAccept() {
  const { inviteId: encodedData } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const { user, loginWithEmail, registerWithEmail, bindRole } = useAuth();

  const [username, setUsername] = useState("");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState<"check" | "auth" | "username" | "done">(
    "check"
  );

  // Auth form states
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authPending, setAuthPending] = useState(false);

  // Decode invite from URL on mount
  useEffect(() => {
    if (!encodedData) {
      setError("Invalid invite link - no invite data found.");
      return;
    }

    const decoded = decodeInviteData(encodedData);
    if (!decoded) {
      setError("This invite link is corrupted or invalid.");
      return;
    }

    // Validate the invite
    if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) {
      setError(
        `This invite expired on ${new Date(decoded.expiresAt).toLocaleDateString()}.`
      );
      return;
    }

    // Check if already used (stored in localStorage by invite ID)
    const usedInvites = JSON.parse(
      localStorage.getItem("fuelpro_used_invites") || "{}"
    );
    if (usedInvites[decoded.id]) {
      setError(
        `This invite has already been used by ${usedInvites[decoded.id]}.`
      );
      return;
    }

    // Check max uses
    const useCount = parseInt(
      localStorage.getItem(`fuelpro_invite_uses_${decoded.id}`) || "0"
    );
    if (useCount >= (decoded.maxUses || 1)) {
      setError("This invite has reached its maximum uses.");
      return;
    }

    setInvite(decoded);

    // If already authenticated, skip to username step
    if (user) {
      setStep("username");
    } else {
      setStep("auth");
    }
  }, [encodedData, user]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter email and password");
      return;
    }

    setAuthPending(true);
    const ok = await loginWithEmail(email.trim(), password);
    setAuthPending(false);
    if (!ok) setError("Invalid email or password");
  };

  // Handle quick register
  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setAuthPending(true);
    const ok = await registerWithEmail(email.trim(), password, regName.trim());
    setAuthPending(false);
    if (!ok && !error)
      setError("Failed to create account. Email may already exist.");
  };

  const handleAccept = () => {
    if (!username.trim() || !invite) {
      setError("Please enter your username");
      return;
    }
    if (!user) {
      setError("You must be signed in first");
      return;
    }

    // Track usage in localStorage
    const useCount =
      parseInt(
        localStorage.getItem(`fuelpro_invite_uses_${invite.id}`) || "0"
      ) + 1;
    localStorage.setItem(`fuelpro_invite_uses_${invite.id}`, String(useCount));

    const usedInvites = JSON.parse(
      localStorage.getItem("fuelpro_used_invites") || "{}"
    );
    usedInvites[invite.id] = username;
    localStorage.setItem("fuelpro_used_invites", JSON.stringify(usedInvites));

    // Add to team (store in localStorage for the station)
    const teamMembers = JSON.parse(
      localStorage.getItem("fuelpro_v2_team") || "[]"
    );
    teamMembers.push({
      id: `mem_${Date.now()}`,
      username,
      role: invite.role,
      assignedPumps: [],
      assignedShifts: [],
      invitedBy: invite.createdBy,
      invitedAt: new Date().toISOString(),
      expiresAt: invite.expiresAt,
      active: true,
    });
    localStorage.setItem("fuelpro_v2_team", JSON.stringify(teamMembers));

    // Create the station locally if it doesn't exist
    try {
      const STORAGE_KEY = "fuelpro_stations_v3";
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored
        ? JSON.parse(stored)
        : { stations: [], version: "3.0" };
      const stations = parsed.stations || [];
      if (
        !stations.some((s: any) => s.id === (invite.stationId || "default"))
      ) {
        stations.push({
          id: invite.stationId || "default",
          name: invite.stationName || "Fuel Station",
          location: "Unknown Location",
          phone: "",
          email: "",
          kraPin: "",
          etrSerial: "",
          taxRate: 16,
          theme: "default",
          logo: "",
          description: `Station joined via ${invite.role} invite`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: {},
          access: [],
          sharedUsers: [],
        });
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ stations, version: "3.0" })
        );
      }
    } catch {
      /* ignore station creation errors */
    }

    // Bind role to auth identity
    bindRole(
      invite.stationId || "default",
      invite.stationName || "Fuel Station",
      invite.role,
      invite.createdBy,
      invite.expiresAt
    );

    // Store current station context
    localStorage.setItem(
      "fuelpro_current_station",
      JSON.stringify({
        stationId: invite.stationId || "default",
        role: invite.role,
      })
    );

    setSuccess(
      `Welcome ${username}! You are now ${invite.role} at ${invite.stationName || "the station"}.`
    );
    setStep("done");

    // Redirect to dashboard after 2.5 seconds
    setTimeout(() => {
      navigate("/");
      import("@/react-app/lib/app-reloader").then(({ broadcastReload }) =>
        broadcastReload()
      );
    }, 2500);
  };

  // Error state
  if (error && step === "check") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-red-300/30 rounded-2xl p-8 text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold text-white mb-2">Invite Error</h2>
          <p className="text-sm text-red-300 mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  const roleInfo = ROLE_INFO[invite.role] || ROLE_INFO.staff;
  const RoleIcon = roleInfo.icon;

  // Step 1: Authenticate with email/password
  if (step === "auth") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Invite Info */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Link2 size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">You're Invited!</h1>
            <p className="text-sm text-indigo-300 mt-1">
              Join {invite.stationName || "a FuelPro station"}
            </p>
          </div>

          <div className={`p-4 rounded-xl border mb-6 ${roleInfo.color}`}>
            <div className="flex items-center gap-3">
              <RoleIcon size={24} />
              <div>
                <p className="text-sm font-bold">{roleInfo.label} Role</p>
                <p className="text-xs opacity-70">{roleInfo.desc}</p>
              </div>
            </div>
            {invite.stationName && (
              <p className="text-xs mt-2 opacity-70">
                Station: <strong>{invite.stationName}</strong>
              </p>
            )}
            {invite.expiresAt && (
              <p className="text-xs mt-1 opacity-70 flex items-center gap-1">
                <Clock size={10} /> Expires:{" "}
                {new Date(invite.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Auth Tabs */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
            {/* Toggle Login / Register */}
            <div className="flex bg-white/5 rounded-xl p-1 mb-5 border border-white/10">
              <button
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  authMode === "login"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                <LogIn size={13} /> Sign In
              </button>
              <button
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  authMode === "register"
                    ? "bg-green-600 text-white shadow-md"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                <UserPlus size={13} /> Create Account
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertTriangle
                  size={14}
                  className="text-red-400 flex-shrink-0 mt-0.5"
                />
                <p className="text-xs text-red-300 flex-1">{error}</p>
              </div>
            )}

            {authMode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-3.5">
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
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
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
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <Eye size={14} />
                      ) : (
                        <Eye size={14} className="text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authPending}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3 rounded-xl transition-all shadow-lg disabled:opacity-60"
                >
                  {authPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={16} /> Sign In
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleQuickRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <UserPlus
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="text"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
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
                      value={email}
                      onChange={e => setEmail(e.target.value)}
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
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <Eye size={14} />
                      ) : (
                        <Eye size={14} className="text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authPending}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg disabled:opacity-60"
                >
                  {authPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={16} /> Create Account
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Enter username
  if (step === "username") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <CheckCircle2 size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Signed In!</h1>
            <p className="text-sm text-indigo-300 mt-1">
              {user?.email || user?.name}
            </p>
          </div>

          <div className={`p-4 rounded-xl border mb-6 ${roleInfo.color}`}>
            <div className="flex items-center gap-3">
              <RoleIcon size={24} />
              <div>
                <p className="text-sm font-bold">{roleInfo.label}</p>
                <p className="text-xs opacity-70">{roleInfo.desc}</p>
              </div>
            </div>
            {invite.stationName && (
              <p className="text-xs mt-2 opacity-70">
                Station: <strong>{invite.stationName}</strong>
              </p>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Choose your team username *
              </label>
              <input
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setError("");
                }}
                onKeyDown={e => e.key === "Enter" && handleAccept()}
                placeholder="Enter a username..."
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 outline-none"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                This identifies you within the station team
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleAccept}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <ShieldCheck size={18} /> Accept Role & Join Station
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Done
  if (step === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <CheckCircle2 size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            You're All Set!
          </h1>
          <p className="text-sm text-green-300 mb-2">{success}</p>
          <p className="text-xs text-gray-400">
            Redirecting to your station dashboard...
          </p>
        </div>
      </div>
    );
  }

  return null;
}
