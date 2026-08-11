/**
 * M-PESA Integration Service
 *
 * Shared data layer that interlinks the Live Transaction tab and the
 * M-PESA Analyzer tab. Both components read from and write to a unified
 * `mpesa_transactions` cloud store, so:
 *   - Real-time STK Push payments (LiveTransaction) appear in the Analyzer.
 *   - Statement-extracted inflows (MPESAAnalyzer) appear in the Live feed.
 *
 * Also provides typed access to the M-PESA Daraja and Kopo Kopo integration
 * configs, so the IntegrationsSettings UI, LiveTransaction, and
 * MPESAAnalyzer all share the same config source of truth.
 */

import cloudStorageService from "@/react-app/lib/cloud-storage-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransactionOrigin =
  "stk_push" | "statement" | "manual" | "kopokopo";
export type TransactionStatus =
  "completed" | "pending" | "failed" | "cancelled";

export interface UnifiedTransaction {
  id: string;
  transaction_ref: string;
  origin: TransactionOrigin;
  transaction_type: string;
  amount: number;
  currency: string;
  sender_info: string;
  description: string;
  status: TransactionStatus;
  payment_method: string;
  transaction_time: string;
  source_name?: string;
  source_type?: string;
  receipt?: string;
  balance?: number;
  is_online?: boolean;
  date?: string;
  time?: string;
}

export interface MpesaIntegrationConfig {
  name: string;
  type: "buy_goods" | "paybill";
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  initiatorName: string;
  initiatorPassword: string;
  shortcode: string;
  accountReference: string;
  environment: "sandbox" | "production";
  enabled: boolean;
}

export interface KopokopoIntegrationConfig {
  name: string;
  clientId: string;
  clientSecret: string;
  tillNumber: string;
  apiKey: string;
  environment: "sandbox" | "production";
  searchWindowHours: number;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Cloud storage keys (station-scoped)
// ---------------------------------------------------------------------------

const TXN_KEY = "mpesa_transactions";
const MPESA_CONFIG_KEY = "mpesa_config";
const KOPOKOPO_CONFIG_KEY = "kopokopo_config";

// ---------------------------------------------------------------------------
// Default configs
// ---------------------------------------------------------------------------

export const DEFAULT_MPESA_CONFIG: MpesaIntegrationConfig = {
  name: "M-PESA",
  type: "buy_goods",
  consumerKey: "",
  consumerSecret: "",
  passkey: "",
  initiatorName: "",
  initiatorPassword: "",
  shortcode: "",
  accountReference: "FuelPro",
  environment: "production",
  enabled: false,
};

export const DEFAULT_KOPOKOPO_CONFIG: KopokopoIntegrationConfig = {
  name: "Kopo Kopo",
  clientId: "",
  clientSecret: "",
  tillNumber: "",
  apiKey: "",
  environment: "sandbox",
  searchWindowHours: 24,
  enabled: false,
};

// ---------------------------------------------------------------------------
// Transaction store (shared between LiveTransaction & MPESAAnalyzer)
// ---------------------------------------------------------------------------

export async function getTransactions(
  stationId?: string,
): Promise<UnifiedTransaction[]> {
  const data =
    (await cloudStorageService.get<UnifiedTransaction[]>(TXN_KEY, stationId)) ||
    [];
  return Array.isArray(data) ? data : [];
}

export async function saveTransactions(
  txns: UnifiedTransaction[],
  stationId?: string,
): Promise<void> {
  await cloudStorageService.set(TXN_KEY, txns, stationId);
}

export async function addTransaction(
  txn: Omit<UnifiedTransaction, "id"> & { id?: string },
  stationId?: string,
): Promise<UnifiedTransaction> {
  const existing = await getTransactions(stationId);
  const record: UnifiedTransaction = {
    ...txn,
    id: txn.id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  // De-dup by transaction_ref (avoid double-importing the same receipt)
  if (
    record.transaction_ref &&
    existing.some((t) => t.transaction_ref === record.transaction_ref)
  ) {
    return record; // already exists, skip
  }
  const updated = [record, ...existing];
  await saveTransactions(updated, stationId);
  return record;
}

export async function addBatchTransactions(
  txns: Array<Omit<UnifiedTransaction, "id"> & { id?: string }>,
  stationId?: string,
): Promise<{ added: number; skipped: number }> {
  const existing = await getTransactions(stationId);
  const existingRefs = new Set(
    existing.map((t) => t.transaction_ref).filter(Boolean),
  );
  const toAdd: UnifiedTransaction[] = [];
  let skipped = 0;
  for (const txn of txns) {
    if (txn.transaction_ref && existingRefs.has(txn.transaction_ref)) {
      skipped++;
      continue;
    }
    if (txn.transaction_ref) existingRefs.add(txn.transaction_ref);
    toAdd.push({
      ...txn,
      id:
        txn.id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });
  }
  if (toAdd.length > 0) {
    await saveTransactions([...toAdd, ...existing], stationId);
  }
  return { added: toAdd.length, skipped };
}

export async function deleteTransaction(
  id: string,
  stationId?: string,
): Promise<void> {
  const existing = await getTransactions(stationId);
  const updated = existing.filter((t) => t.id !== id);
  await saveTransactions(updated, stationId);
}

export async function clearTransactions(stationId?: string): Promise<void> {
  await saveTransactions([], stationId);
}

/**
 * Subscribe to real-time changes on the shared transaction store. When any
 * device writes (LiveTransaction STK Push or MPESAAnalyzer statement import),
 * the callback fires instantly.
 */
export function subscribeToTransactions(
  stationId: string | undefined,
  callback: (txns: UnifiedTransaction[] | null) => void,
): () => void {
  return cloudStorageService.subscribe<UnifiedTransaction[]>(
    TXN_KEY,
    stationId,
    callback,
  );
}

// ---------------------------------------------------------------------------
// Config access
// ---------------------------------------------------------------------------

export async function getMpesaConfig(
  stationId?: string,
): Promise<MpesaIntegrationConfig> {
  const cloud = await cloudStorageService.get<Partial<MpesaIntegrationConfig>>(
    MPESA_CONFIG_KEY,
    stationId,
  );
  return { ...DEFAULT_MPESA_CONFIG, ...(cloud || {}) };
}

export async function saveMpesaConfig(
  config: MpesaIntegrationConfig,
  stationId?: string,
): Promise<void> {
  await cloudStorageService.set(MPESA_CONFIG_KEY, config, stationId);
}

export async function getKopokopoConfig(
  stationId?: string,
): Promise<KopokopoIntegrationConfig> {
  const cloud = await cloudStorageService.get<
    Partial<KopokopoIntegrationConfig>
  >(KOPOKOPO_CONFIG_KEY, stationId);
  return { ...DEFAULT_KOPOKOPO_CONFIG, ...(cloud || {}) };
}

export async function saveKopokopoConfig(
  config: KopokopoIntegrationConfig,
  stationId?: string,
): Promise<void> {
  await cloudStorageService.set(KOPOKOPO_CONFIG_KEY, config, stationId);
}

// ---------------------------------------------------------------------------
// Analytics (shared summary stats consumed by both tabs)
// ---------------------------------------------------------------------------

export interface TransactionSummary {
  total: number;
  totalCount: number;
  completed: number;
  pending: number;
  failed: number;
  byOrigin: Record<TransactionOrigin, { count: number; amount: number }>;
  topSender: { name: string; amount: number; count: number };
  uniqueSenders: number;
  onlinePayments: number;
}

export function calculateSummary(
  txns: UnifiedTransaction[],
): TransactionSummary {
  const completed = txns.filter((t) => t.status === "completed");
  const total = completed.reduce((s, t) => s + t.amount, 0);
  const byOrigin = {} as Record<
    TransactionOrigin,
    { count: number; amount: number }
  >;
  for (const origin of [
    "stk_push",
    "statement",
    "manual",
    "kopokopo",
  ] as TransactionOrigin[]) {
    byOrigin[origin] = { count: 0, amount: 0 };
  }
  const senderMap = new Map<string, { amount: number; count: number }>();
  for (const t of completed) {
    const origin = t.origin || "manual";
    if (byOrigin[origin]) {
      byOrigin[origin].count++;
      byOrigin[origin].amount += t.amount;
    }
    const sender = t.sender_info || "Unknown";
    const ex = senderMap.get(sender) || { amount: 0, count: 0 };
    ex.amount += t.amount;
    ex.count++;
    senderMap.set(sender, ex);
  }
  let topSender = { name: "", amount: 0, count: 0 };
  for (const [name, d] of senderMap) {
    if (d.amount > topSender.amount) topSender = { name, ...d };
  }
  return {
    total,
    totalCount: txns.length,
    completed: completed.length,
    pending: txns.filter((t) => t.status === "pending").length,
    failed: txns.filter((t) => t.status === "failed").length,
    byOrigin,
    topSender,
    uniqueSenders: senderMap.size,
    onlinePayments: txns.filter((t) => t.is_online).length,
  };
}

// ---------------------------------------------------------------------------
// Cross-tab navigation helper
// ---------------------------------------------------------------------------

export function switchToTab(tabId: string): void {
  window.dispatchEvent(new CustomEvent("changeTab", { detail: tabId }));
}
