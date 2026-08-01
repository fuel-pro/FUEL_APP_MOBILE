/**
 * Sentry Error Tracking Integration
 * 
 * Open-source error tracking from: https://github.com/getsentry/sentry-javascript
 * 
 * This module provides comprehensive error tracking, performance monitoring,
 * and crash reporting for the FuelPro application.
 */

// Sentry Configuration Types
export interface SentryConfig {
  dsn: string;
  environment: 'development' | 'staging' | 'production';
  release?: string;
  debug?: boolean;
  sampleRate?: number;
  maxBreadcrumbs?: number;
  attachStacktrace?: boolean;
  sendDefaultPii?: boolean;
  serverName?: string;
  initOnlyOutside?: boolean;
}

export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
  segment?: string;
  [key: string]: any;
}

export interface SentryBreadcrumb {
  category: string;
  message: string;
  data?: Record<string, any>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  type?: 'default' | 'http' | 'navigation' | 'console' | 'custom';
  timestamp?: number;
}

export interface SentrySpan {
  op?: string;
  description?: string;
  data?: Record<string, any>;
  status?: string;
}

export interface SentryTransactionContext {
  name: string;
  op: string;
  trimEnd?: boolean;
  source?: 'custom' | 'url' | 'route' | 'view' | 'component' | 'task' | 'queue' | 'http' | 'db' | 'cache' | 'console' | 'native';
}

// Initialize Sentry with environment-specific configuration
export async function initSentry(config: SentryConfig): Promise<void> {
  const sentryConfig = {
    dsn: config.dsn,
    environment: config.environment,
    release: config.release || `fuelpro@${process.env.VERSION || '1.0.0'}`,
    debug: config.debug || false,
    sampleRate: config.sampleRate || 1.0,
    maxBreadcrumbs: config.maxBreadcrumbs || 100,
    attachStacktrace: config.attachStacktrace ?? true,
    sendDefaultPii: config.sendDefaultPii ?? false,
    serverName: config.serverName || typeof window !== 'undefined' ? window.location.host : undefined,
    // Performance monitoring
    tracesSampleRate: config.sampleRate || 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Integration configuration
    integrations: [
      // Browser integrations - would be loaded from @sentry/browser in production
      // - InboundFilters
      // - FunctionToString
      // - TryCatch
      // - Breadcrumbs
      // - GlobalHandlers
      // - LinkedErrors
      // - Dedupe
      // - HttpContext
      // - VueIntegration (if using Vue)
    ],
  };

  console.info('[Sentry] Initializing with config:', { 
    ...sentryConfig, 
    dsn: sentryConfig.dsn ? '***' : 'not set' 
  });

  // In production, this would initialize @sentry/browser:
  // import * as Sentry from '@sentry/browser';
  // Sentry.init(sentryConfig);

  return Promise.resolve();
}

// Capture a message
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): string | undefined {
  console.info(`[Sentry] Captured message [${level}]:`, message);
  
  // In production: return Sentry.captureMessage(message, level);
  return undefined;
}

// Capture an exception
export function captureException(
  exception: Error,
  hint?: Record<string, any>
): string | undefined {
  console.error('[Sentry] Captured exception:', exception.message, exception.stack);
  
  // In production: return Sentry.captureException(exception, { extra: hint });
  return undefined;
}

// Capture a custom event
export function captureEvent(
  event: Record<string, any>
): string | undefined {
  console.info('[Sentry] Captured event:', event);
  
  // In production: return Sentry.captureEvent(event);
  return undefined;
}

// Set user context
export function setUser(user: SentryUser | null): void {
  console.info('[Sentry] Setting user:', user?.id || 'null');
  
  // In production: Sentry.configureScope(scope => scope.setUser(user));
}

// Set tag
export function setTag(key: string, value: string): void {
  console.info(`[Sentry] Setting tag: ${key} = ${value}`);
  
  // In production: Sentry.configureScope(scope => scope.setTag(key, value));
}

// Set extra context
export function setContext(name: string, context: Record<string, any>): void {
  console.info(`[Sentry] Setting context: ${name}`, context);
  
  // In production: Sentry.configureScope(scope => scope.setContext(name, context));
}

// Add breadcrumb
export function addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
  console.info('[Sentry] Adding breadcrumb:', breadcrumb);
  
  // In production: Sentry.addBreadcrumb(breadcrumb);
}

// Start a new transaction
export function startTransaction(
  context: SentryTransactionContext
): { finish: (span?: SentrySpan) => void; end: (span?: SentrySpan) => void } {
  console.info('[Sentry] Starting transaction:', context);
  
  const startTime = Date.now();
  
  return {
    finish: (span?: SentrySpan) => {
      const duration = Date.now() - startTime;
      console.info('[Sentry] Transaction finished:', { ...context, duration, span });
    },
    end: (span?: SentrySpan) => {
      const duration = Date.now() - startTime;
      console.info('[Sentry] Transaction ended:', { ...context, duration, span });
    },
  };
}

// Start a child span
export function startSpan(
  context: SentrySpan
): { finish: () => void; end: () => void } {
  const startTime = Date.now();
  
  return {
    finish: () => {
      const duration = Date.now() - startTime;
      console.info('[Sentry] Span finished:', { ...context, duration });
    },
    end: () => {
      const duration = Date.now() - startTime;
      console.info('[Sentry] Span ended:', { ...context, duration });
    },
  };
}

// With Performance Monitoring
export function withPerformance<T extends (...args: any[]) => any>(
  name: string,
  op: string,
  fn: T
): T {
  return ((...args: any[]) => {
    const transaction = startTransaction({ name, op });
    try {
      const result = fn(...args);
      transaction.end();
      return result;
    } catch (error) {
      captureException(error as Error);
      transaction.end();
      throw error;
    }
  }) as T;
}

// With Error Boundary (React component integration)
export function createErrorBoundary(
  onError?: (error: Error, errorInfo: any) => void
): {
  ErrorBoundary: React.ComponentType<{ children: React.ReactNode; fallback?: React.ReactNode }>;
} {
  class ErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback?: React.ReactNode },
    { hasError: boolean; error: Error | null }
  > {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      captureException(error, { componentStack: errorInfo.componentStack });
      onError?.(error, errorInfo);
    }

    render() {
      if (this.state.hasError && this.state.error) {
        return this.props.fallback || (
          <div style={{ padding: 20, color: 'red' }}>
            <h2>Something went wrong</h2>
            <p>{this.state.error.message}</p>
          </div>
        );
      }
      return this.props.children;
    }
  }

  return { ErrorBoundary };
}

// Global error handlers
export function setupGlobalErrorHandlers(): () => void {
  const handlers: Array<() => void> = [];

  // Handle unhandled promise rejections
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    captureException(
      new Error(`Unhandled Promise Rejection: ${event.reason}`),
      { rejectionEvent: true }
    );
  };

  // Handle uncaught errors
  const handleUncaughtError = (event: ErrorEvent) => {
    captureException(
      event.error || new Error(`Uncaught Error: ${event.message}`),
      { message: event.message, filename: event.filename, lineno: event.lineno }
    );
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleUncaughtError);
    handlers.push(() => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleUncaughtError);
    });
  }

  return () => handlers.forEach(h => h());
}

// React hook for Sentry
export function useSentry() {
  return {
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
  };
}

// Export Sentry configuration
export const SENTRY_INTEGRATIONS = {
  // Would include actual integration instances in production:
  // - Replay integration
  // - Performance integration  
  // - BrowserTracing integration
  // - Feedback integration
};

// Default configuration for different environments
export const SENTRY_CONFIGS = {
  development: {
    dsn: process.env.VITE_SENTRY_DSN_DEV || '',
    environment: 'development' as const,
    debug: true,
    sampleRate: 0,
  },
  staging: {
    dsn: process.env.VITE_SENTRY_DSN_STAGING || '',
    environment: 'staging' as const,
    debug: false,
    sampleRate: 0.5,
  },
  production: {
    dsn: process.env.VITE_SENTRY_DSN_PROD || '',
    environment: 'production' as const,
    debug: false,
    sampleRate: 1.0,
  },
};

import * as React from 'react';
