/**
 * Supabase Client Configuration
 * 
 * This file configures Supabase for the FuelPro application.
 * Used for:
 * - User authentication (sign-in/sign-up)
 * - Database access (PostgreSQL)
 * - Real-time subscriptions
 * - File storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ojjskjawtikixlpshmub.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInJlZiI6Im9qanNjandhdGlraXhscHNobXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NTI3MjcsImV4cCI6MjEwMTEyODcyN30.nw9Agib1JGJE_atO-AJChf-OHdz8g_gauwL7u0CpNfY';

// Singleton Supabase client instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client (singleton pattern)
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
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
          } catch {
            // Ignore storage errors
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            // Ignore storage errors
          }
        },
      },
    },
  });

  return supabaseClient;
}

// Export singleton instance
export const supabase = getSupabaseClient();

// Export config for debugging
export { supabaseUrl, supabaseAnonKey };

// Default export
export default supabase;
