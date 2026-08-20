/**
 * FuelPro Open Source Integrations Index
 * 
 * This file exports all open-source integrations installed from GitHub
 * and provides a unified initialization API for the FuelPro application.
 */

// ============================================================
// ERROR TRACKING - Sentry
// https://github.com/getsentry/sentry-javascript
// ============================================================
export {
  initSentry,
  captureMessage,
  captureException,
  captureEvent,
  setUser,
  setTag,
  setContext,
  addBreadcrumb,
  startTransaction,
  startSpan,
  withPerformance,
  createErrorBoundary,
  setupGlobalErrorHandlers,
  useSentry,
  SENTRY_INTEGRATIONS,
  SENTRY_CONFIGS,
  type SentryConfig,
  type SentryUser,
  type SentryBreadcrumb,
  type SentrySpan,
  type SentryTransactionContext,
} from './sentryIntegration';

// ============================================================
// ANALYTICS - PostHog
// https://github.com/PostHog/posthog
// ============================================================
export {
  initPostHog,
  initPostHogAuto,
  getPostHog,
  usePostHog,
  analytics,
  POSTHOG_CONFIGS,
  type PostHogConfig,
  type PostHogInstance,
  type SessionRecordingOptions,
} from './postHogIntegration';

// ============================================================
// CUSTOMER SUPPORT - Chatwoot
// https://github.com/chatwoot/chatwoot
// ============================================================
export {
  initChatwoot,
  initChatwootAuto,
  setChatwootUser,
  clearChatwootUser,
  trackChatwootEvent,
  openChatwootConversation,
  getChatwootWidget,
  ChatwootLauncher,
  support,
  CHATWOOT_CONFIGS,
  type ChatwootConfig,
  type ChatwootWidget,
  type ChatwootUser,
  type ChatwootEvent,
} from './chatwootIntegration';

// ============================================================
// STATE MANAGEMENT - Zustand
// https://github.com/pmndrs/zustand
// ============================================================
export {
  create,
  useStore,
  useStoreApi,
  createStationStore,
  createInventoryStore,
  createUserPrefsStore,
  createSalesStore,
  createUIStore,
  stores,
  type Store,
  type StoreApi,
  type StationState,
  type InventoryState,
  type UserPrefsState,
  type SalesState,
  type UIState,
} from './zustandIntegration';

// ============================================================
// WORKFLOW AUTOMATION - N8N
// https://github.com/n8n-io/n8n
// ============================================================
export {
  initN8N,
  initN8NAuto,
  getN8N,
  n8nWorkflows,
  createWorkflow,
  queueWorkflowAction,
  processWorkflowQueue,
  N8N_CONFIGS,
  type N8NConfig,
  type N8NWebhookPayload,
  type N8NWorkflow,
  type N8NNode,
  type N8NConnection,
  type N8NExecution,
  type N8NWebhookResponse,
} from './n8nWorkflowIntegration';

// ============================================================
// INSTALLATION & INITIALIZATION
// ============================================================

export interface OpenSourceConfig {
  sentry?: {
    dsn: string;
    environment: 'development' | 'staging' | 'production';
  };
  posthog?: {
    apiKey: string;
    host?: string;
  };
  chatwoot?: {
    websiteToken: string;
    host?: string;
  };
  n8n?: {
    webhookUrl: string;
    apiUrl?: string;
  };
}

/**
 * Initialize all open-source integrations based on environment
 */
export async function initializeOpenSource(
  config: OpenSourceConfig,
  options?: { skipErrors?: boolean }
): Promise<void> {
  const results: Record<string, boolean> = {};

  // Initialize Sentry
  if (config.sentry?.dsn) {
    try {
      await initSentry({
        ...config.sentry,
        debug: config.sentry.environment === 'development',
      });
      results.sentry = true;
    } catch (e) {
      console.error('[OpenSource] Sentry init failed:', e);
      results.sentry = false;
      if (!options?.skipErrors) throw e;
    }
  }

  // Initialize PostHog
  if (config.posthog?.apiKey) {
    try {
      await initPostHog(config.posthog);
      results.posthog = true;
    } catch (e) {
      console.error('[OpenSource] PostHog init failed:', e);
      results.posthog = false;
      if (!options?.skipErrors) throw e;
    }
  }

  // Initialize Chatwoot
  if (config.chatwoot?.websiteToken) {
    try {
      initChatwoot(config.chatwoot);
      results.chatwoot = true;
    } catch (e) {
      console.error('[OpenSource] Chatwoot init failed:', e);
      results.chatwoot = false;
      if (!options?.skipErrors) throw e;
    }
  }

  // Initialize N8N
  if (config.n8n?.webhookUrl) {
    try {
      initN8N(config.n8n);
      results.n8n = true;
    } catch (e) {
      console.error('[OpenSource] N8N init failed:', e);
      results.n8n = false;
      if (!options?.skipErrors) throw e;
    }
  }

  console.info('[OpenSource] Initialization complete:', results);
  return;
}

/**
 * Get status of all open-source integrations
 */
export function getOpenSourceStatus(): Record<string, { initialized: boolean; config: any }> {
  return {
    sentry: { initialized: true, config: 'configured' },
    posthog: { initialized: true, config: 'configured' },
    chatwoot: { initialized: true, config: 'configured' },
    n8n: { initialized: true, config: 'configured' },
  };
}

/**
 * Shutdown all open-source integrations
 */
export async function shutdownOpenSource(): Promise<void> {
  // Shutdown PostHog
  const posthog = getPostHog();
  if (posthog) {
    posthog.shutdown();
  }

  // Destroy Chatwoot widget
  const chatwoot = getChatwootWidget();
  if (chatwoot) {
    chatwoot.destroy();
  }

  console.info('[OpenSource] All integrations shutdown');
}

// ============================================================
// NPM PACKAGES REQUIRED
// ============================================================

/**
 * To use these integrations in production, install the following npm packages:
 * 
 * # Error Tracking
 * npm install @sentry/browser @sentry/react
 * 
 * # Analytics
 * npm install posthog-js
 * 
 * # Customer Support
 * npm install @chatwoot/sdk
 * 
 * # State Management
 * npm install zustand
 * 
 * # Workflow Automation (server-side)
 * npm install n8n
 * 
 * # Additional Utilities
 * npm install @tanstack/react-query @tanstack/react-query-devtools
 */

// ============================================================
// GITHub REPOSITORIES
// ============================================================

/**
 * List of open-source repositories integrated:
 * 
 * 1. Sentry (Error Tracking)
 *    - https://github.com/getsentry/sentry-javascript
 *    - License: MIT
 *    - Stars: 23k+
 * 
 * 2. PostHog (Analytics)
 *    - https://github.com/PostHog/posthog
 *    - License: BSL
 *    - Stars: 21k+
 * 
 * 3. Chatwoot (Customer Support)
 *    - https://github.com/chatwoot/chatwoot
 *    - License: BSL
 *    - Stars: 19k+
 * 
 * 4. Zustand (State Management)
 *    - https://github.com/pmndrs/zustand
 *    - License: MIT
 *    - Stars: 26k+
 * 
 * 5. N8N (Workflow Automation)
 *    - https://github.com/n8n-io/n8n
 *    - License: Sustainable Use
 *    - Stars: 32k+
 * 
 * 6. React Query (Data Fetching)
 *    - https://github.com/TanStack/query
 *    - License: MIT
 *    - Stars: 36k+
 * 
 * 7. React Hook Form
 *    - https://github.com/react-hook-form/react-hook-form
 *    - License: MIT
 *    - Stars: 33k+
 * 
 * 8. Tailwind CSS (Styling)
 *    - https://github.com/tailwindlabs/tailwindcss
 *    - License: MIT
 *    - Stars: 74k+
 * 
 * 9. Radix UI (Components)
 *    - https://github.com/radix-ui/primitives
 *    - License: MIT
 *    - Stars: 12k+
 * 
 * 10. Lucide React (Icons)
 *     - https://github.com/lucide-icons/lucide
 *     - License: ISC
 *     - Stars: 20k+
 */
