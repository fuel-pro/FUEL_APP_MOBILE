import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import { useStations } from "@/react-app/context/StationContext";
// Unified pricing - single source of truth for all fuel prices
import { KENYA_BASE_PRICES, DEFAULT_PRICES } from "@/react-app/config/pricing";
// Cross-device cloud storage (Supabase app_kv-backed) — replaces /api/user-data
import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";

// Use unified pricing defaults (Kenya EPRA prices as default)
const DEFAULT_PMS_PRICE = KENYA_BASE_PRICES.petrol; // 220.30 KES
const DEFAULTAGO_PRICE = KENYA_BASE_PRICES.diesel; // 250.01 KES

/**
 * Build the station-scoped compact-blob cloud key. Each station gets its own
 * isolated FuelContext blob so companyData, salesHistory, debtHistory, etc.
 * differ per station. Falls back to the legacy user-scoped key (no station
 * segment) when there is no current station (Combined View, or pre-station
 * migration), preserving backward compatibility.
 */
function compactCloudKey(
  userId: string | undefined,
  stationId: string | undefined,
): string {
  const uid = userId ? `user_${userId}` : "guest";
  return stationId ? `${uid}_${stationId}_compact` : `${uid}_compact`;
}

// Types
export interface Station {
  id: string;
  name: string;
  location?: string;
  createdAt: string;
}

export interface CompanyData {
  name: string;
  poBox: string;
  contacts: string;
  email: string;
  logo: string;
  currency: string;
  bankName: string;
  branchName: string;
  accountHolder: string;
  accountNumber: string;
  // KRA eTIMS/ETR Configuration
  kraPin: string;
  vatRegNo: string;
  physicalAddress: string;
  county: string;
  town: string;
  etrSerialNo: string;
  cuSerialNo: string;
  etrInvoicePrefix: string;
}

export interface DeliveryColumn {
  key: string;
  label: string;
  editable: boolean;
}

export interface DeliveryRow {
  [key: string]: string | number;
  date: string;
  reg: string;
  fuel: string;
  litres: number;
  amount: number;
  name: string;
  debt: number;
}

export interface DeliveryData {
  columns: DeliveryColumn[];
  rows: DeliveryRow[];
  totals: {
    totalSupplied: number;
    totalPayments: number;
    balanceDue: number;
  };
}

export interface InvoiceItem {
  [key: string]: string | number;
  desc: string;
  qty: number;
  price: number;
  total: number;
}

export interface InvoiceSettings {
  quantityLabel: string;
}

export interface Pump {
  [key: string]: string | number;
  id: string;
  openingKsh: number;
  closingKsh: number;
  openingL: number;
  closingL: number;
  salesL: number;
  salesKsh: number;
}

export interface Expense {
  desc: string;
  amount: number;
}

export interface OffloadingRecord {
  id: string;
  date: string;
  time: string;
  truckReg: string;
  driverName: string;
  fuelType: "PMS" | "AGO";
  quantity: number;
  rate: number;
  totalAmount: number;
  supplier: string;
  invoiceNo: string;
  remarks: string;
}

export interface TabVisibility {
  dashboard: boolean;
  delivery: boolean;
  offloading: boolean;
  invoice: boolean;
  debt: boolean;
  sales: boolean;
  reports: boolean;
  mpesa: boolean;
  payroll: boolean;
  data: boolean;
  documents: boolean;
  communication: boolean;
  livetransaction: boolean;
  fuelsalesreport: boolean;
  pos: boolean;
  customers: boolean; // Customer loyalty tab
}

export interface TabConfiguration {
  id: string;
  label: string;
  originalLabel: string;
  description: string;
  order: number;
  visible: boolean;
}

export interface ThemeSettings {
  colorScheme: string;
  customColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface EmployeeData {
  id: string;
  name: string;
  phone: string;
  email: string;
  position: string;
  basicSalary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  paymentMethod: string;
  isActive: boolean;
  dateJoined: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  period: string;
  basicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  netSalary: number;
  paymentStatus: string;
  paymentDate?: string;
  notes?: string;
}

export interface MPESATransaction {
  id: string;
  date: string;
  time: string;
  type: string;
  amount: number;
  reference: string;
  description: string;
  balance: number;
  phoneNumber?: string;
  merchantCode?: string;
}

export interface ReportSettings {
  dateRange: {
    start: string;
    end: string;
  };
  reportType: string;
  includeGraphics: boolean;
  includeTables: boolean;
  customFilters: Record<string, any>;
}

export interface UserPreferences {
  language: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  autoSave: boolean;
  autoBackup: boolean;
}

// Station-specific data structure for multi-station support
export interface StationData {
  companyData: CompanyData;
  pmsPumps: Pump[];
  agoPumps: Pump[];
  pmsTankOpening: number;
  pmsTankClosing: number;
  agoTankOpening: number;
  agoTankClosing: number;
  pmsPrice: number;
  agoPrice: number;
  offloadingRecords: OffloadingRecord[];
  salesHistory: Record<string, any>;
  employees: EmployeeData[];
}

export interface FuelState {
  theme: "light" | "dark";
  themeSettings: ThemeSettings;
  userPreferences: UserPreferences;
  // Multi-station support
  stations: Station[];
  currentStationId: string | null;
  // Station-specific data (keyed by stationId)
  stationData: Record<string, StationData>;
  companyData: CompanyData;
  signatures: {
    manager: string;
    director: string;
  };
  deliveryData: DeliveryData;
  invoiceItems: InvoiceItem[];
  invoiceSettings: InvoiceSettings;
  invoiceCounter: number;
  clients: Record<string, any>;
  invoices: Record<string, any>;
  debtHistory: Record<string, any>;
  salesHistory: Record<string, any>;
  pmsPumps: Pump[];
  agoPumps: Pump[];
  expenses: Expense[];
  tillPayment: number;
  salesDate: string;
  shift: string;
  pmsTankOpening: number;
  pmsTankClosing: number;
  agoTankOpening: number;
  agoTankClosing: number;
  pmsPrice: number;
  agoPrice: number;
  petrolPrice: number;
  dieselPrice: number;
  deliveredTo: string;
  totalOrder: string;
  deliveryYear: number;
  offloadingRecords: OffloadingRecord[];
  tabVisibility: TabVisibility;
  tabConfigurations: TabConfiguration[];
  employees: EmployeeData[];
  payrollRecords: PayrollRecord[];
  mpesaTransactions: MPESATransaction[];
  reportSettings: ReportSettings;
  chatHistory: Array<{
    id: string;
    message: string;
    response: string;
    timestamp: string;
  }>;
  dataBackups: Array<{
    id: string;
    name: string;
    date: string;
    size: string;
    data: any;
  }>;
}

type FuelAction =
  | { type: "SET_THEME"; payload: "light" | "dark" }
  | { type: "SET_THEME_SETTINGS"; payload: ThemeSettings }
  | { type: "SET_USER_PREFERENCES"; payload: UserPreferences }
  | { type: "SET_COMPANY_DATA"; payload: CompanyData }
  | { type: "SET_SIGNATURES"; payload: { manager?: string; director?: string } }
  | { type: "SET_DELIVERY_DATA"; payload: DeliveryData }
  | { type: "SET_INVOICE_ITEMS"; payload: InvoiceItem[] }
  | { type: "SET_INVOICE_SETTINGS"; payload: InvoiceSettings }
  | { type: "SET_INVOICE_COUNTER"; payload: number }
  | { type: "SET_CLIENTS"; payload: Record<string, any> }
  | { type: "SET_INVOICES"; payload: Record<string, any> }
  | { type: "SET_DEBT_HISTORY"; payload: Record<string, any> }
  | { type: "SET_SALES_HISTORY"; payload: Record<string, any> }
  | { type: "SET_PMS_PUMPS"; payload: Pump[] }
  | { type: "SET_AGO_PUMPS"; payload: Pump[] }
  | { type: "SET_EXPENSES"; payload: Expense[] }
  | { type: "SET_TILL_PAYMENT"; payload: number }
  | { type: "SET_SALES_DATE"; payload: string }
  | { type: "SET_SHIFT"; payload: string }
  | {
      type: "SET_TANK_VALUES";
      payload: {
        pmsTankOpening?: number;
        pmsTankClosing?: number;
        agoTankOpening?: number;
        agoTankClosing?: number;
      };
    }
  | {
      type: "SET_PRICES";
      payload: {
        pmsPrice?: number;
        agoPrice?: number;
        petrolPrice?: number;
        dieselPrice?: number;
      };
    }
  | {
      type: "SET_DELIVERY_INFO";
      payload: {
        deliveredTo?: string;
        totalOrder?: string;
        deliveryYear?: number;
      };
    }
  | { type: "SET_OFFLOADING_RECORDS"; payload: OffloadingRecord[] }
  | { type: "SET_TAB_VISIBILITY"; payload: TabVisibility }
  | { type: "SET_TAB_CONFIGURATIONS"; payload: TabConfiguration[] }
  | { type: "SET_EMPLOYEES"; payload: EmployeeData[] }
  | { type: "SET_PAYROLL_RECORDS"; payload: PayrollRecord[] }
  | { type: "SET_MPESA_TRANSACTIONS"; payload: MPESATransaction[] }
  | { type: "SET_REPORT_SETTINGS"; payload: ReportSettings }
  | {
      type: "SET_CHAT_HISTORY";
      payload: Array<{
        id: string;
        message: string;
        response: string;
        timestamp: string;
      }>;
    }
  | {
      type: "SET_DATA_BACKUPS";
      payload: Array<{
        id: string;
        name: string;
        date: string;
        size: string;
        data: any;
      }>;
    }
  | { type: "LOAD_FROM_STORAGE"; payload: Partial<FuelState> }
  // Station management actions
  | { type: "ADD_STATION"; payload: Station }
  | {
      type: "UPDATE_STATION";
      payload: { id: string; name: string; location?: string };
    }
  | { type: "DELETE_STATION"; payload: string }
  | { type: "SET_CURRENT_STATION"; payload: string }
  | { type: "SET_STATIONS"; payload: Station[] };

const initialState: FuelState = {
  theme: "dark",
  themeSettings: {
    colorScheme: "Ocean Blue",
    customColors: {
      primary: "rgb(59, 130, 246)",
      secondary: "rgb(219, 234, 254)",
      accent: "rgb(16, 185, 129)",
    },
  },
  userPreferences: {
    language: "en",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    currency: "KSh",
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    autoSave: true,
    autoBackup: true,
  },
  // Multi-station support - initialize with default station
  stations: [
    {
      id: "default_station",
      name: "Main Station",
      location: "",
      createdAt: new Date().toISOString(),
    },
  ],
  currentStationId: "default_station",
  stationData: {},
  companyData: {
    name: "",
    poBox: "",
    contacts: "",
    email: "",
    logo: "",
    currency: "KSh",
    bankName: "",
    branchName: "",
    accountHolder: "",
    accountNumber: "",
    kraPin: "",
    vatRegNo: "",
    physicalAddress: "",
    county: "",
    town: "",
    etrSerialNo: "",
    cuSerialNo: "",
    etrInvoicePrefix: "INV",
  },
  signatures: {
    manager: "",
    director: "",
  },
  deliveryData: {
    columns: [
      { key: "date", label: "Date", editable: true },
      { key: "reg", label: "Reg No", editable: true },
      { key: "fuel", label: "Fuel Type", editable: true },
      { key: "litres", label: "Litres", editable: true },
      { key: "amount", label: "Amount (Ksh)", editable: true },
      { key: "name", label: "Name", editable: true },
      { key: "debt", label: "Balance/Debt (Ksh)", editable: true },
    ],
    rows: [],
    totals: {
      totalSupplied: 0,
      totalPayments: 0,
      balanceDue: 0,
    },
  },
  invoiceItems: [],
  invoiceSettings: {
    quantityLabel: "Qty (DAYS)",
  },
  invoiceCounter: 1,
  clients: {},
  invoices: {},
  debtHistory: {},
  salesHistory: {},
  pmsPumps: [],
  agoPumps: [],
  expenses: [],
  tillPayment: 0,
  salesDate: new Date().toISOString().split("T")[0],
  shift: "Day",
  pmsTankOpening: 0,
  pmsTankClosing: 0,
  agoTankOpening: 0,
  agoTankClosing: 0,
  pmsPrice: DEFAULT_PMS_PRICE, // 220.30 KES (Kenya EPRA)
  agoPrice: DEFAULTAGO_PRICE, // 250.01 KES (Kenya EPRA)
  petrolPrice: DEFAULT_PMS_PRICE,
  dieselPrice: DEFAULTAGO_PRICE,
  deliveredTo: "",
  totalOrder: "",
  deliveryYear: new Date().getFullYear(), // Auto-set to current year
  offloadingRecords: [],
  tabVisibility: {
    dashboard: true,
    delivery: true,
    offloading: true,
    invoice: true,
    debt: true,
    sales: true,
    reports: true,
    mpesa: true,
    payroll: true,
    data: true,
    documents: true,
    communication: true,
    livetransaction: true,
    fuelsalesreport: true,
    pos: true,
    customers: true, // CRITICAL: Enable loyalty/customers tab
  },
  tabConfigurations: [
    {
      id: "dashboard",
      label: "Dashboard",
      originalLabel: "Dashboard",
      description: "Main overview and statistics",
      order: 0,
      visible: true,
    },
    {
      id: "pos",
      label: "Point of Sale",
      originalLabel: "Point of Sale",
      description: "Quick sales with receipt printing",
      order: 1,
      visible: true,
    },
    {
      id: "sales",
      label: "Sales Tracking",
      originalLabel: "Sales Tracking",
      description: "Monitor pump sales and daily operations",
      order: 2,
      visible: true,
    },
    {
      id: "livetransaction",
      label: "Live Transaction",
      originalLabel: "Live Transaction",
      description: "Real-time payment monitoring",
      order: 3,
      visible: true,
    },
    {
      id: "inventory",
      label: "Inventory",
      originalLabel: "Inventory",
      description: "Track stock levels, manage products",
      order: 4,
      visible: true,
    },
    {
      id: "offloading",
      label: "Fuel Offloading",
      originalLabel: "Fuel Offloading",
      description: "Record fuel received from suppliers",
      order: 5,
      visible: true,
    },
    {
      id: "delivery",
      label: "Delivery Tracker",
      originalLabel: "Delivery Tracker",
      description: "Track fuel deliveries to customers",
      order: 6,
      visible: true,
    },
    {
      id: "invoice",
      label: "Invoice",
      originalLabel: "Invoice",
      description: "Generate & manage customer invoices and sales invoices",
      order: 7,
      visible: true,
    },
    {
      id: "credit",
      label: "Credit",
      originalLabel: "Credit",
      description: "Manage customer credit accounts",
      order: 8,
      visible: true,
    },
    {
      id: "debt",
      label: "Debt Reminder",
      originalLabel: "Debt Reminder",
      description: "Track outstanding customer balances",
      order: 9,
      visible: true,
    },
    {
      id: "mpesa",
      label: "M-PESA Analyzer",
      originalLabel: "M-PESA Analyzer",
      description: "Analyze mobile money transactions",
      order: 10,
      visible: true,
    },
    {
      id: "payroll",
      label: "Payroll System",
      originalLabel: "Payroll System",
      description: "Manage employee payments",
      order: 11,
      visible: true,
    },
    {
      id: "customers",
      label: "Customers",
      originalLabel: "Customers",
      description: "Customer loyalty & rewards program",
      order: 13,
      visible: true,
    },
    {
      id: "fuelsalesreport",
      label: "Fuel Sales Report",
      originalLabel: "Fuel Sales Report",
      description: "Monthly fuel sales reporting",
      order: 15,
      visible: true,
    },
    {
      id: "reports",
      label: "Reports Center",
      originalLabel: "Reports Center",
      description: "Generate business reports and analytics",
      order: 16,
      visible: true,
    },
    {
      id: "analytics",
      label: "Analytics",
      originalLabel: "Analytics",
      description: "Predictions, trends & business intelligence",
      order: 17,
      visible: true,
    },
    {
      id: "audit",
      label: "Audit Trail",
      originalLabel: "Audit Trail",
      description: "Complete activity log for compliance",
      order: 18,
      visible: true,
    },
    {
      id: "communication",
      label: "Communication",
      originalLabel: "Communication",
      description: "Client relationship management",
      order: 19,
      visible: true,
    },
    {
      id: "news",
      label: "News",
      originalLabel: "News",
      description: "Fuel industry news, regulations, and price updates",
      order: 20,
      visible: true,
    },
    {
      id: "data",
      label: "Data Manager",
      originalLabel: "Data Manager",
      description: "Backup, restore & cloud sync",
      order: 21,
      visible: true,
    },
    {
      id: "integration",
      label: "Integration Hub",
      originalLabel: "Integration Hub",
      description:
        "Country-specific integrations & payment setup (M-PESA, Kopo Kopo, KRA, banks)",
      order: 22,
      visible: true,
    },
    {
      id: "regional",
      label: "Compliance",
      originalLabel: "Compliance",
      description:
        "Country-specific regulations & compliance for all 195+ countries",
      order: 23,
      visible: true,
    },
    {
      id: "fueltypes",
      label: "Fuel Type Manager",
      originalLabel: "Fuel Type Manager",
      description:
        "Manage fuel products, pump settings, price board & quality testing",
      order: 24,
      visible: true,
    },
    {
      id: "team",
      label: "Team Manager",
      originalLabel: "Team Manager",
      description: "Invite & manage team access and shift scheduling",
      order: 25,
      visible: true,
    },
    {
      id: "documents",
      label: "Document Center",
      originalLabel: "Document Center",
      description: "Smart document management & format conversion",
      order: 26,
      visible: true,
    },
    {
      id: "suppliers",
      label: "Supplier Management",
      originalLabel: "Supplier Management",
      description: "Manage fuel suppliers, purchase orders & purchases",
      order: 27,
      visible: true,
    },
    {
      id: "maintenance",
      label: "Maintenance",
      originalLabel: "Maintenance",
      description: "Equipment maintenance & servicing schedules",
      order: 28,
      visible: true,
    },
    {
      id: "expenses",
      label: "Expenses",
      originalLabel: "Expenses",
      description: "Track operational expenses & approvals",
      order: 29,
      visible: true,
    },
    {
      id: "pumpmapping",
      label: "Pump Mapping V1",
      originalLabel: "Pump Mapping V1",
      description: "AI-powered pump ledger parsing & extraction",
      order: 31,
      visible: true,
    },
    // ─── SalesZote-style additive POS modules ───
    // New capabilities layered onto the FuelPro tab system (not a replica of
    // app.saleszote.com). Tabs that already exist in FuelPro (POS, Inventory,
    // Customers, Expenses, Reports) are NOT duplicated here.
    {
      id: "products",
      label: "Products Catalog",
      originalLabel: "Products Catalog",
      description:
        "Manage non-fuel products, prices & categories (POS catalog)",
      order: 33,
      visible: true,
    },
    {
      id: "terminal",
      label: "Terminal Sessions",
      originalLabel: "Terminal Sessions",
      description: "POS terminal session open/close & reconciliation",
      order: 36,
      visible: true,
    },
    {
      id: "price-finder",
      label: "Fuel Price Finder",
      originalLabel: "Fuel Price Finder",
      description:
        "GPS-based nearby fuel price locator & auto fuel price comparison",
      order: 37,
      visible: true,
    },
  ],
  employees: [],
  payrollRecords: [],
  mpesaTransactions: [],
  reportSettings: {
    dateRange: {
      start: new Date().toISOString().split("T")[0],
      end: new Date().toISOString().split("T")[0],
    },
    reportType: "daily",
    includeGraphics: true,
    includeTables: true,
    customFilters: {},
  },
  chatHistory: [],
  dataBackups: [],
};

/**
 * Merge two companyData objects so an incoming EMPTY string/zero value never
 * overwrites a non-empty existing value. This prevents a stale cloud/local
 * blob (e.g. one where `name: ""` because it was saved before the field
 * existed) from clobbering a populated in-memory value on reload or station
 * switch. For each field, the incoming value wins ONLY when it is truthy
 * (non-empty/non-zero); otherwise the existing value is kept.
 */
function mergeCompanyData(
  existing: CompanyData,
  incoming?: Partial<CompanyData> | null,
): CompanyData {
  if (!incoming) return { ...existing };
  const merged = { ...existing };
  (Object.keys(incoming) as (keyof CompanyData)[]).forEach((key) => {
    const inc = incoming[key];
    // Always let falsy incoming values fall back to the existing value,
    // EXCEPT `currency` (default "KSh") and `etrInvoicePrefix` (default
    // "INV") which are legitimately short strings we still want to carry.
    if (inc !== undefined && inc !== null && inc !== "") {
      (merged as Record<keyof CompanyData, unknown>)[key] = inc;
    }
  });
  return merged;
}

/**
 * Count how many invoice line items carry REAL content (non-empty
 * description OR non-zero price). Used by LOAD_FROM_STORAGE to decide
 * whether an incoming items blob should overwrite the current in-progress
 * draft: a stale all-empty-items blob (default rows) must not clobber a
 * draft the user is actively editing.
 */
function itemsHaveContent(items?: InvoiceItem[] | null): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.filter(
    (it) => (it.desc && it.desc.trim() !== "") || it.price > 0,
  ).length;
}

function fuelReducer(state: FuelState, action: FuelAction): FuelState {
  switch (action.type) {
    case "SET_THEME":
      return { ...state, theme: action.payload };
    case "SET_THEME_SETTINGS":
      return { ...state, themeSettings: action.payload };
    case "SET_USER_PREFERENCES":
      return { ...state, userPreferences: action.payload };
    case "SET_COMPANY_DATA":
      return { ...state, companyData: action.payload };
    case "SET_SIGNATURES":
      return {
        ...state,
        signatures: { ...state.signatures, ...action.payload },
      };
    case "SET_DELIVERY_DATA":
      return { ...state, deliveryData: action.payload };
    case "SET_INVOICE_ITEMS":
      return { ...state, invoiceItems: action.payload };
    case "SET_INVOICE_SETTINGS":
      return {
        ...state,
        invoiceSettings: { ...state.invoiceSettings, ...action.payload },
      };
    case "SET_INVOICE_COUNTER":
      return { ...state, invoiceCounter: action.payload };
    case "SET_CLIENTS":
      return { ...state, clients: action.payload };
    case "SET_INVOICES":
      return { ...state, invoices: action.payload };
    case "SET_DEBT_HISTORY":
      return { ...state, debtHistory: action.payload };
    case "SET_SALES_HISTORY":
      return { ...state, salesHistory: action.payload };
    case "SET_PMS_PUMPS":
      return { ...state, pmsPumps: action.payload };
    case "SET_AGO_PUMPS":
      return { ...state, agoPumps: action.payload };
    case "SET_EXPENSES":
      return { ...state, expenses: action.payload };
    case "SET_TILL_PAYMENT":
      return { ...state, tillPayment: action.payload };
    case "SET_SALES_DATE":
      return { ...state, salesDate: action.payload };
    case "SET_SHIFT":
      return { ...state, shift: action.payload };
    case "SET_TANK_VALUES":
      return { ...state, ...action.payload };
    case "SET_PRICES":
      return { ...state, ...action.payload };
    case "SET_DELIVERY_INFO":
      return { ...state, ...action.payload };
    case "SET_OFFLOADING_RECORDS":
      return { ...state, offloadingRecords: action.payload };
    case "SET_TAB_VISIBILITY":
      return { ...state, tabVisibility: action.payload };
    case "SET_TAB_CONFIGURATIONS":
      return { ...state, tabConfigurations: action.payload };
    case "SET_EMPLOYEES":
      return { ...state, employees: action.payload };
    case "SET_PAYROLL_RECORDS":
      return { ...state, payrollRecords: action.payload };
    case "SET_MPESA_TRANSACTIONS":
      return { ...state, mpesaTransactions: action.payload };
    case "SET_REPORT_SETTINGS":
      return { ...state, reportSettings: action.payload };
    case "SET_CHAT_HISTORY":
      return { ...state, chatHistory: action.payload };
    case "SET_DATA_BACKUPS":
      return { ...state, dataBackups: action.payload };
    case "LOAD_FROM_STORAGE": {
      // Deep-merge companyData so a logo-less/stale payload cannot clobber a
      // logo-bearing in-memory state (fixes logo disappearing after refresh
      // when localStorage wins the race over cloud with stale data).
      // Additionally, an incoming EMPTY string must NOT overwrite a
      // non-empty in-memory value — this is the root cause of companyData.name
      // (and other text fields) being wiped after reload: a stale blob with
      // name:"" was shallow-merging over a populated name. mergeCompanyData
      // keeps the non-empty (existing OR incoming) value for each field.
      const incoming = action.payload;
      // Protect the in-progress invoice draft (invoiceItems) from being
      // clobbered by a stale all-empty-items blob on reload/real-time echo.
      // The incoming items win ONLY when they carry more real content
      // (non-empty desc OR non-zero price) than the current draft; otherwise
      // keep the current draft so the user's edits survive a reload.
      const incomingItems = incoming.invoiceItems;
      const currentItems = state.invoiceItems;
      const invoiceItems =
        incomingItems &&
        itemsHaveContent(incomingItems) >= itemsHaveContent(currentItems)
          ? incomingItems
          : currentItems;
      return {
        ...state,
        ...incoming,
        companyData: mergeCompanyData(state.companyData, incoming.companyData),
        invoiceItems,
      };
    }
    // Station management
    case "ADD_STATION":
      return {
        ...state,
        stations: [...state.stations, action.payload],
        stationData: {
          ...state.stationData,
          [action.payload.id]: {
            companyData: { ...state.companyData, name: action.payload.name },
            pmsPumps: [],
            agoPumps: [],
            pmsTankOpening: 0,
            pmsTankClosing: 0,
            agoTankOpening: 0,
            agoTankClosing: 0,
            pmsPrice: 0,
            agoPrice: 0,
            offloadingRecords: [],
            salesHistory: {},
            employees: [],
          },
        },
      };
    case "UPDATE_STATION":
      return {
        ...state,
        stations: state.stations.map((s) =>
          s.id === action.payload.id
            ? {
                ...s,
                name: action.payload.name,
                location: action.payload.location || s.location,
              }
            : s,
        ),
      };
    case "DELETE_STATION": {
      const deletedStationData = { ...state.stationData };
      delete deletedStationData[action.payload];
      return {
        ...state,
        stations: state.stations.filter((s) => s.id !== action.payload),
        stationData: deletedStationData,
        currentStationId:
          state.currentStationId === action.payload
            ? state.stations.find((s) => s.id !== action.payload)?.id || null
            : state.currentStationId,
      };
    }
    case "SET_CURRENT_STATION": {
      // Save current station's data before switching
      const savedStationData = state.currentStationId
        ? {
            ...state.stationData,
            [state.currentStationId]: {
              companyData: state.companyData,
              pmsPumps: state.pmsPumps,
              agoPumps: state.agoPumps,
              pmsTankOpening: state.pmsTankOpening,
              pmsTankClosing: state.pmsTankClosing,
              agoTankOpening: state.agoTankOpening,
              agoTankClosing: state.agoTankClosing,
              pmsPrice: state.pmsPrice,
              agoPrice: state.agoPrice,
              offloadingRecords: state.offloadingRecords,
              salesHistory: state.salesHistory,
              employees: state.employees,
            },
          }
        : state.stationData;

      // Load new station's data
      const loadedStation = savedStationData[action.payload];
      if (loadedStation) {
        return {
          ...state,
          currentStationId: action.payload,
          stationData: savedStationData,
          companyData: mergeCompanyData(
            state.companyData,
            loadedStation.companyData,
          ),
          pmsPumps: loadedStation.pmsPumps || [],
          agoPumps: loadedStation.agoPumps || [],
          pmsTankOpening: loadedStation.pmsTankOpening || 0,
          pmsTankClosing: loadedStation.pmsTankClosing || 0,
          agoTankOpening: loadedStation.agoTankOpening || 0,
          agoTankClosing: loadedStation.agoTankClosing || 0,
          pmsPrice: loadedStation.pmsPrice || 0,
          agoPrice: loadedStation.agoPrice || 0,
          offloadingRecords: loadedStation.offloadingRecords || [],
          salesHistory: loadedStation.salesHistory || {},
          employees: loadedStation.employees || [],
        };
      }
      return {
        ...state,
        currentStationId: action.payload,
        stationData: savedStationData,
      };
    }
    case "SET_STATIONS":
      return { ...state, stations: action.payload };
    default:
      return state;
  }
}

interface FuelContextType {
  state: FuelState;
  dispatch: React.Dispatch<FuelAction>;
  saveToStorage: () => void;
  loadFromStorage: () => void;
  saveToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
  isCloudSaving: boolean;
  lastCloudSave: Date | null;
}

const FuelContext = createContext<FuelContextType | undefined>(undefined);

export function FuelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fuelReducer, initialState);
  const { user } = useAuth();
  const { currentStation } = useStations();
  const stationId = currentStation?.id;
  const [isCloudSaving, setIsCloudSaving] = React.useState(false);
  const [lastCloudSave, setLastCloudSave] = React.useState<Date | null>(null);

  // Ref that always points to the latest state, so save/load callbacks can read
  // current state WITHOUT being recreated on every state change. This breaks the
  // save/load race where the load effect (which depended on saveToStorage) re-fired
  // on every edit and overwrote fresh edits with stale localStorage data before the
  // 300ms save debounce could persist them.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Ref that always points to the current station id, so saveToCloud/loadFromCloud
  // (which are memoized on [user]) can scope the compact blob per-station without
  // being recreated on every station switch. Each station gets its own isolated
  // compact blob (companyData, salesHistory, debtHistory, etc.) so a user with
  // multiple stations has independent data per station. Combined View aggregates.
  const stationIdRef = useRef<string | undefined>(stationId);
  useEffect(() => {
    stationIdRef.current = stationId;
  }, [stationId]);

  // CRITICAL: Guards the cross-device cloud-sync race. On login, the
  // aggressive auto-save effect (1500ms) can fire BEFORE loadFromCloud has
  // finished hydrating state from Supabase app_kv. When that happens,
  // saveToCloud overwrites the cloud blob with the default/empty in-memory
  // state, silently WIPING all data entered on another device. This ref
  // blocks saveToCloud until the initial cloud load has completed. It is
  // reset to false whenever the user changes (so each login re-loads).
  const cloudLoadCompleteRef = useRef(false);
  useEffect(() => {
    cloudLoadCompleteRef.current = false;
  }, [user]);

  // Real-time echo guard: set before saveToCloud writes so the real-time
  // subscription knows to skip the echo of our own write.
  const skipRemoteUpdateRef = useRef(false);

  const saveToStorage = useCallback(() => {
    try {
      const s = stateRef.current;
      // Compact storage: single compressed JSON blob, station-scoped so each
      // station's local cache is independent (matches the cloud key).
      const userKey = compactCloudKey(user?.id, stationIdRef.current);

      // Create compact data object with only non-empty values
      const compactData: any = {
        theme: s.theme,
        themeSettings: s.themeSettings,
        userPreferences: s.userPreferences,
      };

      // Only include non-empty data to minimize storage
      // Always save companyData if it exists (even without name, for logo persistence)
      if (s.companyData) compactData.companyData = s.companyData;
      if (s.signatures?.manager || s.signatures?.director)
        compactData.signatures = s.signatures;
      if (s.invoiceCounter > 1) compactData.invoiceCounter = s.invoiceCounter;
      if (Object.keys(s.clients).length > 0) compactData.clients = s.clients;
      if (Object.keys(s.invoices).length > 0) compactData.invoices = s.invoices;
      if (Object.keys(s.debtHistory).length > 0)
        compactData.debtHistory = s.debtHistory;
      if (Object.keys(s.salesHistory).length > 0)
        compactData.salesHistory = s.salesHistory;
      if (s.deliveryData?.rows?.length > 0)
        compactData.deliveryData = s.deliveryData;
      if (s.invoiceItems?.length > 0) compactData.invoiceItems = s.invoiceItems;
      // Always save invoiceSettings — the old "!== Qty (DAYS)" conditional caused
      // the label to be dropped from storage, then the load effect overwrote the
      // user's custom label with the default on every state change.
      compactData.invoiceSettings = s.invoiceSettings;
      if (s.tillPayment !== 0) compactData.tillPayment = s.tillPayment;
      if (s.pmsPumps?.length > 0) compactData.pmsPumps = s.pmsPumps;
      if (s.agoPumps?.length > 0) compactData.agoPumps = s.agoPumps;
      if (s.expenses?.length > 0) compactData.expenses = s.expenses;
      if (s.salesDate !== new Date().toISOString().split("T")[0])
        compactData.salesDate = s.salesDate;
      if (s.shift !== "Day") compactData.shift = s.shift;
      if (s.pmsTankOpening !== 0) compactData.pmsTankOpening = s.pmsTankOpening;
      if (s.pmsTankClosing !== 0) compactData.pmsTankClosing = s.pmsTankClosing;
      if (s.agoTankOpening !== 0) compactData.agoTankOpening = s.agoTankOpening;
      if (s.agoTankClosing !== 0) compactData.agoTankClosing = s.agoTankClosing;
      if (s.pmsPrice !== DEFAULT_PMS_PRICE) compactData.pmsPrice = s.pmsPrice;
      if (s.agoPrice !== DEFAULTAGO_PRICE) compactData.agoPrice = s.agoPrice;
      if (s.petrolPrice !== DEFAULT_PMS_PRICE)
        compactData.petrolPrice = s.petrolPrice;
      if (s.dieselPrice !== DEFAULTAGO_PRICE)
        compactData.dieselPrice = s.dieselPrice;
      if (s.deliveredTo) compactData.deliveredTo = s.deliveredTo;
      if (s.totalOrder) compactData.totalOrder = s.totalOrder;
      if (s.deliveryYear !== initialState.deliveryYear)
        compactData.deliveryYear = s.deliveryYear;
      if (s.offloadingRecords?.length > 0)
        compactData.offloadingRecords = s.offloadingRecords;
      if (
        JSON.stringify(s.tabVisibility) !==
        JSON.stringify(initialState.tabVisibility)
      )
        compactData.tabVisibility = s.tabVisibility;
      if (
        s.tabConfigurations?.some(
          (t) => t.label !== t.originalLabel || !t.visible,
        )
      )
        compactData.tabConfigurations = s.tabConfigurations;
      if (s.employees?.length > 0) compactData.employees = s.employees;
      if (s.payrollRecords?.length > 0)
        compactData.payrollRecords = s.payrollRecords;
      if (s.mpesaTransactions?.length > 0)
        compactData.mpesaTransactions = s.mpesaTransactions;
      // Multi-station support - always save station data
      if (s.stations?.length > 0) compactData.stations = s.stations;
      if (s.currentStationId) compactData.currentStationId = s.currentStationId;
      if (Object.keys(s.stationData || {}).length > 0)
        compactData.stationData = s.stationData;
      if (
        JSON.stringify(s.reportSettings) !==
        JSON.stringify(initialState.reportSettings)
      )
        compactData.reportSettings = s.reportSettings;
      if (s.chatHistory?.length > 0)
        compactData.chatHistory = s.chatHistory.slice(-50); // Keep only last 50 messages
      if (s.dataBackups?.length > 0)
        compactData.dataBackups = s.dataBackups.slice(-5); // Keep only last 5 backups

      // Save as single compressed JSON string
      localStorage.setItem(userKey, JSON.stringify(compactData));

      // CRITICAL: Always save companyData to individual key for logo persistence
      // This ensures logo survives even if compact storage has issues
      if (s.companyData) {
        localStorage.setItem(
          `${userKey}companyData`,
          JSON.stringify(s.companyData),
        );
      }

      // Clean up old individual keys EXCEPT companyData (keep for logo backup)
      const oldUserKey = user?.id ? `user_${user.id}_` : "guest_";
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(oldUserKey) && !key.endsWith("companyData")) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }, [user]);

  // Cloud storage with compression
  const saveToCloud = useCallback(async () => {
    if (!user) return;
    // Block cloud saves until the initial cloud load has completed. Without
    // this, the auto-save effect (1500ms) races ahead of loadFromCloud and
    // overwrites the cloud blob with default/empty state, destroying all
    // data entered on another device.
    if (!cloudLoadCompleteRef.current) {
      console.log(
        "[FuelContext] Skipping cloud save — initial cloud load not yet complete",
      );
      return;
    }

    try {
      setIsCloudSaving(true);

      const s = stateRef.current;
      // Create compact data object (same as localStorage logic)
      const compactData: any = {
        theme: s.theme,
        themeSettings: s.themeSettings,
        userPreferences: s.userPreferences,
      };

      // Only include non-default/non-empty values for maximum compression
      // Always save companyData if it exists (even without name, for logo persistence)
      if (s.companyData) compactData.companyData = s.companyData;
      if (s.signatures?.manager || s.signatures?.director)
        compactData.signatures = s.signatures;
      if (s.invoiceCounter > 1) compactData.invoiceCounter = s.invoiceCounter;
      if (Object.keys(s.clients).length > 0) compactData.clients = s.clients;
      if (Object.keys(s.invoices).length > 0) compactData.invoices = s.invoices;
      if (Object.keys(s.debtHistory).length > 0)
        compactData.debtHistory = s.debtHistory;
      if (Object.keys(s.salesHistory).length > 0)
        compactData.salesHistory = s.salesHistory;
      if (s.deliveryData?.rows?.length > 0)
        compactData.deliveryData = s.deliveryData;
      if (s.invoiceItems?.length > 0) compactData.invoiceItems = s.invoiceItems;
      // Always save invoiceSettings (see saveToStorage comment).
      compactData.invoiceSettings = s.invoiceSettings;
      if (s.tillPayment !== 0) compactData.tillPayment = s.tillPayment;
      if (s.pmsPumps?.length > 0) compactData.pmsPumps = s.pmsPumps;
      if (s.agoPumps?.length > 0) compactData.agoPumps = s.agoPumps;
      if (s.expenses?.length > 0) compactData.expenses = s.expenses;
      if (s.salesDate !== new Date().toISOString().split("T")[0])
        compactData.salesDate = s.salesDate;
      if (s.shift !== "Day") compactData.shift = s.shift;
      if (s.pmsTankOpening !== 0) compactData.pmsTankOpening = s.pmsTankOpening;
      if (s.pmsTankClosing !== 0) compactData.pmsTankClosing = s.pmsTankClosing;
      if (s.agoTankOpening !== 0) compactData.agoTankOpening = s.agoTankOpening;
      if (s.agoTankClosing !== 0) compactData.agoTankClosing = s.agoTankClosing;
      if (s.pmsPrice !== DEFAULT_PMS_PRICE) compactData.pmsPrice = s.pmsPrice;
      if (s.agoPrice !== DEFAULTAGO_PRICE) compactData.agoPrice = s.agoPrice;
      if (s.petrolPrice !== DEFAULT_PMS_PRICE)
        compactData.petrolPrice = s.petrolPrice;
      if (s.dieselPrice !== DEFAULTAGO_PRICE)
        compactData.dieselPrice = s.dieselPrice;
      if (s.deliveredTo) compactData.deliveredTo = s.deliveredTo;
      if (s.totalOrder) compactData.totalOrder = s.totalOrder;
      if (s.deliveryYear !== initialState.deliveryYear)
        compactData.deliveryYear = s.deliveryYear;
      if (s.offloadingRecords?.length > 0)
        compactData.offloadingRecords = s.offloadingRecords;
      if (
        JSON.stringify(s.tabVisibility) !==
        JSON.stringify(initialState.tabVisibility)
      )
        compactData.tabVisibility = s.tabVisibility;
      if (
        s.tabConfigurations?.some(
          (t) => t.label !== t.originalLabel || !t.visible,
        )
      )
        compactData.tabConfigurations = s.tabConfigurations;
      if (s.employees?.length > 0) compactData.employees = s.employees;
      if (s.payrollRecords?.length > 0)
        compactData.payrollRecords = s.payrollRecords;
      if (s.mpesaTransactions?.length > 0)
        compactData.mpesaTransactions = s.mpesaTransactions.slice(-100); // Keep only last 100 transactions
      // Multi-station support - always save station data
      if (s.stations?.length > 0) compactData.stations = s.stations;
      if (s.currentStationId) compactData.currentStationId = s.currentStationId;
      if (Object.keys(s.stationData || {}).length > 0)
        compactData.stationData = s.stationData;
      if (
        JSON.stringify(s.reportSettings) !==
        JSON.stringify(initialState.reportSettings)
      )
        compactData.reportSettings = s.reportSettings;
      if (s.chatHistory?.length > 0)
        compactData.chatHistory = s.chatHistory.slice(-50); // Keep only last 50 messages
      if (s.dataBackups?.length > 0)
        compactData.dataBackups = s.dataBackups.slice(-3); // Keep only last 3 backups in cloud

      // Persist to Supabase app_kv (cross-device). Keyed per-user + per-station
      // so each station has its own isolated FuelContext blob (companyData,
      // salesHistory, debtHistory, etc.). RLS-protected by owner_id. localStorage
      // remains a read-through cache via saveToStorage for offline reads.
      const cloudKey = compactCloudKey(user?.id, stationIdRef.current);
      // Set the echo-skip flag so the real-time subscription doesn't
      // re-dispatch our own write as if it came from another device.
      skipRemoteUpdateRef.current = true;
      await cloudStorageService.set(
        cloudKey,
        compactData,
        stationIdRef.current,
      );

      setLastCloudSave(new Date());

      // Calculate and log storage savings
      const fullSize = JSON.stringify(s).length;
      const compactSize = JSON.stringify(compactData).length;
      const savings = ((1 - compactSize / fullSize) * 100).toFixed(1);
      console.log(`Compact data saved to cloud (${savings}% smaller)`);
    } catch (error) {
      console.error("Error saving to cloud:", error);
    } finally {
      setIsCloudSaving(false);
    }
  }, [user]);

  const loadFromCloud = useCallback(async () => {
    if (!user) return;

    try {
      // Read the station-scoped compact data blob from Supabase app_kv
      // (cross-device). Each station has its own blob. Falls back to the
      // legacy user-scoped blob (and then legacy bare-key) via
      // cloudStorageService.get so existing data migrates transparently on
      // first read. localStorage is only a read-through cache.
      const cloudKey = compactCloudKey(user.id, stationIdRef.current);
      const compactData = (await cloudStorageService.get<
        Record<string, unknown>
      >(cloudKey, stationIdRef.current)) as Record<string, unknown> | null;

      if (compactData && Object.keys(compactData).length > 0) {
        // Validate that the loaded data has meaningful content
        const cd = compactData as any;
        const hasData =
          cd.companyData?.name ||
          cd.companyData?.logo ||
          (cd.deliveryData?.rows && cd.deliveryData.rows.length > 0) ||
          (cd.invoiceItems && cd.invoiceItems.length > 0) ||
          (cd.pmsPumps && cd.pmsPumps.length > 0) ||
          (cd.agoPumps && cd.agoPumps.length > 0) ||
          (cd.stations && cd.stations.length > 0);

        if (hasData || cd.theme || cd.tabConfigurations) {
          dispatch({ type: "LOAD_FROM_STORAGE", payload: cd });
          console.log("Data loaded from cloud (Supabase) successfully");
        } else {
          console.log("Cloud data appears empty, keeping current state");
        }
      } else {
        console.log("No data found in cloud storage");
      }
    } catch (error) {
      console.error("Error loading from cloud:", error);
      // Re-throw so the caller can fall back to loadFromStorage.
      throw error;
    }
  }, [user]);

  const loadFromStorage = useCallback(() => {
    try {
      const userKey = compactCloudKey(user?.id, stationIdRef.current);

      // Try loading from compact storage first
      const compactData = localStorage.getItem(userKey);

      if (compactData) {
        // Load from compact JSON blob
        const parsed = JSON.parse(compactData);

        // CRITICAL: Always check individual companyData key for logo (more reliable)
        const individualCompanyData = localStorage.getItem(
          `${userKey}companyData`,
        );
        if (individualCompanyData) {
          parsed.companyData = JSON.parse(individualCompanyData);
        }

        const loadedData: Partial<FuelState> = {
          ...initialState, // Start with defaults
          ...parsed, // Overlay saved values
        };
        dispatch({ type: "LOAD_FROM_STORAGE", payload: loadedData });
      } else {
        // Fallback to old individual keys for backward compatibility
        const oldUserKey = user?.id ? `user_${user.id}_` : "guest_";

        const savedTheme =
          (localStorage.getItem(`${oldUserKey}theme`) as "light" | "dark") ||
          "dark";
        const savedThemeSettings = localStorage.getItem(
          `${oldUserKey}themeSettings`,
        );
        const savedUserPreferences = localStorage.getItem(
          `${oldUserKey}userPreferences`,
        );
        const savedCompany = localStorage.getItem(`${oldUserKey}companyData`);
        const savedSignatures = localStorage.getItem(`${oldUserKey}signatures`);
        const savedInvoiceCounter = localStorage.getItem(
          `${oldUserKey}invoiceCounter`,
        );
        const savedClients = localStorage.getItem(`${oldUserKey}clients`);
        const savedInvoices = localStorage.getItem(`${oldUserKey}invoices`);
        const savedDebtHistory = localStorage.getItem(
          `${oldUserKey}debtHistory`,
        );
        const savedSalesHistory = localStorage.getItem(
          `${oldUserKey}salesHistory`,
        );
        const savedDelivery = localStorage.getItem(
          `${oldUserKey}fuelDeliveryData`,
        );
        const savedInvoiceItems = localStorage.getItem(
          `${oldUserKey}invoiceItems`,
        );
        const savedInvoiceSettings = localStorage.getItem(
          `${oldUserKey}invoiceSettings`,
        );
        const savedTillPayment = localStorage.getItem(
          `${oldUserKey}tillPayment`,
        );
        const savedPmsPumps = localStorage.getItem(
          `${oldUserKey}fuelPumps_pms`,
        );
        const savedAgoPumps = localStorage.getItem(
          `${oldUserKey}fuelPumps_ago`,
        );
        const savedExpenses = localStorage.getItem(`${oldUserKey}fuelExpenses`);
        const savedSalesDate = localStorage.getItem(`${oldUserKey}salesDate`);
        const savedShift = localStorage.getItem(`${oldUserKey}shift`);
        const savedPmsTankOpening = localStorage.getItem(
          `${oldUserKey}pmsTankOpening`,
        );
        const savedPmsTankClosing = localStorage.getItem(
          `${oldUserKey}pmsTankClosing`,
        );
        const savedAgoTankOpening = localStorage.getItem(
          `${oldUserKey}agoTankOpening`,
        );
        const savedAgoTankClosing = localStorage.getItem(
          `${oldUserKey}agoTankClosing`,
        );
        const savedPmsPrice = localStorage.getItem(`${oldUserKey}pmsPrice`);
        const savedAgoPrice = localStorage.getItem(`${oldUserKey}agoPrice`);
        const savedPetrolPrice = localStorage.getItem(
          `${oldUserKey}petrolPrice`,
        );
        const savedDieselPrice = localStorage.getItem(
          `${oldUserKey}dieselPrice`,
        );
        const savedDeliveredTo = localStorage.getItem(
          `${oldUserKey}deliveredTo`,
        );
        const savedTotalOrder = localStorage.getItem(`${oldUserKey}totalOrder`);
        const savedDeliveryYear = localStorage.getItem(
          `${oldUserKey}deliveryYear`,
        );
        const savedOffloadingRecords = localStorage.getItem(
          `${oldUserKey}offloadingRecords`,
        );
        const savedTabVisibility = localStorage.getItem(
          `${oldUserKey}tabVisibility`,
        );
        const savedTabConfigurations = localStorage.getItem(
          `${oldUserKey}tabConfigurations`,
        );
        const savedEmployees = localStorage.getItem(`${oldUserKey}employees`);
        const savedPayrollRecords = localStorage.getItem(
          `${oldUserKey}payrollRecords`,
        );
        const savedMpesaTransactions = localStorage.getItem(
          `${oldUserKey}mpesaTransactions`,
        );
        const savedReportSettings = localStorage.getItem(
          `${oldUserKey}reportSettings`,
        );
        const savedChatHistory = localStorage.getItem(
          `${oldUserKey}chatHistory`,
        );
        const savedDataBackups = localStorage.getItem(
          `${oldUserKey}dataBackups`,
        );

        const loadedData: Partial<FuelState> = {
          theme: savedTheme,
          themeSettings: savedThemeSettings
            ? JSON.parse(savedThemeSettings)
            : initialState.themeSettings,
          userPreferences: savedUserPreferences
            ? JSON.parse(savedUserPreferences)
            : initialState.userPreferences,
          companyData: savedCompany
            ? JSON.parse(savedCompany)
            : initialState.companyData,
          signatures: savedSignatures
            ? JSON.parse(savedSignatures)
            : initialState.signatures,
          invoiceCounter: savedInvoiceCounter
            ? parseInt(savedInvoiceCounter)
            : initialState.invoiceCounter,
          clients: savedClients
            ? JSON.parse(savedClients)
            : initialState.clients,
          invoices: savedInvoices
            ? JSON.parse(savedInvoices)
            : initialState.invoices,
          debtHistory: savedDebtHistory
            ? JSON.parse(savedDebtHistory)
            : initialState.debtHistory,
          salesHistory: savedSalesHistory
            ? JSON.parse(savedSalesHistory)
            : initialState.salesHistory,
          deliveryData: savedDelivery
            ? JSON.parse(savedDelivery)
            : initialState.deliveryData,
          invoiceItems: savedInvoiceItems
            ? JSON.parse(savedInvoiceItems)
            : initialState.invoiceItems,
          invoiceSettings: savedInvoiceSettings
            ? JSON.parse(savedInvoiceSettings)
            : initialState.invoiceSettings,
          tillPayment: savedTillPayment
            ? parseFloat(savedTillPayment)
            : initialState.tillPayment,
          pmsPumps: savedPmsPumps
            ? JSON.parse(savedPmsPumps)
            : initialState.pmsPumps,
          agoPumps: savedAgoPumps
            ? JSON.parse(savedAgoPumps)
            : initialState.agoPumps,
          expenses: savedExpenses
            ? JSON.parse(savedExpenses)
            : initialState.expenses,
          salesDate: savedSalesDate || initialState.salesDate,
          shift: savedShift || initialState.shift,
          pmsTankOpening: savedPmsTankOpening
            ? parseFloat(savedPmsTankOpening)
            : initialState.pmsTankOpening,
          pmsTankClosing: savedPmsTankClosing
            ? parseFloat(savedPmsTankClosing)
            : initialState.pmsTankClosing,
          agoTankOpening: savedAgoTankOpening
            ? parseFloat(savedAgoTankOpening)
            : initialState.agoTankOpening,
          agoTankClosing: savedAgoTankClosing
            ? parseFloat(savedAgoTankClosing)
            : initialState.agoTankClosing,
          pmsPrice: savedPmsPrice
            ? parseFloat(savedPmsPrice)
            : initialState.pmsPrice,
          agoPrice: savedAgoPrice
            ? parseFloat(savedAgoPrice)
            : initialState.agoPrice,
          petrolPrice: savedPetrolPrice
            ? parseFloat(savedPetrolPrice)
            : initialState.petrolPrice,
          dieselPrice: savedDieselPrice
            ? parseFloat(savedDieselPrice)
            : initialState.dieselPrice,
          deliveredTo: savedDeliveredTo || initialState.deliveredTo,
          totalOrder: savedTotalOrder || initialState.totalOrder,
          deliveryYear: savedDeliveryYear
            ? parseInt(savedDeliveryYear)
            : initialState.deliveryYear,
          offloadingRecords: savedOffloadingRecords
            ? JSON.parse(savedOffloadingRecords)
            : initialState.offloadingRecords,
          tabVisibility: savedTabVisibility
            ? JSON.parse(savedTabVisibility)
            : initialState.tabVisibility,
          tabConfigurations: savedTabConfigurations
            ? JSON.parse(savedTabConfigurations)
            : initialState.tabConfigurations,
          employees: savedEmployees
            ? JSON.parse(savedEmployees)
            : initialState.employees,
          payrollRecords: savedPayrollRecords
            ? JSON.parse(savedPayrollRecords)
            : initialState.payrollRecords,
          mpesaTransactions: savedMpesaTransactions
            ? JSON.parse(savedMpesaTransactions)
            : initialState.mpesaTransactions,
          reportSettings: savedReportSettings
            ? JSON.parse(savedReportSettings)
            : initialState.reportSettings,
          chatHistory: savedChatHistory
            ? JSON.parse(savedChatHistory)
            : initialState.chatHistory,
          dataBackups: savedDataBackups
            ? JSON.parse(savedDataBackups)
            : initialState.dataBackups,
        };

        dispatch({ type: "LOAD_FROM_STORAGE", payload: loadedData });
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
    }
  }, [user]);

  // INSTANT LOCAL AUTO-SAVE - saves to browser storage immediately for zero data loss
  useEffect(() => {
    // Save to localStorage on EVERY state change with minimal debounce
    const timeoutId = setTimeout(() => {
      saveToStorage(); // Always save, even empty states
    }, 300); // Reduced to 300ms for near-instant local saves

    return () => clearTimeout(timeoutId);
  }, [state]);

  // AGGRESSIVE AUTO-SAVE to cloud - ensures all business data is always saved
  useEffect(() => {
    if (!user) return;

    // Immediate cloud save on ANY data change (with short debounce to batch rapid changes)
    const immediateCloudSave = setTimeout(() => {
      // Save to cloud for ANY state change (including empty states to sync deletions)
      saveToCloud();
    }, 1500); // Reduced to 1.5 seconds for faster cloud sync

    // Frequent periodic saves every 15 seconds for maximum reliability
    const cloudSaveInterval = setInterval(() => {
      saveToCloud();
    }, 15000); // Save every 15 seconds regardless of changes

    return () => {
      clearTimeout(immediateCloudSave);
      clearInterval(cloudSaveInterval);
    };
  }, [user, state]);

  // Load data on mount AND when user changes.
  // Cloud (Supabase app_kv) is the source of truth — it is always consulted so
  // that data entered on another device/browser is reflected here. localStorage
  // is only a read-through cache (per cloud-storage-service.ts) and is used as a
  // fallback when the network/auth is unavailable. Previously this effect skipped
  // loadFromCloud whenever localStorage had data, which meant a refresh on the
  // SAME browser never pulled the latest cloud state — so a logo (or any field)
  // updated elsewhere vanished. It also broke cross-device sync entirely.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      // First, hydrate instantly from the local cache so the UI is never blank.
      loadFromStorage();

      if (user) {
        try {
          await loadFromCloud();
          if (!cancelled) {
            // Mirror the freshly-loaded cloud state into the local cache so the
            // next mount is instant and offline-capable.
            saveToStorage();
          }
        } catch (error) {
          console.warn("Failed to load from cloud, using local cache:", error);
        } finally {
          // Unblock cloud saves. Whether loadFromCloud succeeded, found no
          // data, or failed, the initial cloud consultation is now done and
          // subsequent saves are legitimate user edits (not default-state
          // overwrites). Without this, the auto-save effect would keep
          // skipping forever and real edits would never sync.
          if (!cancelled) cloudLoadCompleteRef.current = true;
        }
      }
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, loadFromCloud, loadFromStorage, saveToStorage]);

  // CRITICAL: Reload cloud data when the current station changes. Each station
  // has its own isolated FuelContext blob (companyData, salesHistory,
  // debtHistory, etc.). Without this, switching stations keeps the previous
  // station's data in memory, so edits bleed across stations. We:
  // 1. Block saves (cloudLoadCompleteRef = false) so the auto-save effect
  //    can't overwrite the new station's cloud blob with the old station's
  //    in-memory state during the ~200-500ms load window.
  // 2. Load the new station's blob from cloud (falling back to localStorage
  //    cache, then defaults).
  // 3. Unblock saves in finally.
  // We skip the very first run (the mount effect above handles it) by tracking
  // whether a station was previously selected.
  const prevStationRef = useRef<string | undefined>(stationId);
  useEffect(() => {
    // Only react to an actual station CHANGE, not the initial mount.
    if (prevStationRef.current === stationId) return;
    prevStationRef.current = stationId;

    if (!user) return;

    let cancelled = false;
    // Block saves until the new station's data is loaded.
    cloudLoadCompleteRef.current = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      loadFromStorage();
      try {
        await loadFromCloud();
        if (!cancelled) saveToStorage();
      } catch (error) {
        console.warn("Failed to load station cloud data:", error);
      } finally {
        if (!cancelled) cloudLoadCompleteRef.current = true;
      }
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, stationId, loadFromCloud, loadFromStorage, saveToStorage]);

  // REAL-TIME cross-device sync: subscribe to postgres_changes on the compact
  // blob. When another device/browser writes to the same app_kv row (e.g. the
  // user edits company data on their phone), this subscription fires INSTANTLY
  // and dispatches LOAD_FROM_STORAGE so the new data is reflected here with
  // zero delay — no polling, no reload required.
  //
  // A `skipRemoteUpdateRef` guard prevents echo: when THIS device writes, the
  // real-time event comes back to us. We skip it because saveToCloud already
  // updated local state synchronously.
  useEffect(() => {
    if (!user || !stationId) return;

    const cloudKey = compactCloudKey(user.id, stationId);
    const unsub = cloudStorageService.subscribe<Record<string, unknown>>(
      cloudKey,
      stationId,
      (value) => {
        // Skip our own echo.
        if (skipRemoteUpdateRef.current) {
          skipRemoteUpdateRef.current = false;
          return;
        }
        if (value && Object.keys(value).length > 0) {
          const cd = value as any;
          const hasData =
            cd.companyData?.name ||
            cd.companyData?.logo ||
            (cd.deliveryData?.rows && cd.deliveryData.rows.length > 0) ||
            (cd.invoiceItems && cd.invoiceItems.length > 0) ||
            (cd.pmsPumps && cd.pmsPumps.length > 0) ||
            (cd.agoPumps && cd.agoPumps.length > 0) ||
            (cd.stations && cd.stations.length > 0);
          if (hasData || cd.theme || cd.tabConfigurations) {
            dispatch({ type: "LOAD_FROM_STORAGE", payload: cd });
          }
        }
      },
    );

    return () => unsub();
  }, [user, stationId]);

  // Apply theme to body - robust for all browsers
  useEffect(() => {
    try {
      const isDark = state.theme === "dark";
      const html = document.documentElement;
      const body = document.body;

      if (isDark) {
        html.classList.add("dark");
        html.classList.remove("light");
        html.setAttribute("data-theme", "dark");
        body?.classList?.add("dark-mode");
        body?.classList?.remove("light-mode");
        body.style.colorScheme = "dark";
      } else {
        html.classList.remove("dark");
        html.classList.add("light");
        html.setAttribute("data-theme", "light");
        body?.classList?.remove("dark-mode");
        body?.classList?.add("light-mode");
        body.style.colorScheme = "light";
      }
    } catch {
      // DOM not ready
    }
  }, [state.theme]);

  return (
    <FuelContext.Provider
      value={{
        state,
        dispatch,
        saveToStorage,
        loadFromStorage,
        saveToCloud,
        loadFromCloud,
        isCloudSaving,
        lastCloudSave,
      }}
    >
      {children}
    </FuelContext.Provider>
  );
}

export function useFuel() {
  const context = useContext(FuelContext);
  if (context === undefined) {
    throw new Error("useFuel must be used within a FuelProvider");
  }
  return context;
}
