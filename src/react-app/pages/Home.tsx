import {
  useState,
  useEffect,
  lazy,
  Suspense,
  useMemo,
  useCallback,
} from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useStations } from "@/react-app/context/StationContext";
import { useAuth } from "@/react-app/context/AuthContext";
import { usePermissions } from "@/react-app/context/PermissionContext";
import { useTenant } from "@/react-app/context/TenantContext";
import { LocationProvider } from "@/react-app/context/LocationContext";
import Header from "@/react-app/components/Header";
import TabNavigation from "@/react-app/components/TabNavigation";
import MobileBottomNav from "@/react-app/components/MobileBottomNav";
import CloudSyncIndicator from "@/react-app/components/CloudSyncIndicator";
import AIChatbot from "@/react-app/components/AIChatbot";
// Shell components loaded eagerly
import StationManager from "@/react-app/components/StationManager";
import CombinedStationsView from "@/react-app/components/CombinedStationsView";
import SetupWizard from "@/react-app/components/SetupWizard";
import FirstLoginChoice from "@/react-app/components/FirstLoginChoice";

// All tab content lazy-loaded to reduce main bundle
const Dashboard = lazy(() => import("@/react-app/components/Dashboard"));
const DeliveryTracker = lazy(
  () => import("@/react-app/components/DeliveryTracker")
);
const FuelOffloading = lazy(
  () => import("@/react-app/components/FuelOffloading")
);
const Invoice = lazy(() => import("@/react-app/components/Invoice"));
const DebtReminder = lazy(() => import("@/react-app/components/DebtReminder"));
const SalesTracking = lazy(
  () => import("@/react-app/components/SalesTracking")
);
const ReportsCenter = lazy(
  () => import("@/react-app/components/ReportsCenter")
);
const MPESAAnalyzer = lazy(
  () => import("@/react-app/components/MPESAAnalyzer")
);
const PayrollSystem = lazy(
  () => import("@/react-app/components/PayrollSystem")
);
const DataManager = lazy(() => import("@/react-app/components/DataManager"));
const News = lazy(() => import("@/react-app/components/News"));
const LiveTransaction = lazy(
  () => import("@/react-app/components/LiveTransaction")
);
const FuelSalesReport = lazy(
  () => import("@/react-app/components/FuelSalesReport")
);
const Communication = lazy(
  () => import("@/react-app/components/Communication")
);
const PointOfSale = lazy(() => import("@/react-app/components/PointOfSale"));
const InventoryManagement = lazy(
  () => import("@/react-app/components/InventoryManagement")
);
const CustomerLoyalty = lazy(
  () => import("@/react-app/components/CustomerLoyalty")
);
const AuditTrail = lazy(() => import("@/react-app/components/AuditTrail"));
const ShiftManagement = lazy(
  () => import("@/react-app/components/ShiftManagement")
);
const FuelQualityTesting = lazy(
  () => import("@/react-app/components/FuelQualityTesting")
);
const CreditManagement = lazy(
  () => import("@/react-app/components/CreditManagement")
);
const AdvancedAnalytics = lazy(
  () => import("@/react-app/components/AdvancedAnalytics")
);
const IntegrationHub = lazy(
  () => import("@/react-app/components/IntegrationHub")
);
const Compliance = lazy(() => import("@/react-app/components/Compliance"));
const DocumentConverter = lazy(
  () => import("@/react-app/components/DocumentConverter")
);
const FuelTypesManager = lazy(
  () => import("@/react-app/components/FuelTypesManager")
);
const TeamManager = lazy(() => import("@/react-app/components/TeamManager"));
const DocumentCenter = lazy(
  () => import("@/react-app/components/DocumentCenter")
);
const SupplierManagement = lazy(
  () => import("@/react-app/components/SupplierManagement")
);
const MaintenanceTracker = lazy(
  () => import("@/react-app/components/MaintenanceTracker")
);
const ExpenseTracker = lazy(
  () => import("@/react-app/components/ExpenseTracker")
);
const PriceBoard = lazy(() => import("@/react-app/components/PriceBoard"));

// ─── Cross-Tab Data Sync ───
// Shared state channel for real-time updates between tabs
const SYNC_CHANNEL = "fuelpro_sync";

function useCrossTabSync() {
  const broadcast = useCallback((event: string, data: unknown) => {
    try {
      const bc = new BroadcastChannel(SYNC_CHANNEL);
      bc.postMessage({ event, data, timestamp: Date.now() });
      bc.close();
    } catch {
      // Fallback: use localStorage events
      localStorage.setItem(
        "fuelpro_sync_event",
        JSON.stringify({ event, data, timestamp: Date.now() })
      );
    }
  }, []);

  const subscribe = useCallback(
    (event: string, handler: (data: unknown) => void) => {
      let bc: BroadcastChannel | null = null;
      try {
        bc = new BroadcastChannel(SYNC_CHANNEL);
        bc.onmessage = e => {
          if (e.data.event === event) handler(e.data.data);
        };
      } catch {
        // Fallback
      }

      const storageHandler = (e: StorageEvent) => {
        if (e.key === "fuelpro_sync_event") {
          try {
            const msg = JSON.parse(e.newValue || "{}");
            if (msg.event === event) handler(msg.data);
          } catch {}
        }
      };
      window.addEventListener("storage", storageHandler);

      return () => {
        if (bc) {
          bc.close();
        }
        window.removeEventListener("storage", storageHandler);
      };
    },
    []
  );

  return { broadcast, subscribe };
}

function HomeContent() {
  const {
    currentStation,
    stations,
    isStationLoading,
    adminSettings,
    switchStation,
    verifyStationAccess,
    createStation,
    loginAdmin,
  } = useStations();
  const { user, getActiveBinding, bindings } = useAuth();
  const { setRole } = usePermissions();
  const { featureFlags, isFeatureEnabled } = useTenant();
  const { broadcast, subscribe } = useCrossTabSync();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showStationManager, setShowStationManager] = useState(false);
  const [showCombined, setShowCombined] = useState(false);
  const [lastSaleTime, setLastSaleTime] = useState(Date.now());

  // Auto-login to role
  useEffect(() => {
    if (!user || !currentStation) return;
    const binding = getActiveBinding(currentStation.id);
    if (binding && binding.active) {
      setRole(binding.role);
    }
  }, [user, currentStation, getActiveBinding, setRole]);

  // Check for stations in localStorage after wizard completes
  // This fixes the race condition where createStation hasn't propagated yet
  useEffect(() => {
    if (!showSetupWizard && stations.length === 0) {
      const interval = setInterval(() => {
        try {
          const raw = localStorage.getItem("fuelpro_stations_v3");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.length > 0) {
              clearInterval(interval);
              window.location.reload();
            }
          }
        } catch {}
      }, 500);
      // Stop polling after 10 seconds
      const timeout = setTimeout(() => clearInterval(interval), 10000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [showSetupWizard, stations.length]);

  // Check for combined view
  useEffect(() => {
    if (searchParams.get("combined") === "true") setShowCombined(true);
  }, [searchParams]);

  // Cross-tab sync listeners
  useEffect(() => {
    const unsub1 = subscribe("sale_made", () => setLastSaleTime(Date.now()));
    const unsub2 = subscribe("inventory_update", () =>
      setLastSaleTime(Date.now())
    );
    const unsub3 = subscribe("tab_change", (tabId: string) =>
      setActiveTab(tabId)
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [subscribe]);

  // Listen for tab change events
  useEffect(() => {
    const handleChangeTab = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
        broadcast("tab_change", customEvent.detail);
      }
    };
    window.addEventListener("changeTab", handleChangeTab);
    return () => window.removeEventListener("changeTab", handleChangeTab);
  }, [broadcast]);

  // Validate tab access - redirect if current tab is restricted by feature flag
  const { canAccessTab } = usePermissions();
  useEffect(() => {
    const tabFeatureMap: Record<string, keyof typeof featureFlags> = {
      mpesa: "mpesa",
      communication: "email",
      audit: "audit",
      regional: "compliance",
      priceboard: "priceboard",
      fueltypes: "fueltypes",
      maintenance: "maintenance",
      quality: "quality",
    };
    const requiredFeature = tabFeatureMap[activeTab];
    if (requiredFeature && !featureFlags[requiredFeature]) {
      const fallbackTabs = ["dashboard", "pos", "sales", "inventory"];
      const fallback = fallbackTabs.find(t => canAccessTab(t));
      if (fallback && fallback !== activeTab) setActiveTab(fallback);
    }
  }, [activeTab, canAccessTab, featureFlags]);

  // Filter tab configurations based on feature flags
  const filteredTabConfig = useMemo(() => {
    const config = { ...adminSettings.tabConfig };
    // Hide M-PESA tab if not in Kenya/TZ
    if (!featureFlags.mpesa) {
      config.mpesa = { ...config.mpesa, enabled: false };
    }
    // Compliance tab controlled by compliance feature flag
    if (!featureFlags.compliance) {
      config.regional = { ...config.regional, enabled: false };
    }
    return config;
  }, [adminSettings.tabConfig, featureFlags]);

  // ─── Render tab content with cross-tab data ───
  const renderTabContent = () => {
    const tabConfig =
      filteredTabConfig[activeTab as keyof typeof filteredTabConfig];
    if (tabConfig && !tabConfig.enabled) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
              <span className="text-2xl text-gray-400">!</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400">
              Feature Not Available
            </h3>
            <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
              This feature is not available in your region or has been disabled.
              {activeTab === "mpesa" && (
                <span className="block mt-2">
                  M-PESA is only available in Kenya and Tanzania.
                </span>
              )}
            </p>
          </div>
        </div>
      );
    }

    const commonProps = {
      stationId: currentStation?.id || "default",
      lastSyncTime: lastSaleTime,
      onBroadcast: broadcast,
    };

    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "delivery":
        return <DeliveryTracker />;
      case "offloading":
        return <FuelOffloading />;
      case "invoice":
        return <Invoice />;
      case "debt":
        return <DebtReminder />;
      case "sales":
        return <SalesTracking />;
      case "reports":
        return <ReportsCenter />;
      case "mpesa":
        return featureFlags.mpesa ? <MPESAAnalyzer /> : null;
      case "payroll":
        return <PayrollSystem />;
      case "data":
        return <DataManager />;
      case "news":
        return <News />;
      case "livetransaction":
        return <LiveTransaction />;
      case "fuelsalesreport":
        return <FuelSalesReport />;
      case "communication":
        return <Communication />;
      case "pos":
        return <PointOfSale />;
      case "inventory":
        return <InventoryManagement />;
      case "customers":
        return <CustomerLoyalty />;
      case "audit":
        return <AuditTrail {...commonProps} />;
      case "shifts":
        return <ShiftManagement />;
      case "quality":
        return <FuelQualityTesting />;
      case "credit":
        return <CreditManagement />;
      case "analytics":
        return <AdvancedAnalytics />;
      case "integration":
        return <IntegrationHub />;
      case "regional":
        return <Compliance />;
      case "docconverter":
        return <DocumentConverter />;
      case "fueltypes":
        return <FuelTypesManager />;
      case "team":
        return <TeamManager />;
      case "documents":
        return <DocumentCenter />;
      case "suppliers":
        return <SupplierManagement />;
      case "maintenance":
        return <MaintenanceTracker />;
      case "expenses":
        return <ExpenseTracker />;
      case "priceboard":
        return <PriceBoard />;
      default:
        return <Dashboard />;
    }
  };

  if (isStationLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center animate-pulse">
            <span className="text-2xl font-bold text-white">F</span>
          </div>
          <h2 className="text-xl font-bold text-white font-serif">FuelPro</h2>
          <p className="text-gray-400 text-sm mt-2">Loading stations...</p>
          <div className="mt-4 w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full animate-pulse"
              style={{ width: "60%" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // No stations: show FirstLoginChoice
  if (stations.length === 0 || !currentStation) {
    if (showSetupWizard) {
      return (
        <SetupWizard
          onComplete={() => {
            setShowSetupWizard(false);
            // Clear localStorage flags and force full reload
            localStorage.setItem("fuelpro_setup_complete", "true");
            // Force a complete page reload to reset all React state
            window.location.reload();
          }}
        />
      );
    }
    const showAccessMode = stations.length > 0;
    return (
      <FirstLoginChoice
        existingStations={stations}
        showAccessMode={showAccessMode}
        onCreateStation={() => setShowSetupWizard(true)}
        onAccessShared={(stationId, password) => {
          if (verifyStationAccess(stationId, password)) {
            switchStation(stationId);
            const accesses = JSON.parse(
              localStorage.getItem("fuelpro_shared_access") || "[]"
            );
            accesses.push({ stationId, date: new Date().toISOString() });
            localStorage.setItem(
              "fuelpro_shared_access",
              JSON.stringify(accesses)
            );
            return true;
          }
          return false;
        }}
        onSelectStation={stationId => {
          switchStation(stationId);
          return true;
        }}
        loginAdmin={loginAdmin}
      />
    );
  }

  // Combined view
  if (showCombined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header onShowStations={() => setShowStationManager(true)} />
        <div className="container mx-auto px-2 md:px-4 py-6">
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => {
                setShowCombined(false);
                navigate("/");
              }}
              className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-sm"
            >
              Back to Station
            </button>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Combined Stations View
            </h2>
          </div>
          <CombinedStationsView />
        </div>
      </div>
    );
  }

  // Setup wizard
  if (showSetupWizard)
    return <SetupWizard onComplete={() => setShowSetupWizard(false)} />;

  // Station manager
  if (showStationManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
        <StationManager onClose={() => setShowStationManager(false)} />
      </div>
    );
  }

  // ─── MAIN APP ───
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0 transition-colors duration-300">
      <Header
        onShowStations={() => setShowStationManager(true)}
        onShowCombined={() => setShowCombined(true)}
      />

      <div className="container mx-auto px-1 sm:px-2 lg:px-4 py-1 sm:py-2">
        {/* Desktop Tab Navigation */}
        <div className="hidden md:block">
          <TabNavigation
            activeTab={activeTab}
            onTabChange={tab => {
              setActiveTab(tab);
              broadcast("tab_change", tab);
            }}
          />
        </div>

        {/* Mobile Active Tab Title */}
        <div className="md:hidden mb-1 sm:mb-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 capitalize">
              {filteredTabConfig[activeTab as keyof typeof filteredTabConfig]
                ?.label || activeTab}
            </h2>
            {featureFlags.mpesa && activeTab === "mpesa" && (
              <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                M-PESA Ready
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 md:rounded-b-2xl rounded-b-lg shadow-lg flex-1 overflow-hidden flex flex-col">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64 sm:h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
              </div>
            }
          >
            {renderTabContent()}
          </Suspense>
        </div>
      </div>

      {/* Mobile Bottom Navigation - NO duplicate AI here */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={tab => {
          setActiveTab(tab);
          broadcast("tab_change", tab);
        }}
      />

      {/* AI Chatbot - single instance, NOT duplicated */}
      {featureFlags.ai && <AIChatbot />}

      {/* Cloud Sync Indicator */}
      <CloudSyncIndicator />
    </div>
  );
}

export default function Home() {
  const { currentStation } = useStations();
  const stationId = currentStation?.id || "default";

  // Detect country for tenant context
  const detectedCountry = useMemo(() => {
    try {
      const saved = localStorage.getItem("fuelpro_location_country");
      if (saved) {
        const parsed = JSON.parse(saved);
        const cc = parsed.currentCountry || parsed.country;
        if (cc) return cc.toUpperCase();
      }
    } catch {}
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Map common TZs to countries
    if (tz.includes("Nairobi")) return "KE";
    if (tz.includes("Lagos") || tz.includes("Lagos")) return "NG";
    if (tz.includes("Johannesburg")) return "ZA";
    if (tz.includes("Accra")) return "GH";
    if (tz.includes("Dar_es_Salaam") || tz.includes("Dar es Salaam"))
      return "TZ";
    if (tz.includes("Kampala")) return "UG";
    return "US";
  }, []);

  return (
    <LocationProvider stationId={stationId}>
      <HomeContent />
    </LocationProvider>
  );
}
