/**
 * N8N Workflow Automation Integration
 * 
 * Open-source workflow automation from: https://github.com/n8n-io/n8n
 * 
 * This module provides workflow automation, webhooks, and integrations
 * for the FuelPro application.
 */

// N8N Configuration Types
export interface N8NConfig {
  webhookUrl: string;
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface N8NWebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
  source?: string;
}

export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8NNode[];
  connections: N8NConnection[];
}

export interface N8NNode {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, any>;
  position: [number, number];
}

export interface N8NConnection {
  source: string;
  target: string;
  type: 'main' | 'error';
  index?: number;
}

export interface N8NExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'error' | 'waiting';
  startedAt: string;
  finishedAt?: string;
  mode: string;
  error?: string;
}

// Singleton instance
let n8nInstance: N8NInstance | null = null;

// N8N Instance class
class N8NInstance {
  private config: N8NConfig;
  private queue: N8NWebhookPayload[] = [];
  private retryAttempts = 3;
  private timeout = 30000;

  constructor(config: N8NConfig) {
    this.config = config;
    this.retryAttempts = config.retryAttempts || 3;
    this.timeout = config.timeout || 30000;
    console.info('[N8N] Initialized with webhook URL:', config.webhookUrl);
  }

  // Trigger a webhook
  async triggerWebhook(
    event: string,
    data: Record<string, any>,
    options?: {
      retry?: boolean;
      timeout?: number;
    }
  ): Promise<N8NWebhookResponse> {
    const payload: N8NWebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      source: 'fuelpro-app',
    };

    console.info('[N8N] Triggering webhook:', event, data);

    try {
      const response = await this.sendRequest(payload, options?.retry !== false);
      return response;
    } catch (error) {
      console.error('[N8N] Webhook failed:', error);
      throw error;
    }
  }

  // Send HTTP request to N8N
  private async sendRequest(
    payload: N8NWebhookPayload,
    withRetry = true
  ): Promise<N8NWebhookResponse> {
    const url = this.config.webhookUrl;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < (withRetry ? this.retryAttempts : 1); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.timeout
        );

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'X-N8N-API-KEY': this.config.apiKey }),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.info('[N8N] Webhook triggered successfully:', result);
        
        return {
          success: true,
          executionId: result.executionId,
          data: result.data,
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(`[N8N] Attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.retryAttempts - 1) {
          // Wait before retry with exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('N8N webhook failed after all retries');
  }

  // Queue webhook for later (offline support)
  queueWebhook(event: string, data: Record<string, any>): void {
    this.queue.push({
      event,
      timestamp: new Date().toISOString(),
      data,
      source: 'fuelpro-app',
    });
    console.info('[N8N] Webhook queued:', event, 'Queue length:', this.queue.length);
    
    // Persist queue to localStorage
    this.persistQueue();
  }

  // Process queued webhooks
  async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    
    console.info('[N8N] Processing webhook queue, length:', this.queue.length);
    
    const items = [...this.queue];
    this.queue = [];
    
    for (const item of items) {
      try {
        await this.sendRequest(item);
      } catch (error) {
        // Re-queue failed items
        this.queue.push(item);
      }
    }
    
    this.persistQueue();
  }

  // Persist queue to localStorage
  private persistQueue(): void {
    try {
      localStorage.setItem('n8n_webhook_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.error('[N8N] Failed to persist queue:', e);
    }
  }

  // Load queue from localStorage
  loadQueue(): void {
    try {
      const stored = localStorage.getItem('n8n_webhook_queue');
      if (stored) {
        this.queue = JSON.parse(stored);
        console.info('[N8N] Loaded webhook queue, length:', this.queue.length);
      }
    } catch (e) {
      console.error('[N8N] Failed to load queue:', e);
    }
  }

  // Get queue status
  getQueueStatus(): { length: number; oldest: string | null } {
    return {
      length: this.queue.length,
      oldest: this.queue.length > 0 ? this.queue[0].timestamp : null,
    };
  }
}

// Initialize N8N
export function initN8N(config: N8NConfig): N8NInstance {
  n8nInstance = new N8NInstance(config);
  n8nInstance.loadQueue();
  
  // Process queue on online
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.info('[N8N] Online, processing queue');
      n8nInstance?.processQueue();
    });
  }
  
  return n8nInstance;
}

// Get N8N instance
export function getN8N(): N8NInstance | null {
  return n8nInstance;
}

// Pre-built workflow triggers

// Station Events
export const n8nWorkflows = {
  // Station created
  onStationCreated: async (station: any) => {
    return n8nInstance?.triggerWebhook('station.created', {
      stationId: station.id,
      name: station.name,
      location: station.location,
      createdBy: station.createdBy,
    });
  },

  // Station updated
  onStationUpdated: async (station: any, changes: any) => {
    return n8nInstance?.triggerWebhook('station.updated', {
      stationId: station.id,
      name: station.name,
      changes,
    });
  },

  // Fuel sale completed
  onSaleCompleted: async (sale: any) => {
    return n8nInstance?.triggerWebhook('sale.completed', {
      saleId: sale.id,
      stationId: sale.stationId,
      fuelType: sale.fuelType,
      quantity: sale.quantity,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
    });
  },

  // Low inventory alert
  onLowInventory: async (inventory: any) => {
    return n8nInstance?.triggerWebhook('inventory.low', {
      stationId: inventory.stationId,
      fuelType: inventory.fuelType,
      currentLevel: inventory.level,
      capacity: inventory.capacity,
    });
  },

  // User login
  onUserLogin: async (user: any, metadata: any) => {
    return n8nInstance?.triggerWebhook('user.login', {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
      ip: metadata.ip,
      device: metadata.device,
    });
  },

  // Payment received
  onPaymentReceived: async (payment: any) => {
    return n8nInstance?.triggerWebhook('payment.received', {
      paymentId: payment.id,
      amount: payment.amount,
      method: payment.method,
      transactionRef: payment.transactionRef,
      customerId: payment.customerId,
    });
  },

  // Shift started
  onShiftStarted: async (shift: any) => {
    return n8nInstance?.triggerWebhook('shift.started', {
      shiftId: shift.id,
      stationId: shift.stationId,
      userId: shift.userId,
      openingBalance: shift.openingBalance,
    });
  },

  // Shift ended
  onShiftEnded: async (shift: any) => {
    return n8nInstance?.triggerWebhook('shift.ended', {
      shiftId: shift.id,
      stationId: shift.stationId,
      userId: shift.userId,
      closingBalance: shift.closingBalance,
      totalSales: shift.totalSales,
      variance: shift.variance,
    });
  },

  // Delivery received
  onDeliveryReceived: async (delivery: any) => {
    return n8nInstance?.triggerWebhook('delivery.received', {
      deliveryId: delivery.id,
      stationId: delivery.stationId,
      fuelType: delivery.fuelType,
      quantity: delivery.quantity,
      supplier: delivery.supplier,
    });
  },

  // Report generated
  onReportGenerated: async (report: any) => {
    return n8nInstance?.triggerWebhook('report.generated', {
      reportId: report.id,
      type: report.type,
      period: report.period,
      generatedBy: report.generatedBy,
      url: report.url,
    });
  },

  // Error occurred
  onError: async (error: any, context: any) => {
    return n8nInstance?.triggerWebhook('error.occurred', {
      errorMessage: error.message,
      errorStack: error.stack,
      context,
      severity: context.severity || 'high',
    });
  },
};

// Workflow builder for custom workflows
export interface WorkflowBuilder {
  name: string;
  trigger: {
    type: 'webhook' | 'schedule' | 'event';
    config: Record<string, any>;
  };
  actions: WorkflowAction[];
}

export interface WorkflowAction {
  type: string;
  config: Record<string, any>;
  next?: WorkflowAction[];
}

export function createWorkflow(workflow: WorkflowBuilder): void {
  console.info('[N8N] Creating workflow:', workflow.name);
  // In production, this would use N8N's API to create the workflow
}

// Queue-based alternative when N8N is unavailable
export function queueWorkflowAction(
  workflowName: string,
  data: Record<string, any>
): void {
  const queueKey = `n8n_workflow_queue_${workflowName}`;
  try {
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    queue.push({
      data,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(queueKey, JSON.stringify(queue));
    console.info('[N8N] Workflow queued:', workflowName);
  } catch (e) {
    console.error('[N8N] Failed to queue workflow:', e);
  }
}

// Process queued workflow actions
export async function processWorkflowQueue(
  workflowName: string,
  processor: (data: Record<string, any>) => Promise<void>
): Promise<void> {
  const queueKey = `n8n_workflow_queue_${workflowName}`;
  try {
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    if (queue.length === 0) return;
    
    console.info(`[N8N] Processing ${queue.length} queued items for:`, workflowName);
    
    for (const item of queue) {
      try {
        await processor(item.data);
      } catch (e) {
        console.error('[N8N] Failed to process item:', e);
      }
    }
    
    localStorage.setItem(queueKey, JSON.stringify([]));
  } catch (e) {
    console.error('[N8N] Failed to process workflow queue:', e);
  }
}

// Configuration presets
export const N8N_CONFIGS = {
  development: {
    webhookUrl: process.env.VITE_N8N_WEBHOOK_URL_DEV || '',
    apiUrl: process.env.VITE_N8N_API_URL_DEV || 'http://localhost:5678',
    timeout: 10000,
  },
  production: {
    webhookUrl: process.env.VITE_N8N_WEBHOOK_URL_PROD || '',
    apiUrl: process.env.VITE_N8N_API_URL_PROD || 'https://n8n.example.com',
    timeout: 30000,
  },
};

// Response type
export interface N8NWebhookResponse {
  success: boolean;
  executionId?: string;
  data?: Record<string, any>;
  error?: string;
}

// Auto-init function
export function initN8NAuto(): N8NInstance | null {
  const isDev = import.meta.env.DEV;
  const config = isDev ? N8N_CONFIGS.development : N8N_CONFIGS.production;
  
  if (!config.webhookUrl) {
    console.warn('[N8N] No webhook URL configured, skipping initialization');
    return null;
  }
  
  return initN8N(config as N8NConfig);
}

// Type augmentation for window
declare global {
  interface Window {
    n8n?: N8NInstance;
  }
}
