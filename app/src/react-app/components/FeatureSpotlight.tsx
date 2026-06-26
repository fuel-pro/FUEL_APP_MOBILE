// ============================================================
// FeatureSpotlight - Contextual tips and feature discovery
// Inspired by Nextwork.ai - Discover features as you use the app
// ============================================================

import React, { useState, useEffect } from 'react';

interface Spotlight {
  id: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  category: 'feature' | 'tip' | 'announcement';
  priority: 'high' | 'medium' | 'low';
  dismissible: boolean;
  maxShow?: number; // How many times to show
}

// Feature spotlights
const FEATURE_SPOTLIGHTS: Spotlight[] = [
  {
    id: 'cloud-sync',
    title: '☁️ Your Data is Now Cloud-Synced',
    description: 'Your data automatically syncs across all your devices. No more data loss! Enable local storage only if you need offline access.',
    actionText: 'Manage Sync Settings',
    onAction: () => window.dispatchEvent(new CustomEvent('openSyncSettings')),
    category: 'feature',
    priority: 'high',
    dismissible: true,
    maxShow: 3
  },
  {
    id: 'quick-sale',
    title: '⚡ Quick Sale Shortcut',
    description: 'Press Q on your keyboard for instant quick sale mode. Save time on counter sales!',
    category: 'tip',
    priority: 'medium',
    dismissible: true,
    maxShow: 5
  },
  {
    id: 'dark-mode',
    title: '🌙 Dark Mode Available',
    description: 'Switch to dark mode for comfortable night-time operations. Check your settings!',
    actionText: 'Go to Settings',
    onAction: () => window.dispatchEvent(new CustomEvent('openSettings')),
    category: 'tip',
    priority: 'low',
    dismissible: true,
    maxShow: 2
  },
  {
    id: 'mpesa-alert',
    title: '📱 M-PESA Auto-Reconciliation',
    description: 'Connect your M-PESA account to automatically match payments with sales. No more manual tracking!',
    actionText: 'Set up M-PESA',
    onAction: () => window.dispatchEvent(new CustomEvent('openMpesaSettings')),
    category: 'feature',
    priority: 'high',
    dismissible: true,
    maxShow: 3
  },
  {
    id: 'reports-export',
    title: '📊 Export Reports to PDF',
    description: 'Download beautiful PDF reports for your records or to share with stakeholders.',
    category: 'tip',
    priority: 'medium',
    dismissible: true,
    maxShow: 5
  },
  {
    id: 'ai-assistant',
    title: '🤖 AI Help Assistant',
    description: 'Click the 💡 button anytime to get instant help with any feature.',
    category: 'announcement',
    priority: 'low',
    dismissible: true,
    maxShow: 10
  },
  {
    id: 'learning',
    title: '📚 FuelPro Academy',
    description: 'Learn fuel station management with interactive tutorials. Earn XP and unlock achievements!',
    actionText: 'Start Learning',
    onAction: () => window.dispatchEvent(new CustomEvent('openLearningPanel')),
    category: 'feature',
    priority: 'medium',
    dismissible: true,
    maxShow: 3
  }
];

const STORAGE_KEY = 'fuelpro_spotlight_dismissed';

export const FeatureSpotlight: React.FC = () => {
  const [currentSpotlight, setCurrentSpotlight] = useState<Spotlight | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check for dismissed spotlights
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const now = Date.now();
    
    // Find first eligible spotlight
    for (const spotlight of FEATURE_SPOTLIGHTS) {
      const dismissedData = dismissed[spotlight.id];
      const showCount = dismissedData?.count || 0;
      
      // Skip if max show reached
      if (spotlight.maxShow && showCount >= spotlight.maxShow) continue;
      
      // Skip if permanently dismissed
      if (dismissedData?.permanent) continue;
      
      // Skip if dismissed within last hour (for non-high priority)
      if (dismissedData?.dismissedAt && spotlight.priority !== 'high') {
        const hourAgo = now - 3600000;
        if (dismissedData.dismissedAt > hourAgo) continue;
      }
      
      // Found eligible spotlight
      setCurrentSpotlight(spotlight);
      setIsVisible(true);
      
      // Auto-dismiss after 8 seconds for low priority
      if (spotlight.priority === 'low') {
        setTimeout(() => dismissSpotlight(spotlight.id), 8000);
      }
      
      break;
    }
  }, []);

  const dismissSpotlight = (id: string, permanent = false) => {
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    
    if (!dismissed[id]) {
      dismissed[id] = { count: 0 };
    }
    
    if (permanent) {
      dismissed[id].permanent = true;
    } else {
      dismissed[id].count = (dismissed[id].count || 0) + 1;
      dismissed[id].dismissedAt = Date.now();
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
    
    setIsVisible(false);
    
    // Show next spotlight after a delay
    setTimeout(() => {
      setCurrentSpotlight(null);
      // Trigger re-check
      window.dispatchEvent(new CustomEvent('checkSpotlights'));
    }, 500);
  };

  if (!currentSpotlight || !isVisible) return null;

  const getCategoryStyles = (category: string, priority: string) => {
    if (priority === 'high') {
      return 'bg-gradient-to-r from-blue-600 to-purple-600 text-white';
    }
    if (category === 'announcement') {
      return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
    }
    return 'bg-white text-gray-900 border border-gray-200';
  };

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-slide-down">
      <div className={`rounded-2xl shadow-2xl overflow-hidden ${getCategoryStyles(currentSpotlight.category, currentSpotlight.priority)}`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
              {currentSpotlight.category === 'feature' ? '✨' : 
               currentSpotlight.category === 'announcement' ? '📢' : '💡'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-lg leading-tight">
                  {currentSpotlight.title}
                </h3>
                <button
                  onClick={() => dismissSpotlight(currentSpotlight!.id)}
                  className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
              <p className={`mt-1 text-sm leading-relaxed ${currentSpotlight.priority === 'high' || currentSpotlight.category === 'announcement' ? 'text-white/90' : 'text-gray-600'}`}>
                {currentSpotlight.description}
              </p>
              
              {currentSpotlight.actionText && (
                <button
                  onClick={() => {
                    currentSpotlight.onAction?.();
                    dismissSpotlight(currentSpotlight!.id, true);
                  }}
                  className={`mt-3 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    currentSpotlight.priority === 'high' || currentSpotlight.category === 'announcement'
                      ? 'bg-white text-gray-900 hover:bg-gray-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {currentSpotlight.actionText}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Progress bar (auto-dismiss indicator) */}
        {currentSpotlight.priority === 'low' && (
          <div className="h-1 bg-white/20">
            <div 
              className="h-full bg-white/60 animate-shrink-bar"
              style={{ animation: 'shrink-bar 8s linear forwards' }}
            />
          </div>
        )}
        
        {/* Skip link for low priority */}
        {currentSpotlight.priority !== 'high' && (
          <div className="px-4 pb-3 text-center">
            <button
              onClick={() => dismissSpotlight(currentSpotlight!.id)}
              className={`text-xs ${currentSpotlight.priority === 'high' || currentSpotlight.category === 'announcement' ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Skip this tip
            </button>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shrink-bar {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        .animate-shrink-bar {
          animation: shrink-bar 8s linear forwards;
        }
      `}</style>
    </div>
  );
};

// Helper function to trigger a specific spotlight
export const showSpotlight = (spotlightId: string) => {
  const event = new CustomEvent('showSpotlight', { detail: { id: spotlightId } });
  window.dispatchEvent(event);
};

// Helper function to reset spotlights
export const resetSpotlights = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export default FeatureSpotlight;
