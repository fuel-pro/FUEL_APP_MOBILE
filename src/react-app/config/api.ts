/**
 * FuelPro API Configuration
 * Centralized API client for backend communication
 */

import { getBackendUrl } from "@/utils/apiConfig";

function getApiBase(): string {
  return getBackendUrl();
}

// Backend API URL - uses centralized config that handles Vercel proxy
export function getApiBaseUrl(): string {
  return getApiBase();
}

// Get auth token from founder session
export function getAuthToken(): string | null {
  try {
    // Try new token key from founder-auth.ts
    const token = localStorage.getItem("fuelpro_auth_token");
    if (token) return token;
    
    // Try founder session token (legacy format)
    const sessionJson = localStorage.getItem("fuelpro_founder_session");
    if (sessionJson) {
      const session = JSON.parse(sessionJson);
      if (session.active && session.token) {
        // Check if session is still valid (8 hours)
        if (session.loginTime && Date.now() - session.loginTime < 8 * 60 * 60 * 1000) {
          return session.token;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// API Endpoints - using functions to ensure lazy evaluation
export const API_ENDPOINTS = {
  // Dashboard
  get DASHBOARD_STATS() { return `${getApiBase()}/api/dashboard/stats`; },
  get SALES_TREND() { return `${getApiBase()}/api/dashboard/sales-trend`; },
  get FUEL_DISTRIBUTION() { return `${getApiBase()}/api/dashboard/fuel-distribution`; },
  get CURRENT_PRICES() { return `${getApiBase()}/api/dashboard/current-prices`; },
  
  // Authentication
  get LOGIN() { return `${getApiBase()}/api/auth/login`; },
  get REGISTER() { return `${getApiBase()}/api/auth/register`; },
  get ME() { return `${getApiBase()}/api/auth/me`; },
  
  // M-PESA
  get MPESA_STK() { return `${getApiBase()}/api/mpesa/stkpush`; },
  get MPESA_STATUS() { return `${getApiBase()}/api/mpesa/stkstatus`; },
  get MPESA_CONFIG() { return `${getApiBase()}/api/mpesa/config`; },
  
  // Cloud Sync
  get CLOUD_DATA() { return `${getApiBase()}/api/data`; },
  get USER_DATA() { return `${getApiBase()}/api/user-data`; },
};

// API Request Helper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  };

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        // Handle unauthorized - clear session
        localStorage.removeItem('fuelpro_auth_token');
        localStorage.removeItem('fuelpro_founder_session');
        console.warn('Session expired - please login again');
      }
      
      return {
        success: false,
        error: data?.error || data?.message || `API Error: ${response.status}`
      };
    }

    return data;
  } catch (error) {
    console.error(`API Request Failed: ${endpoint}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// Dashboard API helpers
export const dashboardApi = {
  async getStats(): Promise<ApiResponse<{
    totalRevenue: number;
    netProfit: number;
    fuelSold: number;
    balanceDue: number;
    todaySales: number;
    timestamp: string;
  }>> {
    return apiRequest(API_ENDPOINTS.DASHBOARD_STATS);
  },

  async getSalesTrend(): Promise<ApiResponse<Array<{
    date: string;
    revenue: number;
    fuelSold: number;
  }>>> {
    return apiRequest(API_ENDPOINTS.SALES_TREND);
  },

  async getFuelDistribution(): Promise<ApiResponse<{
    petrol: number;
    diesel: number;
    kerosene: number;
  }>> {
    return apiRequest(API_ENDPOINTS.FUEL_DISTRIBUTION);
  },

  async getCurrentPrices(): Promise<ApiResponse<{
    petrol: number;
    diesel: number;
    kerosene: number;
  }>> {
    return apiRequest(API_ENDPOINTS.CURRENT_PRICES);
  },
};

export default {
  getApiBaseUrl,
  API_ENDPOINTS,
  apiRequest,
  dashboardApi,
  getAuthToken,
};