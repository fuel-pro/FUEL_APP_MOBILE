/**
 * REST API Routes for FuelPro
 * 
 * Simple REST API endpoints that work alongside tRPC.
 * These endpoints provide direct CRUD operations for cloud sync.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

// CORS middleware
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
}));

app.use("*", logger());

// In-memory data store (in production, use a real database)
const dataStore: Record<string, Record<string, any>> = {
  users: {},
  stations: {},
  sales: {},
  audit_log: {},
  secrets: {},
  feature_flags: {},
  config: {},
};

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

// List all records in a collection
app.get("/api/data/:collection", (c) => {
  const { collection } = c.req.param();
  
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

// Get single record
app.get("/api/data/:collection/:id", (c) => {
  const { collection, id } = c.req.param();
  
  if (!dataStore[collection]?.[id]) {
    return c.json({ success: false, error: "Not found" }, 404);
  }
  
  return c.json({
    success: true,
    data: { id, ...dataStore[collection][id] },
  });
});

// Create record
app.post("/api/data/:collection", async (c) => {
  const { collection } = c.req.param();
  
  if (!dataStore[collection]) {
    dataStore[collection] = {};
  }
  
  try {
    const body = await c.req.json();
    const id = body.id || generateId(collection);
    const record = {
      ...body,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    delete record.id; // Remove id from record, it's the key
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

// Update record
app.put("/api/data/:collection/:id", async (c) => {
  const { collection, id } = c.req.param();
  
  if (!dataStore[collection]?.[id]) {
    return c.json({ success: false, error: "Not found" }, 404);
  }
  
  try {
    const body = await c.req.json();
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

// Delete record
app.delete("/api/data/:collection/:id", (c) => {
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

export default app;
