/**
 * Enhanced Features Index
 * Centralized exports for all enhanced modules
 */

// Performance & Optimization
export { default as EnhancedCache } from "@/react-app/lib/enhanced/performance";
export {
  dataCache,
  uiCache,
  apiCache,
  usePerformanceMonitor,
  useDebounce,
  useThrottle,
  useVirtualList,
  useIntersectionObserver,
  scheduleIdleTask,
  WorkerPool,
} from "@/react-app/lib/enhanced/performance";

// Sync Service
export {
  enhancedSyncService,
  EnhancedSyncService,
} from "@/react-app/services/enhanced/SyncService";
export type {
  SyncConfig,
  SyncState,
  PendingChange,
} from "@/react-app/services/enhanced/SyncService";

// Enhanced Components
export { default as EnhancedAnalyticsDashboard } from "@/react-app/features/analytics/EnhancedAnalyticsDashboard";
export { default as EnhancedPOS } from "@/react-app/features/pos-enhanced/EnhancedPOS";
export { default as EnhancedInventoryManagement } from "@/react-app/features/inventory-pro/EnhancedInventory";

// Feature flags for gradual rollout
export const ENHANCED_FEATURES = {
  ANALYTICS_DASHBOARD: true,
  ENHANCED_POS: true,
  INVENTORY_PRO: true,
  CUSTOMER_360: false, // Coming soon
  FUEL_OPTIMIZATION: false, // Coming soon
  COMPLIANCE_PRO: false, // Coming soon
  MOBILE_PRO: false, // Coming soon
};

export default {
  EnhancedCache,
  dataCache,
  uiCache,
  apiCache,
  usePerformanceMonitor,
  useDebounce,
  useThrottle,
  useVirtualList,
  useIntersectionObserver,
  scheduleIdleTask,
  WorkerPool,
  enhancedSyncService,
  EnhancedSyncService,
  EnhancedAnalyticsDashboard,
  EnhancedPOS,
  EnhancedInventoryManagement,
  ENHANCED_FEATURES,
};
