import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { useState } from "react";

export const trpc = createTRPCReact<AppRouter>();

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: (failureCount, error: any) => {
          // Don't retry on 401/403 errors
          if (error?.data?.code === "UNAUTHORIZED" || error?.data?.code === "FORBIDDEN") {
            return false;
          }
          return failureCount < 3;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Check if we're in a static deployment
function isStaticDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes("vercel.app") || host.includes("netlify.app") || host.includes("github.io");
}

// Determine the correct API URL - use relative path for Vercel deployments
// to leverage the Vercel proxy which handles CORS headers
function getApiUrl(): string {
  // For Vercel/static deployments, use relative URL to go through proxy
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("vercel.app") || host.includes("netlify.app") || host.includes("github.io")) {
      // Use relative path - but only if backend is configured
      // Otherwise use Firebase-only mode
      if (import.meta.env.VITE_TRPC_URL || import.meta.env.VITE_BACKEND_URL) {
        return "/api/trpc";
      }
    }
  }
  // For other environments, use the configured backend URL
  // Return empty string if not configured (Firebase-only mode)
  return import.meta.env.VITE_TRPC_URL || import.meta.env.VITE_BACKEND_URL + "/api/trpc" || "";
}

// Check if Firebase is configured
const isFirebaseConfigured = () => !!import.meta.env.VITE_FIREBASE_API_KEY;

// Get Firebase auth token (async)
async function getFirebaseToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  
  try {
    // Dynamic import to avoid circular dependencies
    const { getFirebaseAuth } = await import("@/firebase/client");
    const { getIdToken } = await import("firebase/auth");
    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      return await getIdToken(auth.currentUser, true);
    }
  } catch {
    /* Firebase not available */
  }
  return null;
}

function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: getApiUrl(),
        transformer: superjson,
        // Limit URL length to prevent 431 errors from oversized batch requests
        // Standard limit is 8KB, we use 2000 to be safe across proxies
        maxURLLength: 2000,
        async headers() {
          const headers: Record<string, string> = {};
          
          // Include Firebase auth token if configured
          const firebaseToken = await getFirebaseToken();
          if (firebaseToken) {
            headers["Authorization"] = `Bearer ${firebaseToken}`;
            headers["X-Firebase-Auth"] = "true";
          }
          
          // Include founder session token if available (for Founder Access)
          try {
            const sessionJson = localStorage.getItem("fuelpro_founder_session");
            if (sessionJson) {
              const session = JSON.parse(sessionJson);
              // Check if session is still valid (8 hours)
              if (
                session.active &&
                session.loginTime &&
                Date.now() - session.loginTime < 8 * 60 * 60 * 1000
              ) {
                if (session.token) {
                  headers["x-founder-token"] = session.token;
                }
              }
            }
          } catch {
            /* no founder session */
          }
          
          return headers;
        },
        fetch(input, init) {
          // Always allow backend calls - no blocking
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    ],
  });
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  // Use useState to ensure each component tree gets its own queryClient
  // This prevents cache sharing issues during SSR and hot reload
  const [queryClient] = useState(createQueryClient);
  const [trpcClient] = useState(createTrpcClient);
  
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
