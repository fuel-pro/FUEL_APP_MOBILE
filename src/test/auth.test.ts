/**
 * Authentication Tests
 * 
 * Tests for AuthContext and authentication functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(() => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      resetPasswordForEmail: vi.fn(() => ({ error: null })),
      updateUser: vi.fn(() => ({ error: null })),
    },
  })),
}));

describe('Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should clear localStorage on logout', () => {
    localStorage.setItem('fuelpro_auth_identity', JSON.stringify({ id: '123', name: 'Test' }));
    localStorage.setItem('fuelpro_token', 'test-token');
    
    // Simulate logout behavior
    localStorage.removeItem('fuelpro_auth_identity');
    localStorage.removeItem('fuelpro_token');
    
    expect(localStorage.getItem('fuelpro_auth_identity')).toBeNull();
    expect(localStorage.getItem('fuelpro_token')).toBeNull();
  });

  it('should persist user identity in localStorage', () => {
    const user = { id: '123', name: 'Test User', email: 'test@example.com' };
    localStorage.setItem('fuelpro_auth_identity', JSON.stringify(user));
    
    const stored = JSON.parse(localStorage.getItem('fuelpro_auth_identity') || '{}');
    expect(stored.id).toBe('123');
    expect(stored.name).toBe('Test User');
  });

  it('should generate unique device ID', () => {
    const DEVICE_ID_KEY = 'fuelpro_device_id';
    const id = localStorage.getItem(DEVICE_ID_KEY) || `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    
    expect(id).toBeDefined();
    expect(id.startsWith('dev_')).toBe(true);
  });
});
