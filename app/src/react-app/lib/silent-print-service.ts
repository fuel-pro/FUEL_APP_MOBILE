/**
 * Silent Print Service - Background printing without user interaction
 * 
 * Features:
 * - Queue-based print management
 * - Error recovery and retry logic
 * - Background printing without popup dialogs
 * - Support for receipts, reports, and documents
 * - Offline-first with local queuing
 */

import { CloudStorage } from './cloudStorage';
import type { ReceiptData } from './pos/printer-service';
import { printerService } from './pos/printer-service';

export interface SilentPrintJob {
  id: string;
  type: 'receipt' | 'report' | 'document' | 'label';
  content: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  maxRetries: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  printerId?: string;
  settings?: PrintSettings;
}

export interface PrintSettings {
  paperWidth?: number;
  copies?: number;
  layout?: 'portrait' | 'landscape';
  quality?: 'draft' | 'normal' | 'high';
  silent?: boolean;
  timeout?: number;
}

const DEFAULT_SETTINGS: PrintSettings = {
  paperWidth: 80,
  copies: 1,
  layout: 'portrait',
  quality: 'normal',
  silent: true,
  timeout: 30000,
};

const QUEUE_KEY = 'fuelpro_print_queue';
const HISTORY_KEY = 'fuelpro_print_history';
const MAX_QUEUE_SIZE = 100;

class SilentPrintService {
  private queue: SilentPrintJob[] = [];
  private isProcessing = false;
  private processTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.loadQueue();
    this.startAutoProcessing();
  }

  /**
   * Queue a print job for silent printing
   */
  async queuePrint(
    content: any,
    type: SilentPrintJob['type'] = 'document',
    settings?: PrintSettings
  ): Promise<string> {
    const job: SilentPrintJob = {
      id: `print-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      content,
      status: 'pending',
      retries: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      settings: { ...DEFAULT_SETTINGS, ...settings },
    };

    this.queue.push(job);
    this.saveQueue();

    // Log to audit if available
    try {
      const { logAudit } = await import('./cloudStorage');
      await logAudit({
        stationId: this.getStationId(),
        action: 'print_queued',
        category: 'data',
        details: `Queued ${type} print job`,
      });
    } catch (e) {
      console.debug('Audit log unavailable for print job');
    }

    // Process immediately if not already processing
    if (!this.isProcessing && this.queue.length <= 10) {
      this.processPrintQueue();
    }

    return job.id;
  }

  /**
   * Queue a receipt for silent printing
   */
  async queueReceipt(receipt: ReceiptData, printerId?: string): Promise<string> {
    return this.queuePrint(
      receipt,
      'receipt',
      { printerId }
    );
  }

  /**
   * Queue a report for printing
   */
  async queueReport(reportHtml: string, reportName: string): Promise<string> {
    return this.queuePrint(
      { html: reportHtml, name: reportName },
      'report'
    );
  }

  /**
   * Process the print queue
   */
  private async processPrintQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue[0];

      try {
        job.status = 'processing';
        this.saveQueue();

        await this.executePrintJob(job);

        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        this.queue.shift();

        // Store in history
        await this.addToHistory(job);
      } catch (error) {
        job.retries++;

        if (job.retries < job.maxRetries) {
          job.status = 'pending';
          job.error = error instanceof Error ? error.message : 'Unknown error';
          this.saveQueue();
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Max retries exceeded';
          this.queue.shift();
          await this.addToHistory(job);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single print job
   */
  private async executePrintJob(job: SilentPrintJob): Promise<void> {
    const settings = job.settings || DEFAULT_SETTINGS;

    switch (job.type) {
      case 'receipt':
        await this.printReceipt(job.content, settings);
        break;
      case 'report':
        await this.printReport(job.content, settings);
        break;
      case 'document':
        await this.printDocument(job.content, settings);
        break;
      case 'label':
        await this.printLabel(job.content, settings);
        break;
      default:
        throw new Error(`Unknown print type: ${job.type}`);
    }
  }

  /**
   * Print a receipt silently
   */
  private async printReceipt(
    receipt: ReceiptData,
    settings: PrintSettings
  ): Promise<void> {
    try {
      const printerId = settings.printerId || undefined;
      await printerService.printReceipt(receipt, printerId);

      // Wait for print to complete with timeout
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(
          () => reject(new Error('Print timeout')),
          settings.timeout || 30000
        );

        const checkStatus = setInterval(() => {
          const status = printerService.getQueueStatus();
          if (status.printing === false && status.pending === 0) {
            clearInterval(checkStatus);
            clearTimeout(timeoutId);
            resolve();
          }
        }, 100);
      });
    } catch (error) {
      throw new Error(`Receipt print failed: ${error}`);
    }
  }

  /**
   * Print a report silently
   */
  private async printReport(
    report: { html: string; name: string },
    settings: PrintSettings
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          throw new Error('Cannot access iframe document');
        }

        iframeDoc.open();
        iframeDoc.write(`
          <html>
            <head>
              <title>${report.name}</title>
              <style>
                @media print {
                  body { margin: 0; padding: 0; }
                  * { margin: 0; padding: 0; }
                }
              </style>
            </head>
            <body>
              ${report.html}
            </body>
          </html>
        `);
        iframeDoc.close();

        iframe.onload = () => {
          try {
            const timeout = settings.timeout || 30000;
            const timer = setTimeout(() => {
              document.body.removeChild(iframe);
              reject(new Error('Print timeout'));
            }, timeout);

            if (iframe.contentWindow) {
              iframe.contentWindow.print();
              
              // Attempt to detect print completion
              setTimeout(() => {
                clearTimeout(timer);
                document.body.removeChild(iframe);
                resolve();
              }, 500);
            }
          } catch (error) {
            document.body.removeChild(iframe);
            reject(error);
          }
        };
      } catch (error) {
        reject(new Error(`Report print failed: ${error}`));
      }
    });
  }

  /**
   * Print a generic document
   */
  private async printDocument(
    content: any,
    settings: PrintSettings
  ): Promise<void> {
    const html = typeof content === 'string' ? content : JSON.stringify(content);
    return this.printReport({ html, name: 'Document' }, settings);
  }

  /**
   * Print a label
   */
  private async printLabel(
    labelData: any,
    settings: PrintSettings
  ): Promise<void> {
    try {
      // For labels, use smaller paper width
      const labelSettings = { ...settings, paperWidth: 100 };
      const html = this.generateLabelHTML(labelData);
      return this.printReport({ html, name: 'Label' }, labelSettings);
    } catch (error) {
      throw new Error(`Label print failed: ${error}`);
    }
  }

  /**
   * Generate HTML for a label
   */
  private generateLabelHTML(data: any): string {
    return `
      <div style="
        width: 100mm;
        padding: 10mm;
        font-family: Arial, sans-serif;
        font-size: 12px;
        border: 1px solid #000;
      ">
        ${Object.entries(data)
          .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
          .join('')}
      </div>
    `;
  }

  /**
   * Start auto-processing timer
   */
  private startAutoProcessing(): void {
    this.processTimer = setInterval(() => {
      if (!this.isProcessing && this.queue.length > 0) {
        this.processPrintQueue();
      }
    }, 5000) as any; // Check every 5 seconds
  }

  /**
   * Stop auto-processing
   */
  private stopAutoProcessing(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
  }

  /**
   * Save queue to indexed storage
   */
  private saveQueue(): void {
    try {
      CloudStorage.save(QUEUE_KEY, this.queue);
    } catch (e) {
      console.error('Failed to save print queue:', e);
    }
  }

  /**
   * Load queue from indexed storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const saved = await CloudStorage.load(QUEUE_KEY);
      if (Array.isArray(saved)) {
        this.queue = saved;
      }
    } catch (e) {
      console.error('Failed to load print queue:', e);
    }
  }

  /**
   * Add job to history
   */
  private async addToHistory(job: SilentPrintJob): Promise<void> {
    try {
      const history = (await CloudStorage.load(HISTORY_KEY)) || [];
      if (!Array.isArray(history)) return;

      history.unshift(job);
      // Keep only last 500 jobs
      if (history.length > 500) {
        history.splice(500);
      }

      await CloudStorage.save(HISTORY_KEY, history);
    } catch (e) {
      console.error('Failed to save print history:', e);
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    pending: number;
    processing: boolean;
    queue: SilentPrintJob[];
  } {
    return {
      pending: this.queue.length,
      processing: this.isProcessing,
      queue: [...this.queue],
    };
  }

  /**
   * Get print history
   */
  async getHistory(limit: number = 50): Promise<SilentPrintJob[]> {
    try {
      const history = (await CloudStorage.load(HISTORY_KEY)) || [];
      return Array.isArray(history) ? history.slice(0, limit) : [];
    } catch (e) {
      console.error('Failed to load print history:', e);
      return [];
    }
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Retry failed jobs
   */
  async retryFailed(): Promise<void> {
    try {
      const history = (await CloudStorage.load(HISTORY_KEY)) || [];
      const failed = Array.isArray(history)
        ? history.filter((j: any) => j.status === 'failed')
        : [];

      for (const job of failed) {
        job.retries = 0;
        job.status = 'pending';
        this.queue.push(job);
      }

      this.saveQueue();
      this.processPrintQueue();
    } catch (e) {
      console.error('Failed to retry failed jobs:', e);
    }
  }

  /**
   * Get station ID
   */
  private getStationId(): string {
    try {
      const station = JSON.parse(localStorage.getItem('fuelpro_station') || '{}');
      return station.id || 'default';
    } catch {
      return 'default';
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.stopAutoProcessing();
  }
}

export const silentPrintService = new SilentPrintService();
export default silentPrintService;
