import { HashRouter as Router, Routes, Route, Navigate } from "react-router";
import { AuthProvider, useAuth } from "@/react-app/context/AuthContext";
import { StationProvider } from "@/react-app/context/StationContext";
import { TenantProvider } from "@/react-app/context/TenantContext";
import { ThemeProvider } from "@/react-app/context/ThemeContext";
import { LocalizationProvider } from "@/react-app/context/LocalizationContext";
import { PermissionProvider } from "@/react-app/context/PermissionContext";
import { FuelProvider } from "@/react-app/context/FuelContext";
import { PlatformDataProvider } from "@/react-app/context/PlatformDataContext";
import HomePage from "@/react-app/pages/Home";
import AuthLogin from "@/react-app/components/AuthLogin";
import PasswordReset from "@/react-app/pages/PasswordReset";
import { Suspense, useMemo } from "react";
import InviteAccept from "@/react-app/pages/InviteAccept";
import FounderAccess from "@/react-app/pages/FounderAccess";
import ClerkWrapper from "@/react-app/components/ClerkWrapper";
import ClerkSignIn from "@/react-app/components/ClerkSignIn";
import ClerkSignUp from "@/react-app/components/ClerkSignUp";
import ClerkBridge from "@/react-app/components/ClerkBridge";
import ClerkShow from "@/react-app/components/ClerkShow";
import ClerkUserButton from "@/react-app/components/ClerkUserButton";

// Simple fallback for lazy-loaded routes
function RouteFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20 text-center">
        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white font-serif">FuelPro</h2>
        <p className="text-gray-300 mt-2 text-sm">Loading...</p>
      </div>
    </div>
  );
}

/** Detect country from localStorage or timezone */
function useDetectedCountry(): string {
  return useMemo(() => {
    try {
      const saved = localStorage.getItem("fuelpro_location_country");
      if (saved) {
        const parsed = JSON.parse(saved);
        const cc = parsed.currentCountry || parsed.country;
        if (cc) return cc.toUpperCase();
      }
    } catch {}
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("Nairobi")) return "KE";
    if (tz.includes("Lagos")) return "NG";
    if (tz.includes("Johannesburg")) return "ZA";
    if (tz.includes("Dar_es_Salaam") || tz.includes("Dar es Salaam"))
      return "TZ";
    if (tz.includes("Kampala")) return "UG";
    if (tz.includes("Accra")) return "GH";
    return "US";
  }, []);
}

/** Loading screen shown only for main app, not for founder/public routes */
function MainAppLoader() {
  const { user, isPending: isLoading } = useAuth();
  const detectedCountry = useDetectedCountry();
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured = !!publishableKey;

  // Loading state
  if (isLoading && !isClerkConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20 text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white font-serif">
            FuelPro
          </h2>
          <p className="text-gray-300 mt-2 text-sm">
            Initializing multi-tenant systems...
          </p>
          <div className="mt-4 flex items-center gap-2 justify-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">
              Region: {detectedCountry}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Clerk is configured - show Clerk auth or dashboard
  if (isClerkConfigured) {
    return (
      <ClerkShow when="signed-in" fallback={<ClerkSignIn />}>
        <ClerkBridge />
        <TenantProvider detectedCountry={detectedCountry}>
          <StationProvider>
            <FuelProvider>
              <HomePage />
            </FuelProvider>
          </StationProvider>
        </TenantProvider>
      </ClerkShow>
    );
  }

  // Legacy auth (no Clerk configured)
  return user ? (
    <TenantProvider detectedCountry={detectedCountry}>
      <StationProvider>
        <FuelProvider>
          <HomePage />
        </FuelProvider>
      </StationProvider>
    </TenantProvider>
  ) : (
    <AuthLogin />
  );
}

export default function App() {
  return (
    <ClerkWrapper>
      <AuthProvider>
        <ThemeProvider>
          <LocalizationProvider>
            <PermissionProvider>
              <PlatformDataProvider>
                <Router>
                  <Routes>
                    {/* Clerk Authentication Routes */}
                    <Route path="/sign-in" element={<ClerkSignIn />} />
                    <Route path="/sign-up" element={<ClerkSignUp />} />
                    <Route path="/dashboard" element={<MainAppLoader />} />

                    {/* Founder Access - public, no auth required, rendered BEFORE auth check */}
                    <Route
                      path="/founder"
                      element={<FounderAccess />}
                    />
                    <Route
                      path="/founder-v1"
                      element={<Navigate to="/founder" replace />}
                    />
                    <Route
                      path="/admin"
                      element={<Navigate to="/founder" replace />}
                    />

                    {/* Password Reset - public */}
                    <Route path="/reset-password" element={<PasswordReset />} />

                    {/* Invite acceptance - public */}
                    <Route path="/join/:inviteId" element={<InviteAccept />} />

                    {/* Main app - requires auth, shows loader while checking */}
                    <Route path="/" element={<MainAppLoader />} />

                    {/* Catch all */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Router>
              </PlatformDataProvider>
            </PermissionProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </AuthProvider>
    </ClerkWrapper>
  );
}
