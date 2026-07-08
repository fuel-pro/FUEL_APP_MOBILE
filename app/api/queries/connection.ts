import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;
let connectionError: Error | null = null;
let lastConnectionAttempt = 0;
const CONNECTION_COOLDOWN = 5000; // 5 seconds between reconnection attempts

export function getDb() {
  if (!instance) {
    const now = Date.now();
    if (connectionError && now - lastConnectionAttempt < CONNECTION_COOLDOWN) {
      throw connectionError;
    }
    lastConnectionAttempt = now;
    try {
      if (!env.databaseUrl) {
        throw new Error("DATABASE_URL is not configured");
      }
      instance = drizzle(env.databaseUrl, {
        mode: "planetscale",
        schema: fullSchema,
      });
      connectionError = null;
    } catch (err) {
      connectionError = err instanceof Error ? err : new Error(String(err));
      console.error("[DB] Failed to initialize database connection:", connectionError.message);
      throw connectionError;
    }
  }
  return instance;
}

/** Check database health without throwing */
export async function checkDbHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const db = getDb();
    // Simple query to verify connection
    await db.query.users.findFirst();
    return { healthy: true };
  } catch (err) {
    // Reset instance to force reconnection on next attempt
    instance = undefined as any;
    return {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
