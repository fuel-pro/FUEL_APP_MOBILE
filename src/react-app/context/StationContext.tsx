import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { getCountryByCode } from "@/react-app/lib/world-country-utils";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  pullStationSnapshot,
  pushStationSnapshot,
} from "@/react-app/lib/stationCloudSync";

// Lazy API base URL getter using dynamic import to avoid circular deps
let _apiBase: string | null = null;
let _apiPromise: Promise<string> | null = null;
function getApiBase(): string {
  if (_apiBase) return _apiBase;
  // Use environment variable or empty string (Firebase-only mode)
  return import.meta.env.VITE_BACKEND_URL || "";
}
async function getApiBaseAsync(): Promise<string> {
  if (_apiBase) return _apiBase;
  if (!_apiPromise) {
    _apiPromise = import("@/utils/apiConfig").then(m => m.getBackendUrl());
  }
  _apiBase = await _apiPromise;
  return _apiBase || "";
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
  // Guards the cloud-push effect below so it can never fire before the
  // initial cloud pull has resolved (would otherwise risk overwriting a
  // real cloud snapshot with an empty/stale local one on first load).
  const [hasHydratedFromCloud, setHasHydratedFromCloud] = useState(false);

  // FIX: Use Refs to stabilize callbacks and prevent infinite re-hydration loops.
  // Every state update caused syncFromBackend/syncToBackend references to change,
  // which triggered the mount effect again, which reset state, creating an infinite loop.
  const stationsRef = useRef(stations);
  useEffect(() => { stationsRef.current = stations; }, [stations]);

  const adminSettingsRef = useRef(adminSettings);
  useEffect(() => { adminSettingsRef.current = adminSettings; }, [adminSettings]);

  const { user } = useAuth();

  // Sync stations FROM Supabase (see stationCloudSync.ts for why this
  // replaced the old /api/trpc/sync.fullSync call, which hit a backend
  // that doesn't exist in this deployment and silently failed every time).
  const syncFromBackend = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      setHasHydratedFromCloud(true);
      return;
    }

    setIsBackendSyncing(true);
    try {
      const snapshot = await pullStationSnapshot(user.id);

      if (snapshot && Array.isArray(snapshot.stations) && snapshot.stations.length > 0) {
        setStations(snapshot.stations);
        if (snapshot.admin) setAdminSettings(snapshot.admin);

        const now = Date.now();
        setLastBackendSync(now);
        localStorage.setItem(BACKEND_SYNC_TIMESTAMP, String(now));
        setHasBackendData(true);
        localStorage.setItem(BACKEND_SYNC_KEY, "true");

        console.log(`[StationContext] Synced ${snapshot.stations.length} station(s) from Supabase`);
      } else {
        // No cloud snapshot yet for this account — keep whatever is local
        // (e.g. a station created before this device ever synced) and let
        // the push effect below upload it.
        console.log("[StationContext] No cloud data yet for this account");
      }
    } catch (error) {
      console.error("[StationContext] Cloud sync error:", error);
    } finally {
      setIsBackendSyncing(false);
      setHasHydratedFromCloud(true);
    }
  }, [user?.id]);

  // Sync stations TO Supabase. Debounced by the caller (see the effect
  // below) rather than fired on every keystroke-level state change.
  // FIX: Uses refs to stabilize the callback reference.
  const syncToBackend = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      console.log("[StationContext] Not signed in, skipping cloud push");
      return;
    }

    setIsBackendSyncing(true);
    try {
      const result = await pushStationSnapshot(user.id, {
        stations: stationsRef.current,
        admin: adminSettingsRef.current,
      });

      if (result.success) {
        const now = Date.now();
        setLastBackendSync(now);
        localStorage.setItem(BACKEND_SYNC_TIMESTAMP, String(now));
        setHasBackendData(true);
        localStorage.setItem(BACKEND_SYNC_KEY, "true");
        console.log(`[StationContext] Pushed ${stationsRef.current.length} station(s) to Supabase`);
      }
    } finally {
      setIsBackendSyncing(false);
    }
  }, [user?.id]); // Stable! Uses refs internally.

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
    // Use setTimeout to avoid calling async function directly in useEffect
    setTimeout(() => { syncFromBackend(); }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // EMPTY ARRAY: Only runs once on mount. Prevents infinite re-hydration loop.

  // Persist to storage - FIX: Uses refs to avoid dependency on state
  const persist = useCallback(
    (newStations?: Station[], newAdmin?: AdminSettings) => {
      const s = newStations || stationsRef.current;
      const a = newAdmin || adminSettingsRef.current;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ stations: s, version: "3.0" })
      );
      localStorage.setItem(ADMIN_KEY, JSON.stringify(a));
    },
    [] // Stable! Uses refs internally.
  );

  useEffect(() => {
    persist();
  }, [stations, adminSettings, persist]);

  // FIX: Auth listener with EMPTY dependency array. Prevents tearing down and
  // re-subscribing on every render, which was causing extra sync calls.
  useEffect(() => {
    const unsubscribe = useAuth.subscribe((state) => {
      if (state.user) {
        // User signed in - trigger sync
        setTimeout(() => { syncFromBackend(); }, 0);
      } else {
        // User signed out
        setHasBackendData(false);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // EMPTY ARRAY: Only subscribes once.

  // Push to Supabase whenever station/admin data changes, debounced so
  // rapid edits (typing, POS entries) collapse into one request. Gated on
  // hasHydratedFromCloud so this can never fire before the initial pull
  // above has resolved — otherwise a fresh device could push its empty
  // local state and wipe out real data already in the cloud.
  useEffect(() => {
    if (!user?.id || !hasHydratedFromCloud) return;
    const timeout = setTimeout(() => {
      syncToBackend();
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, adminSettings, user?.id, hasHydratedFromCloud]);

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
