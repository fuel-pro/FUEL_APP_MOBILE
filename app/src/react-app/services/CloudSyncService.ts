// ============================================================
// CloudSyncService - Cloud-First Data Synchronization
// Data syncs across devices by default, local storage is optional
// Uses the backend sync API for true cross-device sync
// ============================================================

import { CloudStorage } from './CloudStorageService';

// API Base URL - will be set from backend URL
const getApiBaseUrl = () => {
  // Try to get from environment or use default Northflank URL
  return (window as any).__FUELPRO_API_URL__ || 'https://http--backend-api--xx4glz2bvfy6.code.run';
};

export interface SyncPreferences {
  storeLocally: boolean;
  syncEnabled: boolean;
  autoSyncInterval: number;
  syncOnWifiOnly: boolean;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  deviceCount: number;
  syncedDataCount: number;
  isOnline: boolean;
  pendingChanges: number;
}

export interface SyncResult {
  success: boolean;
  version?: number;
  conflict?: boolean;
  error?: string;
}

interface SyncQueueItem {
  key: string;
  data: any;
  timestamp: number;
  retries: number;
}

// ─── Device ID Management ───
function getDeviceId(): string {
  let deviceId = localStorage.getItem('fuelpro_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('fuelpro_device_id', deviceId);
  }
  return deviceId;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS Device';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Unknown Device';
}

function getDeviceType(): string {
  if (/Mobile|Tablet|iPad/.test(navigator.userAgent)) return 'mobile';
  return 'desktop';
}

// ─── API Helpers ───
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('fuelpro_token');
  
  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      'X-Device-Id': getDeviceId(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Sync Service ───
class CloudSyncService {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncQueue: Map<string, SyncQueueItem> = new Map();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private preferences: SyncPreferences = {
    storeLocally: false,  // Cloud-first by default!
    syncEnabled: true,
    autoSyncInterval: 30000, // 30 seconds
    syncOnWifiOnly: false,
  };
  private initialized: boolean = false;

  constructor() {
    this.initOnlineListener();
    this.initBroadcastChannel();
  }

  // ─── Initialization ───
  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Register device with backend
      await this.registerDevice();
      
      // Load preferences from backend
      await this.loadPreferences();
      
      // Start auto sync if enabled
      if (this.preferences.syncEnabled) {
        this.startAutoSync();
      }
      
      // Initial sync
      await this.sync();
      
      this.initialized = true;
      console.log('[CloudSync] Initialized successfully');
    } catch (error) {
      console.error('[CloudSync] Init failed:', error);
    }
  }

  private async registerDevice(): Promise<void> {
    try {
      await apiRequest('/api/sync/register-device', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: getDeviceId(),
          deviceName: getDeviceName(),
          deviceType: getDeviceType(),
        }),
      });
      console.log('[CloudSync] Device registered:', getDeviceId());
    } catch (error) {
      console.error('[CloudSync] Device registration failed:', error);
    }
  }

  // ─── Preferences ───
  async loadPreferences(): Promise<SyncPreferences> {
    try {
      const prefs = await apiRequest<SyncPreferences>('/api/sync/preferences');
      this.preferences = prefs;
      console.log('[CloudSync] Preferences loaded:', prefs);
      return prefs;
    } catch (error) {
      console.error('[CloudSync] Failed to load preferences:', error);
      return this.preferences;
    }
  }

  async setPreferences(prefs: Partial<SyncPreferences>): Promise<void> {
    try {
      await apiRequest('/api/sync/preferences', {
        method: 'PUT',
        body: JSON.stringify(prefs),
      });
      this.preferences = { ...this.preferences, ...prefs };
      
      // Handle syncEnabled change
      if (prefs.syncEnabled !== undefined) {
        if (prefs.syncEnabled) {
          this.startAutoSync();
        } else {
          this.stopAutoSync();
        }
      }
      
      console.log('[CloudSync] Preferences updated:', this.preferences);
    } catch (error) {
      console.error('[CloudSync] Failed to save preferences:', error);
      throw error;
    }
  }

  getPreferences(): SyncPreferences {
    return { ...this.preferences };
  }

  // ─── Core Sync Operations ───
  
  /**
   * Save data - stores locally AND syncs to cloud by default
   */
  async save(key: string, data: any, options: { localOnly?: boolean } = {}): Promise<SyncResult> {
    const timestamp = Date.now();
    
    // Store locally if enabled or requested
    if (this.preferences.storeLocally || options.localOnly) {
      await CloudStorage.save(key, data);
    } else {
      // Just remove from local if not storing locally
      await CloudStorage.remove(key);
    }
    
    // Queue for cloud sync if enabled
    if (this.preferences.syncEnabled && this.isOnline) {
      return this.pushToCloud(key, data);
    } else {
      // Queue for later
      this.queueSync(key, data);
      return { success: true };
    }
  }

  /**
   * Load data - checks cloud first, then local
   */
  async load(key: string): Promise<any> {
    // Try cloud first if online
    if (this.isOnline && this.preferences.syncEnabled) {
      try {
        const cloudData = await this.pullFromCloud(key);
        if (cloudData) {
          // Update local cache
          if (this.preferences.storeLocally) {
            await CloudStorage.save(key, cloudData);
          }
          return cloudData;
        }
      } catch (error) {
        console.warn('[CloudSync] Cloud pull failed, falling back to local:', error);
      }
    }
    
    // Fall back to local
    if (this.preferences.storeLocally) {
      return CloudStorage.load(key);
    }
    
    return null;
  }

  /**
   * Push data to cloud
   */
  async pushToCloud(key: string, data?: any, forcePush: boolean = false): Promise<SyncResult> {
    if (!this.preferences.syncEnabled) {
      return { success: false, error: 'Sync disabled' };
    }

    if (!this.isOnline) {
      this.queueSync(key, data);
      return { success: false, error: 'Offline' };
    }

    try {
      // Get local data if not provided
      const dataToSync = data ?? await CloudStorage.load(key);
      if (dataToSync === null) {
        return { success: false, error: 'No data to sync' };
      }

      // Get current version
      const meta = await CloudStorage.getSyncMeta(key);
      const version = meta?.version || 0;

      const result = await apiRequest<any>('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          dataKey: key,
          dataType: this.getDataType(key),
          data: dataToSync,
          version,
          deviceId: getDeviceId(),
          forcePush,
        }),
      });

      // Update local metadata
      await CloudStorage.setSyncMeta(key, {
        version: result.version,
        syncedAt: result.syncedAt,
      });

      // Notify listeners
      this.notifyListeners(key, dataToSync);

      console.log('[CloudSync] Pushed:', key, 'v' + result.version);
      return {
        success: true,
        version: result.version,
        conflict: result.conflictResolved,
      };
    } catch (error: any) {
      console.error('[CloudSync] Push failed:', key, error);
      
      // Handle conflict
      if (error.message?.includes('conflict')) {
        return { success: false, conflict: true, error: 'Version conflict' };
      }
      
      // Queue for retry
      this.queueSync(key, data);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull data from cloud
   */
  async pullFromCloud(key?: string): Promise<any> {
    if (!this.preferences.syncEnabled) {
      return null;
    }

    try {
      if (key) {
        // Pull specific key
        const result = await apiRequest<any>(`/api/sync/pull/${encodeURIComponent(key)}`);
        
        // Get metadata
        const meta = await CloudStorage.getSyncMeta(key);
        
        // If up to date, return null
        if (result.upToDate) {
          return null;
        }
        
        // Load actual data (for now, metadata is returned)
        return result;
      } else {
        // Pull all changes
        const since = localStorage.getItem('fuelpro_last_sync');
        const result = await apiRequest<any>(`/api/sync/changes?since=${since || '1970-01-01'}`);
        
        // Process changes
        for (const change of result.changes || []) {
          if (change.action === 'update') {
            await CloudStorage.setSyncMeta(change.dataKey, {
              version: change.version,
              lastModified: change.lastModified,
            });
          } else if (change.action === 'delete') {
            await CloudStorage.remove(change.dataKey);
          }
        }
        
        // Update last sync time
        localStorage.setItem('fuelpro_last_sync', result.syncTimestamp);
        
        return result;
      }
    } catch (error) {
      console.error('[CloudSync] Pull failed:', error);
      return null;
    }
  }

  /**
   * Full sync - push and pull
   */
  async sync(): Promise<{ pushed: number; pulled: number }> {
    if (this.isSyncing) {
      return { pushed: 0, pulled: 0 };
    }

    this.isSyncing = true;
    let pushed = 0;
    let pulled = 0;

    try {
      // Process sync queue
      const queueItems = Array.from(this.syncQueue.entries());
      for (const [key, item] of queueItems) {
        const result = await this.pushToCloud(key, item.data, true);
        if (result.success) {
          this.syncQueue.delete(key);
          pushed++;
        }
      }

      // Pull latest from cloud
      await this.pullFromCloud();
      pulled = 1;

      // Update last sync
      localStorage.setItem('fuelpro_last_sync', new Date().toISOString());
      
      console.log('[CloudSync] Sync complete:', { pushed, pulled });
    } catch (error) {
      console.error('[CloudSync] Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }

    return { pushed, pulled };
  }

  // ─── Queue Management ───
  private queueSync(key: string, data: any): void {
    this.syncQueue.set(key, {
      key,
      data,
      timestamp: Date.now(),
      retries: 0,
    });
  }

  private processQueue(): void {
    if (!this.isOnline || !this.preferences.syncEnabled) return;
    
    for (const [key, item] of this.syncQueue.entries()) {
      if (item.retries < 3) {
        this.pushToCloud(key, item.data)
          .then(result => {
            if (result.success) {
              this.syncQueue.delete(key);
            } else {
              item.retries++;
            }
          })
          .catch(() => {
            item.retries++;
          });
      }
    }
  }

  // ─── Auto Sync ───
  startAutoSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(async () => {
      // Check WiFi preference
      if (this.preferences.syncOnWifiOnly && !this.isWifi()) {
        return;
      }

      if (this.isOnline && !this.isSyncing) {
        await this.sync();
      }
    }, this.preferences.autoSyncInterval);

    console.log('[CloudSync] Auto-sync started:', this.preferences.autoSyncInterval + 'ms');
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[CloudSync] Auto-sync stopped');
    }
  }

  private isWifi(): boolean {
    const connection = (navigator as any).connection ||
                       (navigator as any).mozConnection ||
                       (navigator as any).webkitConnection;
    return connection ? connection.type === 'wifi' : true;
  }

  // ─── Event System ───
  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    return () => this.listeners.get(key)?.delete(callback);
  }

  private notifyListeners(key: string, data: any): void {
    this.listeners.get(key)?.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('[CloudSync] Listener error:', e);
      }
    });
    
    // Also notify global listeners
    this.listeners.get('*')?.forEach(cb => {
      try {
        cb({ key, data });
      } catch (e) {
        console.error('[CloudSync] Global listener error:', e);
      }
    });
  }

  // ─── Online/Offline Handling ───
  private initOnlineListener(): void {
    window.addEventListener('online', async () => {
      console.log('[CloudSync] Online');
      this.isOnline = true;
      
      // Sync queued items
      await this.sync();
    });

    window.addEventListener('offline', () => {
      console.log('[CloudSync] Offline');
      this.isOnline = false;
    });
  }

  // ─── Cross-Tab Sync ───
  private initBroadcastChannel(): void {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('fuelpro-sync');
      
      channel.onmessage = (event) => {
        const { type, key, data } = event.data;
        
        if (type === 'DATA_CHANGED') {
          this.notifyListeners(key, data);
        } else if (type === 'SYNC_REQUEST') {
          this.sync();
        }
      };
    }

    // Also listen to storage events (fallback)
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith('fuelpro_')) {
        const data = event.newValue ? JSON.parse(event.newValue) : null;
        this.notifyListeners(event.key, data);
      }
    });
  }

  // ─── Status ───
  getStatus(): SyncStatus {
    return {
      lastSyncAt: localStorage.getItem('fuelpro_last_sync'),
      deviceCount: 0, // Will be populated from API
      syncedDataCount: this.syncQueue.size,
      isOnline: this.isOnline,
      pendingChanges: this.syncQueue.size,
    };
  }

  async getFullStatus(): Promise<SyncStatus> {
    try {
      const status = await apiRequest<any>('/api/sync/status');
      return {
        ...status,
        isOnline: this.isOnline,
        pendingChanges: this.syncQueue.size,
      };
    } catch {
      return this.getStatus();
    }
  }

  // ─── Utility ───
  private getDataType(key: string): string {
    if (key.includes('station')) return 'station';
    if (key.includes('sale')) return 'sale';
    if (key.includes('inventory')) return 'inventory';
    if (key.includes('customer')) return 'customer';
    if (key.includes('user')) return 'user';
    if (key.includes('setting')) return 'setting';
    return 'data';
  }

  /**
   * Force a full refresh from cloud
   */
  async forceRefresh(): Promise<void> {
    // Clear local cache if not storing locally
    if (!this.preferences.storeLocally) {
      // Could clear IndexedDB here if needed
    }
    
    // Clear last sync to force full pull
    localStorage.removeItem('fuelpro_last_sync');
    
    // Perform sync
    await this.sync();
  }

  /**
   * Clear all synced data from cloud
   */
  async clearCloudData(keys?: string[]): Promise<void> {
    const keysToDelete = keys || [];
    
    for (const key of keysToDelete) {
      try {
        await apiRequest(`/api/sync/data/${encodeURIComponent(key)}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('[CloudSync] Failed to delete from cloud:', key, error);
      }
    }
  }
}

// ─── Singleton Instance ───
export const cloudSyncService = new CloudSyncService();

// ─── Make available globally for debugging ───
if (typeof window !== 'undefined') {
  (window as any).__cloudSyncService__ = cloudSyncService;
}

export default cloudSyncService;
