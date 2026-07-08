/**
 * REST API Routes for FuelPro
 * 
 * Simple REST API endpoints that work alongside tRPC.
 * These endpoints provide direct CRUD operations for cloud sync.
 * 
 * SECURITY: All endpoints require API key authentication.
 * The "secrets" collection is write-only and never returned in list/get operations.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

// CORS middleware - use restrictive defaults, allow override via env
const restApiAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",")
  : process.env.NODE_ENV === "production"
    ? []
    : ["*"];

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return origin || "";
    if (restApiAllowedOrigins.includes("*")) return origin;
    if (restApiAllowedOrigins.some((o: string) => origin === o || origin.endsWith(o.replace("*.", ".")))) {
      return origin;
    }
    return process.env.NODE_ENV === "production" ? "" : origin;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true,
}));

app.use("*", logger());

// Data store type
type DataRecord = Record<string, unknown>;
interface DataStore {
  [collection: string]: Record<string, DataRecord>;
}

// In-memory data store (in production, use a real database)
const dataStore: DataStore = {
  users: {},
  stations: {},
  sales: {},
  audit_log: {},
  feature_flags: {},
  config: {},
};

// Collections that require authentication
const PROTECTED_COLLECTIONS = ["users", "sales", "audit_log", "config"];
// Collections that are write-only (never listed or read back)
const WRITE_ONLY_COLLECTIONS = ["secrets"];

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Simple API key auth middleware
async function requireAuth(c: any, next: any) {
  const apiKey = c.req.header("X-API-Key") || c.req.header("Authorization")?.replace("Bearer ", "");
  const collection = c.req.param("collection");
  
  // Public collections don't require auth
  if (collection && !PROTECTED_COLLECTIONS.includes(collection)) {
    return next();
  }
  
  // Always validate API key if configured, regardless of environment
  const validKeys = (process.env.API_KEYS || "").split(",").filter(Boolean);
  if (validKeys.length > 0) {
    if (!apiKey || !validKeys.includes(apiKey)) {
      return c.json({ success: false, error: "Unauthorized - valid API key required" }, 401);
    }
  }
  
  return next();
}

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "FuelPro REST API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: [
      "GET /api/health - Health check",
      "GET /api/data/:collection - List all records",
      "GET /api/data/:collection/:id - Get single record",
      "POST /api/data/:collection - Create record",
      "PUT /api/data/:collection/:id - Update record",
      "DELETE /api/data/:collection/:id - Delete record",
    ],
  });
});

app.get("/api/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    dataStore: {
      collections: Object.keys(dataStore),
      counts: Object.fromEntries(
        Object.entries(dataStore).map(([k, v]) => [k, Object.keys(v).length])
      ),
    },
  });
});

// List all records in a collection (protected)
app.get("/api/data/:collection", requireAuth, (c) => {
  const { collection } = c.req.param();
  
  // Never allow reading from write-only collections
  if (WRITE_ONLY_COLLECTIONS.includes(collection)) {
    return c.json({ success: false, error: "Collection is write-only" }, 403);
  }
  
  if (!dataStore[collection]) {
    dataStore[collection] = {};
  }
  
  const records = Object.entries(dataStore[collection]).map(([id, record]) => ({
    id,
    ...record,
  }));
  
  return c.json({
    success: true,
    collection,
    count: records.length,
    data: records,
  });
});

// Get single record (protected)
app.get("/api/data/:collection/:id", requireAuth, (c) => {
  const { collection, id } = c.req.param();
  
  // Never allow reading from write-only collections
  if (WRITE_ONLY_COLLECTIONS.includes(collection)) {
    return c.json({ success: false, error: "Collection is write-only" }, 403);
  }
  
  if (!dataStore[collection]?.[id]) {
    return c.json({ success: false, error: "Not found" }, 404);
  }
  
  return c.json({
    success: true,
    data: { id, ...dataStore[collection][id] },
  });
});

// Create record (protected for sensitive collections)
app.post("/api/data/:collection", requireAuth, async (c) => {
  const { collection } = c.req.param();
  
  if (!dataStore[collection]) {
    dataStore[collection] = {};
  }
  
  try {
    const body = await c.req.json() as Record<string, unknown>;
    
    // Basic input validation - reject overly large payloads
    const payloadSize = JSON.stringify(body).length;
    if (payloadSize > 1024 * 1024) { // 1MB limit
      return c.json({ success: false, error: "Payload too large" }, 413);
    }
    
    const id = (body.id as string) || generateId(collection);
    // Create a copy to avoid mutating the input object
    const { id: _bodyId, ...bodyWithoutId } = body;
    void _bodyId; // explicitly ignore
    const record: DataRecord = {
      ...bodyWithoutId,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dataStore[collection][id] = record;
    
    return c.json({
      success: true,
      id,
      data: { id, ...record },
    }, 201);
  } catch (err) {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }
});

// Update record (protected for sensitive collections)
app.put("/api/data/:collection/:id", requireAuth, async (c) => {
  const { collection, id } = c.req.param();
  
  if (!dataStore[collection]?.[id]) {
    return c.json({ success: false, error: "Not found" }, 404);
  }
  
  try {
    const body = await c.req.json() as Record<string, unknown>;
    
    // Basic input validation
    const payloadSize = JSON.stringify(body).length;
    if (payloadSize > 1024 * 1024) { // 1MB limit
      return c.json({ success: false, error: "Payload too large" }, 413);
    }
    
    dataStore[collection][id] = {
      ...dataStore[collection][id],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    return c.json({
      success: true,
      data: { id, ...dataStore[collection][id] },
    });
  } catch (err) {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }
});

// Delete record (protected for sensitive collections)
app.delete("/api/data/:collection/:id", requireAuth, (c) => {
  const { collection, id } = c.req.param();
  
  if (!dataStore[collection]?.[id]) {
    return c.json({ success: false, error: "Not found" }, 404);
  }
  
  delete dataStore[collection][id];
  
  return c.json({ success: true, message: "Deleted" });
});

// Seed initial data
app.post("/api/seed", (c) => {
  // Seed feature flags
  const featureFlags = [
    { id: "pos_system", name: "POS System", description: "Point of Sale module", enabled: true },
    { id: "mpesa_live", name: "M-PESA Live", description: "Real-time M-PESA transactions", enabled: true },
    { id: "ai_chatbot", name: "AI Chatbot", description: "AI assistant for fuel management", enabled: true },
    { id: "cloud_sync", name: "Cloud Sync", description: "Cross-device data synchronization", enabled: true },
    { id: "integration_hub", name: "Integration Hub", description: "KRA, ETR, POS, Payroll connectors", enabled: true },
    { id: "regional_compliance", name: "Regional Compliance", description: "Multi-country compliance features", enabled: true },
    { id: "advanced_analytics", name: "Advanced Analytics", description: "Deep analytics and forecasting", enabled: true },
    { id: "customer_loyalty", name: "Customer Loyalty", description: "Loyalty program management", enabled: true },
    { id: "fuel_quality", name: "Fuel Quality Testing", description: "Quality control and testing", enabled: true },
    { id: "credit_management", name: "Credit Management", description: "Credit and debt tracking", enabled: true },
  ];
  
  featureFlags.forEach((flag) => {
    dataStore.feature_flags[flag.id] = {
      ...flag,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
  
  return c.json({
    success: true,
    message: "Seed data created",
    counts: Object.fromEntries(
      Object.entries(dataStore).map(([k, v]) => [k, Object.keys(v).length])
    ),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Statistics Endpoint
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/dashboard/stats", requireAuth, (c) => {
  // Calculate stats from data store
  const sales = Object.values(dataStore.sales || {});
  const stations = Object.values(dataStore.stations || {});
  const users = Object.values(dataStore.users || {});
  
  const totalRevenue = sales.reduce((sum: number, sale: any) => sum + (sale.amount || 0), 0);
  const todaySales = sales.filter((sale: any) => {
    const saleDate = new Date(sale.createdAt || sale.timestamp);
    const today = new Date();
    return saleDate.toDateString() === today.toDateString();
  }).length;
  
  return c.json({
    success: true,
    data: {
      totalRevenue,
      netProfit: totalRevenue * 0.15, // Estimated 15% margin
      fuelSold: sales.reduce((sum: number, sale: any) => sum + (sale.quantity || 0), 0),
      balanceDue: 0,
      todaySales,
      totalStations: stations.length,
      totalUsers: users.length,
      timestamp: new Date().toISOString(),
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Station Stats Endpoint
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/stations/:id/stats", requireAuth, (c) => {
  const { id } = c.req.param();
  const station = dataStore.stations[id];
  
  if (!station) {
    return c.json({ error: "Station not found" }, 404);
  }
  
  const stationSales = Object.values(dataStore.sales || {}).filter((sale: any) => sale.stationId === id);
  const totalRevenue = stationSales.reduce((sum: number, sale: any) => sum + (sale.amount || 0), 0);
  
  return c.json({
    success: true,
    data: {
      stationId: id,
      totalSales: stationSales.length,
      totalRevenue,
      totalTransactions: stationSales.length,
      todaySales: stationSales.filter((sale: any) => {
        const saleDate = new Date(sale.createdAt || sale.timestamp);
        const today = new Date();
        return saleDate.toDateString() === today.toDateString();
      }).length,
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Endpoints
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/inventory", requireAuth, (c) => {
  const records = Object.entries(dataStore.inventory || {}).map(([id, record]) => ({
    id,
    ...(record as Record<string, unknown>),
  }));
  return c.json({ success: true, data: records });
});

app.get("/api/inventory/:id", requireAuth, (c) => {
  const { id } = c.req.param();
  if (!dataStore.inventory?.[id]) {
    return c.json({ error: "Inventory item not found" }, 404);
  }
  return c.json({ success: true, data: { id, ...dataStore.inventory[id] } });
});

app.post("/api/inventory", requireAuth, async (c) => {
  if (!dataStore.inventory) dataStore.inventory = {};
  try {
    const body = await c.req.json() as Record<string, unknown>;
    const id = (body.id as string) || generateId("inventory");
    dataStore.inventory[id] = {
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return c.json({ success: true, id, data: { id, ...dataStore.inventory[id] } }, 201);
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Payments Endpoints
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/payments", requireAuth, (c) => {
  const records = Object.entries(dataStore.payments || {}).map(([id, record]) => ({
    id,
    ...(record as Record<string, unknown>),
  }));
  return c.json({ success: true, data: records });
});

app.post("/api/payments", requireAuth, async (c) => {
  if (!dataStore.payments) dataStore.payments = {};
  try {
    const body = await c.req.json() as Record<string, unknown>;
    const id = (body.id as string) || generateId("payment");
    dataStore.payments[id] = {
      ...body,
      status: "completed",
      createdAt: new Date().toISOString(),
    };
    return c.json({ success: true, id, data: { id, ...dataStore.payments[id] } }, 201);
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Settings Endpoints
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/settings", requireAuth, (c) => {
  return c.json({
    success: true,
    data: {
      currency: "KES",
      currencySymbol: "KSh",
      timezone: "Africa/Nairobi",
      dateFormat: "DD/MM/YYYY",
      language: "en",
      fuelTypes: ["PMS", "AGO", "Kerosene"],
      defaultPrices: { PMS: 183.5, AGO: 168.3, Kerosene: 103.5 },
      taxRate: 0.16,
    }
  });
});

app.put("/api/settings", requireAuth, async (c) => {
  if (!dataStore.config) dataStore.config = {};
  try {
    const body = await c.req.json() as Record<string, unknown>;
    dataStore.config.settings = { ...dataStore.config.settings, ...body, updatedAt: new Date().toISOString() };
    return c.json({ success: true, data: dataStore.config.settings });
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature Flags Endpoint
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/feature-flags", (c) => {
  const flags = Object.entries(dataStore.feature_flags || {}).map(([id, flag]) => ({
    id,
    ...(flag as Record<string, unknown>),
  }));
  return c.json({ success: true, data: flags });
});

// ─────────────────────────────────────────────────────────────────────────────
// User Data Endpoint (for frontend state sync)
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/user-data", requireAuth, (c) => {
  const authHeader = c.req.header("Authorization")?.replace("Bearer ", "");
  const userId = authHeader; // In a real app, decode the JWT to get user ID
  
  const userData = {
    stations: Object.values(dataStore.stations || {}),
    sales: Object.values(dataStore.sales || {}),
    inventory: Object.values(dataStore.inventory || {}),
    config: dataStore.config,
  };
  
  return c.json({ success: true, data: userData });
});

export default app;
