// ============================================================
// CloudStorageService - Free multi-tier storage system
// Tier 1: IndexedDB (unlimited, free, local)
// Tier 2: REST API Cloud Sync (free, cross-device)
// Tier 3: localStorage (backup, 5-10MB)
// ============================================================

const DB_NAME = "FuelProDB";
const DB_VERSION = 1;
const STORE_NAME = "stationData";
const META_STORE = "syncMeta";
const BACKUP_STORE = "backups";
const AUDIT_STORE = "auditLog";

let db: IDBDatabase | null = null;

// ─── Cloud Sync Configuration ───
interface CloudConfig {
  enabled: boolean;
  apiEndpoint: string;
  apiKey: string;
  syncInterval: number;
  lastSync: number | null;
}

const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  enabled: false,
  apiEndpoint: "", // User configures their own endpoint
  apiKey: "",
  syncInterval: 30000, // 30 seconds
  lastSync: null,
};

function getCloudConfig(): CloudConfig {
  try {
    const saved = localStorage.getItem("fuelpro_cloud_config");
    return saved
      ? { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(saved) }
      : DEFAULT_CLOUD_CONFIG;
  } catch {
    return DEFAULT_CLOUD_CONFIG;
  }
}

function saveCloudConfig(config: CloudConfig) {
  localStorage.setItem("fuelpro_cloud_config", JSON.stringify(config));
}

// ─── Device/User Identification ───
function getDeviceId(): string {
  let deviceId = localStorage.getItem("fuelpro_device_id");
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("fuelpro_device_id", deviceId);
  }
  return deviceId;
}

function getUserId(): string {
  return localStorage.getItem("fuelpro_user_id") || "anonymous";
}

// ─── Cloud Sync Engine ───
class CloudSyncEngine {
  private config: CloudConfig;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private pendingSync: Map<string, any> = new Map();
  private isOnline: boolean = navigator.onLine;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.config = getCloudConfig();
    this.initOnlineListener();
    if (this.config.enabled) this.startAutoSync();
  }

  configure(apiEndpoint: string, apiKey: string) {
    this.config.apiEndpoint = apiEndpoint;
    this.config.apiKey = apiKey;
    this.config.enabled = true;
    saveCloudConfig(this.config);
    this.startAutoSync();
    // Initial sync
    this.pushToCloud();
  }

  disable() {
    this.config.enabled = false;
    this.stopAutoSync();
    saveCloudConfig(this.config);
  }

  isEnabled(): boolean {
    return (
      this.config.enabled &&
      Boolean(this.config.apiEndpoint && this.config.apiKey)
    );
  }

  // ─── Sync Operations ───
  async pushToCloud(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    if (!this.isOnline) return false;

    try {
      // Collect all data
      const allData: Record<string, any> = {};
      const all = await dbGetAll();
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith("fuelpro_")) {
          allData[key] = value;
        }
      }

      // Add sync metadata
      allData._syncMeta = {
        deviceId: getDeviceId(),
        userId: getUserId(),
        timestamp: Date.now(),
        version: "1.0.0",
      };

      // Push to cloud
      const response = await fetch(this.config.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          "X-Device-Id": getDeviceId(),
        },
        body: JSON.stringify({
          action: "sync",
          data: allData,
          deviceId: getDeviceId(),
        }),
      });

      if (response.ok) {
        this.config.lastSync = Date.now();
        saveCloudConfig(this.config);
        this.pendingSync.clear();
        return true;
      }
    } catch (e) {
      console.error("[CloudSync] Push failed:", e);
    }
    return false;
  }

  async pullFromCloud(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    if (!this.isOnline) return false;

    try {
      const response = await fetch(`${this.config.apiEndpoint}/pull`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "X-Device-Id": getDeviceId(),
        },
      });

      if (response.ok) {
        const result = await response.json();
        const cloudData = result.data || result;

        // Merge cloud data (cloud wins for conflicts)
        for (const [key, value] of Object.entries(cloudData)) {
          if (key === "_syncMeta") continue;

          const localValue = await dbGet(key);
          if (localValue === null || !localValue) {
            await dbSet(key, value);
            this.notifyListeners(key, value);
          }
        }
        return true;
      }
    } catch (e) {
      console.error("[CloudSync] Pull failed:", e);
    }
    return false;
  }

  queueSync(key: string, data: any) {
    this.pendingSync.set(key, data);
    if (this.isOnline && this.isEnabled()) {
      this.pushToCloud();
    }
  }

  // ─── Auto Sync ───
  startAutoSync() {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.isEnabled()) {
        if (this.pendingSync.size > 0) {
          this.pushToCloud();
        } else {
          this.pullFromCloud();
        }
      }
    }, this.config.syncInterval);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // ─── Event System ───
  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    return () => this.listeners.get(key)?.delete(callback);
  }

  private notifyListeners(key: string, data: any) {
    this.listeners.get(key)?.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error("[CloudSync] Listener error:", e);
      }
    });
  }

  // ─── Online/Offline ───
  private initOnlineListener() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      if (this.isEnabled()) {
        this.pushToCloud();
        this.pullFromCloud();
      }
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  getStatus() {
    return {
      enabled: this.isEnabled(),
      isOnline: this.isOnline,
      lastSync: this.config.lastSync,
      pendingChanges: this.pendingSync.size,
    };
  }
}

const cloudSync = new CloudSyncEngine();

// ─── IndexedDB Functions ───

// Initialize IndexedDB
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = event => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(BACKUP_STORE)) {
        const backupStore = database.createObjectStore(BACKUP_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        backupStore.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!database.objectStoreNames.contains(AUDIT_STORE)) {
        const auditStore = database.createObjectStore(AUDIT_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        auditStore.createIndex("timestamp", "timestamp", { unique: false });
        auditStore.createIndex("stationId", "stationId", { unique: false });
        auditStore.createIndex("action", "action", { unique: false });
      }
    };
  });
}

// Core CRUD operations
async function dbSet(key: string, value: any): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ key, value, updatedAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(key: string): Promise<any> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(key: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(): Promise<Record<string, any>> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const result: Record<string, any> = {};
      request.result.forEach((item: any) => {
        result[item.key] = item.value;
      });
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
}

// Meta/Sync tracking
async function setSyncMeta(key: string, meta: any): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([META_STORE], "readwrite");
    const store = tx.objectStore(META_STORE);
    const request = store.put({ key, ...meta, updatedAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getSyncMeta(key: string): Promise<any> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([META_STORE], "readonly");
    const store = tx.objectStore(META_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

// Backup management
export interface BackupRecord {
  id?: number;
  name: string;
  stationId: string;
  timestamp: string;
  size: number;
  data: any;
  compressed: boolean;
}

async function createBackup(
  stationId: string,
  data: any,
  name?: string
): Promise<BackupRecord> {
  const database = await initDB();
  const compressed = JSON.stringify(data);
  const record: BackupRecord = {
    name: name || `Auto-backup ${new Date().toLocaleString()}`,
    stationId,
    timestamp: new Date().toISOString(),
    size: new Blob([compressed]).size,
    data,
    compressed: false,
  };
  return new Promise((resolve, reject) => {
    const tx = database.transaction([BACKUP_STORE], "readwrite");
    const store = tx.objectStore(BACKUP_STORE);
    const request = store.add(record);
    request.onsuccess = () => {
      record.id = request.result as number;
      resolve(record);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getBackups(stationId: string): Promise<BackupRecord[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([BACKUP_STORE], "readonly");
    const store = tx.objectStore(BACKUP_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as BackupRecord[];
      resolve(
        all
          .filter(b => b.stationId === stationId)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
      );
    };
    request.onerror = () => reject(request.error);
  });
}

async function restoreBackup(id: number): Promise<any> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([BACKUP_STORE], "readonly");
    const store = tx.objectStore(BACKUP_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result?.data ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteBackup(id: number): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([BACKUP_STORE], "readwrite");
    const store = tx.objectStore(BACKUP_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Auto-backup scheduler
let backupInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoBackup(
  stationId: string,
  getData: () => any,
  intervalMs = 1000 * 60 * 30
): void {
  stopAutoBackup();
  backupInterval = setInterval(async () => {
    try {
      const data = getData();
      await createBackup(
        stationId,
        data,
        `Auto ${new Date().toLocaleTimeString()}`
      );
      // Keep only last 50 backups
      const backups = await getBackups(stationId);
      if (backups.length > 50) {
        for (const old of backups.slice(50)) {
          if (old.id) await deleteBackup(old.id);
        }
      }
    } catch (e) {
      console.error("Auto-backup failed:", e);
    }
  }, intervalMs);
}

export function stopAutoBackup(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

// Google Sheets API (free tier: 500 requests/100 seconds)
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx-PLACEHOLDER/exec"; // User can configure their own

export async function syncToGoogleSheets(data: any): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sync",
        data,
        timestamp: new Date().toISOString(),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Main CloudStorage API
export const CloudStorage = {
  // Data operations
  async save(key: string, value: any): Promise<void> {
    try {
      await dbSet(key, value);
    } catch (e) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },
  async load(key: string): Promise<any> {
    try {
      const value = await dbGet(key);
      if (value !== null) return value;
    } catch {
      /* fallback */
    }
    // Fallback to localStorage
    try {
      const ls = localStorage.getItem(key);
      if (ls) return JSON.parse(ls);
    } catch {
      /* ignore */
    }
    return null;
  },
  async remove(key: string): Promise<void> {
    try {
      await dbDelete(key);
    } catch {
      /* */
    }
    localStorage.removeItem(key);
  },
  async loadAll(): Promise<Record<string, any>> {
    try {
      return await dbGetAll();
    } catch {
      return {};
    }
  },

  // Backup
  createBackup,
  getBackups,
  restoreBackup,
  deleteBackup,
  startAutoBackup,
  stopAutoBackup,

  // Meta
  setSyncMeta,
  getSyncMeta,

  // Export/Import
  async exportAll(): Promise<Blob> {
    const data = await dbGetAll();
    const json = JSON.stringify(data, null, 2);
    return new Blob([json], { type: "application/json" });
  },
  async importAll(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);
    for (const [key, value] of Object.entries(data)) {
      await dbSet(key, value);
    }
  },

  // Storage stats
  async getStorageStats(): Promise<{
    indexedDB: number;
    localStorage: number;
    totalKeys: number;
  }> {
    const all = await dbGetAll();
    const idbSize = new Blob([JSON.stringify(all)]).size;
    let lsSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      lsSize += (localStorage.getItem(localStorage.key(i)!) || "").length * 2;
    }
    return {
      indexedDB: idbSize,
      localStorage: lsSize,
      totalKeys: Object.keys(all).length + localStorage.length,
    };
  },
};

// Export audit log types and functions
export interface AuditEntry {
  id?: number;
  stationId: string;
  timestamp: string;
  action: string;
  category:
    | "data"
    | "sale"
    | "payment"
    | "inventory"
    | "auth"
    | "config"
    | "sync";
  user?: string;
  details: string;
  oldValue?: any;
  newValue?: any;
}

export async function logAudit(
  entry: Omit<AuditEntry, "id" | "timestamp">
): Promise<void> {
  const database = await initDB();
  const fullEntry = { ...entry, timestamp: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const tx = database.transaction([AUDIT_STORE], "readwrite");
    const store = tx.objectStore(AUDIT_STORE);
    const request = store.add(fullEntry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAuditLog(
  stationId: string,
  limit = 100
): Promise<AuditEntry[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([AUDIT_STORE], "readonly");
    const store = tx.objectStore(AUDIT_STORE);
    const index = store.index("stationId");
    const request = index.getAll(stationId, limit);
    request.onsuccess = () => {
      const entries = (request.result as AuditEntry[]).sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      resolve(entries);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAuditLogByCategory(
  stationId: string,
  category: string,
  limit = 50
): Promise<AuditEntry[]> {
  const all = await getAuditLog(stationId, limit * 2);
  return all.filter(e => e.category === category).slice(0, limit);
}

export async function clearOldAudit(daysToKeep = 90): Promise<void> {
  const database = await initDB();
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
  return new Promise((resolve, reject) => {
    const tx = database.transaction([AUDIT_STORE], "readwrite");
    const store = tx.objectStore(AUDIT_STORE);
    const index = store.index("timestamp");
    const range = IDBKeyRange.upperBound(new Date(cutoff).toISOString());
    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// Make CloudStorage available globally
(window as any).FuelProStorage = CloudStorage;
(window as any).FuelProCloudSync = cloudSync;

// Export for use in other modules
export { cloudSync, CloudSyncEngine };
export type { CloudConfig };
