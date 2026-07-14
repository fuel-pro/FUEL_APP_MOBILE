import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Upload,
  FolderUp,
  FileText,
  Image,
  FileSpreadsheet,
  Trash2,
  Download,
  Search,
  X,
  File,
  Archive,
  Music,
  Video,
  ChevronDown,
  Eye,
  Folder,
  Grid,
  List,
  Filter,
  SortAsc,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Layers,
  HardDrive,
  FileUp,
  Zap,
} from "lucide-react";
import {
  saveDocument,
  listDocuments,
  deleteDocument,
  getDocument,
  countDocuments,
  getTotalStorageUsed,
  CATEGORIES,
  type DocMetadata,
} from "@/react-app/lib/documentStore";

const CATEGORY_COLORS: Record<string, string> = {
  "M-PESA Receipt": "#10b981",
  Invoice: "#3b82f6",
  "Delivery Note": "#f59e0b",
  Payroll: "#8b5cf6",
  "Sales Report": "#06b6d4",
  "Expense Claim": "#ef4444",
  Compliance: "#ec4899",
  Inventory: "#14b8a6",
  "Fuel Document": "#f97316",
  Legal: "#6366f1",
  Report: "#0ea5e9",
  General: "#94a3b8",
};

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  "M-PESA Receipt": Zap,
  Invoice: FileText,
  "Delivery Note": FileText,
  Payroll: FileSpreadsheet,
  "Sales Report": FileSpreadsheet,
  "Expense Claim": FileText,
  Compliance: FileText,
  Inventory: FileSpreadsheet,
  "Fuel Document": File,
  Legal: FileText,
  Report: FileText,
  General: File,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(1) + " GB";
}

function getFileIcon(type: string, name: string) {
  if (type.startsWith("image/")) return Image;
  if (type.includes("pdf")) return FileText;
  if (
    type.includes("sheet") ||
    type.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  )
    return FileSpreadsheet;
  if (
    type.includes("zip") ||
    type.includes("archive") ||
    name.endsWith(".zip") ||
    name.endsWith(".rar")
  )
    return Archive;
  if (type.startsWith("audio/")) return Music;
  if (type.startsWith("video/")) return Video;
  return File;
}

interface UploadItem {
  file: File;
  id: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  folderPath?: string;
}

type ViewMode = "grid" | "list";
type SortField = "date" | "name" | "size" | "category";
type SortDir = "asc" | "desc";

export default function DocumentCenter() {
  const [documents, setDocuments] = useState<DocMetadata[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocMetadata | null>(null);
  const [stats, setStats] = useState({ count: 0, storage: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadQueueRef = useRef<UploadItem[]>([]);
  const processingRef = useRef(false);

  // Load documents
  const loadDocs = useCallback(async () => {
    const opts: { category?: string; search?: string } = {};
    if (activeCategory !== "All") opts.category = activeCategory;
    if (searchQuery.trim()) opts.search = searchQuery.trim();
    const docs = await listDocuments(opts);
    setDocuments(docs);
    const cnt = await countDocuments();
    const storage = await getTotalStorageUsed();
    setStats({ count: cnt, storage });
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Process upload queue
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (uploadQueueRef.current.length > 0) {
      const item = uploadQueueRef.current[0];
      if (!item || item.status !== "queued") {
        uploadQueueRef.current.shift();
        continue;
      }

      // Mark as uploading
      setUploads(prev =>
        prev.map(u => (u.id === item.id ? { ...u, status: "uploading" } : u))
      );
      uploadQueueRef.current[0] = { ...item, status: "uploading" };

      try {
        await saveDocument(item.file, {
          folderPath: item.folderPath || "",
        });
        setUploads(prev =>
          prev.map(u =>
            u.id === item.id ? { ...u, status: "done", progress: 100 } : u
          )
        );
        uploadQueueRef.current[0] = {
          ...uploadQueueRef.current[0],
          status: "done",
          progress: 100,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed";
        setUploads(prev =>
          prev.map(u =>
            u.id === item.id ? { ...u, status: "error", error: msg } : u
          )
        );
        uploadQueueRef.current[0] = {
          ...uploadQueueRef.current[0],
          status: "error",
          error: msg,
        };
      }

      uploadQueueRef.current.shift();
      await loadDocs();
    }

    processingRef.current = false;
  }, [loadDocs]);

  // Add files to queue
  const addFilesToQueue = useCallback(
    (files: FileList | null, folderPath?: string) => {
      if (!files || files.length === 0) return;
      const newItems: UploadItem[] = Array.from(files).map(file => ({
        file,
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: "queued" as const,
        progress: 0,
        folderPath,
      }));
      uploadQueueRef.current = [...uploadQueueRef.current, ...newItems];
      setUploads(prev => [...prev, ...newItems]);
      processQueue();
    },
    [processQueue]
  );

  // Handlers
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFilesToQueue(e.target.files);
      e.target.value = "";
    },
    [addFilesToQueue]
  );

  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      // Extract folder path from webkitRelativePath
      const fileList = Array.from(files);
      if (fileList.length > 0) {
        const folderName =
          fileList[0].webkitRelativePath.split("/")[0] || "Folder";
        addFilesToQueue(files, folderName);
      }
      e.target.value = "";
    },
    [addFilesToQueue]
  );

  // Drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const items = e.dataTransfer.items;
      if (!items) {
        addFilesToQueue(e.dataTransfer.files);
        return;
      }
      const allFiles: File[] = [];
      const traverseEntry = (entry: FileSystemEntry, path: string = "") => {
        if (entry.isFile) {
          (entry as FileSystemFileEntry).file(file => {
            allFiles.push(file);
            if (allFiles.length >= 1000) return; // safety limit
          });
        } else if (entry.isDirectory) {
          const dirReader = (entry as FileSystemDirectoryEntry).createReader();
          dirReader.readEntries(entries => {
            entries.forEach(e => traverseEntry(e, path + entry.name + "/"));
          });
        }
      };

      for (let i = 0; i < Math.min(items.length, 50); i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) traverseEntry(entry);
      }

      // Fallback: use dataTransfer.files if webkitGetAsEntry not available
      if (allFiles.length === 0 && e.dataTransfer.files.length > 0) {
        addFilesToQueue(e.dataTransfer.files);
      } else if (allFiles.length > 0) {
        const dt = new DataTransfer();
        allFiles.forEach(f => dt.items.add(f));
        addFilesToQueue(dt.files);
      }
    },
    [addFilesToQueue]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDocument(id);
      setSelectedDoc(null);
      await loadDocs();
    },
    [loadDocs]
  );

  const handleDownload = useCallback(async (doc: DocMetadata) => {
    const result = await getDocument(doc.id);
    if (!result) return;
    const blob = new Blob([result.data], {
      type: doc.type || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev =>
      prev.filter(u => u.status === "queued" || u.status === "uploading")
    );
  }, []);

  // Sorted & filtered documents
  const sortedDocs = useMemo(() => {
    const sorted = [...documents];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "date":
        default:
          cmp =
            new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [documents, sortField, sortDir]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(d => {
      counts[d.category] = (counts[d.category] || 0) + 1;
    });
    return counts;
  }, [documents]);

  const activeUploads = uploads.filter(
    u => u.status === "queued" || u.status === "uploading"
  ).length;
  const doneUploads = uploads.filter(u => u.status === "done").length;
  const errorUploads = uploads.filter(u => u.status === "error").length;

  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, sans-serif",
        color: "#e2e8f0",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            margin: "0 0 6px",
            fontSize: 20,
            fontWeight: 700,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Layers size={22} style={{ color: "#f59e0b" }} /> Document Center
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Upload, organize, and manage your fuel station documents
        </p>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <StatCard
          icon={<FileText size={16} />}
          label="Documents"
          value={String(stats.count)}
          color="#3b82f6"
        />
        <StatCard
          icon={<HardDrive size={16} />}
          label="Storage Used"
          value={formatSize(stats.storage)}
          color="#10b981"
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Uploaded"
          value={String(doneUploads)}
          color="#8b5cf6"
        />
        {errorUploads > 0 && (
          <StatCard
            icon={<AlertTriangle size={16} />}
            label="Errors"
            value={String(errorUploads)}
            color="#ef4444"
          />
        )}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragOver ? "#f59e0b" : "#334155"}`,
          borderRadius: 12,
          padding: "28px 20px",
          textAlign: "center",
          background: isDragOver
            ? "rgba(245,158,11,0.08)"
            : "rgba(30,30,35,0.6)",
          transition: "all 0.2s",
          marginBottom: 16,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp,.zip,.mp3,.mp4,.mov,.avi"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore - webkitdirectory is not in TypeScript types but works in browsers
          webkitdirectory=""
          // @ts-ignore
          directory=""
          multiple
          onChange={handleFolderSelect}
          style={{ display: "none" }}
        />
        <FileUp
          size={32}
          style={{ color: isDragOver ? "#f59e0b" : "#475569", marginBottom: 8 }}
        />
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#94a3b8" }}>
          {isDragOver
            ? "Drop files or folders here"
            : "Drag & drop files or folders here"}
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "10px 18px",
              background: "#f59e0b",
              color: "#000",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Upload size={15} /> Select Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            style={{
              padding: "10px 18px",
              background: "transparent",
              color: "#f59e0b",
              border: "1px solid #f59e0b",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FolderUp size={15} /> Select Folder
          </button>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#475569" }}>
          Supports PDF, Word, Excel, Images, CSV, Text, ZIP — Max 100MB per file
        </p>
      </div>

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            background: "rgba(30,30,35,0.6)",
            borderRadius: 10,
            padding: 12,
            border: "1px solid #334155",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
              Upload Queue{" "}
              {activeUploads > 0 && (
                <span style={{ color: "#f59e0b" }}>
                  ({activeUploads} active)
                </span>
              )}
            </span>
            <button
              onClick={clearCompleted}
              style={{
                fontSize: 11,
                color: "#64748b",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Clear completed
            </button>
          </div>
          <div
            style={{
              maxHeight: 160,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {uploads.map(item => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(20,20,25,0.5)",
                  fontSize: 12,
                }}
              >
                {item.status === "queued" && (
                  <span style={{ color: "#64748b", flexShrink: 0 }}>
                    <Loader2 size={12} />
                  </span>
                )}
                {item.status === "uploading" && (
                  <span style={{ color: "#f59e0b", flexShrink: 0 }}>
                    <Loader2 size={12} className="spin" />
                  </span>
                )}
                {item.status === "done" && (
                  <span style={{ color: "#10b981", flexShrink: 0 }}>
                    <CheckCircle2 size={12} />
                  </span>
                )}
                {item.status === "error" && (
                  <span style={{ color: "#ef4444", flexShrink: 0 }}>
                    <AlertTriangle size={12} />
                  </span>
                )}
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#cbd5e1",
                  }}
                >
                  {item.file.name}
                </span>
                <span style={{ color: "#475569", flexShrink: 0 }}>
                  {formatSize(item.file.size)}
                </span>
                {item.folderPath && (
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: 10,
                      background: "#1e293b",
                      padding: "2px 6px",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    {item.folderPath}
                  </span>
                )}
                {item.status === "error" && (
                  <span
                    style={{ color: "#ef4444", fontSize: 10, flexShrink: 0 }}
                  >
                    {item.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#475569",
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              background: "#1a1a1f",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#475569",
                cursor: "pointer",
                padding: 2,
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: 8,
            background: "#1a1a1f",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Filter size={14} />
        </button>
        <button
          onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          style={{
            padding: 8,
            background: "#1a1a1f",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          {viewMode === "grid" ? <List size={14} /> : <Grid size={14} />}
        </button>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setSortDir(d => (d === "asc" ? "desc" : "asc"))}
            style={{
              padding: "8px 12px",
              background: "#1a1a1f",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
            }}
          >
            <SortAsc
              size={14}
              style={{
                transform: sortDir === "desc" ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
            {sortField}
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 12,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat;
          const count = cat === "All" ? stats.count : categoryCounts[cat] || 0;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
                border: "none",
                flexShrink: 0,
                background: isActive ? "#f59e0b" : "#1e293b",
                color: isActive ? "#000" : "#94a3b8",
              }}
            >
              {cat}{" "}
              {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Document list */}
      {sortedDocs.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "#475569",
          }}
        >
          <File size={40} style={{ marginBottom: 10, opacity: 0.3 }} />
          <p style={{ fontSize: 14, margin: 0 }}>No documents found</p>
          <p style={{ fontSize: 12, margin: "4px 0 0" }}>
            Upload files or folders to get started
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 10,
          }}
        >
          {sortedDocs.map(doc => (
            <DocGridCard
              key={doc.id}
              doc={doc}
              onSelect={setSelectedDoc}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sortedDocs.map(doc => (
            <DocListRow
              key={doc.id}
              doc={doc}
              onSelect={setSelectedDoc}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedDoc && (
        <DocDetailPanel
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={handleDelete}
          onDownload={handleDownload}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// Sub-components
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(30,30,35,0.6)",
        borderRadius: 10,
        padding: 12,
        border: "1px solid #334155",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
          {value}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function DocGridCard({
  doc,
  onSelect,
  onDelete,
  onDownload,
}: {
  doc: DocMetadata;
  onSelect: (d: DocMetadata) => void;
  onDelete: (id: string) => void;
  onDownload: (d: DocMetadata) => void;
}) {
  const Icon = getFileIcon(doc.type, doc.name);
  const color = CATEGORY_COLORS[doc.category] || "#94a3b8";
  const CatIcon = CATEGORY_ICONS[doc.category] || FileText;
  return (
    <div
      onClick={() => onSelect(doc)}
      style={{
        background: "rgba(30,30,35,0.6)",
        borderRadius: 10,
        padding: 12,
        border: "1px solid #334155",
        cursor: "pointer",
        transition: "border-color 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#475569")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#334155")}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Icon size={20} style={{ color }} />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={e => {
              e.stopPropagation();
              onDownload(doc);
            }}
            style={{
              background: "none",
              border: "none",
              color: "#475569",
              cursor: "pointer",
              padding: 2,
            }}
          >
            <Download size={13} />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete(doc.id);
            }}
            style={{
              background: "none",
              border: "none",
              color: "#475569",
              cursor: "pointer",
              padding: 2,
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "#e2e8f0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {doc.name}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          color: "#475569",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <CatIcon size={10} style={{ color }} /> {doc.category}
        </span>
        <span>{formatSize(doc.size)}</span>
      </div>
      <div style={{ fontSize: 10, color: "#475569" }}>
        {new Date(doc.uploadedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

function DocListRow({
  doc,
  onSelect,
  onDelete,
  onDownload,
}: {
  doc: DocMetadata;
  onSelect: (d: DocMetadata) => void;
  onDelete: (id: string) => void;
  onDownload: (d: DocMetadata) => void;
}) {
  const Icon = getFileIcon(doc.type, doc.name);
  const color = CATEGORY_COLORS[doc.category] || "#94a3b8";
  return (
    <div
      onClick={() => onSelect(doc)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        background: "rgba(30,30,35,0.6)",
        borderRadius: 8,
        border: "1px solid #334155",
        cursor: "pointer",
        fontSize: 12,
        transition: "border-color 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#475569")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#334155")}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 500,
          color: "#e2e8f0",
        }}
      >
        {doc.name}
      </span>
      <span
        style={{
          color,
          fontSize: 10,
          fontWeight: 600,
          background: `${color}15`,
          padding: "2px 8px",
          borderRadius: 10,
          whiteSpace: "nowrap",
        }}
      >
        {doc.category}
      </span>
      <span style={{ color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>
        {formatSize(doc.size)}
      </span>
      <span style={{ color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>
        {new Date(doc.uploadedAt).toLocaleDateString()}
      </span>
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        <button
          onClick={e => {
            e.stopPropagation();
            onDownload(doc);
          }}
          style={{
            background: "none",
            border: "none",
            color: "#475569",
            cursor: "pointer",
            padding: 3,
          }}
        >
          <Download size={13} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            onDelete(doc.id);
          }}
          style={{
            background: "none",
            border: "none",
            color: "#475569",
            cursor: "pointer",
            padding: 3,
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function DocDetailPanel({
  doc,
  onClose,
  onDelete,
  onDownload,
}: {
  doc: DocMetadata;
  onClose: () => void;
  onDelete: (id: string) => void;
  onDownload: (d: DocMetadata) => void;
}) {
  const Icon = getFileIcon(doc.type, doc.name);
  const color = CATEGORY_COLORS[doc.category] || "#94a3b8";
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 380,
        maxWidth: "100%",
        height: "100vh",
        background: "rgba(15,15,20,0.98)",
        backdropFilter: "blur(12px)",
        borderLeft: "1px solid #334155",
        zIndex: 1000,
        padding: 20,
        overflowY: "auto",
        boxSizing: "border-box",
        animation: "slideInRight 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, color: "#fff" }}>
          Document Details
        </h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#475569",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
          }}
        >
          <Icon size={32} style={{ color }} />
        </div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            margin: "0 0 4px",
            wordBreak: "break-all",
          }}
        >
          {doc.name}
        </p>
        <span
          style={{
            fontSize: 11,
            color,
            fontWeight: 600,
            background: `${color}15`,
            padding: "3px 10px",
            borderRadius: 10,
          }}
        >
          {doc.category}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <DetailRow label="Size" value={formatSize(doc.size)} />
        <DetailRow label="Type" value={doc.type || "Unknown"} />
        <DetailRow
          label="Uploaded"
          value={new Date(doc.uploadedAt).toLocaleString()}
        />
        <DetailRow label="Category" value={doc.category} />
        {doc.folderPath && <DetailRow label="Folder" value={doc.folderPath} />}
        <DetailRow label="Tags" value={doc.tags.join(", ")} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onDownload(doc)}
          style={{
            flex: 1,
            padding: 10,
            background: "#f59e0b",
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Download size={14} /> Download
        </button>
        <button
          onClick={() => {
            onDelete(doc.id);
            onClose();
          }}
          style={{
            padding: 10,
            background: "transparent",
            color: "#ef4444",
            border: "1px solid #ef4444",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        padding: "6px 0",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <span style={{ color: "#475569" }}>{label}</span>
      <span
        style={{
          color: "#e2e8f0",
          fontWeight: 500,
          maxWidth: "60%",
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}
