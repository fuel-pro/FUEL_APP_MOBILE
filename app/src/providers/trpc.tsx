import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();

// Check if we're in a static deployment
function isStaticDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes("vercel.app") || host.includes("netlify.app") || host.includes("github.io");
}

// Check if Clerk is configured
const isClerkConfigured = () => !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Get Clerk session token (async)
async function getClerkToken(): Promise<string | null> {
  if (!isClerkConfigured()) return null;
  
  try {
    // @ts-ignore - Clerk exposes this in the browser
    const clerk = window.Clerk;
    if (clerk?.session) {
      return await clerk.session.getToken();
    }
  } catch {
    /* Clerk not available */
  }
  return null;
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL || "https://fuel-pro-backend-v2-production-7c2b.up.railway.app"}/api/trpc`,
      transformer: superjson as never,
      // Limit URL length to prevent 431 errors from oversized batch requests
      // Standard limit is 8KB, we use 2KB to be safe across proxies
      maxURLLength: 2000,
      async headers() {
        const headers: Record<string, string> = {};
        
        // Include Clerk auth token if configured
        const clerkToken = await getClerkToken();
        if (clerkToken) {
          headers["Authorization"] = `Bearer ${clerkToken}`;
          headers["X-Clerk-Auth"] = "true";
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

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
