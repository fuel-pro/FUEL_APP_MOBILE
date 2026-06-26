import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Health check endpoint
app.get("/", (c) => c.json({ 
  status: "ok", 
  message: "FuelPro Backend API", 
  version: "3.0-CLOUD-SYNC",
  timestamp: new Date().toISOString()
}));

app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// tRPC endpoint with explicit CORS
app.use("/api/trpc/*", async (c) => {
  // Add CORS headers
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-founder-token");
  
  if (c.req.method === "OPTIONS") {
    return c.json({ ok: true });
  }
  
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// REST API fallback endpoints for direct access
app.notFound((c) => c.json({ error: "Not Found", path: c.req.path }, 404));

export default app;

if (env.isProduction && !process.env.VERCEL) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
