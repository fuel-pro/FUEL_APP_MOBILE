import { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  FileText,
  Upload,
  Trash2,
  Download,
  Share2,
  Eye,
  X,
  Search,
  Plus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileCode,
  Clock,
  Tag,
  Filter,
  SortAsc,
  Grid,
  List,
  Star,
  MoreHorizontal,
} from "lucide-react";

interface DocItem {
  id: string;
  name: string;
  type: "pdf" | "image" | "spreadsheet" | "document" | "archive" | "other";
  folderId: string;
  size: number;
  created: string;
  tags: string[];
  starred: boolean;
  content?: string;
  url?: string;
}

interface DocFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
  autoSort: boolean;
  rules: string[];
}

const DEFAULT_FOLDERS: DocFolder[] = [
  {
    id: "invoices",
    name: "Invoices & Receipts",
    icon: "receipt",
    color: "blue",
    autoSort: true,
    rules: ["invoice", "receipt", "payment"],
  },
  {
    id: "sales",
    name: "Sales Reports",
    icon: "chart",
    color: "green",
    autoSort: true,
    rules: ["sales", "report", "daily", "monthly"],
  },
  {
    id: "tax",
    name: "Tax & Compliance",
    icon: "shield",
    color: "purple",
    autoSort: true,
    rules: ["tax", "vat", "kra", "compliance", "return"],
  },
  {
    id: "employees",
    name: "Employee Records",
    icon: "users",
    color: "amber",
    autoSort: true,
    rules: ["employee", "staff", "payroll", "shift"],
  },
  {
    id: "inventory",
    name: "Inventory & Stock",
    icon: "package",
    color: "red",
    autoSort: true,
    rules: ["inventory", "stock", "delivery", "fuel"],
  },
  {
    id: "finance",
    name: "Financial Documents",
    icon: "banknote",
    color: "emerald",
    autoSort: true,
    rules: ["bank", "statement", "mpesa", "financial"],
  },
  {
    id: "legal",
    name: "Legal & Permits",
    icon: "scale",
    color: "indigo",
    autoSort: true,
    rules: ["license", "permit", "legal", "contract"],
  },
  {
    id: "maintenance",
    name: "Maintenance Logs",
    icon: "wrench",
    color: "orange",
    autoSort: true,
    rules: ["maintenance", "repair", "service", "pump"],
  },
  {
    id: "uploads",
    name: "General Uploads",
    icon: "upload",
    color: "gray",
    autoSort: false,
    rules: [],
  },
  {
    id: "starred",
    name: "Starred",
    icon: "star",
    color: "yellow",
    autoSort: false,
    rules: [],
  },
];

const STORAGE_KEY = "fuelpro_documents";
const FOLDERS_KEY = "fuelpro_doc_folders";

function loadDocs(): DocItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function loadFolders(): DocFolder[] {
  try {
    const saved = localStorage.getItem(FOLDERS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_FOLDERS;
}

function getFileType(name: string): DocItem["type"] {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext))
    return "image";
  if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet";
  if (["doc", "docx", "txt", "md", "rtf"].includes(ext)) return "document";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  return "other";
}

function autoClassify(name: string): string {
  const lower = name.toLowerCase();
  for (const folder of DEFAULT_FOLDERS) {
    if (folder.autoSort && folder.rules.some(rule => lower.includes(rule))) {
      return folder.id;
    }
  }
  return "uploads";
}

const FILE_ICONS: Record<string, any> = {
  pdf: FileText,
  image: FileImage,
  spreadsheet: FileSpreadsheet,
  document: FileCode,
  archive: FileArchive,
  other: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  pdf: "text-red-500",
  image: "text-purple-500",
  spreadsheet: "text-green-500",
  document: "text-blue-500",
  archive: "text-amber-500",
  other: "text-gray-500",
};

export default function DocumentManager() {
  const [folders, setFolders] = useState<DocFolder[]>(loadFolders);
  const [docs, setDocs] = useState<DocItem[]>(loadDocs);
  const [activeFolder, setActiveFolder] = useState("invoices");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const persistDocs = (d: DocItem[]) => {
    setDocs(d);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  };
  const persistFolders = (f: DocFolder[]) => {
    setFolders(f);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(f));
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const type = getFileType(file.name);
      const folderId = autoClassify(file.name);
      const newDoc: DocItem = {
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        type,
        folderId,
        size: file.size,
        created: new Date().toISOString(),
        tags: [],
        starred: false,
      };
      persistDocs([newDoc, ...docs]);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this document?")) return;
    persistDocs(docs.filter(d => d.id !== id));
    if (previewDoc?.id === id) setPreviewDoc(null);
  };

  const toggleStar = (id: string) => {
    persistDocs(
      docs.map(d => (d.id === id ? { ...d, starred: !d.starred } : d))
    );
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const folder: DocFolder = {
      id: `fld_${Date.now()}`,
      name: newFolderName.trim(),
      icon: "folder",
      color: "gray",
      autoSort: false,
      rules: [],
    };
    persistFolders([...folders, folder]);
    setNewFolderName("");
    setShowCreateFolder(false);
  };

  const filteredDocs = docs
    .filter(d => {
      if (activeFolder === "starred") return d.starred;
      if (activeFolder === "uploads")
        return (
          d.folderId === "uploads" || !folders.find(f => f.id === d.folderId)
        );
      return d.folderId === activeFolder;
    })
    .filter(
      d =>
        !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "date")
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      return b.size - a.size;
    });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <FolderOpen size={24} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Document Center
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Smart folders, auto-sort, preview, and share
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar Folders */}
        <div className="w-full lg:w-64 space-y-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Upload size={16} /> Upload Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={e => {
              handleFileUpload(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />

          <div className="space-y-1 mt-3">
            {folders.map(folder => {
              const count =
                folder.id === "starred"
                  ? docs.filter(d => d.starred).length
                  : folder.id === "uploads"
                    ? docs.filter(
                        d =>
                          d.folderId === "uploads" ||
                          !folders.find(f => f.id === d.folderId)
                      ).length
                    : docs.filter(d => d.folderId === folder.id).length;
              const isActive = activeFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <FolderOpen
                    size={14}
                    className={
                      isActive ? "text-blue-500" : `text-${folder.color}-400`
                    }
                  />
                  <span className="flex-1 truncate">{folder.name}</span>
                  {count > 0 && (
                    <span className="text-[10px] text-gray-400">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowCreateFolder(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FolderPlus size={14} /> New Folder
          </button>

          {showCreateFolder && (
            <div className="flex gap-2 px-3">
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded text-xs dark:text-white"
                onKeyDown={e => e.key === "Enter" && createFolder()}
                autoFocus
              />
              <button
                onClick={createFolder}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
              >
                Add
              </button>
              <button
                onClick={() => setShowCreateFolder(false)}
                className="px-2 py-1 text-gray-400 text-xs"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "bg-white dark:bg-gray-700 shadow" : ""}`}
              >
                <List size={14} className="text-gray-500" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded ${viewMode === "grid" ? "bg-white dark:bg-gray-700 shadow" : ""}`}
              >
                <Grid size={14} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Document List */}
          {viewMode === "list" ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {filteredDocs.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <FolderOpen size={36} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No documents in this folder</p>
                  <p className="text-xs mt-1">
                    Upload files or they will be auto-sorted here
                  </p>
                </div>
              )}
              {filteredDocs.map(doc => {
                const FileIcon = FILE_ICONS[doc.type] || FileText;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <FileIcon
                      size={20}
                      className={TYPE_COLORS[doc.type] || "text-gray-500"}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {doc.name}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {formatSize(doc.size)} |{" "}
                        {new Date(doc.created).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          toggleStar(doc.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Star
                          size={14}
                          className={
                            doc.starred
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-300"
                          }
                        />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPreviewDoc(doc);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredDocs.map(doc => {
                const FileIcon = FILE_ICONS[doc.type] || FileText;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setPreviewDoc(doc)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-pointer text-center"
                  >
                    <FileIcon
                      size={32}
                      className={`mx-auto mb-2 ${TYPE_COLORS[doc.type] || "text-gray-500"}`}
                    />
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {doc.name}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {formatSize(doc.size)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const Icon = FILE_ICONS[previewDoc.type] || FileText;
                  return (
                    <Icon size={18} className={TYPE_COLORS[previewDoc.type]} />
                  );
                })()}
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {previewDoc.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                {(() => {
                  const Icon = FILE_ICONS[previewDoc.type] || FileText;
                  return (
                    <Icon size={40} className={TYPE_COLORS[previewDoc.type]} />
                  );
                })()}
              </div>
              <div className="space-y-2 text-center">
                <p className="text-xs text-gray-500">
                  Type:{" "}
                  <strong className="text-gray-700 dark:text-gray-300">
                    {previewDoc.type.toUpperCase()}
                  </strong>
                </p>
                <p className="text-xs text-gray-500">
                  Size:{" "}
                  <strong className="text-gray-700 dark:text-gray-300">
                    {formatSize(previewDoc.size)}
                  </strong>
                </p>
                <p className="text-xs text-gray-500">
                  Uploaded:{" "}
                  <strong className="text-gray-700 dark:text-gray-300">
                    {new Date(previewDoc.created).toLocaleString()}
                  </strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <Download size={14} /> Download
              </button>
              <button className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <Share2 size={14} /> Share
              </button>
              <button
                onClick={() => handleDelete(previewDoc.id)}
                className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
