// ============================================================
// AIHelpAssistant - Contextual help and tips (inspired by Nextwork.ai Claude Code)
// Provides instant guidance for any feature
// ============================================================

import React, { useState, useEffect, useRef } from 'react';

interface HelpTopic {
  id: string;
  title: string;
  keywords: string[];
  content: string;
  tips?: string[];
  relatedTopics?: string[];
}

interface AIHelpProps {
  onClose?: () => void;
  contextHint?: string; // Current page/section hint
}

// Help topics database
const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'sales',
    title: 'Recording Sales',
    keywords: ['sale', 'sell', 'transaction', 'invoice', 'POS'],
    content: 'FuelPro makes recording sales easy! Here\'s how:',
    tips: [
      'Select the fuel type and enter liters or amount',
      'Add customer details if needed for tracking',
      'Choose payment method: Cash, M-PESA, or Credit',
      'Invoice is generated automatically'
    ],
    relatedTopics: ['invoices', 'payments', 'reports']
  },
  {
    id: 'inventory',
    title: 'Managing Fuel Inventory',
    keywords: ['tank', 'fuel', 'stock', 'inventory', 'delivery', 'dip'],
    content: 'Keep track of your fuel levels with tank management:',
    tips: [
      'Record daily dip readings to track fuel levels',
      'Log fuel deliveries with invoice numbers',
      'Set up low-stock alerts to prevent shortages',
      'Track opening/closing readings for accuracy'
    ],
    relatedTopics: ['deliveries', 'alerts']
  },
  {
    id: 'payments',
    title: 'Payment Methods',
    keywords: ['mpesa', 'cash', 'payment', 'mobile money', 'credit', 'card'],
    content: 'FuelPro supports multiple payment methods:',
    tips: [
      'M-PESA: Auto-reconciles with transaction codes',
      'Cash: Perfect for counter sales',
      'Credit: Track customer balances easily',
      'Mixed payments: Combine multiple methods'
    ],
    relatedTopics: ['sales', 'mpesa']
  },
  {
    id: 'mpesa',
    title: 'M-PESA Integration',
    keywords: ['mpesa', 'safaricom', 'mobile money', 'payment', 'transaction'],
    content: 'Accept M-PESA payments directly:',
    tips: [
      'Connect your M-PESA business account',
      'Transactions auto-appear in your dashboard',
      'Reconcile payments with sales automatically',
      'Send payment links to customers via SMS'
    ],
    relatedTopics: ['payments', 'sales']
  },
  {
    id: 'reports',
    title: 'Generating Reports',
    keywords: ['report', 'sales', 'analytics', 'export', 'pdf', 'daily'],
    content: 'Get insights with comprehensive reports:',
    tips: [
      'Daily sales reports show all transactions',
      'Profit margins by fuel type',
      'Export to PDF or Excel',
      'Schedule automated daily reports'
    ],
    relatedTopics: ['sales', 'analytics']
  },
  {
    id: 'station-setup',
    title: 'Setting Up Your Station',
    keywords: ['setup', 'station', 'configure', 'settings', 'fuel types'],
    content: 'Get started with station configuration:',
    tips: [
      'Add station name and location',
      'Configure fuel types you sell',
      'Set your tax rate for invoices',
      'Add your KRA PIN for compliance'
    ],
    relatedTopics: ['settings', 'invoices']
  },
  {
    id: 'delivery',
    title: 'Recording Deliveries',
    keywords: ['delivery', 'supply', 'truck', 'stock', 'receive'],
    content: 'Track fuel deliveries properly:',
    tips: [
      'Record before and after dip readings',
      'Note the delivery note number',
      'Check fuel quality visually',
      'Verify liters received match invoice'
    ],
    relatedTopics: ['inventory', 'tank']
  },
  {
    id: 'multi-station',
    title: 'Managing Multiple Stations',
    keywords: ['multi', 'multiple', 'stations', 'franchise', 'chain'],
    content: 'FuelPro supports managing multiple stations:',
    tips: [
      'Add stations from the dashboard',
      'Switch between stations easily',
      'View combined reports across all stations',
      'Each station has separate inventory'
    ],
    relatedTopics: ['station-setup', 'reports']
  },
  {
    id: 'customer-loyalty',
    title: 'Customer Loyalty Program',
    keywords: ['customer', 'loyalty', 'reward', 'points', 'repeat'],
    content: 'Build customer loyalty:',
    tips: [
      'Track customer purchase history',
      'Set up reward points system',
      'Send targeted promotions',
      'Offer credit for regular customers'
    ],
    relatedTopics: ['sales', 'payments']
  },
  {
    id: 'cloud-sync',
    title: 'Cloud Sync & Backup',
    keywords: ['cloud', 'sync', 'backup', 'online', 'offline', 'data'],
    content: 'Keep your data safe with cloud sync:',
    tips: [
      'Data syncs automatically to the cloud',
      'Access from any device anywhere',
      'Local storage is optional (offline mode)',
      'Sync settings in your profile'
    ],
    relatedTopics: ['settings', 'data']
  }
];

export const AIHelpAssistant: React.FC<AIHelpProps> = ({ onClose, contextHint }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [suggestedTopic, setSuggestedTopic] = useState<HelpTopic | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggest topic based on context hint
  useEffect(() => {
    if (contextHint) {
      const hint = contextHint.toLowerCase();
      const topic = HELP_TOPICS.find(t => 
        t.keywords.some(k => hint.includes(k))
        || HELP_TOPICS[0]; // Default to first
      setSuggestedTopic(topic);
    }
  }, [contextHint]);

  // Search topics
  const searchTopics = (query: string): HelpTopic[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return HELP_TOPICS.filter(t => 
      t.title.toLowerCase().includes(q) ||
      t.keywords.some(k => k.toLowerCase().includes(q))
    );
  };

  // Get filtered topics
  const filteredTopics = searchQuery ? searchTopics(searchQuery) : 
    suggestedTopic ? [suggestedTopic] : [];

  // Handle topic selection
  const handleSelectTopic = (topic: HelpTopic) => {
    setSelectedTopic(topic);
    setSearchQuery('');
  };

  // Handle back
  const handleBack = () => {
    setSelectedTopic(null);
    setSuggestedTopic(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl z-50"
        title="Get Help"
      >
        💡
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h2 className="font-bold">FuelPro Assistant</h2>
                <p className="text-sm opacity-80">How can I help?</p>
              </div>
            </div>
            <button 
              onClick={() => { setIsOpen(false); onClose?.(); }}
              className="text-white/80 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
          
          {/* Search */}
          <div className="mt-3 relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for help..."
              className="w-full bg-white/20 backdrop-blur rounded-lg px-4 py-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60">
              🔍
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedTopic ? (
            /* Topic Detail */
            <div className="space-y-4">
              <button
                onClick={handleBack}
                className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
              >
                ← Back to topics
              </button>
              
              <h3 className="text-xl font-bold text-gray-900">{selectedTopic.title}</h3>
              <p className="text-gray-700">{selectedTopic.content}</p>
              
              {selectedTopic.tips && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">💡 Tips:</h4>
                  <ul className="space-y-2">
                    {selectedTopic.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-blue-800">
                        <span className="text-blue-500">•</span>
                        <span className="text-sm">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedTopic.relatedTopics && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Related Topics:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTopic.relatedTopics.map(topicId => {
                      const topic = HELP_TOPICS.find(t => t.id === topicId);
                      return topic ? (
                        <button
                          key={topicId}
                          onClick={() => handleSelectTopic(topic)}
                          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full transition-colors"
                        >
                          {topic.title}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : filteredTopics.length > 0 ? (
            /* Search Results */
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-3">
                {searchQuery ? 'Search Results:' : 'Suggested for you:'}
              </p>
              {filteredTopics.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => handleSelectTopic(topic)}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <h4 className="font-medium text-gray-900">{topic.title}</h4>
                  <p className="text-sm text-gray-500">{topic.content.substring(0, 80)}...</p>
                </button>
              ))}
            </div>
          ) : (
            /* Quick Topics Grid */
            <div>
              <p className="text-sm text-gray-500 mb-3">Quick Topics:</p>
              <div className="grid grid-cols-2 gap-2">
                {HELP_TOPICS.slice(0, 6).map(topic => (
                  <button
                    key={topic.id}
                    onClick={() => handleSelectTopic(topic)}
                    className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <h4 className="font-medium text-gray-900 text-sm">{topic.title}</h4>
                  </button>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Or search for:</p>
                <div className="flex flex-wrap gap-1">
                  {['sales', 'mpesa', 'inventory', 'reports'].map(keyword => (
                    <button
                      key={keyword}
                      onClick={() => setSearchQuery(keyword)}
                      className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-full"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Tip: Press <kbd className="bg-gray-200 px-1 rounded">?</kbd> anywhere to open help
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIHelpAssistant;
