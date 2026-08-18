import { useState, useEffect } from "react";
import { Lock, User, LogIn, LogOut, Eye, Shield } from "lucide-react";
import {
  loginWithAccessCode,
  getAccessSession,
  clearAccessSession,
  type StationAccessSession,
} from "@/react-app/lib/station-access-code-service";

/**
 * Station Access page — lets a team member log in with a username + password
 * provided by the station owner (NO signup needed). The member enters the
 * credentials and gains restricted (read-only or tab-limited) access to the
 * station's shared data.
 *
 * URL: /#/station-access
 *
 * The owner creates access codes in the Team Manager tab.
 */
export default function StationAccess() {
  const [session, setSession] = useState<StationAccessSession | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [stationOwnerId, setStationOwnerId] = useState("");
  const [stationId, setStationId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSession(getAccessSession());
    // Pre-fill from URL query params if present (owner can share a
    // pre-filled link: /#/station-access?owner=<uid>&station=<sid>).
    const params = new URLSearchParams(
      window.location.hash.split("?")[1] || "",
    );
    const owner = params.get("owner");
    const station = params.get("station");
    if (owner) setStationOwnerId(owner);
    if (station) setStationId(station);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    if (!stationOwnerId.trim() || !stationId.trim()) {
      setError(
        "Station owner ID and station ID are required. Use the link provided by the station owner.",
      );
      return;
    }
    setLoading(true);
    try {
      const s = await loginWithAccessCode(
        username,
        password,
        stationOwnerId,
        stationId,
      );
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAccessSession();
    setSession(null);
    setUsername("");
    setPassword("");
  };

  if (session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
              <Shield className="text-green-600" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold dark:text-white">
                Station Access
              </h1>
              <p className="text-sm text-gray-500">Logged in as team member</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm font-medium dark:text-white">
                {session.memberName}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-500">Role</span>
              <span className="text-sm font-medium dark:text-white">
                {session.memberRole}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-500">Access Mode</span>
              <span
                className={`text-sm font-medium flex items-center gap-1 ${session.readOnly ? "text-blue-600" : "text-green-600"}`}
              >
                {session.readOnly ? (
                  <>
                    <Eye size={14} /> Read-Only
                  </>
                ) : (
                  "Full Access"
                )}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-500">Allowed Tabs</span>
              <span className="text-sm font-medium dark:text-white">
                {session.allowedTabs.length === 0
                  ? "All tabs"
                  : `${session.allowedTabs.length} tabs`}
              </span>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-6">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              You are viewing the station's shared data as{" "}
              <strong>{session.memberName}</strong>.{" "}
              {session.readOnly
                ? "You have read-only access — changes are not saved."
                : "You have edit access to the allowed tabs."}
              {session.allowedTabs.length > 0 &&
                ` Access is limited to: ${session.allowedTabs.join(", ")}.`}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Lock className="text-blue-600" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold dark:text-white">
              Station Access
            </h1>
            <p className="text-sm text-gray-500">
              Team member login — no signup needed
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Station Owner ID
            </label>
            <input
              type="text"
              value={stationOwnerId}
              onChange={(e) => setStationOwnerId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
              placeholder="Provided in your access link"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Station ID
            </label>
            <input
              type="text"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
              placeholder="Provided in your access link"
            />
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="text-xs text-gray-500 mb-1 block">Username</label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Password</label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn size={18} />
            {loading ? "Logging in…" : "Access Station"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          Enter the credentials provided by your station owner. If you don't
          have them, ask the owner to create an access code for you in the Team
          Manager tab.
        </p>
      </div>
    </div>
  );
}
