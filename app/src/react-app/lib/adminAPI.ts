/**
 * FuelPro Admin API Client
 * Frontend API client for secure backend communication
 *
 * NOTE: This is the frontend client. The actual backend implementation
 * should mirror these endpoints with proper server-side validation,
 * authentication middleware, and database queries.
 */

import { AdminUser, AdminAPIClient } from "./adminAuth";
import { AuditFilter, AuditLogEntry, auditLog } from "./auditLogger";

// ═══════════════════════════════════════════════════════════════════
// API CLIENT INSTANCE
// ═══════════════════════════════════════════════════════════════════

const api = new AdminAPIClient("/api");

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS (mirrors backend)
// ═══════════════════════════════════════════════════════════════════

// ─── Settings Types ───
export interface GlobalSettings {
  company: {
    name: string;
    logo?: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
  };
  localization: {
    currency: string;
    currencySymbol: string;
    timezone: string;
    dateFormat: string;
    language: string;
  };
  business: {
    fuelTypes: string[];
    defaultPrices: Record<string, number>;
    taxRate: number;
    kraPin?: string;
    vatRegNo?: string;
  };
  security: {
    sessionTimeout: number;
    passwordMinLength: number;
    mfaRequired: boolean;
    ipWhitelist?: string[];
  };
  integrations: {
    mpesa: {
      enabled: boolean;
      consumerKey?: string;
      environment: "sandbox" | "production";
    };
    firebase: {
      enabled: boolean;
      apiKey?: string;
    };
    supabase: {
      enabled: boolean;
      url?: string;
    };
    seafile: {
      enabled: boolean;
      url?: string;
    };
  };
  features: {
    loyalty: boolean;
    payroll: boolean;
    delivery: boolean;
    creditSales: boolean;
  };
}

// ─── User Types ───
export interface CreateUserRequest {
  email: string;
  name: string;
  role: string;
  stationIds: string[];
  permissions?: string[];
}

export interface UpdateUserRequest {
  name?: string;
  role?: string;
  stationIds?: string[];
  permissions?: string[];
  isActive?: boolean;
}

// ─── Station Types ───
export interface StationData {
  id: string;
  name: string;
  location: string;
  address: string;
  managerId?: string;
  isActive: boolean;
  settings: Record<string, any>;
}

// ─── API Response Types ───
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// ─── Auth API ───
// NOTE: These functions previously called /api/admin/auth/* endpoints which don't exist.
// Refactored to use the existing main auth system (/api/auth/*) with founder/admin role checks.
// The separate admin auth system was never fully implemented on the backend.
export const AdminAuthAPI = {
  async login(email: string, password: string, _mfaCode?: string) {
    try {
      // Use the main auth API - founder accounts are identified by their role
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();
      
      // Check if user has admin/founder role
      if (data.user?.role !== "founder" && data.user?.role !== "admin") {
        throw new Error("Admin access required. This account does not have admin privileges.");
      }

      // Store admin token
      if (data.token) {
        localStorage.setItem("fuelpro_admin_token", data.token);
      }

      return data;
    } catch (e) {
      console.error("[AdminAPI] Login error:", e);
      throw e;
    }
  },

  async logout() {
    try {
      // Clear admin token
      localStorage.removeItem("fuelpro_admin_token");
      
      // Call main auth logout
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      // Ignore logout errors - clear local state anyway
      console.warn("[AdminAPI] Logout warning:", e);
      localStorage.removeItem("fuelpro_admin_token");
    }
  },

  async refreshToken(refreshToken: string) {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        credentials: "include",
      });

      if (!response.ok) {
        localStorage.removeItem("fuelpro_admin_token");
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      
      // Update admin token if present
      if (data.token) {
        localStorage.setItem("fuelpro_admin_token", data.token);
      }

      return data;
    } catch (e) {
      console.error("[AdminAPI] Token refresh error:", e);
      localStorage.removeItem("fuelpro_admin_token");
      throw e;
    }
  },

  async getProfile() {
    return api.get<AdminUser>("/admin/profile");
  },

  async updateProfile(data: Partial<AdminUser>) {
    return api.put<AdminUser>("/admin/profile", data);
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return api.post("/admin/auth/change-password", {
      currentPassword,
      newPassword,
    });
  },
};

// ─── Users API ───
export const AdminUsersAPI = {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return api.get<PaginatedResponse<AdminUser>>(
      `/admin/users${query ? `?${query}` : ""}`
    );
  },

  async get(id: string) {
    return api.get<AdminUser>(`/admin/users/${id}`);
  },

  async create(data: CreateUserRequest) {
    return api.post<AdminUser>("/admin/users", data);
  },

  async update(id: string, data: UpdateUserRequest) {
    return api.put<AdminUser>(`/admin/users/${id}`, data);
  },

  async delete(id: string) {
    return api.delete(`/admin/users/${id}`);
  },

  async resetPassword(id: string) {
    return api.post(`/admin/users/${id}/reset-password`, {});
  },
};

// ─── Stations API ───
export const AdminStationsAPI = {
  async list(params?: { page?: number; limit?: number; search?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return api.get<PaginatedResponse<StationData>>(
      `/admin/stations${query ? `?${query}` : ""}`
    );
  },

  async get(id: string) {
    return api.get<StationData>(`/admin/stations/${id}`);
  },

  async create(data: Omit<StationData, "id">) {
    return api.post<StationData>("/admin/stations", data);
  },

  async update(id: string, data: Partial<StationData>) {
    return api.put<StationData>(`/admin/stations/${id}`, data);
  },

  async delete(id: string) {
    return api.delete(`/admin/stations/${id}`);
  },

  async getStats(id: string) {
    return api.get<any>(`/admin/stations/${id}/stats`);
  },
};

// ─── Settings API ───
export const AdminSettingsAPI = {
  async get() {
    return api.get<GlobalSettings>("/admin/settings");
  },

  async update(data: Partial<GlobalSettings>) {
    return api.put<GlobalSettings>("/admin/settings", data);
  },

  async getByCategory(category: string) {
    return api.get<any>(`/admin/settings/${category}`);
  },

  async updateCategory(category: string, data: any) {
    return api.put<any>(`/admin/settings/${category}`, data);
  },

  async export() {
    return api.get<{ settings: GlobalSettings; exportedAt: string }>(
      "/admin/settings/export"
    );
  },

  async import(data: GlobalSettings) {
    return api.post("/admin/settings/import", data);
  },
};

// ─── Audit API ───
export const AdminAuditAPI = {
  async list(filter?: AuditFilter) {
    const params = new URLSearchParams(filter as any).toString();
    return api.get<PaginatedResponse<AuditLogEntry>>(
      `/admin/audit${params ? `?${params}` : ""}`
    );
  },

  async get(id: string) {
    return api.get<AuditLogEntry>(`/admin/audit/${id}`);
  },

  async getStats(dateRange?: { start: string; end: string }) {
    const params = dateRange ? new URLSearchParams(dateRange).toString() : "";
    return api.get<any>(`/admin/audit/stats${params ? `?${params}` : ""}`);
  },

  async export(format: "json" | "csv" = "json") {
    const response = await fetch(`/api/admin/audit/export?format=${format}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("fuelpro_admin_token")}`,
      },
    });
    return response.text();
  },
};

// ─── API Keys API ───
export const AdminAPIKeysAPI = {
  async list() {
    return api.get<any[]>("/admin/api-keys");
  },

  async create(name: string, permissions: string[], expiresIn?: number) {
    return api.post<{ key: string; name: string; expiresAt: string }>(
      "/admin/api-keys",
      {
        name,
        permissions,
        expiresIn,
      }
    );
  },

  async revoke(id: string) {
    return api.delete(`/admin/api-keys/${id}`);
  },
};

// ─── System API ───
export const AdminSystemAPI = {
  async getHealth() {
    return api.get<{
      status: "healthy" | "degraded" | "down";
      uptime: number;
      version: string;
      services: Record<string, "up" | "down" | "degraded">;
    }>("/admin/system/health");
  },

  async getMetrics() {
    return api.get<any>("/admin/system/metrics");
  },

  async createBackup() {
    return api.post<{ backupId: string; createdAt: string }>(
      "/admin/system/backup",
      {}
    );
  },

  async listBackups() {
    return api.get<any[]>("/admin/system/backups");
  },

  async restoreBackup(backupId: string) {
    return api.post(`/admin/system/restore`, { backupId });
  },
};

// ─── Webhooks API ───
export const AdminWebhooksAPI = {
  async list() {
    return api.get<any[]>("/admin/webhooks");
  },

  async create(data: { url: string; events: string[]; secret?: string }) {
    return api.post<any>("/admin/webhooks", data);
  },

  async update(
    id: string,
    data: Partial<{ url: string; events: string[]; isActive: boolean }>
  ) {
    return api.put<any>(`/admin/webhooks/${id}`, data);
  },

  async delete(id: string) {
    return api.delete(`/admin/webhooks/${id}`);
  },

  async test(id: string) {
    return api.post<{ success: boolean; response: any }>(
      `/admin/webhooks/${id}/test`,
      {}
    );
  },

  async getDeliveries(webhookId: string) {
    return api.get<any[]>(`/admin/webhooks/${webhookId}/deliveries`);
  },
};

// ═══════════════════════════════════════════════════════════════════
// FRONTEND-ONLY IMPLEMENTATION (for demo/dev)
// In production, all these would be server-side only
// ═══════════════════════════════════════════════════════════════════

export class AdminAPI {
  // Simulated responses for frontend development
  // These would be replaced by real API calls in production

  static async simulateResponse<T>(data: T, delay = 300): Promise<T> {
    await new Promise(resolve => setTimeout(resolve, delay));
    return data;
  }

  static getMockUsers(): AdminUser[] {
    return [
      {
        id: "user_1",
        email: "admin@fuelpro.app",
        name: "Admin User",
        role: "admin",
        permissions: ["*"],
        stationIds: ["*"],
        isActive: true,
        lastLogin: new Date().toISOString(),
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: new Date().toISOString(),
      },
      {
        id: "user_2",
        email: "founder@fuelpro.app",
        name: "Leon Founder",
        role: "founder",
        permissions: ["*"],
        stationIds: ["*"],
        isActive: true,
        lastLogin: new Date().toISOString(),
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: new Date().toISOString(),
      },
      {
        id: "user_3",
        email: "manager@station.com",
        name: "Station Manager",
        role: "manager",
        permissions: [
          "stations:view",
          "stations:edit",
          "sales:view",
          "sales:create",
        ],
        stationIds: ["station_1"],
        isActive: true,
        lastLogin: "2024-06-01T10:00:00Z",
        createdAt: "2024-02-01T00:00:00Z",
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  static getMockSettings(): GlobalSettings {
    return {
      company: {
        name: "FuelPro Kenya",
        address: "123 Business Park, Nairobi",
        phone: "+254700123456",
        email: "info@fuelpro.app",
      },
      localization: {
        currency: "KES",
        currencySymbol: "KSh",
        timezone: "Africa/Nairobi",
        dateFormat: "DD/MM/YYYY",
        language: "en",
      },
      business: {
        fuelTypes: ["PMS", "AGO", "Kerosene"],
        defaultPrices: { PMS: 183.5, AGO: 168.3, Kerosene: 103.5 },
        taxRate: 0.16,
      },
      security: {
        sessionTimeout: 3600,
        passwordMinLength: 8,
        mfaRequired: false,
      },
      integrations: {
        mpesa: { enabled: true, environment: "sandbox" },
        firebase: { enabled: false },
        supabase: { enabled: true },
        seafile: { enabled: false },
      },
      features: {
        loyalty: true,
        payroll: true,
        delivery: true,
        creditSales: true,
      },
    };
  }

  static getMockStations(): StationData[] {
    return [
      {
        id: "station_1",
        name: "Downtown Station",
        location: "Nairobi CBD",
        address: "123 Main Street, Nairobi",
        managerId: "user_3",
        isActive: true,
        settings: {},
      },
      {
        id: "station_2",
        name: "Westlands Fuel Center",
        location: "Westlands",
        address: "456 Waiyaki Way, Westlands",
        isActive: true,
        settings: {},
      },
    ];
  }
}

export default {
  api,
  AdminAuthAPI,
  AdminUsersAPI,
  AdminStationsAPI,
  AdminSettingsAPI,
  AdminAuditAPI,
  AdminAPIKeysAPI,
  AdminSystemAPI,
  AdminWebhooksAPI,
  AdminAPI,
};
