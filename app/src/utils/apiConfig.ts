/**
 * API Configuration Utility - Fixed v2
 *
 * Provides centralized API URL management for different deployment environments.
 * Uses direct backend URL for auth endpoints to avoid proxy issues.
 * Uses relative /api/* paths (Vercel proxy) for tRPC calls.
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
 * On Vercel: returns "" so requests use /api/* Vercel proxy routes.
 * Locally: returns the full backend URL.
 */
export function getApiUrl(): string {
  if (typeof window !== "undefined" && isVercelDeployment()) {
    return ""; // Vercel proxy handles /api/* -> Railway
  }
  return TRPC_API_URL;
}

export function getApiPath(path: string): string {
  const base = getApiUrl();
  return base ? `${base}${path}` : path;
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
 * Returns "" on Vercel so AuthContext fetch calls use /api/* proxy.
 * The Vercel proxy (vercel.json) routes /api/* to the correct Railway backend.
 */
export function getBackendUrl(): string {
  if (typeof window !== "undefined" && isVercelDeployment()) {
    return ""; // Use /api/* Vercel proxy (vercel.json routes to Railway)
  }
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
