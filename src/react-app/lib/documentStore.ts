// IndexedDB-based document storage for FuelPro Document Center
const DB_NAME = "FuelPro_Documents";
const DB_VERSION = 1;
const STORE_NAME = "documents";
const METADATA_KEY = "fuelpro_doc_metadata";

interface DocMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  tags: string[];
  uploadedAt: string;
  updatedAt: string;
  folderPath?: string;
  content?: string;
  thumbnail?: string;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(req.result);
    };
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("uploadedAt", "uploadedAt", { unique: false });
        store.createIndex("folderPath", "folderPath", { unique: false });
      }
    };
  });
}

export async function saveDocument(
  file: File,
  opts?: { folderPath?: string; content?: string; thumbnail?: string }
): Promise<DocMetadata> {
  const db = await openDB();
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const category = autoCategorize(file.name);
  const meta: DocMetadata = {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
    category,
    tags: getTags(file.name, category),
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    folderPath: opts?.folderPath || "",
    content: opts?.content,
    thumbnail: opts?.thumbnail,
  };

  const data = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const fullDoc = { ...meta, data };
    const req = store.add(fullDoc);
    req.onsuccess = () => resolve(meta);
    req.onerror = () => reject(req.error);
  });
}

export async function getDocument(
  id: string
): Promise<{ meta: DocMetadata; data: ArrayBuffer } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const r = req.result;
      if (!r) return resolve(null);
      const { data, ...meta } = r;
      resolve({ meta, data });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listDocuments(opts?: {
  category?: string;
  search?: string;
  folderPath?: string;
}): Promise<DocMetadata[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    const results: DocMetadata[] = [];
    req.onsuccess = e => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        const { data, ...meta } = cursor.value;
        let match = true;
        if (opts?.category && meta.category !== opts.category) match = false;
        if (
          opts?.search &&
          !meta.name.toLowerCase().includes(opts.search.toLowerCase())
        )
          match = false;
        if (
          opts?.folderPath !== undefined &&
          meta.folderPath !== opts.folderPath
        )
          match = false;
        if (match) results.push(meta);
        cursor.continue();
      } else {
        results.sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function countDocuments(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getTotalStorageUsed(): Promise<number> {
  const docs = await listDocuments();
  return docs.reduce((sum, d) => sum + (d.size || 0), 0);
}

// Auto-categorization engine
function autoCategorize(filename: string): string {
  const name = filename.toLowerCase();
  if (/receipt|mpesa|payment|transaction|lipa|stk/i.test(name))
    return "M-PESA Receipt";
  if (/invoice|bill|quote|proforma/i.test(name)) return "Invoice";
  if (/delivery|waybill|dispatch|consignment|grn/i.test(name))
    return "Delivery Note";
  if (/payroll|salary|staff|wage|payslip|nhif|nssf|sha/i.test(name))
    return "Payroll";
  if (/sales|daily|shift|pump|revenue|closing/i.test(name))
    return "Sales Report";
  if (/expense|petty|reimburs|voucher|claim/i.test(name))
    return "Expense Claim";
  if (/audit|compliance|kra|tax|nema|epra|license/i.test(name))
    return "Compliance";
  if (/stock|inventory|dip|tank|reconcil/i.test(name)) return "Inventory";
  if (/fuel|diesel|petrol|gas|oil|lpg/i.test(name)) return "Fuel Document";
  if (/contract|agreement|legal|memo/i.test(name)) return "Legal";
  if (/report|monthly|annual|quarterly/i.test(name)) return "Report";
  return "General";
}

function getTags(filename: string, category: string): string[] {
  const name = filename.toLowerCase();
  const tags: string[] = [category];
  if (/\.pdf$/i.test(name)) tags.push("pdf");
  if (/\.docx?$/i.test(name)) tags.push("word");
  if (/\.xlsx?$/i.test(name)) tags.push("excel");
  if (/\.csv$/i.test(name)) tags.push("csv");
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(name)) tags.push("image");
  if (/\.(txt|md|rst)$/i.test(name)) tags.push("text");
  if (/\.zip$/i.test(name)) tags.push("archive");
  if (/202\d/.test(name)) tags.push(name.match(/202\d/)?.[0] || "2025");
  return tags;
}

export const CATEGORIES = [
  "All",
  "M-PESA Receipt",
  "Invoice",
  "Delivery Note",
  "Payroll",
  "Sales Report",
  "Expense Claim",
  "Compliance",
  "Inventory",
  "Fuel Document",
  "Legal",
  "Report",
  "General",
] as const;

export type { DocMetadata };
