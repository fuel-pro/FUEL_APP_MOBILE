/**
 * Clerk Authentication Integration
 * 
 * Uses Clerk for user authentication with real live credentials:
 * - Publishable Key: pk_live_Y2xlcmsuZnVlbHByby5jb20k
 * - Backend API: https://api.clerk.com
 * - Frontend API: https://clerk.fuelpro.com
 */

import { Clerk } from '@clerk/clerk-js';

// Clerk publishable key from environment
const PUBLISHER_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_live_Y2xlcmsuZnVlbHByby5jb20k';

// Singleton Clerk instance
let clerkInstance: Clerk | null = null;

/**
 * Get Clerk instance (singleton)
 */
export function getClerk(): Clerk {
  if (clerkInstance) {
    return clerkInstance;
  }
  
  if (!PUBLISHER_KEY) {
    throw new Error('Clerk publishable key is not configured');
  }
  
  clerkInstance = new Clerk(PUBLISHER_KEY);
  return clerkInstance;
}

/**
 * Initialize Clerk and load the user
 */
export async function initClerk(): Promise<Clerk | null> {
  try {
    const clerk = getClerk();
    await clerk.load();
    return clerk;
  } catch (error) {
    console.error('[Clerk] Initialization error:', error);
    return null;
  }
}

/**
 * Check if user is signed in
 */
export function isSignedIn(): boolean {
  try {
    const clerk = getClerk();
    return clerk.user !== null;
  } catch {
    return false;
  }
}

/**
 * Get current user
 */
export function getCurrentUser() {
  try {
    const clerk = getClerk();
    if (!clerk.user) return null;
    
    return {
      id: clerk.user.id,
      email: clerk.user.primaryEmailAddress?.emailAddress || '',
      name: clerk.user.fullName || clerk.user.firstName || 'User',
      picture: clerk.user.imageUrl || undefined,
      role: 'owner', // Default role - can be extended with metadata
      permissions: ['read', 'write'],
    };
  } catch {
    return null;
  }
}

/**
 * Get user ID token for API authentication
 */
export async function getUserToken(): Promise<string | null> {
  try {
    const clerk = getClerk();
    if (!clerk.user) return null;
    
    // Get the active session's token
    const session = clerk.session;
    if (!session) return null;
    
    return await session.getToken();
  } catch (error) {
    console.error('[Clerk] Get token error:', error);
    return null;
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const clerk = getClerk();
    
    // Clerk uses redirect - we'll use the standard sign-in flow
    const { supportedThirdPartyProviders } = clerk;
    
    // For email/password, Clerk uses the create magic link flow
    // or redirects to the hosted sign-in
    await clerk.redirectToSignIn();
    
    return { success: true };
  } catch (error: any) {
    console.error('[Clerk] Sign in error:', error);
    return { 
      success: false, 
      error: error?.message || 'Failed to sign in. Please try again.' 
    };
  }
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const clerk = getClerk();
    
    // Clerk handles sign-up via redirect
    await clerk.redirectToSignUp();
    
    return { success: true };
  } catch (error: any) {
    console.error('[Clerk] Sign up error:', error);
    return { 
      success: false, 
      error: error?.message || 'Failed to create account. Please try again.' 
    };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  try {
    const clerk = getClerk();
    await clerk.signOut();
  } catch (error) {
    console.error('[Clerk] Sign out error:', error);
  }
}

/**
 * Get Clerk auth state for API calls
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getUserToken();
  if (!token) return {};
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Export for convenience
export const clerk = {
  getInstance: getClerk,
  init: initClerk,
  isSignedIn,
  getCurrentUser,
  getToken: getUserToken,
  signIn: signInWithEmail,
  signUp: signUpWithEmail,
  signOut,
  getAuthHeaders,
};

export default clerk;
