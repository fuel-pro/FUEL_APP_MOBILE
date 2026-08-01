/**
 * Supabase Client Configuration
 * 
 * This file configures the Supabase client for the FuelPro application.
 * Replace Firebase with Supabase for authentication and database.
 */

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton Supabase client instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize and get Supabase client (singleton pattern)
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration missing!');
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
    throw new Error('Supabase not configured');
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: {
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (error) {
            console.error('Error saving to localStorage:', error);
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.error('Error removing from localStorage:', error);
          }
        },
      },
    },
    global: {
      headers: {
        'x-client-info': 'fuelpro-app',
      },
    },
  });

  return supabaseClient;
}

// Export a convenience reference
export const supabase = getSupabaseClient();

// Export types
export type { SupabaseClient };

// Re-export Supabase types for convenience
export type {
  User,
  Session,
  AuthError,
  AuthChangeEvent,
  SupabaseAuthClient,
  SupabaseQueryData,
  RealtimeChannel,
  RealtimePostgresChanges,
} from '@supabase/supabase-js';

export default {
  getClient: getSupabaseClient,
  client: supabase,
};
