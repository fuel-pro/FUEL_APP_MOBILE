/**
 * Zustand State Management Integration
 * 
 * Open-source state management from: https://github.com/pmndrs/zustand
 * 
 * A small, fast and scalable bearbones state-management solution
 * using simplified flux principles with hooks.
 */

// Store Types
export interface Store<T> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  destroy: () => void;
}

export interface StoreApi<T> extends Store<T> {
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  getState: () => T;
  subscribe: <U>(
    listener: (state: T, prevState: T) => U
  ) => (() => void);
  destroy: () => void;
}

export type StateCreator<T, Mps extends Record<string, any> = {}> = (
  set: Store<T>['setState'],
  get: Store<T>['getState'],
  store: Mps
) => T;

export type SetState<T extends object> = (
  partial: Partial<T> | ((state: T) => Partial<T>) | null,
  replace?: boolean
) => void;

export type GetState<T extends object> = () => T;

export type Subscribe<T extends object> = <U>(
  listener: (state: T, prevState: T) => U
) => () => void;

// Create a Zustand store
export function create<T extends object, Mps extends Record<string, any> = {}>(
  creator: StateCreator<T, Mps>,
  options?: {
    name?: string;
    getItem?: (key: string) => string | null;
    setItem?: (key: string, value: string) => void;
    removeItem?: (key: string) => void;
    storage?: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
    partialize?: (state: T) => Partial<T>;
    onRehydrateStorage?: (state: T) => {
      onRehydrateStorage?: (state: T) => void;
    };
    merge?: (state: T, partial: any) => T;
  }
): StoreApi<T> & Mps {
  const config = options || {};
  let state: T;
  const listeners: Set<(state: T, prevState: T) => void> = new Set();

  // Persistence functions
  const persistStorage = config.storage || (typeof window !== 'undefined' ? window.localStorage : null);
  
  const getItem = persistStorage 
    ? () => persistStorage.getItem(config.name || 'zustand-store')
    : () => null;
    
  const setItem = persistStorage
    ? (value: string) => persistStorage.setItem(config.name || 'zustand-store', value)
    : () => {};
    
  const removeItem = persistStorage
    ? () => persistStorage.removeItem(config.name || 'zustand-store')
    : () => {};

  // Create store
  const setState: SetState<T> = (partial, replace) => {
    const nextState = typeof partial === 'function' 
      ? partial(state) 
      : (replace ? Object.assign({}, partial) : Object.assign({}, state, partial));
    
    if (nextState !== state) {
      const prevState = state;
      state = nextState;
      
      // Notify listeners
      listeners.forEach(listener => listener(state, prevState));
      
      // Persist state
      if (persistStorage) {
        try {
          const serialized = JSON.stringify(state);
          setItem(serialized);
        } catch (e) {
          console.error('[Zustand] Failed to persist state:', e);
        }
      }
    }
  };

  const getState: GetState<T> = () => state;

  const subscribe: Subscribe<T> = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const destroy = () => {
    listeners.clear();
    removeItem();
  };

  // Initialize state
  const initialState = creator(setState, getState, {} as Mps);
  
  // Try to rehydrate from storage
  const persistedState = getItem();
  if (persistedState) {
    try {
      const parsed = JSON.parse(persistedState);
      state = config.merge 
        ? config.merge(initialState, parsed) 
        : Object.assign({}, initialState, parsed);
    } catch (e) {
      state = initialState;
    }
  } else {
    state = initialState;
  }

  return {
    getState,
    setState,
    subscribe,
    destroy,
  } as StoreApi<T> & Mps;
}

// React hooks for Zustand
export function useStore<T, S>(
  store: StoreApi<T>,
  selector: (state: T) => S
): S {
  const result = selector(store.getState());
  
  // This would use React's useSyncExternalStore in production
  // For now, return the selected value
  return result;
}

export function useStoreApi<T>(store: StoreApi<T>): StoreApi<T> {
  return store;
}

// Pre-built FuelPro stores

// Station Store
export interface StationState {
  stations: any[];
  currentStation: any | null;
  loading: boolean;
  error: string | null;
}

export const createStationStore = () => create<StationState>((set, get) => ({
  stations: [],
  currentStation: null,
  loading: false,
  error: null,
  
  // Actions
  setStations: (stations) => set({ stations }),
  addStation: (station) => set(state => ({ 
    stations: [...state.stations, station] 
  })),
  updateStation: (id, updates) => set(state => ({
    stations: state.stations.map(s => s.id === id ? { ...s, ...updates } : s)
  })),
  removeStation: (id) => set(state => ({
    stations: state.stations.filter(s => s.id !== id)
  })),
  setCurrentStation: (station) => set({ currentStation: station }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

// Fuel Inventory Store
export interface InventoryState {
  inventory: any[];
  alerts: any[];
  thresholds: {
    low: number;
    critical: number;
  };
}

export const createInventoryStore = () => create<InventoryState>((set, get) => ({
  inventory: [],
  alerts: [],
  thresholds: { low: 20, critical: 10 },
  
  setInventory: (inventory) => set({ inventory }),
  addAlert: (alert) => set(state => ({
    alerts: [...state.alerts, alert]
  })),
  clearAlerts: () => set({ alerts: [] }),
  setThresholds: (thresholds) => set({ thresholds }),
  checkInventory: () => {
    const { inventory, thresholds, addAlert } = get();
    inventory.forEach(item => {
      if (item.level <= thresholds.critical) {
        addAlert({
          type: 'critical',
          fuelType: item.fuelType,
          level: item.level,
          message: `Critical: ${item.fuelType} is below ${thresholds.critical}%`,
        });
      } else if (item.level <= thresholds.low) {
        addAlert({
          type: 'warning',
          fuelType: item.fuelType,
          level: item.level,
          message: `Low: ${item.fuelType} is below ${thresholds.low}%`,
        });
      }
    });
  },
}));

// User Preferences Store
export interface UserPrefsState {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  dashboard: {
    layout: 'grid' | 'list';
    refreshInterval: number;
    showWidgets: string[];
  };
}

export const createUserPrefsStore = () => create<UserPrefsState>(
  (set) => ({
    theme: 'auto',
    language: 'en',
    currency: 'USD',
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    dashboard: {
      layout: 'grid',
      refreshInterval: 30000,
      showWidgets: ['sales', 'inventory', 'alerts'],
    },
  }),
  {
    name: 'fuelpro-user-prefs',
  }
);

// Sales Store
export interface SalesState {
  sales: any[];
  todaySales: any[];
  weekSales: any[];
  monthSales: any[];
  filters: {
    dateRange: { start: Date; end: Date };
    fuelType: string | null;
    paymentMethod: string | null;
    stationId: string | null;
  };
}

export const createSalesStore = () => create<SalesState>((set) => ({
  sales: [],
  todaySales: [],
  weekSales: [],
  monthSales: [],
  filters: {
    dateRange: { start: new Date(), end: new Date() },
    fuelType: null,
    paymentMethod: null,
    stationId: null,
  },
  
  setSales: (sales) => set({ sales }),
  addSale: (sale) => set(state => ({
    sales: [sale, ...state.sales],
  })),
  setFilters: (filters) => set(state => ({
    filters: { ...state.filters, ...filters }
  })),
  clearFilters: () => set({
    filters: {
      dateRange: { start: new Date(), end: new Date() },
      fuelType: null,
      paymentMethod: null,
      stationId: null,
    },
  }),
}));

// UI Store (for modals, drawers, etc.)
export interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  modalData: any;
  notifications: any[];
  isLoading: {
    global: boolean;
    sales: boolean;
    inventory: boolean;
    stations: boolean;
  };
}

export const createUIStore = () => create<UIState>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  modalData: null,
  notifications: [],
  isLoading: {
    global: false,
    sales: false,
    inventory: false,
    stations: false,
  },
  
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  openModal: (name, data) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  addNotification: (notification) => set(state => ({
    notifications: [...state.notifications, {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...notification,
    }],
  })),
  removeNotification: (id) => set(state => ({
    notifications: state.notifications.filter(n => n.id !== id),
  })),
  setLoading: (key, value) => set(state => ({
    isLoading: { ...state.isLoading, [key]: value },
  })),
}));

// Export all stores
export const stores = {
  station: createStationStore(),
  inventory: createInventoryStore(),
  userPrefs: createUserPrefsStore(),
  sales: createSalesStore(),
  ui: createUIStore(),
};

// React hook for selecting store slices
export function useStoreSlice<T>(
  storeCreator: () => StoreApi<T>
): T {
  const storeRef = useStoreRef(storeCreator);
  return storeRef.current.getState();
}

const storeRefs = new Map<() => StoreApi<any>, React.MutableRefObject<StoreApi<any>>>();

function useStoreRef<T>(
  storeCreator: () => StoreApi<T>
): React.MutableRefObject<StoreApi<T>> {
  if (!storeRefs.has(storeCreator)) {
    storeRefs.set(storeCreator, { current: storeCreator() });
  }
  return storeRefs.get(storeCreator)!;
}

// Persist middleware
export function persist<T extends object>(
  config: StoreApi<T>,
  options: {
    name?: string;
    storage?: Storage;
    partialize?: (state: T) => Partial<T>;
  }
): StoreApi<T> {
  // Would implement persistence logic here
  return config;
}

import * as React from 'react';
