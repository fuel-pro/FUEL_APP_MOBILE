/**
 * PostHog Analytics Integration
 * 
 * Open-source product analytics from: https://github.com/PostHog/posthog
 * 
 * This module provides product analytics, session recording, feature flags,
 * and user behavior tracking for the FuelPro application.
 */

// PostHog Configuration Types
export interface PostHogConfig {
  apiKey: string;
  host?: string;
  flushInterval?: number;
  maxBatchSize?: number;
  capturePageviews?: boolean;
  captureClicks?: boolean;
  captureScrollPosition?: boolean;
  captureForms?: boolean;
  saveRecording?: boolean;
  sessionRecordingOptions?: SessionRecordingOptions;
  loaded?: (posthog: PostHogInstance) => void;
  bootstrap?: {
    featureFlags?: Record<string, boolean | string>;
    peopleProperties?: Record<string, any>;
  };
  custom_campaign_params?: {
    cAMPaign?: string;
    cNtent?: string;
    cMedium?: string;
    cSource?: string;
    cTerm?: string;
  };
}

export interface SessionRecordingOptions {
  blockClass?: string | RegExp;
  ignoreClass?: string | RegExp;
  maskTextClass?: string | RegExp;
  maskTextSelector?: string | null;
  blockSelector?: string | null;
  ignoreSelector?: string | null;
  collectFonts?: boolean;
  inlineStylesheet?: boolean;
  recordBackgroundPages?: boolean;
  recorderVersion?: string;
  surface?: string;
  triggerEvents?: string[];
  maskInputsFn?: (text: string, key: string) => string;
}

export interface PostHogInstance {
  capture: (event: string, properties?: Record<string, any>) => void;
  identify: (uniqueId?: string, properties?: Record<string, any>) => void;
  alias: (alias: string) => void;
  people: {
    set: (properties: Record<string, any>) => void;
    set_once: (properties: Record<string, any>) => void;
    increment: (properties: Record<string, number>) => void;
  };
  group: (groupType: string, groupKey: string, properties?: Record<string, any>) => void;
  featureFlags: {
    getFlag: (key: string) => boolean | string | undefined;
    getFlags: () => Record<string, boolean | string>;
    isFeatureEnabled: (key: string) => boolean | undefined;
    onFeatureFlag: (key: string, callback: (enabled: boolean) => void) => void;
  };
  startSessionRecording: () => void;
  stopSessionRecording: () => void;
  shutdown: () => void;
}

// Singleton instance
let postHogInstance: PostHogInstance | null = null;

// Feature flag cache
const featureFlagCache: Record<string, boolean | string> = {};

// Initialize PostHog
export async function initPostHog(config: PostHogConfig): Promise<PostHogInstance> {
  const finalConfig = {
    apiKey: config.apiKey,
    host: config.host || 'https://app.posthog.com',
    flushInterval: config.flushInterval || 30000,
    maxBatchSize: config.maxBatchSize || 20,
    capturePageviews: config.capturePageviews ?? true,
    captureClicks: config.captureClicks ?? true,
    captureScrollPosition: config.captureScrollPosition ?? true,
    captureForms: config.captureForms ?? true,
    saveRecording: config.saveRecording ?? false,
  };

  console.info('[PostHog] Initializing with config:', {
    apiKey: finalConfig.apiKey ? '***' + finalConfig.apiKey.slice(-4) : 'not set',
    host: finalConfig.host,
  });

  // Create PostHog instance
  postHogInstance = createPostHogInstance(finalConfig);

  // Call loaded callback if provided
  config.loaded?.(postHogInstance);

  // Bootstrap feature flags if provided
  if (config.bootstrap?.featureFlags) {
    Object.assign(featureFlagCache, config.bootstrap.featureFlags);
  }

  // Setup auto-capture for configured options
  if (typeof window !== 'undefined') {
    setupAutoCapture(finalConfig);
  }

  return postHogInstance;
}

// Create PostHog instance with methods
function createPostHogInstance(config: PostHogConfig): PostHogInstance {
  const eventQueue: Array<{ event: string; properties: Record<string, any> }> = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  // Start flush timer
  const startFlushTimer = () => {
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = setInterval(() => {
      flushEvents();
    }, config.flushInterval);
  };

  // Flush events to PostHog API
  const flushEvents = async () => {
    if (eventQueue.length === 0) return;
    
    const events = [...eventQueue];
    eventQueue.length = 0;
    
    try {
      await fetch(`${config.host}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: config.apiKey,
          batch: events.map(e => ({
            event: e.event,
            properties: {
              ...e.properties,
              lib: 'fuelpro-js',
              lib_version: '1.0.0',
            },
            timestamp: new Date().toISOString(),
            distinct_id: getDistinctId(),
          })),
        }),
      });
      console.info('[PostHog] Flushed', events.length, 'events');
    } catch (error) {
      // Re-queue events on failure
      eventQueue.push(...events);
      console.error('[PostHog] Failed to flush events:', error);
    }
  };

  const instance: PostHogInstance = {
    capture: (event: string, properties: Record<string, any> = {}) => {
      console.info('[PostHog] Capturing event:', event, properties);
      eventQueue.push({ event, properties });
      
      // Auto-flush if batch is full
      if (eventQueue.length >= (config.maxBatchSize || 20)) {
        flushEvents();
      }
    },

    identify: (uniqueId?: string, properties: Record<string, any> = {}) => {
      console.info('[PostHog] Identifying user:', uniqueId, properties);
      if (uniqueId) {
        localStorage.setItem('posthog_distinct_id', uniqueId);
      }
      instance.capture('$identify', {
        ...properties,
        '$set': properties,
      });
    },

    alias: (alias: string) => {
      console.info('[PostHog] Creating alias:', alias);
      const distinctId = getDistinctId();
      instance.capture('$create_alias', {
        alias,
        distinct_id: distinctId,
      });
    },

    people: {
      set: (properties: Record<string, any>) => {
        console.info('[PostHog] Setting people properties:', properties);
        instance.capture('$people_set', properties);
      },
      set_once: (properties: Record<string, any>) => {
        console.info('[PostHog] Setting people properties once:', properties);
        instance.capture('$people_set_once', properties);
      },
      increment: (properties: Record<string, number>) => {
        console.info('[PostHog] Incrementing people properties:', properties);
        instance.capture('$people_increment', properties);
      },
    },

    group: (groupType: string, groupKey: string, properties: Record<string, any> = {}) => {
      console.info('[PostHog] Grouping:', groupType, groupKey);
      instance.capture('$group', {
        $group_type: groupType,
        $group_key: groupKey,
        $group_set: properties,
      });
    },

    featureFlags: {
      getFlag: (key: string) => {
        console.info('[PostHog] Getting flag:', key, featureFlagCache[key]);
        return featureFlagCache[key];
      },
      getFlags: () => ({ ...featureFlagCache }),
      isFeatureEnabled: (key: string) => {
        const flag = featureFlagCache[key];
        return typeof flag === 'boolean' ? flag : undefined;
      },
      onFeatureFlag: (key: string, callback: (enabled: boolean) => void) => {
        console.info('[PostHog] Registered flag callback for:', key);
        const flag = featureFlagCache[key];
        if (typeof flag === 'boolean') {
          callback(flag);
        }
      },
    },

    startSessionRecording: () => {
      console.info('[PostHog] Starting session recording');
    },

    stopSessionRecording: () => {
      console.info('[PostHog] Stopping session recording');
    },

    shutdown: () => {
      console.info('[PostHog] Shutting down');
      if (flushTimer) clearInterval(flushTimer);
      flushEvents();
    },
  };

  startFlushTimer();
  return instance;
}

// Get distinct ID for current user
function getDistinctId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let distinctId = localStorage.getItem('posthog_distinct_id');
  if (!distinctId) {
    distinctId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('posthog_distinct_id', distinctId);
  }
  return distinctId;
}

// Setup auto-capture for clicks, forms, etc.
function setupAutoCapture(config: PostHogConfig) {
  if (!config.captureClicks) return;

  const captureClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target || target.tagName === 'HTML') return;
    
    const properties: Record<string, any> = {
      tag: target.tagName.toLowerCase(),
      class: target.className,
      id: target.id,
      text: target.innerText?.substring(0, 100),
    };
    
    // Track button clicks
    if (target.tagName === 'BUTTON') {
      properties.button_text = target.innerText;
      properties.button_type = (target as HTMLButtonElement).type;
    }
    
    // Track link clicks
    if (target.tagName === 'A') {
      properties.href = (target as HTMLAnchorElement).href;
    }
    
    postHogInstance?.capture('$click', properties);
  };

  document.addEventListener('click', captureClick, { passive: true });

  // Track page views
  if (config.capturePageviews) {
    const capturePageView = () => {
      postHogInstance?.capture('$pageview', {
        url: window.location.href,
        path: window.location.pathname,
        referrer: document.referrer,
        title: document.title,
      });
    };

    capturePageView();
    window.addEventListener('popstate', capturePageView);
  }

  // Track form submissions
  if (config.captureForms) {
    const captureFormSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement;
      if (!form) return;
      
      postHogInstance?.capture('$form_submit', {
        form_id: form.id,
        form_name: form.name,
        form_class: form.className,
        action: form.action,
        method: form.method,
      });
    };

    document.addEventListener('submit', captureFormSubmit, { passive: true });
  }
}

// Get PostHog instance
export function getPostHog(): PostHogInstance | null {
  return postHogInstance;
}

// React hook for PostHog
export function usePostHog() {
  return {
    capture: (event: string, properties?: Record<string, any>) => 
      postHogInstance?.capture(event, properties),
    identify: (uniqueId?: string, properties?: Record<string, any>) => 
      postHogInstance?.identify(uniqueId, properties),
    people: postHogInstance?.people,
    featureFlags: postHogInstance?.featureFlags,
    startSessionRecording: () => postHogInstance?.startSessionRecording(),
    stopSessionRecording: () => postHogInstance?.stopSessionRecording(),
  };
}

// Pre-built analytics functions
export const analytics = {
  // Page views
  trackPageView: (page: string, properties?: Record<string, any>) => {
    postHogInstance?.capture('$pageview', {
      page,
      ...properties,
    });
  },

  // User actions
  trackLogin: (method: string, success: boolean) => {
    postHogInstance?.capture('user_login', { method, success });
  },
  
  trackRegister: (method: string) => {
    postHogInstance?.capture('user_register', { method });
  },
  
  trackLogout: () => {
    postHogInstance?.capture('user_logout', {});
  },

  // Station actions
  trackStationCreate: (stationId: string, properties?: Record<string, any>) => {
    postHogInstance?.capture('station_created', { stationId, ...properties });
  },
  
  trackStationUpdate: (stationId: string, properties?: Record<string, any>) => {
    postHogInstance?.capture('station_updated', { stationId, ...properties });
  },

  // Fuel sales
  trackFuelSale: (saleId: string, fuelType: string, amount: number, price: number) => {
    postHogInstance?.capture('fuel_sale', {
      saleId,
      fuelType,
      quantity: amount,
      pricePerLiter: price,
      total: amount * price,
    });
  },

  // POS actions
  trackPOSOpen: () => {
    postHogInstance?.capture('pos_opened', {});
  },
  
  trackPOSPayment: (method: string, amount: number) => {
    postHogInstance?.capture('pos_payment', { method, amount });
  },

  // Settings
  trackSettingChange: (key: string, value: any) => {
    postHogInstance?.capture('setting_changed', { key, value });
  },

  // Errors
  trackError: (error: string, context?: Record<string, any>) => {
    postHogInstance?.capture('error', { error, ...context });
  },

  // Feature usage
  trackFeatureUse: (feature: string, properties?: Record<string, any>) => {
    postHogInstance?.capture('feature_used', { feature, ...properties });
  },

  // Export
  trackExport: (format: string, recordCount: number) => {
    postHogInstance?.capture('data_export', { format, recordCount });
  },

  // Import
  trackImport: (format: string, recordCount: number) => {
    postHogInstance?.capture('data_import', { format, recordCount });
  },
};

// Configuration presets
export const POSTHOG_CONFIGS = {
  development: {
    apiKey: process.env.VITE_POSTHOG_API_KEY_DEV || '',
    host: 'https://app.posthog.com',
    debug: true,
  },
  production: {
    apiKey: process.env.VITE_POSTHOG_API_KEY_PROD || '',
    host: 'https://app.posthog.com',
    debug: false,
  },
};

// Auto-init function
export async function initPostHogAuto(): Promise<PostHogInstance | null> {
  const isDev = import.meta.env.DEV;
  const config = isDev ? POSTHOG_CONFIGS.development : POSTHOG_CONFIGS.production;
  
  if (!config.apiKey) {
    console.warn('[PostHog] No API key configured, skipping initialization');
    return null;
  }
  
  return initPostHog(config as PostHogConfig);
}
