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

// CORS configuration - restrict in production
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",")
  : env.isProduction
    ? []
    : ["*"];

app.use("*", cors({
  origin: (origin) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return origin || "";
    // In development or if wildcard is allowed
    if (allowedOrigins.includes("*")) return origin;
    // Check against allowed origins
    if (allowedOrigins.some((o: string) => origin === o || origin.endsWith(o.replace("*.", ".")))) {
      return origin;
    }
    // In production, return empty string to deny (Hono handles this gracefully)
    return env.isProduction ? "" : origin;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "x-founder-token"],
  credentials: true,
  maxAge: 86400,
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

// tRPC endpoint with error handling
app.use("/api/trpc/*", async (c) => {
  if (c.req.method === "OPTIONS") {
    return c.json({ ok: true });
  }
  
  try {
    return await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext,
    });
  } catch (err) {
    console.error("[tRPC] Unhandled error:", err);
    return c.json({ 
      error: "Internal server error", 
      code: "INTERNAL_SERVER_ERROR",
      path: c.req.path 
    }, 500);
  }
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
  try {
    const { serve } = await import("@hono/node-server");
    const { serveStaticFiles } = await import("./lib/vite");
    serveStaticFiles(app);

    const port = parseInt(process.env.PORT || "3000");
    serve({ fetch: app.fetch, port }, () => {
      console.log(`Server running on http://localhost:${port}/`);
    });
  } catch (err) {
    console.error("[Server] Failed to start production server:", err);
    process.exit(1);
  }
}
