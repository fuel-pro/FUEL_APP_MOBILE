/**
 * Database connection stub
 * 
 * This is a frontend-only app that connects to the Railway backend via API.
 * The actual database connection is handled by the backend service.
 * 
 * This stub exists for TypeScript type compatibility with code that expects
 * a database connection object.
 */

// Connection stub - actual connection is managed by the backend
export const getDb = () => null;
export const db = null;

// Type for compatibility
export type DbConnection = typeof db;
