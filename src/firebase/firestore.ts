/**
 * Firebase Firestore Data Service
 * COMPREHENSIVE REAL-TIME SYNC for all data
 */

import { 
 getFirestore, 
 Firestore,
 collection, 
 doc, 
 getDoc, 
 getDocs, 
 setDoc, 
 updateDoc, 
 deleteDoc,
 onSnapshot,
 query,
 where,
 orderBy,
 serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseApp } from './client';

export interface UserProfile {
 uid: string;
 email: string;
 name: string;
 role: 'owner' | 'admin' | 'manager' | 'staff';
 stations: string[];
 createdAt: any;
 updatedAt: any;
 lastSeen?: any;
 deviceInfo?: string;
}

export interface Station {
 id: string;
 ownerId: string;
 ownerEmail: string;
 name: string;
 location: string;
 phone: string;
 email: string;
 kraPin: string;
 etrSerial: string;
 taxRate: number;
 theme: string;
 logo: string;
 description: string;
 createdAt: any;
 updatedAt: any;
 data: any;
 access: any[];
 sharedUsers: any[];
 backendId?: number;
 userRole?: string;
}

export interface Sale {
 id: string;
 stationId: string;
 userId: string;
 items: any[];
 total: number;
 paymentMethod: 'cash' | 'mpesa' | 'card' | 'bank';
 customerName?: string;
 customerPhone?: string;
 createdAt: any;
 operator?: string;
 shiftId?: string;
}

export interface AdminSettings {
 adminUsername: string;
 adminPasswordHash: string;
 secretKey: string;
 apiKeys: Record<string, string>;
 tabConfig: Record<string, any>;
 systemConfig: Record<string, any>;
 updateHistory: any[];
 createdAt?: any;
 updatedAt?: any;
}

export interface UpdateRecord {
 id: string;
 type: string;
 description: string;
 changes: any;
 timestamp: string;
 reverted?: boolean;
 revertedAt?: string;
}

export interface AccessLog {
 id: string;
 stationId: string;
 user: string;
 action: string;
 timestamp: string;
 ip?: string;
 deviceInfo?: string;
}

let _db: Firestore | null = null;

export function getFirestoreDB(): Firestore {
 if (!_db) {
   _db = getFirestore(getFirebaseApp());
 }
 return _db;
}

export async function createUserProfile(userData: { uid: string; email: string; name: string; deviceInfo?: string; }): Promise<void> {
 const db = getFirestoreDB();
 const userRef = doc(db, 'users', userData.uid);
 const profile: UserProfile = {
  uid: userData.uid,
  email: userData.email,
  name: userData.name,
  role: 'owner',
  stations: [],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastSeen: serverTimestamp(),
  deviceInfo: userData.deviceInfo || 'unknown',
 };
 await setDoc(userRef, profile, { merge: true });
 console.log('[Firestore] User profile created:', userData.uid);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
 const db = getFirestoreDB();
 const userRef = doc(db, 'users', uid);
 const snapshot = await getDoc(userRef);
 if (snapshot.exists()) return snapshot.data() as UserProfile;
 return null;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
 const db = getFirestoreDB();
 const userRef = doc(db, 'users', uid);
 await updateDoc(userRef, { ...data, updatedAt: serverTimestamp(), lastSeen: serverTimestamp() });
 console.log('[Firestore] User profile updated:', uid);
}

export async function getAllUsers(): Promise<UserProfile[]> {
 const db = getFirestoreDB();
 const usersRef = collection(db, 'users');
 const snapshot = await getDocs(usersRef);
 return snapshot.docs.map(doc => doc.data() as UserProfile);
}

export async function saveStation(station: Station): Promise<void> {
 const db = getFirestoreDB();
 const stationRef = doc(db, 'stations', station.id);
 const stationData = {
  ...station,
  updatedAt: serverTimestamp(),
  data: station.data || {},
  access: station.access || [],
  sharedUsers: station.sharedUsers || [],
 };
 await setDoc(stationRef, stationData, { merge: true });
 console.log('[Firestore] Station saved:', station.id);
}

export async function syncStationToFirestore(station: Station): Promise<void> {
 await saveStation(station);
}

export async function getStation(stationId: string): Promise<Station | null> {
 const db = getFirestoreDB();
 const stationRef = doc(db, 'stations', stationId);
 const snapshot = await getDoc(stationRef);
 if (snapshot.exists()) return snapshot.data() as Station;
 return null;
}

export async function getUserStations(userId: string): Promise<Station[]> {
 const db = getFirestoreDB();
 const stationsRef = collection(db, 'stations');
 const q = query(stationsRef, where('ownerId', '==', userId));
 const snapshot = await getDocs(q);
 return snapshot.docs.map(doc => doc.data() as Station);
}

export async function updateStation(stationId: string, data: Partial<Station>): Promise<void> {
 const db = getFirestoreDB();
 const stationRef = doc(db, 'stations', stationId);
 await updateDoc(stationRef, { ...data, updatedAt: serverTimestamp() });
 console.log('[Firestore] Station updated:', stationId);
}

export async function updateStationData(stationId: string, dataKey: string, dataValue: any): Promise<void> {
 const db = getFirestoreDB();
 const stationRef = doc(db, 'stations', stationId);
 await updateDoc(stationRef, { [`data.${dataKey}`]: dataValue, updatedAt: serverTimestamp() });
 console.log(`[Firestore] Station data updated: ${stationId}.${dataKey}`);
}

export async function addStationFile(stationId: string, file: any): Promise<void> {
 const db = getFirestoreDB();
 const stationRef = doc(db, 'stations', stationId);
 const snapshot = await getDoc(stationRef);
 const currentStation = snapshot.exists() ? snapshot.data() as Station : null;
 const currentFiles = currentStation?.data?.files || [];
 await updateDoc(stationRef, { 'data.files': [...currentFiles, file], updatedAt: serverTimestamp() });
}

export async function addStationDocument(stationId: string, document: any): Promise<void> {
 const db = getFirestoreDB();
 const stationRef = doc(db, 'stations', stationId);
 const snapshot = await getDoc(stationRef);
 const currentStation = snapshot.exists() ? snapshot.data() as Station : null;
 const currentDocs = currentStation?.data?.documents2 || [];
 await updateDoc(stationRef, { 'data.documents2': [...currentDocs, document], updatedAt: serverTimestamp() });
}

export async function deleteStation(stationId: string): Promise<void> {
 const db = getFirestoreDB();
 const stationRef = doc(db, 'stations', stationId);
 await deleteDoc(stationRef);
 console.log('[Firestore] Station deleted:', stationId);
}

export async function getAllStations(): Promise<Station[]> {
 const db = getFirestoreDB();
 const stationsRef = collection(db, 'stations');
 const snapshot = await getDocs(stationsRef);
 return snapshot.docs.map(doc => doc.data() as Station);
}

export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
 const db = getFirestoreDB();
 const settingsRef = doc(db, 'admin_settings', 'global');
 await setDoc(settingsRef, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
 console.log('[Firestore] Admin settings saved');
}

export async function getAdminSettings(): Promise<AdminSettings | null> {
 const db = getFirestoreDB();
 const settingsRef = doc(db, 'admin_settings', 'global');
 const snapshot = await getDoc(settingsRef);
 if (snapshot.exists()) return snapshot.data() as AdminSettings;
 return null;
}

export async function updateAdminSetting(key: string, value: any): Promise<void> {
 const db = getFirestoreDB();
 const settingsRef = doc(db, 'admin_settings', 'global');
 await updateDoc(settingsRef, { [key]: value, updatedAt: serverTimestamp() });
}

export async function updateTabConfig(tabId: string, config: any): Promise<void> {
 const db = getFirestoreDB();
 const settingsRef = doc(db, 'admin_settings', 'global');
 await updateDoc(settingsRef, { [`tabConfig.${tabId}`]: config, updatedAt: serverTimestamp() });
}

export async function addUpdateRecord(record: UpdateRecord): Promise<void> {
 const db = getFirestoreDB();
 const settingsRef = doc(db, 'admin_settings', 'global');
 const snapshot = await getDoc(settingsRef);
 const currentSettings = snapshot.exists() ? snapshot.data() as AdminSettings : null;
 const currentHistory = currentSettings?.updateHistory || [];
 await updateDoc(settingsRef, { updateHistory: [record, ...currentHistory].slice(0, 100), updatedAt: serverTimestamp() });
}

export async function addAccessLog(log: AccessLog): Promise<void> {
 const db = getFirestoreDB();
 const logsRef = collection(db, 'access_logs');
 const logRef = doc(logsRef);
 await setDoc(logRef, { ...log, id: logRef.id, timestamp: serverTimestamp() });
 console.log('[Firestore] Access log added:', log.action);
}

export async function getAccessLogs(stationId?: string, limit: number = 100): Promise<AccessLog[]> {
 const db = getFirestoreDB();
 const logsRef = collection(db, 'access_logs');
 let q = query(logsRef, orderBy('timestamp', 'desc'));
 if (stationId) q = query(logsRef, where('stationId', '==', stationId), orderBy('timestamp', 'desc'));
 const snapshot = await getDocs(q);
 return snapshot.docs.slice(0, limit).map(doc => doc.data() as AccessLog);
}

export async function recordSale(saleData: Omit<Sale, 'id' | 'createdAt'>): Promise<string> {
 const db = getFirestoreDB();
 const salesRef = collection(db, 'sales');
 const saleRef = doc(salesRef);
 const sale: Sale = { ...saleData, id: saleRef.id, createdAt: serverTimestamp() };
 await setDoc(saleRef, sale);
 return saleRef.id;
}

export async function getStationSales(stationId: string, limit: number = 100): Promise<Sale[]> {
 const db = getFirestoreDB();
 const salesRef = collection(db, 'sales');
 const q = query(salesRef, where('stationId', '==', stationId), orderBy('createdAt', 'desc'));
 const snapshot = await getDocs(q);
 return snapshot.docs.slice(0, limit).map(doc => doc.data() as Sale);
}

export async function getAllSales(): Promise<Sale[]> {
 const db = getFirestoreDB();
 const salesRef = collection(db, 'sales');
 const q = query(salesRef, orderBy('createdAt', 'desc'));
 const snapshot = await getDocs(q);
 return snapshot.docs.map(doc => doc.data() as Sale);
}

export function subscribeToUserStations(userId: string, callback: (stations: Station[]) => void): () => void {
 const db = getFirestoreDB();
 const stationsRef = collection(db, 'stations');
 const q = query(stationsRef, where('ownerId', '==', userId));
 return onSnapshot(q, (snapshot) => {
  const stations = snapshot.docs.map(doc => doc.data() as Station);
  callback(stations);
 }, (error) => { console.error('[Firestore] User stations subscription error:', error); });
}

export function subscribeToStation(stationId: string, callback: (station: Station | null) => void): () => void {
 const db = getFirestoreDB();
 const stationRef = doc(db, 'stations', stationId);
 return onSnapshot(stationRef, (snapshot) => {
  if (snapshot.exists()) callback(snapshot.data() as Station);
  else callback(null);
 }, (error) => { console.error('[Firestore] Station subscription error:', error); });
}

export function subscribeToAllStations(callback: (stations: Station[]) => void): () => void {
 const db = getFirestoreDB();
 const stationsRef = collection(db, 'stations');
 return onSnapshot(stationsRef, (snapshot) => {
  const stations = snapshot.docs.map(doc => doc.data() as Station);
  callback(stations);
 }, (error) => { console.error('[Firestore] All stations subscription error:', error); });
}

export function subscribeToAllUsers(callback: (users: UserProfile[]) => void): () => void {
 const db = getFirestoreDB();
 const usersRef = collection(db, 'users');
 return onSnapshot(usersRef, (snapshot) => {
  const users = snapshot.docs.map(doc => doc.data() as UserProfile);
  callback(users);
 }, (error) => { console.error('[Firestore] All users subscription error:', error); });
}

export function subscribeToAllSales(callback: (sales: Sale[]) => void): () => void {
 const db = getFirestoreDB();
 const salesRef = collection(db, 'sales');
 const q = query(salesRef, orderBy('createdAt', 'desc'));
 return onSnapshot(q, (snapshot) => {
  const sales = snapshot.docs.map(doc => doc.data() as Sale);
  callback(sales);
 }, (error) => { console.error('[Firestore] All sales subscription error:', error); });
}

export function subscribeToAdminSettings(callback: (settings: AdminSettings | null) => void): () => void {
 const db = getFirestoreDB();
 const settingsRef = doc(db, 'admin_settings', 'global');
 return onSnapshot(settingsRef, (snapshot) => {
  if (snapshot.exists()) callback(snapshot.data() as AdminSettings);
  else callback(null);
 }, (error) => { console.error('[Firestore] Admin settings subscription error:', error); });
}

export async function syncAllDataToFirestore(data: { userId: string; userEmail: string; userName: string; stations: Station[]; adminSettings?: AdminSettings; }): Promise<void> {
 console.log('[Firestore] Syncing ALL data to Firestore...');
 await createUserProfile({ uid: data.userId, email: data.userEmail, name: data.userName, deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown' });
 for (const station of data.stations) { await saveStation(station); }
 if (data.adminSettings) { await saveAdminSettings(data.adminSettings); }
 console.log('[Firestore] All data synced successfully');
}

export async function fetchAllDataFromFirestore(userId: string): Promise<{ stations: Station[]; adminSettings: AdminSettings | null; }> {
 console.log('[Firestore] Fetching ALL data from Firestore...');
 const [stations, adminSettings] = await Promise.all([getUserStations(userId), getAdminSettings()]);
 console.log('[Firestore] Data fetched:', { stations: stations.length, hasAdminSettings: !!adminSettings });
 return { stations, adminSettings };
}

export async function getAdminDashboardData(): Promise<{ users: UserProfile[]; stations: Station[]; sales: Sale[]; adminSettings: AdminSettings | null; totalRevenue: number; totalStations: number; totalUsers: number; totalSales: number; }> {
 const [users, stations, sales, adminSettings] = await Promise.all([getAllUsers(), getAllStations(), getAllSales(), getAdminSettings()]);
 const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
 return { users, stations, sales, adminSettings, totalRevenue, totalStations: stations.length, totalUsers: users.length, totalSales: sales.length };
}

export async function checkFirestoreStatus(): Promise<{ connected: boolean; error?: string; }> {
 try {
  const db = getFirestoreDB();
  const testRef = doc(db, '_status', 'test');
  await getDoc(testRef);
  return { connected: true };
 } catch (error: any) {
  console.error('[Firestore] Connection error:', error);
  return { connected: false, error: error.message || 'Unknown error' };
 }
}
