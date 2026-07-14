import { useState } from "react";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Calendar,
} from "lucide-react";

interface BackupSectionProps {
  logAudit: (
    event: string,
    detail: string,
    severity: "success" | "warning" | "danger" | "info"
  ) => void;
}

export default function BackupSection({ logAudit }: BackupSectionProps) {
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(() =>
    localStorage.getItem("fuelpro_last_backup")
  );
  const [backupSize, setBackupSize] = useState("0 KB");
  const [includeFiles, setIncludeFiles] = useState(true);

  const handleBackup = () => {
    setBackingUp(true);
    logAudit("Backup Started", "Manual backup initiated", "info");
    setTimeout(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) data[key] = localStorage.getItem(key) || "";
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      setBackupSize(`${(blob.size / 1024).toFixed(1)} KB`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fuelpro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      localStorage.setItem("fuelpro_last_backup", now);
      setLastBackup(now);
      setBackingUp(false);
      logAudit(
        "Backup Completed",
        `Backup exported: ${(blob.size / 1024).toFixed(1)} KB`,
        "success"
      );
    }, 1200);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    logAudit("Restore Started", `Restoring from ${file.name}`, "info");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (
          !confirm(
            `Restore ${Object.keys(data).length} keys? This will overwrite current data.`
          )
        ) {
          setRestoring(false);
          return;
        }
        Object.entries(data).forEach(([key, value]) => {
          localStorage.setItem(key, value as string);
        });
        logAudit(
          "Restore Completed",
          `Restored ${Object.keys(data).length} keys`,
          "success"
        );
        import("@/react-app/lib/app-reloader").then(({ triggerSoftReload }) =>
          triggerSoftReload(500)
        );
      } catch {
        logAudit("Restore Failed", "Invalid backup file", "danger");
      }
      setRestoring(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <Database size={18} className="text-blue-400" /> Backup & Restore
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Export and import all FuelPro data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Backup Card */}
        <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-3">
            <Download size={18} className="text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-white mb-1">Export Backup</h3>
          <p className="text-xs text-gray-500 mb-4">
            Download all localStorage data as JSON
          </p>
          {lastBackup && (
            <div className="flex items-center gap-2 mb-3 text-[10px] text-gray-500">
              <Clock size={10} /> Last: {new Date(lastBackup).toLocaleString()}{" "}
              ({backupSize})
            </div>
          )}
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="w-full py-2.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs rounded-lg border border-blue-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {backingUp ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Creating...
              </>
            ) : (
              <>
                <Download size={13} /> Create Backup
              </>
            )}
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
          <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center mb-3">
            <Upload size={18} className="text-amber-400" />
          </div>
          <h3 className="text-sm font-medium text-white mb-1">Import Backup</h3>
          <p className="text-xs text-gray-500 mb-4">
            Restore from a previous backup file
          </p>
          <div className="mb-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeFiles}
              onChange={() => setIncludeFiles(!includeFiles)}
              className="rounded accent-amber-500"
            />
            <span className="text-[10px] text-gray-500">
              Include uploaded files
            </span>
          </div>
          <label className="w-full py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs rounded-lg border border-amber-500/20 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={13} />{" "}
            {restoring ? "Restoring..." : "Select Backup File"}
            <input
              type="file"
              accept=".json"
              onChange={handleRestore}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Storage Stats */}
      <div className="bg-[#161618] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <HardDrive size={14} className="text-purple-400" /> Storage Breakdown
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {Array.from({ length: localStorage.length }, (_, i) =>
            localStorage.key(i)
          )
            .filter(Boolean)
            .sort()
            .map(key => {
              const val = localStorage.getItem(key!) || "";
              return (
                <div
                  key={key}
                  className="flex items-center justify-between text-xs py-1"
                >
                  <span className="text-gray-400 font-mono truncate max-w-[60%]">
                    {key}
                  </span>
                  <span className="text-gray-600">
                    {(val.length / 1024).toFixed(2)} KB
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
