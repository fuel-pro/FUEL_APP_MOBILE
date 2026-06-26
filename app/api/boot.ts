import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import restApi from "./routes/rest-api";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Global CORS
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "x-founder-token"],
}));

// Health check endpoint
app.get("/", (c) => c.json({ 
  status: "ok", 
  message: "FuelPro Backend API", 
  version: "3.0-CLOUD-SYNC-REST",
  timestamp: new Date().toISOString()
}));

// REST API routes (mounted before tRPC)
app.route("/api", restApi);

app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// tRPC endpoint
app.use("/api/trpc/*", async (c) => {
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

// Fallback for unmatched routes
app.notFound((c) => c.json({ 
  error: "Not Found", 
  path: c.req.path,
  method: c.req.method,
  hint: "Try /api/health or /api/data/:collection"
}, 404));

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
