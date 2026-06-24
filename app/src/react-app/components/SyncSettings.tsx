// ============================================================
// SyncSettings - User preferences for cloud sync and local storage
// Allows users to control how their data is stored and synced
// ============================================================

import React, { useState, useEffect } from 'react';
import { cloudSyncService, SyncPreferences, SyncStatus } from '../services/CloudSyncService';

interface SyncSettingsProps {
  onClose?: () => void;
}

export const SyncSettings: React.FC<SyncSettingsProps> = ({ onClose }) => {
  const [preferences, setPreferences] = useState<SyncPreferences>({
    storeLocally: false,
    syncEnabled: true,
    autoSyncInterval: 30000,
    syncOnWifiOnly: false,
  });
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const prefs = cloudSyncService.getPreferences();
      setPreferences(prefs);
      
      const fullStatus = await cloudSyncService.getFullStatus();
      setStatus(fullStatus);
      setDevices(fullStatus.devices || []);
      setLastSync(fullStatus.lastSyncAt);
    } catch (err) {
      console.error('Failed to load sync settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof SyncPreferences) => {
    const newValue = !preferences[key];
    const updated = { ...preferences, [key]: newValue };
    
    setPreferences(updated);
    setSaving(true);
    setError(null);
    
    try {
      await cloudSyncService.setPreferences({ [key]: newValue });
      const fullStatus = await cloudSyncService.getFullStatus();
      setStatus(fullStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to update');
      setPreferences(preferences); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const handleSyncIntervalChange = async (interval: number) => {
    const updated = { ...preferences, autoSyncInterval: interval };
    setPreferences(updated);
    setSaving(true);
    
    try {
      await cloudSyncService.setPreferences({ autoSyncInterval: interval });
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async () => {
    setSaving(true);
    setError(null);
    
    try {
      await cloudSyncService.sync();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Sync failed');
    } finally {
      setSaving(false);
    }
  };

  const handleForceRefresh = async () => {
    if (!confirm('This will clear local cache and fetch all data from cloud. Continue?')) {
      return;
    }
    
    setSaving(true);
    try {
      await cloudSyncService.forceRefresh();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Refresh failed');
    } finally {
      setSaving(false);
    }
  };

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-md mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">🔄 Sync & Storage Settings</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Sync Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Sync Status</p>
              <p className="text-xs text-gray-500">
                Last synced: {formatLastSync(lastSync)}
              </p>
            </div>
            <div className={`flex items-center ${status?.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${status?.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              {status?.isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
          
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white rounded px-3 py-2">
              <p className="text-gray-500 text-xs">Devices</p>
              <p className="font-semibold">{devices.length}</p>
            </div>
            <div className="bg-white rounded px-3 py-2">
              <p className="text-gray-500 text-xs">Pending</p>
              <p className="font-semibold">{status?.pendingChanges || 0}</p>
            </div>
          </div>
        </div>

        {/* Toggle Settings */}
        <div className="space-y-4">
          {/* Cloud Sync Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">☁️ Cloud Sync</p>
              <p className="text-sm text-gray-500">Sync data across all your devices</p>
            </div>
            <button
              onClick={() => handleToggle('syncEnabled')}
              disabled={saving}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                preferences.syncEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferences.syncEnabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* Local Storage Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">💾 Local Storage</p>
              <p className="text-sm text-gray-500">Also save data on this device</p>
            </div>
            <button
              onClick={() => handleToggle('storeLocally')}
              disabled={saving}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                preferences.storeLocally ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferences.storeLocally ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* WiFi Only Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">📶 WiFi Only</p>
              <p className="text-sm text-gray-500">Sync only on WiFi connections</p>
            </div>
            <button
              onClick={() => handleToggle('syncOnWifiOnly')}
              disabled={saving || !preferences.syncEnabled}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                preferences.syncOnWifiOnly ? 'bg-blue-600' : 'bg-gray-300'
              } ${!preferences.syncEnabled ? 'opacity-50' : ''}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferences.syncOnWifiOnly ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Sync Interval */}
        {preferences.syncEnabled && (
          <div>
            <p className="font-medium text-gray-900 mb-2">🔄 Auto-Sync Interval</p>
            <select
              value={preferences.autoSyncInterval}
              onChange={(e) => handleSyncIntervalChange(parseInt(e.target.value))}
              disabled={saving}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value={10000}>Every 10 seconds</option>
              <option value={30000}>Every 30 seconds</option>
              <option value={60000}>Every 1 minute</option>
              <option value={300000}>Every 5 minutes</option>
              <option value={600000}>Every 10 minutes</option>
            </select>
          </div>
        )}

        {/* Connected Devices */}
        {devices.length > 0 && (
          <div>
            <p className="font-medium text-gray-900 mb-2">📱 Connected Devices</p>
            <div className="space-y-2">
              {devices.map((device, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">
                      {device.deviceType === 'mobile' ? '📱' : '💻'}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{device.deviceName || 'Unknown Device'}</p>
                      <p className="text-xs text-gray-500">
                        Last seen: {formatLastSync(device.lastSeenAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-4 border-t">
          <button
            onClick={handleManualSync}
            disabled={saving || !status?.isOnline}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
          >
            {saving ? (
              <span className="animate-spin mr-2">⏳</span>
            ) : (
              <span className="mr-2">🔄</span>
            )}
            Sync Now
          </button>
          
          <button
            onClick={handleForceRefresh}
            disabled={saving || !status?.isOnline}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            🔃 Force Refresh from Cloud
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Cloud-First by Default:</strong> Your data is automatically synced to the cloud 
            and accessible from any device. Enable "Local Storage" only if you need offline access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SyncSettings;
