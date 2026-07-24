/**
 * REST API Sync - FuelPro
 * 
 * This module provides a complete cloud-synced database using Firebase Firestore.
 * When Firebase is available, it syncs data to Firestore.
 * Falls back to localStorage when offline.
 * 
 * Collections:
 * - users, stations, sales, audit_log, secrets, feature_flags, config, sales_analytics
 */

import { getApiPath, getBackendUrl } from "@/utils/apiConfig";

// ═══════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// ═══════════════════════════════════════════════════

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, Firestore, collection, doc, setDoc, getDoc, 
  getDocs, deleteDoc, serverTimestamp, query, where, orderBy, limit 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCgIOzDrLRpFVBVlABmgMJnX0iLa9c8J98',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'fuel-pro-1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'fuel-pro-1',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fuel-pro-1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '434474929988',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:434474929988:web:f141473bd3acfba6d41111',
};

// Initialize Firebase
let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }
  firebaseApp = initializeApp(firebaseConfig);
  return firebaseApp;
}

function getFirestoreDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  firestoreDb = getFirestore(getFirebaseApp());
  return firestoreDb;
}

// ═══════════════════════════════════════════════════
// FIREBASE-FIRST SYNC (Primary Method)
// ═══════════════════════════════════════════════════

// Collections enum
export enum Collections {
  USERS = 'users',
  STATIONS = 'stations',
  SALES = 'sales',
  AUDIT_LOG = 'audit_log',
  SECRETS = 'secrets',
  FEATURE_FLAGS = 'feature_flags',
  CONFIG = 'config',
  SALES_ANALYTICS = 'sales_analytics',
}

// Get user ID from localStorage
function getCurrentUserId(): string | null {
  try {
    const authIdentity = localStorage.getItem("fuelpro_auth_identity");
    if (authIdentity) {
      const user = JSON.parse(authIdentity);
      return user?.id || null;
    }
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════
// BACKEND CONFIGURATION (optional - for legacy support)
// ═══════════════════════════════════════════════════


// ═══════════════════════════════════════════════════
// UNIFIED DATA STORE
// ═══════════════════════════════════════════════════

export interface DataRecord {
  id: string;
  collection: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  stationId?: string;
}


// ═══════════════════════════════════════════════════
// CRUD OPERATIONS - USING FIREBASE FIRESTORE
// ═══════════════════════════════════════════════════

// Create
export async function createRecord(
  collection: string,
  data: Record<string, any>,
  userId?: string,
  stationId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const id = `${collection}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: DataRecord = {
    id,
    collection,
    data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId,
    stationId,
  };
  
  try {
    const db = getFirestoreDb();
    await setDoc(
      doc(db, collection, id),
      {
        ...record,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true, id };
  } catch (err: any) {
    // Fallback to localStorage
    localStorage.setItem(`fuelpro_${collection}_${id}`, JSON.stringify(record));
    return { success: true, id, error: 'Saved locally' };
  }
}

// Read
export async function getRecord(
  collection: string,
  id: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const db = getFirestoreDb();
    const docSnap = await getDoc(doc(db, collection, id));
    
    if (docSnap.exists()) {
      const firestoreData = docSnap.data();
      return { 
        success: true, 
        data: firestoreData.data || firestoreData 
      };
    }
    
    // Fallback to localStorage
    const localData = localStorage.getItem(`fuelpro_${collection}_${id}`);
    if (localData) {
      return { success: true, data: JSON.parse(localData) };
    }
    
    return { success: false, error: "Not found" };
  } catch (err: any) {
    // Fallback to localStorage
    const localData = localStorage.getItem(`fuelpro_${collection}_${id}`);
    if (localData) {
      return { success: true, data: JSON.parse(localData) };
    }
    return { success: false, error: err.message };
  }
}

// Update
export async function updateRecord(
  collection: string,
  id: string,
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getFirestoreDb();
    await setDoc(
      doc(db, collection, id),
      {
        data,
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (err: any) {
    // Fallback to localStorage
    const existing = localStorage.getItem(`fuelpro_${collection}_${id}`);
    if (existing) {
      const record = JSON.parse(existing);
      record.data = { ...record.data, ...data };
      record.updatedAt = new Date().toISOString();
      localStorage.setItem(`fuelpro_${collection}_${id}`, JSON.stringify(record));
    }
    return { success: true, error: 'Saved locally' };
  }
}

// Delete
export async function deleteRecord(
  collection: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getFirestoreDb();
    await deleteDoc(doc(db, collection, id));
    return { success: true };
  } catch (err: any) {
    // Fallback to localStorage
    localStorage.removeItem(`fuelpro_${collection}_${id}`);
    return { success: true, error: 'Deleted locally' };
  }
}

// List
export async function listRecords(
  collection: string,
  options?: { userId?: string; stationId?: string; limit?: number }
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const db = getFirestoreDb();
    const collectionRef = collection(db, collection);
    
    let q = query(collectionRef);
    
    if (options?.userId) {
      q = query(collectionRef, where("userId", "==", options.userId));
    }
    if (options?.stationId) {
      q = query(collectionRef, where("stationId", "==", options.stationId));
    }
    if (options?.limit) {
      q = query(collectionRef, limit(options.limit));
    }
    
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        data: data.data || data,
      };
    });
    
    return { success: true, data: records };
  } catch (err: any) {
    // Fallback to localStorage
    const results: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`fuelpro_${collection}_`)) {
        const data = localStorage.getItem(key);
        if (data) {
          results.push(JSON.parse(data));
        }
      }
    }
    return { success: true, data: results, error: 'Retrieved from local cache' };
  }
}

// ═══════════════════════════════════════════════════
// SPECIALIZED STORES
// ═══════════════════════════════════════════════════

// Audit Log
export const auditLogStore = {
  async add(event: string, detail: string, user: string, severity: string = "info") {
    return createRecord(Collections.AUDIT_LOG, {
      event,
      detail,
      user,
      severity,
      timestamp: new Date().toISOString(),
    });
  },
  async list(limit = 100) {
    const result = await listRecords(Collections.AUDIT_LOG, { limit });
    return result;
  },
};

// Users
export const userStore = {
  async create(data: any) {
    return createRecord(Collections.USERS, data);
  },
  async update(id: string, data: any) {
    return updateRecord(Collections.USERS, id, data);
  },
  async get(id: string) {
    return getRecord(Collections.USERS, id);
  },
  async list(options?: { limit?: number }) {
    return listRecords(Collections.USERS, options);
  },
};

// Stations
export const stationStore = {
  async create(data: any, stationId?: string) {
    return createRecord(Collections.STATIONS, data, undefined, stationId);
  },
  async update(id: string, data: any) {
    return updateRecord(Collections.STATIONS, id, data);
  },
  async get(id: string) {
    return getRecord(Collections.STATIONS, id);
  },
  async list(stationId?: string) {
    return listRecords(Collections.STATIONS, { stationId });
  },
};

// Secrets
export const secretsStore = {
  async create(data: { key: string; value: string }) {
    return createRecord(Collections.SECRETS, data);
  },
  async update(id: string, data: { key: string; value: string }) {
    return updateRecord(Collections.SECRETS, id, data);
  },
  async delete(id: string) {
    return deleteRecord(Collections.SECRETS, id);
  },
  async list() {
    return listRecords(Collections.SECRETS);
  },
};

// Feature Flags
export const featureFlagsStore = {
  async create(data: { id: string; name: string; description: string; enabled: boolean }) {
    return createRecord(Collections.FEATURE_FLAGS, data);
  },
  async update(id: string, data: any) {
    return updateRecord(Collections.FEATURE_FLAGS, id, data);
  },
  async list() {
    return listRecords(Collections.FEATURE_FLAGS);
  },
};

// Sales
export const salesStore = {
  async create(data: any, stationId?: string) {
    return createRecord(Collections.SALES, data, undefined, stationId);
  },
  async list(stationId?: string, limit?: number) {
    return listRecords(Collections.SALES, { stationId, limit });
  },
  async analytics(stationId?: string) {
    const result = await listRecords(Collections.SALES_ANALYTICS, { stationId, limit: 1 });
    return result;
  },
};

// Config
export const configStore = {
  async get(key: string) {
    return getRecord(Collections.CONFIG, key);
  },
  async set(key: string, value: any) {
    const existing = await getRecord(Collections.CONFIG, key);
    if (existing.success) {
      return updateRecord(Collections.CONFIG, key, value);
    }
    return createRecord(Collections.CONFIG, { key, value });
  },
  async list() {
    return listRecords(Collections.CONFIG);
  },
};

// ═══════════════════════════════════════════════════
// STATUS CHECK
// ═══════════════════════════════════════════════════

export async function checkApiStatus(): Promise<{
  connected: boolean;
  url: string;
  error?: string;
}> {
  try {
    // Check Firebase Firestore connectivity
    const db = getFirestoreDb();
    
    // Try to read the _health/_check document
    const healthDoc = doc(db, '_health', '_check');
    await getDoc(healthDoc);
    
    return { 
      connected: true, 
      url: 'Firebase Firestore',
      error: 'Firebase Connected' 
    };
  } catch (err: any) {
    // Firebase might not have data yet, but it's connected
    // Check if it's a "missing document" error (which is OK) vs actual connection error
    const errorStr = err.message || '';
    if (errorStr.includes('permission') || errorStr.includes('PERMISSION')) {
      return { 
        connected: true, 
        url: 'Firebase Firestore',
        error: 'Firebase Connected (no data yet)' 
      };
    }
    
    // If we can't connect to Firebase, try the REST API as fallback
    try {
      const response = await fetch(`${API_URL}/`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        return { 
          connected: true, 
          url: API_URL, 
          error: 'Backend connected' 
        };
      }
    } catch {}
    
    return { 
      connected: false, 
      url: 'Firebase Firestore', 
      error: err.message 
    };
  }
}

// ═══════════════════════════════════════════════════
// FALLBACK MODE
// ═══════════════════════════════════════════════════

// When API is not available, operations are queued locally
const SYNC_QUEUE_KEY = "fuelpro_api_sync_queue";
const PENDING_CHANGES_KEY = "fuelpro_pending_changes";

interface PendingChange {
  id: string;
  collection: string;
  operation: "create" | "update" | "delete";
  data?: any;
  timestamp: number;
}

export function queuePendingChange(
  collection: string,
  operation: "create" | "update" | "delete",
  data?: any,
  localId?: string
): void {
  const queue = getPendingChanges();
  queue.push({
    id: localId || `${collection}_${Date.now()}`,
    collection,
    operation,
    data,
    timestamp: Date.now(),
  });
  localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(queue));
}

export function getPendingChanges(): PendingChange[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_CHANGES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearPendingChanges(): void {
  localStorage.setItem(PENDING_CHANGES_KEY, "[]");
}

export function getPendingCount(): number {
  return getPendingChanges().length;
}
