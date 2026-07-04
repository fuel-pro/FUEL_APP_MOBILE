/**
 * AuthProviderWithSync - Enhanced authentication with full sync support
 * Handles auto-save, cross-device login, and real-time sync
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { syncService, STORAGE_KEYS } from '../lib/syncService';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
  [key: string]: unknown;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateUser: (data: Partial<User>) => void;
  checkAuth: () => Promise<boolean>;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = import.meta.env.VITE_API_URL || 'https://fuel-app-mobile.vercel.app';

// Token refresh interval (in ms)
const TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes (JWT typically 15 min)

export function AuthProviderWithSync({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    token: null,
  });

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncUnsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize auth state from storage
  useEffect(() => {
    const stored = syncService.getAuthData();
    if (stored.token && stored.user) {
      setState({
        user: stored.user as User,
        isAuthenticated: true,
        isLoading: false,
        token: stored.token,
      });
      syncService.trackDevice((stored.user as User).id);
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Setup token auto-refresh
  useEffect(() => {
    if (state.isAuthenticated) {
      refreshIntervalRef.current = setInterval(() => {
        refreshToken();
      }, TOKEN_REFRESH_INTERVAL);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [state.isAuthenticated]);

  // Setup sync listener for cross-tab updates
  useEffect(() => {
    syncUnsubscribeRef.current = syncService.subscribe(STORAGE_KEYS.USER_DATA, (data) => {
      if (data) {
        setState(prev => ({
          ...prev,
          user: data as User,
        }));
      }
    });

    const handleForceRefresh = () => {
      checkAuth();
    };
    window.addEventListener('force-auth-refresh', handleForceRefresh);

    return () => {
      syncUnsubscribeRef.current?.();
      window.removeEventListener('force-auth-refresh', handleForceRefresh);
    };
  }, []);

  const saveAuthToStorage = useCallback((authData: {
    token: string;
    refreshToken?: string;
    user: User;
  }) => {
    syncService.saveAuthData({
      token: authData.token,
      refreshToken: authData.refreshToken,
      user: authData.user,
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const user: User = {
        id: data.user?.id || data.id,
        email: data.user?.email || data.email,
        name: data.user?.name || data.name,
        role: data.user?.role || data.role,
        permissions: data.user?.permissions || data.permissions || [],
        ...data.user,
      };

      const token = data.token || data.accessToken;

      saveAuthToStorage({
        token,
        refreshToken: data.refreshToken,
        user,
      });

      syncService.trackDevice(user.id);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        token,
      });

    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [saveAuthToStorage]);

  const logout = useCallback(async () => {
    try {
      const token = state.token;
      if (token) {
        fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } finally {
      syncService.clearLocalData();
      
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        token: null,
      });
    }
  }, [state.token]);

  const register = useCallback(async (data: RegisterData) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          role: data.role || 'user',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Registration failed');
      }

      await login(data.email, data.password);
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [login]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const stored = syncService.getAuthData();
    
    if (!stored.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });

      if (!response.ok) {
        syncService.clearLocalData();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          token: null,
        });
        return false;
      }

      const data = await response.json();
      
      saveAuthToStorage({
        token: data.token || data.accessToken,
        refreshToken: data.refreshToken,
        user: state.user!,
      });

      setState(prev => ({
        ...prev,
        token: data.token || data.accessToken,
      }));

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }, [saveAuthToStorage, state.user]);

  const updateUser = useCallback((data: Partial<User>) => {
    if (!state.user) return;

    const updatedUser = { ...state.user, ...data };
    
    syncService.setItem(STORAGE_KEYS.USER_DATA, {
      ...updatedUser,
      lastUpdated: Date.now(),
    });

    setState(prev => ({
      ...prev,
      user: updatedUser,
    }));
  }, [state.user]);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const stored = syncService.getAuthData();
    
    if (!stored.token) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        token: null,
      });
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${stored.token}`,
        },
      });

      if (!response.ok) {
        const refreshed = await refreshToken();
        if (!refreshed) {
          syncService.clearLocalData();
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            token: null,
          });
          return false;
        }
      }

      const user = await response.json();
      
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        token: stored.token,
      });

      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }, [refreshToken]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    register,
    refreshToken,
    updateUser,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthSync() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthSync must be used within AuthProviderWithSync');
  }
  return context;
}
