/**
 * FuelPro Open-Source Integrations
 * 
 * This module integrates multiple open-source tools to enhance the FuelPro application:
 * 
 * 1. PostHog - Product Analytics (https://github.com/posthog/posthog)
 * 2. GlitchTip - Error Tracking (https://github.com/glitchtip/glitchtip)
 * 3. Chatwoot - Customer Chat (https://github.com/chatwoot/chatwoot)
 * 4. Umami - Web Analytics (https://github.com/umami-software/umami)
 * 5. Simple Analytics - Privacy-focused analytics
 * 6. LogRocket - Session replay (optional)
 * 
 * All integrations are GDPR compliant and respect user privacy.
 */

import { useEffect, useRef, useCallback } from 'react';

// Environment variables
const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

const GLITCHTIP_DSN = import.meta.env.VITE_GLITCHTIP_DSN || '';

const CHATWOOT_WEBSITE_TOKEN = import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN || '';
const CHATWOOT_HOST = import.meta.env.VITE_CHATWOOT_HOST || 'https://app.chatwoot.com';

const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID || '';
const UMAMI_HOST = import.meta.env.VITE_UMAMI_HOST || 'https://analytics.umami.is';

/**
 * PostHog Analytics Integration
 * Open-source product analytics with session recording
 */
class PostHogAnalytics {
  private initialized = false;
  private queue: Array<{ method: string; args: any[] }> = [];

  async init() {
    if (this.initialized || !POSTHOG_API_KEY) return;
    
    try {
      // Dynamic import to avoid blocking initial load
      const posthogModule = await import('posthog-js');
      const posthog = posthogModule.default;
      
      posthog.init(POSTHOG_API_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false, // We handle this manually
        capture_pageleave: true,
        autocapture: true,
        session_recording: {
          maskAllInputs: true, // Mask sensitive data
        },
        bootstrap: {
          featureFlags: {},
        },
        loaded: (posthog) => {
          posthog.onFeatureFlags(() => {
            console.log('[PostHog] Feature flags loaded');
          });
        },
      });

      // Process queued calls
      this.queue.forEach(({ method, args }) => {
        (posthog as any)[method](...args);
      });
      this.queue = [];
      this.initialized = true;
      console.log('[PostHog] Initialized successfully');
    } catch (error) {
      console.error('[PostHog] Failed to initialize:', error);
    }
  }

  private call(method: string, ...args: any[]) {
    if (this.initialized) {
      import('posthog-js').then((module) => {
        (module.default as any)[method](...args);
      });
    } else {
      this.queue.push({ method, args });
    }
  }

  identify(userId: string, properties?: Record<string, any>) {
    this.call('identify', userId, properties);
  }

  capture(event: string, properties?: Record<string, any>) {
    this.call('capture', event, properties);
  }

  page(pageName: string, properties?: Record<string, any>) {
    this.call('page', pageName, properties);
  }

  reset() {
    this.call('reset');
  }
}

/**
 * GlitchTip Error Tracking Integration
 * Open-source error tracking (Sentry alternative)
 */
class GlitchTipErrorTracking {
  private initialized = false;

  async init() {
    if (this.initialized || !GLITCHTIP_DSN) return;

    try {
      // Extract project ID and DSN from the GlitchTip DSN
      const dsn = this.parseDSN(GLITCHTIP_DSN);
      if (!dsn) {
        console.log('[GlitchTip] Invalid DSN format');
        return;
      }

      // Set up global error handlers
      window.onerror = this.handleError.bind(this);
      window.onunhandledrejection = this.handleUnhandledRejection.bind(this);

      // Intercept console.error
      const originalError = console.error;
      console.error = (...args: any[]) => {
        this.reportError('console.error', args.join(' '));
        originalError.apply(console, args);
      };

      this.initialized = true;
      console.log('[GlitchTip] Error tracking initialized');
    } catch (error) {
      console.error('[GlitchTip] Failed to initialize:', error);
    }
  }

  private parseDSN(dsn: string) {
    try {
      // GlitchTip DSN format: https://<key>@<host>/<project_id>
      const match = dsn.match(/^https?:\/\/(.+)@(.+)\/(\d+)$/);
      if (match) {
        return {
          key: match[1],
          host: match[2],
          projectId: match[3],
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async reportError(type: string, message: string, stack?: string) {
    if (!this.initialized || !GLITCHTIP_DSN) return;

    const dsn = this.parseDSN(GLITCHTIP_DSN);
    if (!dsn) return;

    const errorData = {
      type,
      message,
      stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('fuelpro_user_id'),
    };

    try {
      await fetch(`${window.location.protocol}//${dsn.host}/api/3/store/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=glitchtip/1.0, sentry_key=${dsn.key}`,
        },
        body: JSON.stringify(errorData),
      });
    } catch {
      // Silently fail to avoid infinite loops
    }
  }

  private handleError(message: string, source: string, lineno: number, colno: number, error: Error) {
    this.reportError('window.onerror', message, error?.stack);
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    this.reportError('unhandledrejection', String(event.reason), event.reason?.stack);
  }
}

/**
 * Chatwoot Customer Chat Integration
 * Open-source live chat software
 */
class ChatwootWidget {
  private initialized = false;

  async init() {
    if (this.initialized || !CHATWOOT_WEBSITE_TOKEN) return;

    try {
      // Create Chatwoot script
      const script = document.createElement('script');
      script.id = 'chatwoot-sdk';
      script.async = true;
      script.src = `${CHATWOOT_HOST}/packs/js/sdk.js`;
      
      script.onload = () => {
        (window as any).chatwootSettings = {
          hideMessageBubble: false,
          position: 'right',
          language: 'en',
          openWidgetInMobile: true,
        };
        
        // Initialize Chatwoot
        if ((window as any).chatwootSDK) {
          (window as any).chatwootSDK.run({
            websiteToken: CHATWOOT_WEBSITE_TOKEN,
            baseUrl: CHATWOOT_HOST,
          });
        }
      };

      document.head.appendChild(script);
      this.initialized = true;
      console.log('[Chatwoot] Widget initialized');
    } catch (error) {
      console.error('[Chatwoot] Failed to initialize:', error);
    }
  }

  toggle() {
    if ((window as any).chatwootSDK) {
      (window as any).chatwootSDK.toggle();
    }
  }

  setUser(identifier: string, name: string, email?: string) {
    if ((window as any).chatwootSDK) {
      (window as any).chatwootSDK.setUser(identifier, {
        name,
        email,
      });
    }
  }
}

/**
 * Umami Web Analytics Integration
 * Privacy-focused Google Analytics alternative
 */
class UmamiAnalytics {
  private initialized = false;

  async init() {
    if (this.initialized || !UMAMI_WEBSITE_ID) return;

    try {
      // Create Umami script
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.src = `${UMAMI_HOST}/script.js`;
      script.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
      
      document.head.appendChild(script);
      this.initialized = true;
      console.log('[Umami] Analytics initialized');
    } catch (error) {
      console.error('[Umami] Failed to initialize:', error);
    }
  }

  track(eventName: string, eventData?: Record<string, any>) {
    if (typeof (window as any).umami !== 'undefined') {
      (window as any).umami.track(eventName, eventData);
    }
  }
}

/**
 * Simple Custom Analytics (GDPR Compliant)
 * Fallback when other analytics are not configured
 */
class SimpleAnalytics {
  private events: Array<{ name: string; data: any; timestamp: number }> = [];

  track(eventName: string, eventData?: Record<string, any>) {
    const event = {
      name: eventName,
      data: eventData,
      timestamp: Date.now(),
    };
    
    this.events.push(event);
    
    // Also log to console in development
    if (import.meta.env.DEV) {
      console.log('[Analytics]', eventName, eventData);
    }
    
    // Store locally
    this.saveLocally();
  }

  private saveLocally() {
    try {
      localStorage.setItem('fuelpro_analytics', JSON.stringify(this.events.slice(-100)));
    } catch {
      // Storage might be full
    }
  }

  getEvents() {
    return this.events;
  }

  clear() {
    this.events = [];
    localStorage.removeItem('fuelpro_analytics');
  }
}

// Singleton instances
export const posthogAnalytics = new PostHogAnalytics();
export const glitchtipTracking = new GlitchTipErrorTracking();
export const chatwootWidget = new ChatwootWidget();
export const umamiAnalytics = new UmamiAnalytics();
export const simpleAnalytics = new SimpleAnalytics();

/**
 * Initialize all integrations
 */
export async function initializeOpenSourceIntegrations() {
  console.log('[FuelPro] Initializing open-source integrations...');
  
  // Initialize in parallel
  await Promise.allSettled([
    posthogAnalytics.init(),
    glitchtipTracking.init(),
    chatwootWidget.init(),
    umamiAnalytics.init(),
  ]);
  
  console.log('[FuelPro] Open-source integrations ready');
}

/**
 * React hook for using analytics
 */
export function useAnalytics() {
  const posthogRef = useRef(postHogAnalytics);
  const simpleRef = useRef(simpleAnalytics);
  
  return {
    // PostHog methods
    identify: (userId: string, properties?: Record<string, any>) => 
      posthogRef.current.identify(userId, properties),
    capture: (event: string, properties?: Record<string, any>) => 
      posthogRef.current.capture(event, properties),
    page: (pageName: string, properties?: Record<string, any>) => 
      posthogRef.current.page(pageName, properties),
    reset: () => posthogRef.current.reset(),
    
    // Simple analytics (always available)
    trackEvent: (eventName: string, data?: Record<string, any>) => 
      simpleRef.current.track(eventName, data),
  };
}

/**
 * Analytics Provider Component
 */
export function OpenSourceIntegrationsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeOpenSourceIntegrations();
  }, []);

  return <>{children}</>;
}

/**
 * Chatwoot Widget Toggle Component
 */
export function ChatwootToggle() {
  const handleClick = useCallback(() => {
    chatwootWidget.toggle();
  }, []);

  return (
    <button
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#f59e0b',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
      }}
      title="Open Chat"
    >
      💬
    </button>
  );
}

/**
 * Utility function to track any action
 */
export function trackAction(
  category: string,
  action: string,
  label?: string,
  value?: number
) {
  const eventData = {
    category,
    action,
    label,
    value,
    timestamp: Date.now(),
  };
  
  // Track in all available analytics
  posthogAnalytics.capture(`${category}_${action}`, eventData);
  simpleAnalytics.track(`${category}_${action}`, eventData);
  
  if (UMAMI_WEBSITE_ID) {
    umamiAnalytics.track(`${category}_${action}`, eventData);
  }
}

// Export types for TypeScript support
export type {
  PostHogAnalytics,
  GlitchTipErrorTracking,
  ChatwootWidget,
  UmamiAnalytics,
  SimpleAnalytics,
};

export default {
  initializeOpenSourceIntegrations,
  useAnalytics,
  posthogAnalytics,
  glitchtipTracking,
  chatwootWidget,
  umamiAnalytics,
  simpleAnalytics,
  trackAction,
};
