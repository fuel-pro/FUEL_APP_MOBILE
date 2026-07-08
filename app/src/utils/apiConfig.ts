/**
 * API Configuration Utility
 * 
 * Provides centralized API URL management for different deployment environments.
 * In Vercel/static deployments, uses relative URLs to proxy through Vercel
 * which handles CORS headers. In other environments, uses direct backend URL.
 * 
 * Priority:
 * 1. VITE_API_URL (environment variable)
 * 2. Fallback to Railway backend URL
 */

// tRPC API Server (new backend with MySQL)
const TRPC_API_URL = import.meta.env.VITE_API_URL || "https://fuel-pro-tprc-api.up.railway.app";

// Legacy REST API Server (old Express backend)
const BACKEND_URL = "https://fuel-pro-backend-v2-production-7c2b.up.railway.app";

// Google Gemini API Key (for AI features)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Detect if we're in a Vercel deployment
function isVercelDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host.includes("vercel.app") ||
    host.includes("netlify.app") ||
    host.includes("github.io")
  );
}

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    // For Vercel/static deployments, use relative path to proxy through Vercel
    if (isVercelDeployment()) {
      return "";
    }
  }
  return TRPC_API_URL;
}

export function getApiPath(path: string): string {
  const base = getApiUrl();
  if (base) {
    return `${base}${path}`;
  }
  return path;
}

// Get tRPC API URL (for tRPC client)
export function getTrpcUrl(): string {
  if (typeof window !== "undefined" && isVercelDeployment()) {
    return "/api/trpc";
  }
  return `${TRPC_API_URL}/api/trpc`;
}

// Get legacy REST API URL (for REST endpoints)
export function getRestApiUrl(): string {
  if (typeof window !== "undefined" && isVercelDeployment()) {
    return "/api";
  }
  return `${BACKEND_URL}/api`;
}

// Get backend URL (legacy)
export function getBackendUrl(): string {
  if (typeof window !== "undefined" && isVercelDeployment()) {
    return ""; // Use relative path for Vercel proxy
  }
  return BACKEND_URL;
}

// Get Gemini API URL with key
export function getGeminiUrl(): string {
  if (GEMINI_API_KEY) {
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  }
  return "";
}

// Check if running on Vercel (can proxy requests)
export function isProxiedDeployment(): boolean {
  return isVercelDeployment();
}
