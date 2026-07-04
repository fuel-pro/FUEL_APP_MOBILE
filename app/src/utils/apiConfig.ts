/**
 * API Configuration Utility
 * 
 * Provides centralized API URL management for different deployment environments.
 * In Vercel/static deployments, uses relative URLs to proxy through Vercel
 * which handles CORS headers. In other environments, uses direct backend URL.
 */

const BACKEND_URL = "https://fuel-pro-backend-v2-production-7c2b.up.railway.app";

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // For Vercel/static deployments, use relative path to proxy through Vercel
    if (
      host.includes("vercel.app") ||
      host.includes("netlify.app") ||
      host.includes("github.io") ||
      host.includes("localhost")
    ) {
      return "";
    }
  }
  return BACKEND_URL;
}

export function getApiPath(path: string): string {
  const base = getApiUrl();
  if (base) {
    return `${base}${path}`;
  }
  return path;
}

export function getBackendUrl(): string {
  return BACKEND_URL;
}

// Check if running on Vercel (can proxy requests)
export function isProxiedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host.includes("vercel.app") ||
    host.includes("netlify.app") ||
    host.includes("github.io")
  );
}
