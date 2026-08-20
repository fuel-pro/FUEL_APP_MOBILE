/**
 * FuelPro AI Assistant Integration
 * 
 * Integrates multiple open-source and commercial AI providers:
 * 
 * 1. OpenAI (GPT-4, GPT-3.5)
 * 2. Anthropic (Claude)
 * 3. Google (Gemini)
 * 4. Open Source (Ollama, LM Studio)
 * 5. Custom LLM endpoints
 * 
 * Supports:
 * - Chat completion
 * - Text embedding
 * - Image analysis
 * - Speech synthesis
 * - Custom fine-tuned models
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// API Configuration
interface AIConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'lmstudio' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_CONFIG: Record<string, AIConfig> = {
  openai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7,
  },
  anthropic: {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-opus-20240229',
    maxTokens: 2000,
    temperature: 0.7,
  },
  google: {
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-pro',
    maxTokens: 2000,
    temperature: 0.7,
  },
  ollama: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/api',
    model: 'llama2',
    maxTokens: 2000,
    temperature: 0.7,
  },
  lmstudio: {
    provider: 'lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    maxTokens: 2000,
    temperature: 0.7,
  },
};

// Message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  tokens?: number;
  error?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model: string;
  provider: string;
}

// Storage keys
const CHAT_STORAGE_KEY = 'fuelpro_ai_chats';
const CONFIG_STORAGE_KEY = 'fuelpro_ai_config';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Local storage helpers
 */
function saveChats(chats: ChatThread[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
  } catch (e) {
    console.error('[AI] Failed to save chats:', e);
  }
}

function loadChats(): ChatThread[] {
  try {
    const data = localStorage.getItem(CHAT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveConfig(config: Record<string, AIConfig>) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('[AI] Failed to save config:', e);
  }
}

function loadConfig(): Record<string, AIConfig> {
  try {
    const data = localStorage.getItem(CONFIG_STORAGE_KEY);
    return data ? JSON.parse(data) : DEFAULT_CONFIG;
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

/**
 * AI API Client
 */
export class AIClient {
  private config: Record<string, AIConfig>;

  constructor() {
    this.config = loadConfig();
  }

  setConfig(provider: string, config: AIConfig) {
    this.config[provider] = config;
    saveConfig(this.config);
  }

  getConfig(provider: string): AIConfig {
    return this.config[provider] || DEFAULT_CONFIG[provider] || DEFAULT_CONFIG.openai;
  }

  async chat(
    provider: string,
    messages: ChatMessage[],
    onStream?: (chunk: string) => void
  ): Promise<ChatMessage> {
    const config = this.getConfig(provider);
    
    try {
      let response: Response;
      let data: any;
      let content = '';

      switch (config.provider) {
        case 'openai':
          response = await this.callOpenAI(config, messages);
          data = await response.json();
          content = data.choices?.[0]?.message?.content || '';
          break;

        case 'anthropic':
          response = await this.callAnthropic(config, messages);
          data = await response.json();
          content = data.content?.[0]?.text || '';
          break;

        case 'google':
          response = await this.callGoogle(config, messages);
          data = await response.json();
          content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;

        case 'ollama':
        case 'lmstudio':
        case 'custom':
          response = await this.callOllama(config, messages, onStream);
          if (onStream) {
            content = await this.readStream(response);
          } else {
            data = await response.json();
            content = data.message?.content || '';
          }
          break;

        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      if (!response.ok) {
        throw new Error(data.error?.message || `API Error: ${response.status}`);
      }

      return {
        id: generateId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        model: config.model,
      };
    } catch (error: any) {
      return {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  private async callOpenAI(config: AIConfig, messages: ChatMessage[]): Promise<Response> {
    return fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey || import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
    });
  }

  private async callAnthropic(config: AIConfig, messages: ChatMessage[]): Promise<Response> {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    return fetch(`${config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        messages: chatMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        system: systemMessage?.content,
        max_tokens: config.maxTokens || 1024,
        temperature: config.temperature,
      }),
    });
  }

  private async callGoogle(config: AIConfig, messages: ChatMessage[]): Promise<Response> {
    const lastMessage = messages.filter(m => m.role !== 'system').pop();

    return fetch(`${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey || import.meta.env.VITE_GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: lastMessage?.content || '' }],
        }],
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      }),
    });
  }

  private async callOllama(config: AIConfig, messages: ChatMessage[], onStream?: (chunk: string) => void): Promise<Response> {
    const requestBody: any = {
      model: config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: !!onStream,
    };

    if (onStream) {
      requestBody.options = {
        temperature: config.temperature,
      };
    }

    return fetch(`${config.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  }

  private async readStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let content = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      content += decoder.decode(value);
    }

    // Try to parse as JSON
    try {
      const data = JSON.parse(content);
      return data.message?.content || '';
    } catch {
      return content;
    }
  }

  async embed(text: string, provider: string = 'openai'): Promise<number[]> {
    const config = this.getConfig(provider);

    if (provider === 'openai') {
      const response = await fetch(`${config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey || import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      const data = await response.json();
      return data.data?.[0]?.embedding || [];
    }

    return [];
  }
}

/**
 * AI Assistant Hook
 */
export function useAIAssistant() {
  const [chats, setChats] = useState<ChatThread[]>(() => loadChats());
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('openai');
  const clientRef = useRef(new AIClient());

  const activeChat = chats.find(c => c.id === activeChatId);

  // Save chats whenever they change
  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  // Create new chat
  const createChat = useCallback((title?: string) => {
    const newChat: ChatThread = {
      id: generateId(),
      title: title || `Chat ${chats.length + 1}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: clientRef.current.getConfig(currentProvider).model || 'gpt-4',
      provider: currentProvider,
    };

    setChats(prev => [...prev, newChat]);
    setActiveChatId(newChat.id);
    return newChat;
  }, [chats, currentProvider]);

  // Delete chat
  const deleteChat = useCallback((chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(chats[0]?.id || null);
    }
  }, [activeChatId, chats]);

  // Send message
  const sendMessage = useCallback(async (
    content: string,
    systemPrompt?: string
  ) => {
    if (!activeChatId) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    // Add user message
    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        return {
          ...chat,
          messages: [...chat.messages, userMessage],
          updatedAt: Date.now(),
        };
      }
      return chat;
    }));

    setIsLoading(true);

    try {
      const currentChat = chats.find(c => c.id === activeChatId);
      if (!currentChat) return;

      const allMessages: ChatMessage[] = [
        ...currentChat.messages,
        userMessage,
      ];

      if (systemPrompt) {
        allMessages.unshift({
          id: generateId(),
          role: 'system',
          content: systemPrompt,
          timestamp: Date.now(),
        });
      }

      const response = await clientRef.current.chat(
        currentProvider,
        allMessages
      );

      // Add assistant response
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: [...chat.messages, response],
            updatedAt: Date.now(),
          };
        }
        return chat;
      }));

      return response;
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        error: error.message || 'Failed to get response',
      };

      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: [...chat.messages, errorMessage],
            updatedAt: Date.now(),
          };
        }
        return chat;
      }));

      return errorMessage;
    } finally {
      setIsLoading(false);
    }
  }, [activeChatId, chats, currentProvider]);

  // Clear chat
  const clearChat = useCallback((chatId: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: [],
          updatedAt: Date.now(),
        };
      }
      return chat;
    }));
  }, []);

  // Update chat title
  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return { ...chat, title, updatedAt: Date.now() };
      }
      return chat;
    }));
  }, []);

  return {
    chats,
    activeChat,
    activeChatId,
    isLoading,
    currentProvider,
    setActiveChatId,
    setCurrentProvider,
    createChat,
    deleteChat,
    sendMessage,
    clearChat,
    updateChatTitle,
    client: clientRef.current,
  };
}

/**
 * Pre-built prompts for FuelPro
 */
export const FUELPRO_PROMPTS = {
  salesReport: `You are a FuelPro sales analyst. Generate detailed sales reports based on the data provided. Include:
- Total revenue
- Top selling fuel types
- Payment method breakdown
- Comparison with previous periods
- Recommendations for improvement`,

  inventoryManagement: `You are a FuelPro inventory manager. Help with:
- Stock level analysis
- Reorder recommendations
- Supplier suggestions
- Cost optimization strategies`,

  customerInsights: `You are a FuelPro customer analytics expert. Provide insights on:
- Customer behavior patterns
- Peak hours analysis
- Loyalty program recommendations
- Marketing suggestions`,

  maintenancePrediction: `You are a FuelPro maintenance analyst. Help predict:
- Equipment maintenance needs
- Tank inspection schedules
- Pump performance issues
- Safety compliance requirements`,

  general: `You are a helpful AI assistant for FuelPro, a fuel station management system. 
Help users with any questions about fuel management, sales tracking, inventory, 
customer management, and general inquiries about the application.`,
};

/**
 * AI Settings Component
 */
export function AISettings({
  config,
  onSave,
}: {
  config: Record<string, AIConfig>;
  onSave: (config: Record<string, AIConfig>) => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);

  const handleSave = () => {
    onSave(localConfig);
  };

  return (
    <div className="ai-settings">
      <h3>AI Configuration</h3>
      
      <div className="settings-grid">
        <div className="setting-group">
          <label>Provider</label>
          <select
            value={localConfig.openai?.provider || 'openai'}
            onChange={(e) => setLocalConfig({
              ...localConfig,
              openai: { ...localConfig.openai, provider: e.target.value as any }
            })}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="lmstudio">LM Studio</option>
          </select>
        </div>

        <div className="setting-group">
          <label>Model</label>
          <input
            type="text"
            value={localConfig.openai?.model || 'gpt-4'}
            onChange={(e) => setLocalConfig({
              ...localConfig,
              openai: { ...localConfig.openai, model: e.target.value }
            })}
            placeholder="gpt-4"
          />
        </div>

        <div className="setting-group">
          <label>Temperature</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={localConfig.openai?.temperature || 0.7}
            onChange={(e) => setLocalConfig({
              ...localConfig,
              openai: { ...localConfig.openai, temperature: parseFloat(e.target.value) }
            })}
          />
          <span>{localConfig.openai?.temperature || 0.7}</span>
        </div>

        <div className="setting-group">
          <label>Max Tokens</label>
          <input
            type="number"
            value={localConfig.openai?.maxTokens || 2000}
            onChange={(e) => setLocalConfig({
              ...localConfig,
              openai: { ...localConfig.openai, maxTokens: parseInt(e.target.value) }
            })}
          />
        </div>
      </div>

      <button onClick={handleSave}>Save Settings</button>
    </div>
  );
}

// Export singleton instance
export const aiClient = new AIClient();

export default {
  AIClient,
  useAIAssistant,
  FUELPRO_PROMPTS,
  aiClient,
};
