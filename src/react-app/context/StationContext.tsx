import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { getCountryByCode } from "@/react-app/lib/world-country-utils";

// Lazy API base URL getter using dynamic import to avoid circular deps
let _apiBase: string | null = null;
let _apiPromise: Promise<string> | null = null;
function getApiBase(): string {
  if (_apiBase) return _apiBase;
  return "https://fuel-pro-backend-v2-production-7c2b.up.railway.app";
}
async function getApiBaseAsync(): Promise<string> {
  if (_apiBase) return _apiBase;
  if (!_apiPromise) {
    _apiPromise = import("@/utils/apiConfig").then(m => m.getBackendUrl());
  }
  _apiBase = await _apiPromise;
  return _apiBase;
}

// Encryption helper for sensitive data
const encrypt = (text: string, key: string): string => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + key);
    let hash = "";
    for (let i = 0; i < data.length; i++) {
      hash += String.fromCharCode(data[i] ^ key.charCodeAt(i % key.length));
    }
    return btoa(hash);
  } catch {
    return btoa(text);
  }
};

const decrypt = (encoded: string, key: string): string => {
  try {
    const hash = atob(encoded);
    const data = new Uint8Array(hash.length);
    for (let i = 0; i < hash.length; i++) {
      data[i] = hash.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    }
    const decoder = new TextDecoder();
    const result = decoder.decode(data);
    return result.substring(0, result.length - key.length);
  } catch {
    return atob(encoded);
  }
};

const STORAGE_KEY = "fuelpro_stations_v3";
const ADMIN_KEY = "fuelpro_admin_v3";
const SESSION_KEY = "fuelpro_session_v3";
const CURRENT_STATION_KEY = "fuelpro_current_station_v3";
const ACCESS_LOG_KEY = "fuelpro_access_log_v3";
const BACKEND_SYNC_KEY = "fuelpro_backend_synced";
const BACKEND_SYNC_TIMESTAMP = "fuelpro_backend_sync_time";

export interface StationAccess {
  username: string;
  passwordHash: string; // encrypted
  role: "owner" | "shared";
  permissions: string[];
  grantedAt: string;
  grantedBy: string;
}

export interface Station {
  id: string;
  name: string;
  location: string;
  phone: string;
  email: string;
  kraPin: string;
  etrSerial: string;
  taxRate: number;
  theme: string;
  logo: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  data: any; // station-specific fuel data
  access: StationAccess[];
  sharedUsers: {
    email: string;
    stationId: string;
    accessKey: string;
    grantedAt: string;
  }[];
  // Backend sync fields (optional)
  backendId?: number;
  userRole?: string;
}

export interface AdminSettings {
  adminUsername: string;
  adminPasswordHash: string;
  secretKey: string;
  apiKeys: Record<string, string>;
  tabConfig: Record<
    string,
    { label: string; icon: string; enabled: boolean; order: number }
  >;
  systemConfig: {
    enableSync: boolean;
    enableCloudBackup: boolean;
    enableAutoReports: boolean;
    enableKRAIntegration: boolean;
    enableWhatsApp: boolean;
    enableEmail: boolean;
    enableAI: boolean;
    currency: string;
    language: string;
  };
  updateHistory: UpdateRecord[];
}

export interface UpdateRecord {
  id: string;
  type: "settings" | "files" | "api_keys" | "tabs" | "system";
  description: string;
  changes: any;
  timestamp: string;
  reverted?: boolean;
  revertedAt?: string;
}

export interface AccessLog {
  id: string;
  stationId: string;
  user: string;
  action: string;
  timestamp: string;
  ip?: string;
}

interface StationContextType {
  stations: Station[];
  currentStation: Station | null;
  isAdmin: boolean;
  adminSettings: AdminSettings;
  isStationLoading: boolean;
  isBackendSyncing: boolean;
  lastBackendSync: number | null;
  // Station CRUD
  createStation: (station: Partial<Station>) => Station;
  updateStation: (id: string, data: Partial<Station>) => void;
  deleteStation: (id: string) => void;
  switchStation: (id: string) => void;
  combineStations: () => { data: any; stations: Station[] } | null;
  // Station Access
  shareStation: (stationId: string, email: string, password: string) => void;
  revokeAccess: (stationId: string, email: string) => void;
  verifyStationAccess: (stationId: string, password: string) => boolean;
  changeStationPassword: (stationId: string, newPassword: string) => void;
  // Admin
  loginAdmin: (username: string, password: string) => boolean;
  logoutAdmin: () => void;
  updateAdminPassword: (
    currentPassword: string,
    newPassword: string
  ) => boolean;
  updateAdminSettings: (settings: Partial<AdminSettings>) => void;
  addUpdateRecord: (record: Omit<UpdateRecord, "id" | "timestamp">) => void;
  revertUpdate: (updateId: string) => void;
  updateTabConfig: (
    tabId: string,
    config: Partial<AdminSettings["tabConfig"][string]>
  ) => void;
  updateApiKey: (keyName: string, value: string) => void;
  // Access Log
  addAccessLog: (stationId: string, action: string) => void;
  getAccessLogs: (stationId?: string) => AccessLog[];
  // Utils
  getStationData: (stationId: string) => any;
  saveStationData: (stationId: string, data: any) => void;
  exportAllData: () => string;
  importAllData: (json: string) => void;
  encryptSensitive: (text: string) => string;
  decryptSensitive: (encoded: string) => string;
  // Backend Sync (cross-device consistency)
  syncFromBackend: () => Promise<void>;
  syncToBackend: () => Promise<void>;
  hasBackendData: boolean;
}

const defaultAdminSettings: AdminSettings = {
  adminUsername: "ADMIN",
  adminPasswordHash: encrypt("fuelpro2026", "fuelpro_secret_key_2026"),
  secretKey: "fuelpro_secret_key_2026",
  apiKeys: {
    kra_etims: "",
    mpesa_api: "",
    email_smtp: "",
    whatsapp_api: "",
    google_maps: "",
    firebase: "",
    cloud_backup: "",
    ai_api: "",
  },
  tabConfig: {
    dashboard: {
      label: "Dashboard",
      icon: "LayoutDashboard",
      enabled: true,
      order: 1,
    },
    delivery: {
      label: "Delivery Tracker",
      icon: "Truck",
      enabled: true,
      order: 2,
    },
    offloading: {
      label: "Fuel Offloading",
      icon: "Fuel",
      enabled: true,
      order: 3,
    },
    invoice: { label: "Invoice", icon: "Receipt", enabled: true, order: 4 },
    debt: { label: "Debt Reminder", icon: "Bell", enabled: true, order: 5 },
    sales: {
      label: "Sales Tracking",
      icon: "BarChart3",
      enabled: true,
      order: 6,
    },
    reports: {
      label: "Reports Center",
      icon: "FileBarChart",
      enabled: true,
      order: 7,
    },
    fuelSalesReport: {
      label: "Fuel Sales Report",
      icon: "TrendingUp",
      enabled: true,
      order: 8,
    },
    liveTransaction: {
      label: "Live Transaction",
      icon: "Activity",
      enabled: true,
      order: 9,
    },
    mpesa: {
      label: "M-PESA Analyzer",
      icon: "CreditCard",
      enabled: true,
      order: 10,
    },
    payroll: {
      label: "Payroll System",
      icon: "Users",
      enabled: true,
      order: 11,
    },
    communication: {
      label: "Communication",
      icon: "MessageCircle",
      enabled: true,
      order: 12,
    },
    documents: { label: "Documents", icon: "Folder", enabled: true, order: 13 },
    dataManager: {
      label: "Data Manager",
      icon: "Database",
      enabled: true,
      order: 14,
    },
    pos: {
      label: "Point of Sale",
      icon: "ShoppingCart",
      enabled: true,
      order: 15,
    },
    ai: { label: "AI Assistant", icon: "Brain", enabled: true, order: 16 },
    pumpmapping: { label: "Pump Mapping v1", icon: "Fuel", enabled: true, order: 17 },
    admin: {
      label: "Founder Access",
      icon: "Shield",
      enabled: true,
      order: 99,
    },
  },
  systemConfig: {
    enableSync: false,
    enableCloudBackup: false,
    enableAutoReports: false,
    enableKRAIntegration: false,
    enableWhatsApp: false,
    enableEmail: false,
    enableAI: true,
    currency: (() => {
      try {
        const saved = localStorage.getItem("fuelpro_location_country");
        if (saved) {
          const parsed = JSON.parse(saved);
          const cc = parsed.currentCountry || parsed.country;
          if (cc) {
            const country = getCountryByCode(cc);
            if (country) return country.currency;
          }
        }
      } catch {
        /* */
      }
      return "USD";
    })(),
    language: "en",
  },
  updateHistory: [],
};

const loadFromStorage = (): {
  stations: Station[];
  admin: AdminSettings;
  currentId: string | null;
} => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const adminRaw = localStorage.getItem(ADMIN_KEY);
    const currentId = localStorage.getItem(CURRENT_STATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const admin = adminRaw ? JSON.parse(adminRaw) : defaultAdminSettings;
      return { stations: parsed.stations || [], admin, currentId };
    }
  } catch {
    /* ignore */
  }
  return { stations: [], admin: defaultAdminSettings, currentId: null };
};

const StationContext = createContext<StationContextType | null>(null);

export function StationProvider({ children }: { children: React.ReactNode }) {
  const [stations, setStations] = useState<Station[]>([]);
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [adminSettings, setAdminSettings] =
    useState<AdminSettings>(defaultAdminSettings);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStationLoading, setIsStationLoading] = useState(true);
  const [isBackendSyncing, setIsBackendSyncing] = useState(false);
  const [lastBackendSync, setLastBackendSync] = useState<number | null>(() => {
    const saved = localStorage.getItem(BACKEND_SYNC_TIMESTAMP);
    return saved ? parseInt(saved, 10) : null;
  });
  const [hasBackendData, setHasBackendData] = useState(false);

  // Get auth token from storage
  const getAuthToken = useCallback((): string | null => {
    // Try different storage keys for auth tokens
    const keys = [
      "fuelpro_founder_session",
      "firebase_token",
      "auth_token",
      "fuelpro_auth_token",
    ];
    for (const key of keys) {
      try {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed.token) return parsed.token;
          if (parsed.accessToken) return parsed.accessToken;
          if (typeof parsed === "string") return parsed;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }, []);

  // Sync stations FROM the backend server
  const syncFromBackend = useCallback(async (): Promise<void> => {
    const token = getAuthToken();
    if (!token) {
      console.log("[StationContext] No auth token, skipping backend sync");
      return;
    }

    setIsBackendSyncing(true);
    try {
      const response = await fetch(`${getApiBase()}/api/trpc/sync.fullSync`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Backend sync failed: ${response.status}`);
      }

      const result = await response.json();
      const data = result.result?.data?.json || result.data;

      if (data && data.success && data.stations && data.stations.length > 0) {
        // Map backend stations to local format
        const backendStations: Station[] = data.stations.map((s: any) => ({
          id: `backend_${s.id}`,
          name: s.name,
          location: s.location || "",
          phone: s.phone || "",
          email: s.managerName || "",
          kraPin: "",
          etrSerial: "",
          taxRate: parseFloat(s.taxRate) || 16,
          theme: "dark",
          logo: "",
          description: "",
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString(),
          data: {},
          access: [
            {
              username: s.managerName || "owner",
              passwordHash: encrypt(s.code || "default", adminSettings.secretKey),
              role: "owner" as const,
              permissions: ["all"],
              grantedAt: s.createdAt || new Date().toISOString(),
              grantedBy: "system",
            },
          ],
          sharedUsers: [],
          // Store backend ID for reference
          backendId: s.id,
          userRole: s.userRole,
        }));

        // Merge with local stations (prefer backend data for shared stations)
        setStations(prevStations => {
          const localOnlyStations = prevStations.filter(
            s => !s.id.startsWith("backend_") && !s.backendId
          );
          return [...localOnlyStations, ...backendStations];
        });

        // Save sync timestamp
        const now = Date.now();
        setLastBackendSync(now);
        localStorage.setItem(BACKEND_SYNC_TIMESTAMP, String(now));
        setHasBackendData(true);
        localStorage.setItem(BACKEND_SYNC_KEY, "true");

        console.log(`[StationContext] Synced ${backendStations.length} stations from backend`);
      } else {
        console.log("[StationContext] No stations found on backend");
        setHasBackendData(data?.stations?.length > 0);
      }
    } catch (error) {
      console.error("[StationContext] Backend sync error:", error);
    } finally {
      setIsBackendSyncing(false);
    }
  }, [getAuthToken, adminSettings.secretKey]);

  // Sync stations TO the backend server
  const syncToBackend = useCallback(async (): Promise<void> => {
    const token = getAuthToken();
    if (!token) {
      console.log("[StationContext] No auth token, skipping push");
      return;
    }

    // Find stations that need to be pushed (local-only, not yet on backend)
    const stationsToPush = stations.filter(
      s => !s.id.startsWith("backend_") && !s.backendId
    );

    if (stationsToPush.length === 0) {
      console.log("[StationContext] No local stations to push");
      return;
    }

    setIsBackendSyncing(true);
    try {
      const stationData = stationsToPush.map(s => ({
        name: s.name,
        code: s.name.toLowerCase().replace(/\s+/g, "_").substring(0, 20),
        location: s.location,
        phone: s.phone,
        managerName: s.email || s.name,
        taxRate: String(s.taxRate || 16),
      }));

      const response = await fetch(`${getApiBase()}/api/trpc/sync.pushChanges`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stationData }),
      });

      if (!response.ok) {
        throw new Error(`Backend push failed: ${response.status}`);
      }

      const result = await response.json();
      const data = result.result?.data?.json || result.data;

      if (data && data.success && data.results?.stations) {
        // Update local stations with backend IDs
        setStations(prevStations =>
          prevStations.map(s => {
            if (s.id.startsWith("backend_") || s.backendId) return s;
            const pushed = data.results.stations.find(
              (p: any) => p.action === "created"
            );
            if (pushed) {
              return { ...s, backendId: pushed.id, id: `backend_${pushed.id}` };
            }
            return s;
          })
        );

        const now = Date.now();
        setLastBackendSync(now);
        localStorage.setItem(BACKEND_SYNC_TIMESTAMP, String(now));
        console.log(`[StationContext] Pushed ${stationsToPush.length} stations to backend`);
      }
    } catch (error) {
      console.error("[StationContext] Backend push error:", error);
    } finally {
      setIsBackendSyncing(false);
    }
  }, [getAuthToken, stations]);

  // Load from storage on mount
  useEffect(() => {
    const { stations: loadedStations, admin, currentId } = loadFromStorage();
    setStations(loadedStations);
    setAdminSettings(admin);

    // Check admin session
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (
          parsed.isAdmin &&
          parsed.expiresAt &&
          new Date(parsed.expiresAt) > new Date()
        ) {
          setIsAdmin(true);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    // Check if we have backend data
    const backendSynced = localStorage.getItem(BACKEND_SYNC_KEY);
    setHasBackendData(backendSynced === "true");

    // Set current station
    if (currentId) {
      const found = loadedStations.find(s => s.id === currentId);
      if (found) setCurrentStation(found);
    } else if (loadedStations.length > 0) {
      setCurrentStation(loadedStations[0]);
      localStorage.setItem(CURRENT_STATION_KEY, loadedStations[0].id);
    }
    setIsStationLoading(false);

    // Try to sync from backend on mount
    syncFromBackend();
  }, [syncFromBackend]);

  // Persist to storage
  const persist = useCallback(
    (newStations?: Station[], newAdmin?: AdminSettings) => {
      const s = newStations || stations;
      const a = newAdmin || adminSettings;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ stations: s, version: "3.0" })
      );
      localStorage.setItem(ADMIN_KEY, JSON.stringify(a));
    },
    [stations, adminSettings]
  );

  useEffect(() => {
    persist();
  }, [stations, adminSettings, persist]);

  // Station CRUD
  const createStation = useCallback(
    (stationData: Partial<Station>): Station => {
      const id = `station_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const password =
        Math.random().toString(36).substr(2, 8) +
        Math.random().toString(36).substr(2, 4);
      const newStation: Station = {
        id,
        name: stationData.name || `Station ${stations.length + 1}`,
        location: stationData.location || "",
        phone: stationData.phone || "",
        email: stationData.email || "",
        kraPin: stationData.kraPin || "",
        etrSerial: stationData.etrSerial || "",
        taxRate: stationData.taxRate || 16,
        theme: stationData.theme || "dark",
        logo: stationData.logo || "",
        description: stationData.description || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: stationData.data || {},
        access: [
          {
            username:
              stationData.name?.toLowerCase().replace(/\s+/g, "_") ||
              `station_${stations.length + 1}`,
            passwordHash: encrypt(password, adminSettings.secretKey),
            role: "owner",
            permissions: ["all"],
            grantedAt: new Date().toISOString(),
            grantedBy: "system",
          },
        ],
        sharedUsers: [],
      };
      setStations(prev => [...prev, newStation]);
      setCurrentStation(newStation);
      localStorage.setItem(CURRENT_STATION_KEY, id);
      // Also save directly to ensure persistence even if useEffect hasn't fired
      try {
        const existing = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || '{"stations":[],"version":"3.0"}'
        );
        existing.stations = [...(existing.stations || []), newStation];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      } catch (e) {
        console.error("Failed to persist station:", e);
      }
      return newStation;
    },
    [stations, adminSettings.secretKey]
  );

  const updateStation = useCallback(
    (id: string, data: Partial<Station>) => {
      setStations(prev =>
        prev.map(s =>
          s.id === id
            ? { ...s, ...data, updatedAt: new Date().toISOString() }
            : s
        )
      );
      if (currentStation?.id === id) {
        setCurrentStation(prev =>
          prev
            ? { ...prev, ...data, updatedAt: new Date().toISOString() }
            : null
        );
      }
    },
    [currentStation]
  );

  const deleteStation = useCallback(
    (id: string) => {
      setStations(prev => prev.filter(s => s.id !== id));
      if (currentStation?.id === id) {
        const remaining = stations.filter(s => s.id !== id);
        setCurrentStation(remaining.length > 0 ? remaining[0] : null);
        if (remaining.length > 0)
          localStorage.setItem(CURRENT_STATION_KEY, remaining[0].id);
      }
    },
    [currentStation, stations]
  );

  const switchStation = useCallback(
    (id: string) => {
      const found = stations.find(s => s.id === id);
      if (found) {
        setCurrentStation(found);
        localStorage.setItem(CURRENT_STATION_KEY, id);
      }
    },
    [stations]
  );

  const combineStations = useCallback(() => {
    if (stations.length === 0) return null;
    // Aggregate data from all stations
    const combinedData: any = {
      salesHistory: {},
      clients: {},
      invoices: {},
      expenses: [],
      employees: [],
      deliveryData: {
        entries: [],
        totals: {
          balanceDue: 0,
          totalSupplied: 0,
          totalPaid: 0,
          totalRemaining: 0,
          totalDebt: 0,
        },
      },
      mpesaTransactions: [],
      documents: [],
      payrollRecords: [],
      pmsTankOpening: 0,
      pmsTankClosing: 0,
      agoTankOpening: 0,
      agoTankClosing: 0,
      totalRevenue: 0,
      totalFuelSold: 0,
      totalDebt: 0,
      stations: stations.map(s => ({
        id: s.id,
        name: s.name,
        location: s.location,
      })),
    };

    stations.forEach(s => {
      const d = s.data || {};
      // Merge sales history
      if (d.salesHistory)
        Object.assign(combinedData.salesHistory, d.salesHistory);
      if (d.clients) Object.assign(combinedData.clients, d.clients);
      if (d.invoices) Object.assign(combinedData.invoices, d.invoices);
      if (d.expenses) combinedData.expenses.push(...d.expenses);
      if (d.employees) combinedData.employees.push(...d.employees);
      if (d.deliveryData) {
        if (d.deliveryData.entries)
          combinedData.deliveryData.entries.push(...d.deliveryData.entries);
        if (d.deliveryData.totals) {
          combinedData.deliveryData.totals.balanceDue +=
            d.deliveryData.totals.balanceDue || 0;
          combinedData.deliveryData.totals.totalSupplied +=
            d.deliveryData.totals.totalSupplied || 0;
        }
      }
      if (d.mpesaTransactions)
        combinedData.mpesaTransactions.push(...d.mpesaTransactions);
      combinedData.pmsTankOpening += d.pmsTankOpening || 0;
      combinedData.pmsTankClosing += d.pmsTankClosing || 0;
      combinedData.agoTankOpening += d.agoTankOpening || 0;
      combinedData.agoTankClosing += d.agoTankClosing || 0;
    });

    return { data: combinedData, stations };
  }, [stations]);

  // Station Access
  const shareStation = useCallback(
    (stationId: string, email: string, password: string) => {
      setStations(prev =>
        prev.map(s => {
          if (s.id !== stationId) return s;
          const accessKey = Math.random().toString(36).substr(2, 16);
          return {
            ...s,
            sharedUsers: [
              ...s.sharedUsers,
              {
                email,
                stationId,
                accessKey,
                grantedAt: new Date().toISOString(),
              },
            ],
            access: [
              ...s.access,
              {
                username: email,
                passwordHash: encrypt(password, adminSettings.secretKey),
                role: "shared",
                permissions: ["view", "edit_sales", "edit_delivery"],
                grantedAt: new Date().toISOString(),
                grantedBy: s.access[0]?.username || "owner",
              },
            ],
          };
        })
      );
    },
    [adminSettings.secretKey]
  );

  const revokeAccess = useCallback((stationId: string, email: string) => {
    setStations(prev =>
      prev.map(s => {
        if (s.id !== stationId) return s;
        return {
          ...s,
          sharedUsers: s.sharedUsers.filter(u => u.email !== email),
          access: s.access.filter(a => a.username !== email),
        };
      })
    );
  }, []);

  const verifyStationAccess = useCallback(
    (stationId: string, password: string): boolean => {
      const station = stations.find(s => s.id === stationId);
      if (!station) return false;
      return station.access.some(a => {
        try {
          return decrypt(a.passwordHash, adminSettings.secretKey) === password;
        } catch {
          return false;
        }
      });
    },
    [stations, adminSettings.secretKey]
  );

  const changeStationPassword = useCallback(
    (stationId: string, newPassword: string) => {
      setStations(prev =>
        prev.map(s => {
          if (s.id !== stationId) return s;
          return {
            ...s,
            access: s.access.map((a, i) =>
              i === 0
                ? {
                    ...a,
                    passwordHash: encrypt(newPassword, adminSettings.secretKey),
                  }
                : a
            ),
          };
        })
      );
    },
    [adminSettings.secretKey]
  );

  // Admin
  const loginAdmin = useCallback(
    (username: string, password: string): boolean => {
      const storedHash = adminSettings.adminPasswordHash;
      const isValid =
        username === adminSettings.adminUsername &&
        decrypt(storedHash, adminSettings.secretKey) === password;
      if (isValid) {
        setIsAdmin(true);
        const session = {
          isAdmin: true,
          expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return isValid;
    },
    [adminSettings]
  );

  const logoutAdmin = useCallback(() => {
    setIsAdmin(false);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const updateAdminPassword = useCallback(
    (currentPassword: string, newPassword: string): boolean => {
      if (
        decrypt(adminSettings.adminPasswordHash, adminSettings.secretKey) !==
        currentPassword
      )
        return false;
      const newHash = encrypt(newPassword, adminSettings.secretKey);
      const updated = { ...adminSettings, adminPasswordHash: newHash };
      setAdminSettings(updated);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(updated));
      return true;
    },
    [adminSettings]
  );

  const updateAdminSettings = useCallback(
    (settings: Partial<AdminSettings>) => {
      setAdminSettings(prev => ({ ...prev, ...settings }));
    },
    []
  );

  const addUpdateRecord = useCallback(
    (record: Omit<UpdateRecord, "id" | "timestamp">) => {
      const newRecord: UpdateRecord = {
        ...record,
        id: `upd_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      setAdminSettings(prev => ({
        ...prev,
        updateHistory: [newRecord, ...prev.updateHistory].slice(0, 100),
      }));
    },
    []
  );

  const revertUpdate = useCallback((updateId: string) => {
    setAdminSettings(prev => ({
      ...prev,
      updateHistory: prev.updateHistory.map(u =>
        u.id === updateId
          ? { ...u, reverted: true, revertedAt: new Date().toISOString() }
          : u
      ),
    }));
  }, []);

  const updateTabConfig = useCallback(
    (tabId: string, config: Partial<AdminSettings["tabConfig"][string]>) => {
      setAdminSettings(prev => ({
        ...prev,
        tabConfig: {
          ...prev.tabConfig,
          [tabId]: { ...prev.tabConfig[tabId], ...config },
        },
      }));
    },
    []
  );

  const updateApiKey = useCallback((keyName: string, value: string) => {
    setAdminSettings(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [keyName]: value },
    }));
  }, []);

  // Access Log
  const addAccessLog = useCallback(
    (stationId: string, action: string) => {
      const log: AccessLog = {
        id: `log_${Date.now()}`,
        stationId,
        user: currentStation?.access[0]?.username || "unknown",
        action,
        timestamp: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem(ACCESS_LOG_KEY) || "[]");
      localStorage.setItem(
        ACCESS_LOG_KEY,
        JSON.stringify([log, ...existing].slice(0, 500))
      );
    },
    [currentStation]
  );

  const getAccessLogs = useCallback((stationId?: string): AccessLog[] => {
    const all = JSON.parse(localStorage.getItem(ACCESS_LOG_KEY) || "[]");
    return stationId
      ? all.filter((l: AccessLog) => l.stationId === stationId)
      : all;
  }, []);

  // Station Data
  const getStationData = useCallback(
    (stationId: string): any => {
      const station = stations.find(s => s.id === stationId);
      return station?.data || {};
    },
    [stations]
  );

  const saveStationData = useCallback((stationId: string, data: any) => {
    setStations(prev =>
      prev.map(s =>
        s.id === stationId
          ? { ...s, data, updatedAt: new Date().toISOString() }
          : s
      )
    );
  }, []);

  // Export/Import
  const exportAllData = useCallback((): string => {
    const payload = {
      stations,
      adminSettings,
      exportedAt: new Date().toISOString(),
      version: "3.0",
    };
    return JSON.stringify(payload, null, 2);
  }, [stations, adminSettings]);

  const importAllData = useCallback(
    (json: string) => {
      try {
        const payload = JSON.parse(json);
        if (payload.stations) setStations(payload.stations);
        if (payload.adminSettings) setAdminSettings(payload.adminSettings);
        persist(payload.stations, payload.adminSettings);
      } catch (e) {
        console.error("Import failed:", e);
      }
    },
    [persist]
  );

  // Encryption utils
  const encryptSensitive = useCallback(
    (text: string) => encrypt(text, adminSettings.secretKey),
    [adminSettings.secretKey]
  );
  const decryptSensitive = useCallback(
    (encoded: string) => decrypt(encoded, adminSettings.secretKey),
    [adminSettings.secretKey]
  );

  return (
    <StationContext.Provider
      value={{
        stations,
        currentStation,
        isAdmin,
        adminSettings,
        isStationLoading,
        isBackendSyncing,
        lastBackendSync,
        createStation,
        updateStation,
        deleteStation,
        switchStation,
        combineStations,
        shareStation,
        revokeAccess,
        verifyStationAccess,
        changeStationPassword,
        loginAdmin,
        logoutAdmin,
        updateAdminPassword,
        updateAdminSettings,
        addUpdateRecord,
        revertUpdate,
        updateTabConfig,
        updateApiKey,
        addAccessLog,
        getAccessLogs,
        getStationData,
        saveStationData,
        exportAllData,
        importAllData,
        encryptSensitive,
        decryptSensitive,
        syncFromBackend,
        syncToBackend,
        hasBackendData,
      }}
    >
      {children}
    </StationContext.Provider>
  );
}

export function useStations() {
  const ctx = useContext(StationContext);
  if (!ctx) throw new Error("useStations must be used within StationProvider");
  return ctx;
}
