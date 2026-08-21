/**
 * BusinessSuite.tsx
 * Full SalesZote-style sidebar navigation shell.
 * Maps every menu item to its feature module.
 * All subcomponents are module-scoped (UPDATE-4 rule).
 */
import React, { useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  TrendingUp,
  FileText,
  Users,
  Receipt,
  CreditCard,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Fuel,
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  X,
} from "lucide-react";

// Import components
import EnhancedDashboard from "./EnhancedDashboard";
import AdvancedPOS from "./AdvancedPOS";
import ProductsManagement from "./ProductsManagement";
import InventoryManagement from "./InventoryManagement";
import SalesInvoices from "./SalesInvoices";
import PurchasesSuppliers from "./PurchasesSuppliers";
import CustomersManagement from "./CustomersManagement";
import ExpensesManagement from "./ExpensesManagement";
import ReportsAnalytics from "./ReportsAnalytics";
import TerminalSessions from "./TerminalSessions";
import SettingsPanel from "./SettingsPanel";
import { isKenyaStation } from "@/react-app/lib/currency";

type MenuSection = {
  title: string;
  icon: React.ElementType;
  items: MenuItem[];
};

type MenuItem = {
  label: string;
  key: string;
  badge?: string;
};

type ActiveView =
  | "dashboard"
  | "pos"
  | "products"
  | "inventory"
  | "inventory-adjustments"
  | "inventory-transfers"
  | "inventory-counts"
  | "inventory-wastage"
  | "sales"
  | "sales-invoices"
  | "sales-terminal"
  | "purchases"
  | "purchases-orders"
  | "purchases-suppliers"
  | "customers"
  | "expenses"
  | "expenses-categories"
  | "reports"
  | "settings"
  | "settings-integrations";

const MENU_STRUCTURE: MenuSection[] = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    items: [{ label: "Dashboard", key: "dashboard" }],
  },
  {
    title: "Point of Sale",
    icon: ShoppingCart,
    items: [{ label: "POS", key: "pos" }],
  },
  {
    title: "Catalog",
    icon: Package,
    items: [{ label: "Products", key: "products" }],
  },
  {
    title: "Stock Management",
    icon: Warehouse,
    items: [
      { label: "Adjustments", key: "inventory-adjustments", badge: "New" },
      { label: "Transfers", key: "inventory-transfers", badge: "New" },
      { label: "Counts", key: "inventory-counts", badge: "New" },
      { label: "Wastages", key: "inventory-wastage", badge: "New" },
    ],
  },
  {
    title: "Sales",
    icon: TrendingUp,
    items: [
      { label: "All Sales", key: "sales" },
      { label: "Invoices", key: "sales-invoices" },
      { label: "Terminal Sessions", key: "sales-terminal" },
    ],
  },
  {
    title: "Purchases",
    icon: FileText,
    items: [
      { label: "Purchase Orders", key: "purchases-orders" },
      { label: "Suppliers", key: "purchases-suppliers" },
    ],
  },
  {
    title: "Customers",
    icon: Users,
    items: [{ label: "Customers", key: "customers" }],
  },
  {
    title: "Expenses",
    icon: Receipt,
    items: [
      { label: "All Expenses", key: "expenses" },
      { label: "Categories", key: "expenses-categories" },
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    items: [{ label: "Reports & Analytics", key: "reports" }],
  },
  {
    title: "Settings",
    icon: Settings,
    items: [
      { label: "Settings", key: "settings" },
      { label: "Integrations", key: "settings-integrations" },
    ],
  },
];

// Module-scoped components (UPDATE-4 rule)
const SectionHeader = ({
  icon: Icon,
  title,
  isOpen,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 transition-colors rounded-lg mx-2 my-1"
  >
    <Icon size={18} className="flex-shrink-0" />
    <span className="flex-1 text-left text-sm font-medium">{title}</span>
    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
  </button>
);

const MenuListItem = ({
  label,
  isActive,
  badge,
  onClick,
}: {
  label: string;
  isActive: boolean;
  badge?: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all rounded-lg mx-2 ${
      isActive
        ? "bg-amber-500/20 text-amber-400 font-medium"
        : "text-gray-400 hover:text-white hover:bg-white/5"
    }`}
  >
    <span>{label}</span>
    {badge && (
      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

const PlaceholderModule = ({ title }: { title: string }) => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Package className="w-8 h-8 text-amber-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
      <p className="text-gray-400 text-sm">Module coming soon</p>
    </div>
  </div>
);

// Real component renderers
const renderModule = (view: ActiveView) => {
  switch (view) {
    case "dashboard":
      return <EnhancedDashboard />;
    case "pos":
      return <AdvancedPOS />;
    case "products":
      return <ProductsManagement />;
    case "inventory-adjustments":
    case "inventory-transfers":
    case "inventory-counts":
    case "inventory-wastage":
      return <InventoryManagement />;
    case "sales":
    case "sales-invoices":
      return <SalesInvoices />;
    case "sales-terminal":
      return <TerminalSessions />;
    case "purchases-orders":
    case "purchases-suppliers":
      return <PurchasesSuppliers />;
    case "customers":
      return <CustomersManagement />;
    case "expenses":
    case "expenses-categories":
      return <ExpensesManagement />;
    case "reports":
      return <ReportsAnalytics />;
    case "settings":
      return <SettingsPanel />;
    case "settings-integrations": {
      const isKenya = isKenyaStation();
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white mb-2">Integrations</h1>
          <p className="text-gray-400 mb-6">
            Connect your business with payment processors.
          </p>
          {isKenya ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <IntegrationCard
                icon={Fuel}
                name="M-PESA"
                type="Payment"
                description="Accept mobile money payments via Safaricom M-PESA."
                status="disconnected"
                onSetup={() => {}}
              />
              <IntegrationCard
                icon={Fuel}
                name="Kopo Kopo"
                type="Payment"
                description="Accept payments via Kopo Kopo till."
                status="disconnected"
                onSetup={() => {}}
              />
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-amber-200">
              <p className="font-semibold">
                Mobile money integrations are region-specific
              </p>
              <p className="text-sm text-amber-300/80 mt-1">
                Safaricom M-PESA and Kopo Kopo are Kenya-specific mobile money
                integrations. Configure payment integrations for your region in
                the Integration Hub (Settings &rarr; Integration Hub).
              </p>
            </div>
          )}
        </div>
      );
    }
    default:
      return <EnhancedDashboard />;
  }
};

const IntegrationCard = ({
  icon: Icon,
  name,
  type,
  description,
  status,
  onSetup,
}: {
  icon: React.ElementType;
  name: string;
  type: string;
  description: string;
  status: "connected" | "disconnected";
  onSetup: () => void;
}) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
          <Icon className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">{name}</h3>
          <span className="text-xs text-gray-400">{type}</span>
        </div>
      </div>
      <span
        className={`text-xs px-2 py-1 rounded-full ${
          status === "connected"
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-gray-500/20 text-gray-400"
        }`}
      >
        {status === "connected" ? "Connected" : "Disconnected"}
      </span>
    </div>
    <p className="text-sm text-gray-400 mb-4">{description}</p>
    <button
      onClick={onSetup}
      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
    >
      Setup
    </button>
  </div>
);

// Main Component
export default function BusinessSuite() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {};
    MENU_STRUCTURE.forEach((section) => {
      initial[section.title] = true;
    });
    return initial;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleMenuItemClick = (key: string) => {
    setActiveView(key as ActiveView);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    return renderModule(activeView);
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Mobile sidebar toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 rounded-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-800/50 backdrop-blur-xl border-r border-white/10 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold">FuelPro</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {MENU_STRUCTURE.map((section) => (
            <div key={section.title} className="mb-2">
              <SectionHeader
                icon={section.icon}
                title={section.title}
                isOpen={expandedSections[section.title]}
                onToggle={() => toggleSection(section.title)}
              />
              {expandedSections[section.title] && (
                <div className="mt-1">
                  {section.items.map((item) => (
                    <MenuListItem
                      key={item.key}
                      label={item.label}
                      badge={item.badge}
                      isActive={activeView === item.key}
                      onClick={() => handleMenuItemClick(item.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <Bell size={18} />
            <span>Notifications</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-sm mt-3">
            <HelpCircle size={18} />
            <span>Help & Support</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-sm mt-3">
            <LogOut size={18} />
            <span>Sign Out</span>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{renderContent()}</main>
    </div>
  );
}
