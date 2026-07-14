// ============================================================
// FirebaseService - Cloud persistence for FuelPro
// Uses Firebase Realtime Database (free tier: 1GB storage)
// All data encrypted locally before transmission
// ============================================================

// Firebase config - configure your own Firebase project
const FIREBASE_CONFIG = {
  databaseURL: "https://fuelpro-cloud-default-rtdb.firebaseio.com",
  apiKey: "YOUR_FIREBASE_API_KEY",
  projectId: "fuelpro-cloud",
};

interface CloudData {
  stationId: string;
  data: Record<string, any>;
  version: number;
  lastModified: string;
  deviceId: string;
}

// Generate a unique device ID for this browser
function getDeviceId(): string {
  let id = localStorage.getItem("fuelpro_device_id");
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("fuelpro_device_id", id);
  }
  return id;
}

// Simple XOR encryption for data before transmission
function encrypt(data: string, key: string): string {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(
      data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(result);
}

function decrypt(data: string, key: string): string {
  try {
    const decoded = atob(data);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  } catch {
    return "{}";
  }
}

// Derive encryption key from station credentials
function getEncryptionKey(stationId: string): string {
  const base =
    localStorage.getItem("fuelpro_cloud_key") || "fuelpro_default_key_2026";
  return `${base}_${stationId}`;
}

export const FirebaseService = {
  // Check if cloud sync is enabled
  isEnabled(): boolean {
    return localStorage.getItem("fuelpro_cloud_enabled") === "true";
  },

  // Enable/disable cloud sync
  setEnabled(enabled: boolean): void {
    localStorage.setItem("fuelpro_cloud_enabled", String(enabled));
  },

  // Set custom encryption key
  setEncryptionKey(key: string): void {
    localStorage.setItem("fuelpro_cloud_key", key);
  },

  // Sync all data to cloud
  async syncToCloud(stationId: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const allData: Record<string, any> = {};

      // Collect all relevant localStorage data
      const keys = [
        `fuelpro_data_${stationId}`,
        `fuelpro_inventory`,
        `fuelpro_customers`,
        `fuelpro_shifts`,
        `fuelpro_employees`,
        `fuelpro_credit_accounts`,
        `fuelpro_quality_tests`,
        `fuelpro_sync_result_${stationId}`,
        `fuelpro_fuel_prices_KE`,
      ];

      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            allData[key] = JSON.parse(value);
          } catch {
            allData[key] = value;
          }
        }
      }

      const payload: CloudData = {
        stationId,
        data: allData,
        version: Date.now(),
        lastModified: new Date().toISOString(),
        deviceId: getDeviceId(),
      };

      const encrypted = encrypt(
        JSON.stringify(payload),
        getEncryptionKey(stationId)
      );

      const response = await fetch(
        `${FIREBASE_CONFIG.databaseURL}/stations/${stationId}.json`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ encrypted, timestamp: Date.now() }),
        }
      );

      if (response.ok) {
        localStorage.setItem(
          "fuelpro_last_cloud_sync",
          new Date().toISOString()
        );
        // Dispatch event for UI update
        window.dispatchEvent(
          new CustomEvent("fuelpro-cloud-sync", {
            detail: { success: true, stationId },
          })
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error("[Firebase] Sync failed:", error);
      return false;
    }
  },

  // Restore data from cloud
  async restoreFromCloud(stationId: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const response = await fetch(
        `${FIREBASE_CONFIG.databaseURL}/stations/${stationId}.json`
      );
      if (!response.ok) return false;

      const result = await response.json();
      if (!result?.encrypted) return false;

      const decrypted = decrypt(result.encrypted, getEncryptionKey(stationId));
      const payload: CloudData = JSON.parse(decrypted);

      if (payload.data) {
        // Restore each data key to localStorage
        for (const [key, value] of Object.entries(payload.data)) {
          if (value !== null && value !== undefined) {
            localStorage.setItem(
              key,
              typeof value === "string" ? value : JSON.stringify(value)
            );
          }
        }

        localStorage.setItem(
          "fuelpro_last_cloud_sync",
          new Date().toISOString()
        );
        window.dispatchEvent(
          new CustomEvent("fuelpro-cloud-sync", {
            detail: { success: true, restored: true, stationId },
          })
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error("[Firebase] Restore failed:", error);
      return false;
    }
  },

  // Auto-sync on interval
  startAutoSync(
    stationId: string,
    intervalMs = 60000
  ): ReturnType<typeof setInterval> {
    return setInterval(() => {
      if (this.isEnabled()) {
        this.syncToCloud(stationId);
      }
    }, intervalMs);
  },

  // Get last sync info
  getLastSyncInfo(): {
    lastSync: string | null;
    deviceId: string;
    enabled: boolean;
  } {
    return {
      lastSync: localStorage.getItem("fuelpro_last_cloud_sync"),
      deviceId: getDeviceId(),
      enabled: this.isEnabled(),
    };
  },

  // Clear all cloud data for a station
  async clearCloudData(stationId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${FIREBASE_CONFIG.databaseURL}/stations/${stationId}.json`,
        {
          method: "DELETE",
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  },
};
