/**
 * FuelPro Open-Source Integrations Index
 * 
 * This file exports all open-source integrations for easy importing.
 */

// Open Source Analytics & Monitoring
export {
  initializeOpenSourceIntegrations,
  useAnalytics,
  posthogAnalytics,
  glitchtipTracking,
  chatwootWidget,
  umamiAnalytics,
  simpleAnalytics,
  trackAction,
  OpenSourceIntegrationsProvider,
  ChatwootToggle,
} from './openSourceIntegrations';

// AI & Machine Learning
export {
  AIClient,
  useAIAssistant,
  FUELPRO_PROMPTS,
  aiClient,
  type ChatMessage,
  type ChatThread,
} from './aiIntegrations';

// Payment Gateways
export {
  PaymentManager,
  MpesaPayment,
  FlutterwavePayment,
  StripePayment,
  PaystackPayment,
  paymentManager,
  mpesaPayment,
  flutterwavePayment,
  stripePayment,
  paystackPayment,
  type PaymentConfig,
  type PaymentRequest,
  type PaymentResponse,
  type Transaction,
} from './paymentIntegrations';

// Notifications
export {
  NotificationManager,
  EmailService,
  SMSService,
  PushService,
  WhatsAppService,
  notificationManager,
  DEFAULT_TEMPLATES,
  type Notification,
  type NotificationTemplate,
  type NotificationPreferences,
  type NotificationChannel,
  type NotificationStatus,
} from './notificationIntegrations';

// Export & Reporting
export {
  ExportService,
  ReportBuilder,
  exportService,
  reportBuilder,
  DEFAULT_REPORTS,
  type ExportConfig,
  type ReportConfig,
  type ReportFilter,
  type ReportColumn,
  type ReportAggregation,
  type ReportSort,
  type ReportSchedule,
  type ChartConfig,
} from './exportIntegrations';

// Offline Sync
export {
  SyncService,
  IndexedDBManager,
  SyncQueueManager,
  syncService,
  useSyncService,
  useLocalData,
  type SyncConfig,
  type SyncableRecord,
  type SyncQueueItem,
  type SyncStatus,
  type ConflictResolution,
} from './offlineSync';

/**
 * Quick integration setup helpers
 */

// Initialize all integrations with one call
export async function initializeAllIntegrations() {
  console.log('[FuelPro] Initializing all integrations...');
  
  // Initialize open-source integrations
  const { initializeOpenSourceIntegrations } = await import('./openSourceIntegrations');
  await initializeOpenSourceIntegrations();
  
  // Initialize offline sync
  const { syncService } = await import('./offlineSync');
  await syncService.initialize([
    { name: 'sales', keyPath: 'id', indexes: [{ name: 'created_at', keyPath: '_sync.lastModifiedAt' }] },
    { name: 'inventory', keyPath: 'id' },
    { name: 'stations', keyPath: 'id' },
    { name: 'users', keyPath: 'id' },
  ]);
  
  console.log('[FuelPro] All integrations initialized');
}

// Environment variable validation
export function validateEnvVariables() {
  const required: string[] = [];
  const optional: string[] = [];

  // Supabase (required)
  if (!import.meta.env.VITE_SUPABASE_URL) {
    required.push('VITE_SUPABASE_URL');
  }
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    required.push('VITE_SUPABASE_ANON_KEY');
  }

  // Analytics (optional)
  if (!import.meta.env.VITE_POSTHOG_API_KEY) {
    optional.push('VITE_POSTHOG_API_KEY');
  }

  // Payments (optional)
  if (!import.meta.env.VITE_MPESA_CONSUMER_KEY) {
    optional.push('VITE_MPESA_CONSUMER_KEY');
  }
  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    optional.push('VITE_STRIPE_PUBLISHABLE_KEY');
  }

  // Chat (optional)
  if (!import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN) {
    optional.push('VITE_CHATWOOT_WEBSITE_TOKEN');
  }

  return {
    isValid: required.length === 0,
    required,
    optional,
    message: required.length > 0
      ? `Missing required environment variables: ${required.join(', ')}`
      : 'All required environment variables are set',
  };
}

// Feature flags based on environment variables
export function getFeatureFlags() {
  return {
    analytics: !!import.meta.env.VITE_POSTHOG_API_KEY,
    errorTracking: !!import.meta.env.VITE_SENTRY_DSN || !!import.meta.env.VITE_GLITCHTIP_DSN,
    chat: !!import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN,
    webAnalytics: !!import.meta.env.VITE_UMAMI_WEBSITE_ID,
    mpesa: !!import.meta.env.VITE_MPESA_CONSUMER_KEY,
    flutterwave: !!import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY,
    stripe: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    paystack: !!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    offlineSync: true, // Always enabled
    aiAssistant: !!import.meta.env.VITE_OPENAI_API_KEY || !!import.meta.env.VITE_ANTHROPIC_API_KEY,
    pdfExport: true, // Always available via jsPDF
    excelExport: true, // Always available via SheetJS
    offlineMode: true, // Always available via IndexedDB
    pushNotifications: !!import.meta.env.VITE_FCM_VAPID_KEY,
    sms: !!import.meta.env.VITE_TWILIO_ACCOUNT_SID,
    whatsapp: !!import.meta.env.VITE_WHATSAPP_FROM,
  };
}

// Get available payment providers
export function getAvailablePaymentProviders() {
  const providers = [];
  
  if (import.meta.env.VITE_MPESA_CONSUMER_KEY) {
    providers.push('mpesa');
  }
  if (import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY) {
    providers.push('flutterwave');
  }
  if (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    providers.push('stripe');
  }
  if (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY) {
    providers.push('paystack');
  }
  if (import.meta.env.VITE_CRYPTO_ENABLED === 'true') {
    providers.push('crypto');
  }
  
  return providers;
}

// Get available AI providers
export function getAvailableAIProviders() {
  const providers = [];
  
  if (import.meta.env.VITE_OPENAI_API_KEY) {
    providers.push({
      id: 'openai',
      name: 'OpenAI',
      models: ['gpt-4', 'gpt-3.5-turbo'],
    });
  }
  if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
    providers.push({
      id: 'anthropic',
      name: 'Anthropic Claude',
      models: ['claude-3-opus', 'claude-3-sonnet'],
    });
  }
  if (import.meta.env.VITE_GOOGLE_API_KEY) {
    providers.push({
      id: 'google',
      name: 'Google Gemini',
      models: ['gemini-pro'],
    });
  }
  if (import.meta.env.VITE_OLLAMA_URL) {
    providers.push({
      id: 'ollama',
      name: 'Ollama (Local)',
      models: ['llama2', 'mistral', 'codellama'],
    });
  }
  
  return providers;
}

// Get available notification channels
export function getAvailableNotificationChannels() {
  const channels = ['in_app']; // Always available
  
  if (import.meta.env.VITE_SENDGRID_API_KEY || import.meta.env.VITE_RESEND_API_KEY) {
    channels.push('email');
  }
  if (import.meta.env.VITE_TWILIO_ACCOUNT_SID) {
    channels.push('sms');
  }
  if (import.meta.env.VITE_FCM_VAPID_KEY) {
    channels.push('push');
  }
  if (import.meta.env.VITE_WHATSAPP_FROM) {
    channels.push('whatsapp');
  }
  
  return channels;
}

// Export version info
export const INTEGRATION_VERSION = {
  version: '1.0.0',
  buildDate: new Date().toISOString(),
  integrations: {
    analytics: 'PostHog',
    errorTracking: 'GlitchTip/Sentry',
    chat: 'Chatwoot',
    payments: ['M-PESA', 'Flutterwave', 'Stripe', 'Paystack'],
    notifications: ['Email', 'SMS', 'Push', 'WhatsApp'],
    export: ['XLSX', 'CSV', 'PDF', 'JSON', 'XML', 'HTML'],
    sync: 'IndexedDB + Background Sync',
    ai: ['OpenAI', 'Anthropic', 'Google', 'Ollama'],
  },
};

export default {
  initializeAllIntegrations,
  validateEnvVariables,
  getFeatureFlags,
  getAvailablePaymentProviders,
  getAvailableAIProviders,
  getAvailableNotificationChannels,
  INTEGRATION_VERSION,
};
