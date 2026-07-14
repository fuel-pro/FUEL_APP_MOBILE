import { useState } from "react";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import EnhancedCard from "./EnhancedCard";
import EnhancedButton from "./EnhancedButton";

interface DataRecoveryProps {
  onRestore?: (data: any) => void;
}

export default function DataRecovery({ onRestore }: DataRecoveryProps) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleExport = () => {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        fuelData: localStorage.getItem("fuelData"),
        clients: localStorage.getItem("clients"),
        invoices: localStorage.getItem("invoices"),
        salesHistory: localStorage.getItem("salesHistory"),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fuelpro-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus("success");
      setMessage("Backup exported successfully");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (error) {
      setStatus("error");
      setMessage("Failed to export backup");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string);

        if (data.fuelData) localStorage.setItem("fuelData", data.fuelData);
        if (data.clients) localStorage.setItem("clients", data.clients);
        if (data.invoices) localStorage.setItem("invoices", data.invoices);
        if (data.salesHistory)
          localStorage.setItem("salesHistory", data.salesHistory);

        if (onRestore) onRestore(data);

        setStatus("success");
        setMessage("Backup restored successfully. Reloading...");
        import("@/react-app/lib/app-reloader").then(({ triggerSoftReload }) =>
          triggerSoftReload(1500)
        );
      } catch (error) {
        setStatus("error");
        setMessage("Invalid backup file format");
        setTimeout(() => setStatus("idle"), 3000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <EnhancedCard title="Data Backup & Recovery" icon={<Download size={20} />}>
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">
          Export your data for backup or import a previous backup to restore
          your data.
        </p>

        {status !== "idle" && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              status === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}
          >
            {status === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span>{message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EnhancedButton
            onClick={handleExport}
            icon={<Download size={20} />}
            variant="primary"
            fullWidth
          >
            Export Backup
          </EnhancedButton>

          <label className="w-full">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <EnhancedButton
              icon={<Upload size={20} />}
              variant="secondary"
              fullWidth
            >
              Import Backup
            </EnhancedButton>
          </label>
        </div>
      </div>
    </EnhancedCard>
  );
}
