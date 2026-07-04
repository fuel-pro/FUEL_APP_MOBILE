/**
 * Founder Authentication
 * FIXED: All authentication done via backend JWT tokens
 * No hardcoded credentials in source code
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'fuelpro_founder_token';

/** Login via backend - returns JWT token */
export async function founderLogin(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/founder-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success && data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
      return { success: true, token: data.token };
    }

    return { success: false, error: data.error || 'Login failed' };
  } catch (error) {
    console.error('Founder login error:', error);
    return { success: false, error: 'Network error' };
  }
}

/** Get stored JWT token */
export function getFounderToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Verify token with backend */
export async function verifyFounderToken(): Promise<boolean> {
  const token = getFounderToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_URL}/api/auth/verify-founder`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }

    const data = await response.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

/** Get auth header for API calls */
export function getFounderAuthHeader(): Record<string, string> {
  const token = getFounderToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/** End founder session */
export function endFounderSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Check if logged in (local check only) */
export function isLoggedIn(): boolean {
  return !!getFounderToken();
}

/** DEPRECATED: Legacy function for backwards compatibility
 *  Authentication is now handled via backend JWT tokens
 */
export function getFounderCredentials(): { username: string; password: string } {
  // Return empty - credentials are now stored securely on backend
  return { username: '', password: '' };
}

/** DEPRECATED: Legacy function for backwards compatibility
 *  Use founderLogin() instead
 */
export async function validateFounderAuth(
  inputUser: string,
  inputPw: string
): Promise<boolean> {
  const result = await founderLogin(inputUser, inputPw);
  return result.success;
}
