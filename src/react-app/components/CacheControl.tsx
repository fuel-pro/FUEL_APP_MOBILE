import { useState } from "react";
import {
  Database,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Clock,
  Server,
} from "lucide-react";

interface CacheStats {
  localStorage: number;
  sessionStorage: number;
  indexedDB: number;
  total: number;
}

export default function CacheControl() {
  const [clearing, setClearing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "warning";
  } | null>(null);

  const getCacheStats = (): CacheStats => {
    const calculateSize = (storage: Storage) => {
      let size = 0;
      for (let key in storage) {
        if (storage.hasOwnProperty(key)) {
          size += storage[key].length + key.length;
        }
      }
      return size;
    };

    const localSize = calculateSize(localStorage);
    const sessionSize = calculateSize(sessionStorage);

    return {
      localStorage: localSize,
      sessionStorage: sessionSize,
      indexedDB: 0, // Estimate
      total: localSize + sessionSize,
    };
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const showNotification = (
    message: string,
    type: "success" | "warning" = "success"
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const clearStorage = async (
    type: "localStorage" | "sessionStorage" | "all"
  ) => {
    setClearing(type);
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (type === "localStorage" || type === "all") {
        localStorage.clear();
      }
      if (type === "sessionStorage" || type === "all") {
        sessionStorage.clear();
      }
      showNotification(
        `${type === "all" ? "All" : type} cache cleared successfully`
      );
    } catch (e) {
      showNotification("Failed to clear cache", "warning");
    }
    setClearing(null);
  };

  const reloadPage = () => {
    window.location.reload();
  };

  const stats = getCacheStats();

  const storageKeys = {
    localStorage: Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i)
    ).filter(Boolean),
    sessionStorage: Array.from({ length: sessionStorage.length }, (_, i) =>
      sessionStorage.key(i)
    ).filter(Boolean),
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2 ${notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span className="text-sm">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
          <Database
            size={24}
            className="text-orange-600 dark:text-orange-400"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Cache Control
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage browser storage and cache
          </p>
        </div>
      </div>

      {/* Storage Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Server size={16} className="text-gray-400" />
            <span className="text-xs text-gray-500">Local Storage</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatBytes(stats.localStorage)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {storageKeys.localStorage.length} items
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-gray-400" />
            <span className="text-xs text-gray-500">Session Storage</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatBytes(stats.sessionStorage)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {storageKeys.sessionStorage.length} items
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={16} className="text-gray-400" />
            <span className="text-xs text-gray-500">Total Usage</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatBytes(stats.total)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Browser Storage</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Database size={16} className="text-blue-500" />
            <span className="text-xs text-blue-600">IndexedDB</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ~0 KB
          </p>
          <p className="text-xs text-blue-400 mt-1">Estimated</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => clearStorage("localStorage")}
            disabled={clearing !== null}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 rounded-xl transition-colors disabled:opacity-50"
          >
            {clearing === "localStorage" ? (
              <span className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Clear Local Storage
          </button>
          <button
            onClick={() => clearStorage("sessionStorage")}
            disabled={clearing !== null}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors disabled:opacity-50"
          >
            {clearing === "sessionStorage" ? (
              <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Clear Session Storage
          </button>
          <button
            onClick={() => clearStorage("all")}
            disabled={clearing !== null}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-xl transition-colors disabled:opacity-50"
          >
            {clearing === "all" ? (
              <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Clear All Cache
          </button>
        </div>
      </div>

      {/* Reload Options */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Reload Options
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={reloadPage}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-xl transition-colors"
          >
            <RefreshCw size={16} />
            Reload Page
          </button>
          <button
            onClick={() => {
              clearStorage("all");
              setTimeout(reloadPage, 600);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 rounded-xl transition-colors"
          >
            <Trash2 size={16} />
            Clear & Reload
          </button>
        </div>
      </div>

      {/* Storage Keys Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Storage Keys Preview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Local Storage ({storageKeys.localStorage.length} keys)
            </h4>
            <div className="max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              {storageKeys.localStorage.length === 0 ? (
                <p className="text-xs text-gray-400">Empty</p>
              ) : (
                <div className="space-y-1">
                  {storageKeys.localStorage.slice(0, 20).map(key => (
                    <div
                      key={key}
                      className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate"
                      title={key}
                    >
                      {key}
                    </div>
                  ))}
                  {storageKeys.localStorage.length > 20 && (
                    <div className="text-xs text-gray-400 mt-2">
                      ...and {storageKeys.localStorage.length - 20} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Session Storage ({storageKeys.sessionStorage.length} keys)
            </h4>
            <div className="max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              {storageKeys.sessionStorage.length === 0 ? (
                <p className="text-xs text-gray-400">Empty</p>
              ) : (
                <div className="space-y-1">
                  {storageKeys.sessionStorage.slice(0, 20).map(key => (
                    <div
                      key={key}
                      className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate"
                      title={key}
                    >
                      {key}
                    </div>
                  ))}
                  {storageKeys.sessionStorage.length > 20 && (
                    <div className="text-xs text-gray-400 mt-2">
                      ...and {storageKeys.sessionStorage.length - 20} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Important Notice
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Clearing all cache will log you out and reset station data. Make
            sure to backup any important data before proceeding.
          </p>
        </div>
      </div>
    </div>
  );
}
