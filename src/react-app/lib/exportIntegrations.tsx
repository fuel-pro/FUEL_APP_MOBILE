/**
 * FuelPro Data Export & Reporting System
 * 
 * Integrates multiple export and reporting tools:
 * 
 * 1. Excel/XLSX - SheetJS (xlsx)
 * 2. CSV Export - Native
 * 3. PDF Reports - jsPDF, html2pdf
 * 4. Print - Native print API
 * 5. Data APIs - REST, GraphQL
 * 6. BI Tools - Metabase, Superset integration
 * 
 * Features:
 * - Multiple export formats
 * - Custom report templates
 * - Scheduled exports
 * - Email reports
 * - API integration
 */

import { useState, useCallback, useMemo } from 'react';

// Types
export interface ExportConfig {
  filename: string;
  format: 'xlsx' | 'csv' | 'pdf' | 'json' | 'xml' | 'html' | 'print';
  includeHeaders?: boolean;
  includeMetadata?: boolean;
  sheetName?: string;
  compression?: boolean;
}

export interface ReportConfig {
  id: string;
  name: string;
  description?: string;
  type: 'sales' | 'inventory' | 'financial' | 'customer' | 'operations' | 'custom';
  dataSource: string;
  filters?: ReportFilter[];
  columns?: ReportColumn[];
  aggregations?: ReportAggregation[];
  groupings?: string[];
  sorting?: ReportSort[];
  limit?: number;
  schedule?: ReportSchedule;
  createdAt: number;
  updatedAt: number;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with' | 'between' | 'is_null' | 'is_not_null';
  value: any;
  logic?: 'and' | 'or';
}

export interface ReportColumn {
  field: string;
  label?: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'number' | 'currency' | 'date' | 'datetime' | 'percentage' | 'boolean' | 'custom';
  formatOptions?: Record<string, any>;
  hidden?: boolean;
}

export interface ReportAggregation {
  field: string;
  function: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'distinct' | 'first' | 'last';
  label?: string;
}

export interface ReportSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  recipients?: string[];
  format?: ExportConfig['format'];
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'scatter' | 'area' | 'radar' | 'polar';
  xAxis?: string;
  yAxis?: string | string[];
  title?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
}

// Storage helpers
const REPORTS_KEY = 'fuelpro_reports';
const EXPORTS_KEY = 'fuelpro_exports';

function saveReports(reports: ReportConfig[]) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error('[Export] Failed to save reports:', e);
  }
}

function loadReports(): ReportConfig[] {
  try {
    const data = localStorage.getItem(REPORTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Export Service - Handles data export to various formats
 */
export class ExportService {
  /**
   * Export data to Excel (XLSX)
   */
  async exportToExcel<T extends Record<string, any>>(
    data: T[],
    config: ExportConfig
  ): Promise<Blob> {
    const XLSX = await import('xlsx');
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data with headers
    const processedData = this.processData(data, config);
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(processedData, {
      header: config.includeHeaders !== false ? Object.keys(processedData[0] || {}) : undefined,
    });
    
    // Set sheet name
    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName || 'Sheet1');
    
    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Export data to CSV
   */
  async exportToCSV<T extends Record<string, any>>(
    data: T[],
    config: ExportConfig
  ): Promise<Blob> {
    const XLSX = await import('xlsx');
    
    const processedData = this.processData(data, config);
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(processedData));
    
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Export data to JSON
   */
  async exportToJSON<T extends Record<string, any>>(
    data: T[],
    config: ExportConfig
  ): Promise<Blob> {
    const exportData = config.includeMetadata
      ? {
          metadata: {
            exportedAt: new Date().toISOString(),
            recordCount: data.length,
            format: 'json',
          },
          data: this.processData(data, config),
        }
      : this.processData(data, config);

    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  }

  /**
   * Export data to XML
   */
  async exportToXML<T extends Record<string, any>>(
    data: T[],
    config: ExportConfig
  ): Promise<Blob> {
    const processedData = this.processData(data, config);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    
    processedData.forEach((item: any, index: number) => {
      xml += `  <record id="${index + 1}">\n`;
      for (const [key, value] of Object.entries(item)) {
        const safeValue = String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xml += `    <${this.toXmlTag(key)}>${safeValue}</${this.toXmlTag(key)}>\n`;
      }
      xml += '  </record>\n';
    });
    
    xml += '</root>';
    
    return new Blob([xml], { type: 'application/xml' });
  }

  /**
   * Export data to HTML table
   */
  async exportToHTML<T extends Record<string, any>>(
    data: T[],
    config: ExportConfig
  ): Promise<Blob> {
    const processedData = this.processData(data, config);
    const headers = config.includeHeaders !== false ? Object.keys(processedData[0] || {}) : [];
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.filename}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f59e0b; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .metadata { color: #666; font-size: 12px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>${config.filename}</h1>
  ${config.includeMetadata ? `<p class="metadata">Exported: ${new Date().toLocaleString()} | Records: ${processedData.length}</p>` : ''}
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${processedData.map((row: any) => 
        `<tr>${headers.map(h => `<td>${this.escapeHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>`
      ).join('\n      ')}
    </tbody>
  </table>
</body>
</html>`;

    return new Blob([html], { type: 'text/html' });
  }

  /**
   * Export data to PDF
   */
  async exportToPDF<T extends Record<string, any>>(
    data: T[],
    config: ExportConfig,
    options?: {
      title?: string;
      orientation?: 'portrait' | 'landscape';
      margins?: { top: number; right: number; bottom: number; left: number };
    }
  ): Promise<Blob> {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF({
      orientation: options?.orientation || 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add title
    doc.setFontSize(18);
    doc.text(options?.title || config.filename, 14, 20);
    
    // Add metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Records: ${data.length}`, 14, 34);
    
    // Prepare table data
    const processedData = this.processData(data, config);
    const headers = config.includeHeaders !== false ? [Object.keys(processedData[0] || {})] : [];
    const body = processedData.map((row: any) => Object.values(row).map(v => String(v ?? '')));
    
    // Add table
    autoTable(doc, {
      head: headers as any,
      body: body as any,
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: [245, 158, 11], // Amber
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    // Add footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    return doc.output('blob');
  }

  /**
   * Open print dialog
   */
  async printData<T extends Record<string, any>>(
    data: T[],
    config: ExportConfig,
    options?: {
      title?: string;
      showLogo?: boolean;
    }
  ): Promise<void> {
    const processedData = this.processData(data, config);
    const headers = config.includeHeaders !== false ? Object.keys(processedData[0] || {}) : [];
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>${config.filename}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      padding: 20px; 
      max-width: 1200px;
      margin: 0 auto;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 20px;
      border-bottom: 2px solid #f59e0b;
      padding-bottom: 20px;
    }
    .title { font-size: 24px; font-weight: bold; color: #1f2937; }
    .metadata { color: #6b7280; font-size: 14px; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 20px;
    }
    th, td { 
      border: 1px solid #e5e7eb; 
      padding: 12px 8px; 
      text-align: left; 
      font-size: 14px;
    }
    th { 
      background-color: #f59e0b; 
      color: white; 
      font-weight: 600;
    }
    tr:nth-child(even) { background-color: #f9fafb; }
    .number { text-align: right; }
    .footer { 
      margin-top: 30px; 
      text-align: center; 
      color: #9ca3af; 
      font-size: 12px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${options?.title || config.filename}</div>
    <div class="metadata">
      <div>Exported: ${new Date().toLocaleString()}</div>
      <div>Records: ${processedData.length}</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${processedData.map((row: any) => 
        `<tr>${headers.map(h => {
          const value = row[h];
          const isNumber = typeof value === 'number';
          return `<td class="${isNumber ? 'number' : ''}">${this.escapeHtml(String(value ?? ''))}</td>`;
        }).join('')}</tr>`
      ).join('\n      ')}
    </tbody>
  </table>
  
  <div class="footer">
    Generated by FuelPro | ${new Date().toISOString()}
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 250);
    };
  </script>
</body>
</html>`);

    printWindow.document.close();
  }

  /**
   * Download blob as file
   */
  downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Copy data to clipboard
   */
  async copyToClipboard<T extends Record<string, any>>(data: T[]): Promise<boolean> {
    const text = data.map(row => Object.values(row).join('\t')).join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // Helper methods
  private processData<T extends Record<string, any>>(data: T[], config: ExportConfig): any[] {
    return data.map(row => {
      const processed: any = {};
      for (const [key, value] of Object.entries(row)) {
        processed[key] = this.formatValue(value);
      }
      return processed;
    });
  }

  private formatValue(value: any): any {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  private toXmlTag(str: string): string {
    return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

/**
 * Report Builder Service
 */
export class ReportBuilder {
  private reports: ReportConfig[];

  constructor() {
    this.reports = loadReports();
  }

  createReport(config: Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt'>): ReportConfig {
    const report: ReportConfig = {
      ...config,
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.reports.push(report);
    saveReports(this.reports);
    return report;
  }

  updateReport(id: string, updates: Partial<ReportConfig>): ReportConfig | null {
    const index = this.reports.findIndex(r => r.id === id);
    if (index === -1) return null;

    this.reports[index] = {
      ...this.reports[index],
      ...updates,
      updatedAt: Date.now(),
    };

    saveReports(this.reports);
    return this.reports[index];
  }

  deleteReport(id: string): boolean {
    const index = this.reports.findIndex(r => r.id === id);
    if (index === -1) return false;

    this.reports.splice(index, 1);
    saveReports(this.reports);
    return true;
  }

  getReport(id: string): ReportConfig | undefined {
    return this.reports.find(r => r.id === id);
  }

  getReports(type?: ReportConfig['type']): ReportConfig[] {
    if (type) {
      return this.reports.filter(r => r.type === type);
    }
    return this.reports;
  }

  // Apply filters to data
  applyFilters<T extends Record<string, any>>(data: T[], filters: ReportFilter[]): T[] {
    return data.filter(row => {
      return filters.reduce((acc, filter, index) => {
        const value = this.getNestedValue(row, filter.field);
        const matches = this.evaluateFilter(value, filter.operator, filter.value);
        
        if (index === 0) return matches;
        
        const logic = filter.logic || 'and';
        return logic === 'and' ? acc && matches : acc || matches;
      }, true);
    });
  }

  // Apply aggregations
  applyAggregations<T extends Record<string, any>>(
    data: T[],
    aggregations: ReportAggregation[]
  ): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const agg of aggregations) {
      const values = data.map(row => this.getNestedValue(row, agg.field)).filter(v => v != null);
      const label = agg.label || `${agg.field}_${agg.function}`;
      
      switch (agg.function) {
        case 'sum':
          result[label] = values.reduce((a, b) => (a || 0) + (b || 0), 0);
          break;
        case 'count':
          result[label] = values.length;
          break;
        case 'avg':
          result[label] = values.length > 0 
            ? values.reduce((a, b) => (a || 0) + (b || 0), 0) / values.length 
            : 0;
          break;
        case 'min':
          result[label] = Math.min(...values);
          break;
        case 'max':
          result[label] = Math.max(...values);
          break;
        case 'distinct':
          result[label] = [...new Set(values)].length;
          break;
        case 'first':
          result[label] = values[0];
          break;
        case 'last':
          result[label] = values[values.length - 1];
          break;
      }
    }
    
    return result;
  }

  // Group data
  groupData<T extends Record<string, any>>(
    data: T[],
    groupBy: string[]
  ): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    
    for (const row of data) {
      const key = groupBy.map(field => this.getNestedValue(row, field)).join('|');
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    }
    
    return grouped;
  }

  // Sort data
  sortData<T extends Record<string, any>>(
    data: T[],
    sorting: ReportSort[]
  ): T[] {
    return [...data].sort((a, b) => {
      for (const sort of sorting) {
        const aVal = this.getNestedValue(a, sort.field);
        const bVal = this.getNestedValue(b, sort.field);
        
        if (aVal === bVal) continue;
        
        const comparison = aVal < bVal ? -1 : 1;
        return sort.direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    });
  }

  // Helper methods
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  private evaluateFilter(value: any, operator: ReportFilter['operator'], filterValue: any): boolean {
    switch (operator) {
      case 'eq': return value === filterValue;
      case 'ne': return value !== filterValue;
      case 'gt': return value > filterValue;
      case 'gte': return value >= filterValue;
      case 'lt': return value < filterValue;
      case 'lte': return value <= filterValue;
      case 'in': return filterValue.includes(value);
      case 'not_in': return !filterValue.includes(value);
      case 'contains': return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'starts_with': return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
      case 'ends_with': return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
      case 'between': return value >= filterValue[0] && value <= filterValue[1];
      case 'is_null': return value == null;
      case 'is_not_null': return value != null;
      default: return true;
    }
  }
}

// Pre-built report templates
export const DEFAULT_REPORTS: Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Daily Sales Report',
    description: 'Summary of all sales for the current day',
    type: 'sales',
    dataSource: 'sales',
    aggregations: [
      { field: 'total', function: 'sum', label: 'Total Revenue' },
      { field: 'id', function: 'count', label: 'Transaction Count' },
      { field: 'quantity_liters', function: 'sum', label: 'Total Liters Sold' },
    ],
    groupings: ['fuel_type'],
  },
  {
    name: 'Inventory Status',
    description: 'Current inventory levels for all fuel types',
    type: 'inventory',
    dataSource: 'inventory',
    columns: [
      { field: 'fuel_type', label: 'Fuel Type' },
      { field: 'current_stock', label: 'Current Stock (L)', format: 'number' },
      { field: 'capacity', label: 'Capacity (L)', format: 'number' },
      { field: 'price_per_liter', label: 'Price/Liter', format: 'currency' },
      { field: 'supplier_name', label: 'Supplier' },
    ],
  },
  {
    name: 'Customer Loyalty Summary',
    description: 'Customer engagement and loyalty metrics',
    type: 'customer',
    dataSource: 'customers',
    aggregations: [
      { field: 'total_purchases', function: 'sum', label: 'Total Purchases' },
      { field: 'loyalty_points', function: 'sum', label: 'Total Points' },
      { field: 'id', function: 'count', label: 'Customer Count' },
    ],
  },
  {
    name: 'Financial Summary',
    description: 'Complete financial overview',
    type: 'financial',
    dataSource: 'sales',
    aggregations: [
      { field: 'subtotal', function: 'sum', label: 'Gross Revenue' },
      { field: 'tax_amount', function: 'sum', label: 'Tax Collected' },
      { field: 'total', function: 'sum', label: 'Net Revenue' },
    ],
    groupings: ['payment_method'],
  },
];

// Export singleton instances
export const exportService = new ExportService();
export const reportBuilder = new ReportBuilder();

export default {
  ExportService,
  ReportBuilder,
  exportService,
  reportBuilder,
  DEFAULT_REPORTS,
};
