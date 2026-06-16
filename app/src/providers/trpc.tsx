import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson as never,
      headers() {
        // Include founder session token if available (for Founder Access)
        const headers: Record<string, string> = {};
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
              // Try to get the token from session, or generate from stored data
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
