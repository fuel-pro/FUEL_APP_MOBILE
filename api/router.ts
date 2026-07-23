/**
 * TypeScript type definitions for the tRPC router.
 * 
 * These types define the API contract between the frontend and the backend.
 * The actual router implementation is in the backend repository.
 * 
 * Backend URL: https://fuel-pro-backend-v2-production-7c2b.up.railway.app
 */

// Base types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'manager' | 'attendant' | 'founder';
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Station {
  id: string;
  name: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FounderSession {
  id: string;
  token: string;
  active: boolean;
  loginTime: number;
  userId?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  userId?: string;
  stationId?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// tRPC router type - compatible with @trpc/server
// This defines the shape of the API that the frontend expects
export interface AppRouter {
  founderAuth: {
    login: {
      input: { email: string; password: string };
      output: { success: boolean; token?: string; user?: User };
    };
    logout: {
      input: void;
      output: { success: boolean };
    };
    changePassword: {
      input: { currentPassword: string; newPassword: string };
      output: { success: boolean };
    };
    getAllUsers: {
      input: void;
      output: User[];
    };
    getAllStations: {
      input: void;
      output: Station[];
    };
  };
  audit: {
    log: {
      input: { action: string; details?: Record<string, unknown> };
      output: { success: boolean };
    };
    listAll: {
      input: { limit?: number; offset?: number };
      output: AuditLog[];
    };
    summary: {
      input: void;
      output: { totalActions: number; recentActivity: AuditLog[] };
    };
    getFounderSession: {
      input: void;
      output: FounderSession | null;
    };
    upsertFounderSession: {
      input: Partial<FounderSession>;
      output: { success: boolean };
    };
  };
  station: {
    list: {
      input: void;
      output: Station[];
    };
    get: {
      input: { id: string };
      output: Station | null;
    };
    create: {
      input: Partial<Station>;
      output: Station;
    };
    update: {
      input: { id: string; data: Partial<Station> };
      output: Station;
    };
    delete: {
      input: { id: string };
      output: { success: boolean };
    };
  };
  sale: {
    analytics: {
      input: void;
      output: {
        totalSales: number;
        recentSales: unknown[];
        revenue: number;
      };
    };
    list: {
      input: { limit?: number; stationId?: string };
      output: unknown[];
    };
  };
  userMgmt: {
    list: {
      input: void;
      output: User[];
    };
    stats: {
      input: void;
      output: {
        total: number;
        active: number;
        byRole: Record<string, number>;
      };
    };
    updateRole: {
      input: { userId: string; role: User['role'] };
      output: User;
    };
    updateStatus: {
      input: { userId: string; status: User['status'] };
      output: User;
    };
  };
}
