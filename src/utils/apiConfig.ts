/**
 * API Configuration Utility - Fixed v4
 *
 * Uses direct backend URL for auth endpoints.
 * Uses Vercel proxy for tRPC calls.
 */

// Production REST API backend (Railway)
const BACKEND_URL = "https://fuel-pro-backend-v2-production-7c2b.up.railway.app";

// tRPC API (may differ from REST backend)
const TRPC_API_URL = import.meta.env.VITE_API_URL || "https://fuel-pro-backend-v2-production-7c2b.up.railway.app";

// Google Gemini API Key (for AI features)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Detect static/Vercel deployment
function isVercelDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host.includes("vercel.app") ||
    host.includes("netlify.app") ||
    host.includes("github.io") ||
    host.includes("fuel-app-mobile")
  );
}

/**
 * Get the API base URL.
 * Always uses direct backend URL to avoid proxy issues.
 */
export function getApiUrl(): string {
  return BACKEND_URL;
}

export function getApiPath(path: string): string {
  return `${BACKEND_URL}${path}`;
}

/** Get tRPC endpoint URL */
export function getTrpcUrl(): string {
  if (typeof window !== "undefined" && isVercelDeployment()) {
    return "/api/trpc";
  }
  return `${TRPC_API_URL}/api/trpc`;
}

/** Get REST API base URL */
export function getRestApiUrl(): string {
  if (typeof window !== "undefined" && isVercelDeployment()) {
    return "/api";
  }
  return `${BACKEND_URL}/api`;
}

/**
 * Get backend URL for auth and data fetching.
 * Always uses direct backend URL.
 */
export function getBackendUrl(): string {
  return BACKEND_URL;
}

/** Get Gemini AI API URL */
export function getGeminiUrl(): string {
  if (GEMINI_API_KEY) {
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  }
  return "";
}

/** Check if running in a proxied/Vercel deployment */
export function isProxiedDeployment(): boolean {
  return isVercelDeployment();
}
