import { useState, useRef, useEffect } from "react";
import {
  Download,
  FileText,
  Table,
  MessageSquare,
  Mail,
  FileSpreadsheet,
} from "lucide-react";

interface ExportDropdownProps {
  onExport: {
    pdf: () => void;
    excel: () => void;
    txt: () => void;
    whatsapp: () => void;
    email: () => void;
  };
  title: string;
}

const FORMATS = [
  { key: "pdf" as const, label: "PDF", icon: FileText, color: "text-red-500" },
  {
    key: "excel" as const,
    label: "Excel",
    icon: FileSpreadsheet,
    color: "text-green-500",
  },
  {
    key: "txt" as const,
    label: "Text",
    icon: FileText,
    color: "text-gray-500",
  },
  {
    key: "whatsapp" as const,
    label: "WhatsApp",
    icon: MessageSquare,
    color: "text-green-600",
  },
  { key: "email" as const, label: "Email", icon: Mail, color: "text-blue-500" },
];

export default function ExportDropdown({
  onExport,
  title,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-[0.98]"
      >
        <Download size={16} />
        {title}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu - positioned directly below the button, right-aligned */}
      <div
        className={`absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-2xl shadow-black/20 border border-gray-200 dark:border-gray-700 z-50 overflow-hidden transition-all duration-150 origin-top-right ${
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
        }`}
      >
        <div className="py-1">
          {FORMATS.map((fmt, i) => {
            const Icon = fmt.icon;
            return (
              <button
                key={fmt.key}
                onClick={() => {
                  onExport[fmt.key]();
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors ${
                  i === 0 ? "rounded-t-xl" : ""
                } ${i === FORMATS.length - 1 ? "rounded-b-xl" : ""}`}
              >
                <Icon size={16} className={fmt.color} />
                <span className="font-medium">{fmt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
