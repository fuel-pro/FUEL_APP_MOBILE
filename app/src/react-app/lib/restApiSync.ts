/**
 * REST API Sync - FuelPro
 * 
 * This module provides a complete cloud-synced database using REST API calls.
 * It works with any backend that supports CRUD operations via HTTP.
 * 
 * The API endpoints are:
 * - GET    /api/data/:collection - List all records
 * - GET    /api/data/:collection/:id - Get single record
 * - POST   /api/data/:collection - Create record
 * - PUT    /api/data/:collection/:id - Update record
 * - DELETE /api/data/:collection/:id - Delete record
 */

import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('vercel') 
    ? "https://fuel-pro-backend-v2-production.up.railway.app"
    : "http://localhost:3001");

const API_KEY = import.meta.env.VITE_API_KEY || "";

// ═══════════════════════════════════════════════════
// REST API CLIENT
// ═══════════════════════════════════════════════════

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: any
): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }
    
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify({ json: body }) : undefined,
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const result = await response.json();
    
    // Handle tRPC response format
    if (result?.result?.data?.json) {
      return { success: true, data: result.result.data.json };
    }
    
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════
// UNIFIED DATA STORE
// ═══════════════════════════════════════════════════

export interface DataRecord {
  id: string;
  collection: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  stationId?: string;
}

// Collection names
export const Collections = {
  USERS: "users",
  STATIONS: "stations",
  SALES: "sales",
  AUDIT_LOG: "audit_log",
  SECRETS: "secrets",
  FEATURE_FLAGS: "feature_flags",
  CONFIG: "config",
  SALES_ANALYTICS: "sales_analytics",
} as const;

// ═══════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════

// Create
export async function createRecord(
  collection: string,
  data: Record<string, any>,
  userId?: string,
  stationId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const id = `${collection}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: DataRecord = {
    id,
    collection,
    data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId,
    stationId,
  };
  
  const result = await apiRequest<DataRecord>("POST", `/api/data/${collection}`, record);
  return {
    success: result.success,
    id: result.success ? id : undefined,
    error: result.error,
  };
}

// Read
export async function getRecord(
  collection: string,
  id: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await apiRequest<DataRecord>("GET", `/api/data/${collection}/${id}`);
  if (result.success && result.data) {
    return { success: true, data: result.data.data || result.data };
  }
  return { success: false, error: result.error || "Not found" };
}

// Update
export async function updateRecord(
  collection: string,
  id: string,
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const record: Partial<DataRecord> = {
    data,
    updatedAt: new Date().toISOString(),
  };
  
  return apiRequest<DataRecord>("PUT", `/api/data/${collection}/${id}`, record);
}

// Delete
export async function deleteRecord(
  collection: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  return apiRequest("DELETE", `/api/data/${collection}/${id}`);
}

// List
export async function listRecords(
  collection: string,
  options?: { userId?: string; stationId?: string; limit?: number }
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const params = new URLSearchParams();
  if (options?.userId) params.append("userId", options.userId);
  if (options?.stationId) params.append("stationId", options.stationId);
  if (options?.limit) params.append("limit", String(options.limit));
  
  const queryString = params.toString();
  const path = `/api/data/${collection}${queryString ? `?${queryString}` : ""}`;
  
  const result = await apiRequest<DataRecord[]>("GET", path);
  if (result.success && Array.isArray(result.data)) {
    return { 
      success: true, 
      data: result.data.map((r: any) => r.data || r) 
    };
  }
  return { success: false, error: result.error };
}

// ═══════════════════════════════════════════════════
// SPECIALIZED STORES
// ═══════════════════════════════════════════════════

// Audit Log
export const auditLogStore = {
  async add(event: string, detail: string, user: string, severity: string = "info") {
    return createRecord(Collections.AUDIT_LOG, {
      event,
      detail,
      user,
      severity,
      timestamp: new Date().toISOString(),
    });
  },
  async list(limit = 100) {
    const result = await listRecords(Collections.AUDIT_LOG, { limit });
    return result;
  },
};

// Users
export const userStore = {
  async create(data: any) {
    return createRecord(Collections.USERS, data);
  },
  async update(id: string, data: any) {
    return updateRecord(Collections.USERS, id, data);
  },
  async get(id: string) {
    return getRecord(Collections.USERS, id);
  },
  async list(options?: { limit?: number }) {
    return listRecords(Collections.USERS, options);
  },
};

// Stations
export const stationStore = {
  async create(data: any, stationId?: string) {
    return createRecord(Collections.STATIONS, data, undefined, stationId);
  },
  async update(id: string, data: any) {
    return updateRecord(Collections.STATIONS, id, data);
  },
  async get(id: string) {
    return getRecord(Collections.STATIONS, id);
  },
  async list(stationId?: string) {
    return listRecords(Collections.STATIONS, { stationId });
  },
};

// Secrets
export const secretsStore = {
  async create(data: { key: string; value: string }) {
    return createRecord(Collections.SECRETS, data);
  },
  async update(id: string, data: { key: string; value: string }) {
    return updateRecord(Collections.SECRETS, id, data);
  },
  async delete(id: string) {
    return deleteRecord(Collections.SECRETS, id);
  },
  async list() {
    return listRecords(Collections.SECRETS);
  },
};

// Feature Flags
export const featureFlagsStore = {
  async create(data: { id: string; name: string; description: string; enabled: boolean }) {
    return createRecord(Collections.FEATURE_FLAGS, data);
  },
  async update(id: string, data: any) {
    return updateRecord(Collections.FEATURE_FLAGS, id, data);
  },
  async list() {
    return listRecords(Collections.FEATURE_FLAGS);
  },
};

// Sales
export const salesStore = {
  async create(data: any, stationId?: string) {
    return createRecord(Collections.SALES, data, undefined, stationId);
  },
  async list(stationId?: string, limit?: number) {
    return listRecords(Collections.SALES, { stationId, limit });
  },
  async analytics(stationId?: string) {
    const result = await listRecords(Collections.SALES_ANALYTICS, { stationId, limit: 1 });
    return result;
  },
};

// Config
export const configStore = {
  async get(key: string) {
    return getRecord(Collections.CONFIG, key);
  },
  async set(key: string, value: any) {
    const existing = await getRecord(Collections.CONFIG, key);
    if (existing.success) {
      return updateRecord(Collections.CONFIG, key, value);
    }
    return createRecord(Collections.CONFIG, { key, value });
  },
  async list() {
    return listRecords(Collections.CONFIG);
  },
};

// ═══════════════════════════════════════════════════
// STATUS CHECK
// ═══════════════════════════════════════════════════

export async function checkApiStatus(): Promise<{
  connected: boolean;
  url: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_URL}/`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (response.ok) {
      return { connected: true, url: API_URL };
    }
    
    return { 
      connected: false, 
      url: API_URL, 
      error: `HTTP ${response.status}` 
    };
  } catch (err: any) {
    return { 
      connected: false, 
      url: API_URL, 
      error: err.message 
    };
  }
}

// ═══════════════════════════════════════════════════
// FALLBACK MODE
// ═══════════════════════════════════════════════════

// When API is not available, operations are queued locally
const SYNC_QUEUE_KEY = "fuelpro_api_sync_queue";
const PENDING_CHANGES_KEY = "fuelpro_pending_changes";

interface PendingChange {
  id: string;
  collection: string;
  operation: "create" | "update" | "delete";
  data?: any;
  timestamp: number;
}

export function queuePendingChange(
  collection: string,
  operation: "create" | "update" | "delete",
  data?: any,
  localId?: string
): void {
  const queue = getPendingChanges();
  queue.push({
    id: localId || `${collection}_${Date.now()}`,
    collection,
    operation,
    data,
    timestamp: Date.now(),
  });
  localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(queue));
}

export function getPendingChanges(): PendingChange[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_CHANGES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearPendingChanges(): void {
  localStorage.setItem(PENDING_CHANGES_KEY, "[]");
}

export function getPendingCount(): number {
  return getPendingChanges().length;
}
