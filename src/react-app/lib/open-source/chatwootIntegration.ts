/**
 * Chatwoot Customer Support Integration
 * 
 * Open-source customer support platform from: https://github.com/chatwoot/chatwoot
 * 
 * This module provides live chat, customer support ticketing,
 * and team inbox management for the FuelPro application.
 */

// Chatwoot Configuration Types
export interface ChatwootConfig {
  websiteToken: string;
  host?: string;
  locale?: string;
  position?: 'left' | 'right';
  language?: string;
  color?: string;
  widgetStyle?: 'standard' | 'expanded';
  showPopoutButton?: boolean;
  popoutWidget?: boolean;
  inboxPort?: number;
  enableRTL?: boolean;
  enableVoice?: boolean;
  closeable?: boolean;
  minimizeable?: boolean;
  useBrowserLanguage?: boolean;
  searchPlaceHolder?: string;
  transcriptSent?: boolean;
}

export interface ChatwootWidget {
  toggle: (state?: 'open' | 'close') => void;
  show: () => void;
  hide: () => void;
  isOpen: () => boolean;
  destroy: () => void;
}

export interface ChatwootUser {
  identifier: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  phone_number?: string;
  custom_attributes?: Record<string, any>;
}

export interface ChatwootEvent {
  name: string;
  properties?: Record<string, any>;
}

export interface ChatwootMessage {
  content: string;
  type?: 'incoming' | 'outgoing';
  sender?: {
    name: string;
    avatar?: string;
  };
  timestamp?: string;
}

// Singleton instance
let chatwootWidget: ChatwootWidget | null = null;
let chatwootLoaded = false;
let chatwootQueue: Array<() => void> = [];

// Initialize Chatwoot widget
export function initChatwoot(config: ChatwootConfig): ChatwootWidget {
  const finalConfig = {
    websiteToken: config.websiteToken,
    host: config.host || 'https://app.chatwoot.com',
    position: config.position || 'left',
    locale: config.locale || 'en',
    color: config.color || '#1f93ff',
    showPopoutButton: config.showPopoutButton ?? true,
    enableRTL: config.enableRTL ?? false,
    closeable: config.closeable ?? true,
    minimizeable: config.minimizeable ?? true,
  };

  console.info('[Chatwoot] Initializing with config:', {
    websiteToken: finalConfig.websiteToken ? '***' + finalConfig.websiteToken.slice(-4) : 'not set',
    host: finalConfig.host,
  });

  // Create widget interface
  chatwootWidget = {
    toggle: (state?: 'open' | 'close') => {
      console.info('[Chatwoot] Toggling widget:', state);
      if (typeof window !== 'undefined' && (window as any).chatwootSDK) {
        (window as any).chatwootSDK.toggle(state);
      }
    },
    show: () => {
      console.info('[Chatwoot] Showing widget');
      chatwootWidget?.toggle('open');
    },
    hide: () => {
      console.info('[Chatwoot] Hiding widget');
      chatwootWidget?.toggle('close');
    },
    isOpen: () => {
      // Would check actual widget state
      return false;
    },
    destroy: () => {
      console.info('[Chatwoot] Destroying widget');
      if (typeof window !== 'undefined') {
        const script = document.getElementById('chatwoot-sdk-script');
        script?.remove();
        delete (window as any).chatwootSDK;
      }
      chatwootLoaded = false;
    },
  };

  // Load Chatwoot SDK
  if (typeof window !== 'undefined' && !chatwootLoaded) {
    loadChatwootSDK(finalConfig);
  }

  return chatwootWidget;
}

// Load Chatwoot SDK script
function loadChatwootSDK(config: ChatwootConfig): void {
  // Create SDK script
  const script = document.createElement('script');
  script.id = 'chatwoot-sdk-script';
  script.async = true;
  script.src = `${config.host}/packs/js/sdk.js`;
  
  script.onload = () => {
    chatwootLoaded = true;
    console.info('[Chatwoot] SDK loaded successfully');
    
    // Configure SDK
    if ((window as any).chatwootSDK) {
      (window as any).chatwootSDK.init({
        websiteToken: config.websiteToken,
        host: config.host,
        locale: config.locale,
        position: config.position,
        color: config.color,
        showPopoutButton: config.showPopoutButton,
        enableRTL: config.enableRTL,
        closeable: config.closeable,
        minimizeable: config.minimizeable,
      });
      
      // Process queued actions
      chatwootQueue.forEach(fn => fn());
      chatwootQueue = [];
    }
  };
  
  script.onerror = () => {
    console.error('[Chatwoot] Failed to load SDK');
  };
  
  document.head.appendChild(script);
}

// Set user identity
export function setChatwootUser(user: ChatwootUser): void {
  console.info('[Chatwoot] Setting user:', user.identifier);
  
  const setUserFn = () => {
    if ((window as any).chatwootSDK) {
      (window as any).chatwootSDK.setUser(user.identifier, {
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        phone_number: user.phone_number,
        ...user.custom_attributes,
      });
    }
  };
  
  if (chatwootLoaded) {
    setUserFn();
  } else {
    chatwootQueue.push(setUserFn);
  }
}

// Clear user identity (on logout)
export function clearChatwootUser(): void {
  console.info('[Chatwoot] Clearing user');
  
  const clearFn = () => {
    if ((window as any).chatwootSDK) {
      (window as any).chatwootSDK.clearSession();
    }
  };
  
  if (chatwootLoaded) {
    clearFn();
  } else {
    chatwootQueue.push(clearFn);
  }
}

// Track event
export function trackChatwootEvent(event: ChatwootEvent): void {
  console.info('[Chatwoot] Tracking event:', event);
  
  const trackFn = () => {
    if ((window as any).chatwootSDK) {
      (window as any).chatwootSDK.trackEvent(event.name, event.properties);
    }
  };
  
  if (chatwootLoaded) {
    trackFn();
  } else {
    chatwootQueue.push(trackFn);
  }
}

// Open conversation with specific greeting
export function openChatwootConversation(greeting?: string): void {
  console.info('[Chatwoot] Opening conversation');
  
  chatwootWidget?.show();
  
  if (greeting && (window as any).chatwootSDK) {
    // Would send initial message
    (window as any).chatwootSDK.sendMessage(greeting);
  }
}

// Get Chatwoot widget instance
export function getChatwootWidget(): ChatwootWidget | null {
  return chatwootWidget;
}

// React component for Chatwoot launcher
export function ChatwootLauncher() {
  return (
    <button
      onClick={() => chatwootWidget?.toggle('open')}
      style={{
        position: 'fixed',
        bottom: '20px',
        [chatwootWidget ? 'left' : 'right']: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#1f93ff',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      aria-label="Open chat"
    >
      💬
    </button>
  );
}

// Pre-built support functions
export const support = {
  // Open chat with specific topic
  openChat: (topic: string, properties?: Record<string, any>) => {
    openChatwootConversation(`Hi, I need help with: ${topic}`);
    trackChatwootEvent({
      name: 'chat_opened',
      properties: { topic, ...properties },
    });
  },
  
  // Report a problem
  reportProblem: (description: string, priority?: 'low' | 'medium' | 'high') => {
    openChatwootConversation(
      `Problem Report:\n\nDescription: ${description}\nPriority: ${priority || 'medium'}`
    );
    trackChatwootEvent({
      name: 'problem_reported',
      properties: { description, priority },
    });
  },
  
  // Request a feature
  requestFeature: (feature: string, useCase?: string) => {
    openChatwootConversation(
      `Feature Request:\n\nFeature: ${feature}\nUse Case: ${useCase || 'N/A'}`
    );
    trackChatwootEvent({
      name: 'feature_requested',
      properties: { feature, useCase },
    });
  },
  
  // Get help with station
  getStationHelp: (stationId: string, issue?: string) => {
    openChatwootConversation(
      `Station Help Request:\n\nStation ID: ${stationId}\nIssue: ${issue || 'General inquiry'}`
    );
    trackChatwootEvent({
      name: 'station_help_requested',
      properties: { stationId, issue },
    });
  },
  
  // Billing inquiry
  billingInquiry: (topic: string, details?: string) => {
    openChatwootConversation(
      `Billing Inquiry:\n\nTopic: ${topic}\nDetails: ${details || 'N/A'}`
    );
    trackChatwootEvent({
      name: 'billing_inquiry',
      properties: { topic, details },
    });
  },
  
  // Technical support
  technicalSupport: (error?: string, context?: Record<string, any>) => {
    openChatwootConversation(
      `Technical Support Request:\n\nError: ${error || 'N/A'}`
    );
    trackChatwootEvent({
      name: 'technical_support_requested',
      properties: { error, ...context },
    });
  },
};

// Configuration presets
export const CHATWOOT_CONFIGS = {
  development: {
    websiteToken: process.env.VITE_CHATWOOT_WEBSITE_TOKEN_DEV || '',
    host: process.env.VITE_CHATWOOT_HOST_DEV || 'https://app.chatwoot.com',
  },
  production: {
    websiteToken: process.env.VITE_CHATWOOT_WEBSITE_TOKEN_PROD || '',
    host: process.env.VITE_CHATWOOT_HOST_PROD || 'https://app.chatwoot.com',
  },
};

// Auto-init function
export function initChatwootAuto(): ChatwootWidget | null {
  const isDev = import.meta.env.DEV;
  const config = isDev ? CHATWOOT_CONFIGS.development : CHATWOOT_CONFIGS.production;
  
  if (!config.websiteToken) {
    console.warn('[Chatwoot] No website token configured, skipping initialization');
    return null;
  }
  
  return initChatwoot(config as ChatwootConfig);
}

// Type augmentation for window
declare global {
  interface Window {
    chatwootSDK?: {
      init: (config: any) => void;
      toggle: (state?: 'open' | 'close') => void;
      setUser: (identifier: string, userInfo?: any) => void;
      clearSession: () => void;
      trackEvent: (event: string, properties?: Record<string, any>) => void;
      sendMessage: (message: string) => void;
    };
  }
}

import * as React from 'react';
