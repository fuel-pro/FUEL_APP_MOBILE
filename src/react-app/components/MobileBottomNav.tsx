import {
  Home,
  ShoppingCart,
  BarChart3,
  FileText,
  MoreHorizontal,
  Fuel,
  Truck,
  CreditCard,
  Users,
  FolderOpen,
  Newspaper,
  Database,
  Activity,
  TrendingUp,
  Bell,
  Package,
  Award,
  Calendar,
  FlaskConical,
  Wallet,
  LineChart,
  ClipboardList,
  Plug,
  Globe,
  Wrench,
  Monitor,
  Receipt,
  Settings,
  HelpCircle,
  FileUp,
} from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/react-app/context/PermissionContext";
import { useTenant } from "@/react-app/context/TenantContext";

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  color: string;
}

export default function MobileBottomNav({
  activeTab,
  onTabChange,
}: MobileBottomNavProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { canAccessTab } = usePermissions();
  const { featureFlags } = useTenant();

  // Helper: Check if tab should show based on feature flags
  const isTabAllowed = (tabId: string): boolean => {
    if (!canAccessTab(tabId)) return false;
    // Filter by feature flags + location
    const flagMap: Record<string, keyof typeof featureFlags> = {
      mpesa: "mpesa",
      pos: "pos",
      inventory: "inventory",
      sales: "sales",
      analytics: "analytics",
      payroll: "payroll",
      expenses: "expenses",
      customers: "customers",
      suppliers: "suppliers",
      documents: "documents",
      invoice: "pos",
      debt: "pos",
      communication: "email",
      audit: "audit",
      regional: "compliance",
      docconverter: "documents",
      priceboard: "priceboard",
      fueltypes: "fueltypes",
      maintenance: "maintenance",
      quality: "quality",
    };
    const flag = flagMap[tabId];
    if (flag && !featureFlags[flag]) return false;
    return true;
  };

  // Primary nav: most used tabs - 48px touch targets
  const primaryNav: NavItem[] = [
    { id: "dashboard", label: "Home", icon: Home, color: "text-blue-500" },
    { id: "pos", label: "POS", icon: ShoppingCart, color: "text-green-500" },
    { id: "sales", label: "Sales", icon: BarChart3, color: "text-purple-500" },
    {
      id: "inventory",
      label: "Stock",
      icon: Package,
      color: "text-orange-500",
    },
  ].filter(item => isTabAllowed(item.id));

  // Secondary nav: all other tabs - filtered by feature flags + permissions
  const secondaryNav: NavItem[] = [
    {
      id: "reports",
      label: "Reports",
      icon: FileText,
      color: "text-orange-400",
    },
    {
      id: "fuelsalesreport",
      label: "Fuel Rpt",
      icon: TrendingUp,
      color: "text-orange-400",
    },
    { id: "offloading", label: "Offload", icon: Fuel, color: "text-amber-500" },
    { id: "delivery", label: "Delivery", icon: Truck, color: "text-teal-500" },
    {
      id: "invoice",
      label: "Invoice",
      icon: FileText,
      color: "text-indigo-500",
    },
    { id: "credit", label: "Credit", icon: Wallet, color: "text-pink-500" },
    { id: "debt", label: "Debts", icon: Bell, color: "text-red-400" },
    { id: "payroll", label: "Payroll", icon: Users, color: "text-pink-500" },
    { id: "shifts", label: "Shifts", icon: Calendar, color: "text-cyan-500" },
    { id: "team", label: "Team", icon: Users, color: "text-purple-500" },
    { id: "customers", label: "Loyalty", icon: Award, color: "text-amber-500" },
    {
      id: "quality",
      label: "Quality",
      icon: FlaskConical,
      color: "text-teal-500",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: LineChart,
      color: "text-violet-500",
    },
    {
      id: "documents",
      label: "Docs",
      icon: FolderOpen,
      color: "text-cyan-500",
    },
    {
      id: "audit",
      label: "Audit",
      icon: ClipboardList,
      color: "text-indigo-500",
    },
    {
      id: "communication",
      label: "Comms",
      icon: Activity,
      color: "text-green-500",
    },
    { id: "news", label: "News", icon: Newspaper, color: "text-blue-400" },
    { id: "data", label: "Data", icon: Database, color: "text-gray-400" },
    {
      id: "integration",
      label: "Integrate",
      icon: Plug,
      color: "text-indigo-500",
    },
    {
      id: "regional",
      label: "Compliance",
      icon: Globe,
      color: "text-blue-500",
    },
    { id: "fueltypes", label: "Fuels", icon: Fuel, color: "text-amber-500" },
    {
      id: "maintenance",
      label: "Maint.",
      icon: Wrench,
      color: "text-gray-400",
    },
    {
      id: "priceboard",
      label: "Prices",
      icon: Monitor,
      color: "text-cyan-500",
    },
    { id: "expenses", label: "Expenses", icon: Receipt, color: "text-red-400" },
    {
      id: "docconverter",
      label: "Convert",
      icon: FileUp,
      color: "text-amber-500",
    },
  ].filter(item => isTabAllowed(item.id));

  // M-PESA is ONLY shown if feature flag enabled (Kenya/TZ only)
  if (featureFlags.mpesa) {
    secondaryNav.unshift({
      id: "mpesa",
      label: "M-PESA",
      icon: CreditCard,
      color: "text-green-600",
    });
  }

  const handleNavClick = (tabId: string) => {
    onTabChange(tabId);
    setShowMoreMenu(false);
  };

  const isMoreActive = secondaryNav.some(item => item.id === activeTab);
  const showMoreButton = secondaryNav.length > 0;

  return (
    <>
      {/* More Menu Overlay - backdrop */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 bg-black/60 z-[55] md:hidden"
          style={{ touchAction: "none" }}
          onClick={() => setShowMoreMenu(false)}
        />
      )}

      {/* More Menu Sheet - slides up */}
      {showMoreMenu && (
        <div
          className="fixed bottom-[72px] left-2 right-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-[60] md:hidden border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{ maxHeight: "60vh", overflowY: "auto" }}
        >
          <div className="sticky top-0 bg-white dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 z-10">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              All Features
            </h3>
            <p className="text-[10px] text-gray-400">Tap to navigate</p>
          </div>
          <div className="grid grid-cols-3 gap-1 p-2">
            {secondaryNav.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all active:scale-95 ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900/40"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  }`}
                  style={{ minHeight: 64, touchAction: "manipulation" }}
                >
                  <Icon
                    size={22}
                    className={
                      isActive ? item.color : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span
                    className={`text-[11px] mt-1 font-medium ${
                      isActive
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar - 64px height for proper touch targets */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-50 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          className="flex items-center justify-around"
          style={{ height: 64 }}
        >
          {primaryNav.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95 relative"
                style={{ minWidth: 48, touchAction: "manipulation" }}
              >
                {/* Active indicator line */}
                {isActive && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-b-full"
                    style={{ width: 32, height: 3 }}
                  />
                )}
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive ? "bg-blue-100 dark:bg-blue-900/40" : ""
                  }`}
                >
                  <Icon
                    size={22}
                    className={
                      isActive ? item.color : "text-gray-400 dark:text-gray-500"
                    }
                  />
                </div>
                <span
                  className={`text-[10px] mt-0.5 font-medium leading-none ${
                    isActive
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More Button */}
          {showMoreButton && (
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95 relative"
              style={{ minWidth: 48, touchAction: "manipulation" }}
            >
              {isMoreActive && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-b-full"
                  style={{ width: 32, height: 3 }}
                />
              )}
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  showMoreMenu || isMoreActive
                    ? "bg-blue-100 dark:bg-blue-900/40"
                    : ""
                }`}
              >
                <MoreHorizontal
                  size={22}
                  className={
                    showMoreMenu || isMoreActive
                      ? "text-blue-500"
                      : "text-gray-400 dark:text-gray-500"
                  }
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 font-medium leading-none ${
                  showMoreMenu || isMoreActive
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                More
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
