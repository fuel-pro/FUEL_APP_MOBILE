// Supabase Storage + user_documents-backed document storage for FuelPro
// Document Center. Files are stored as binary objects in the fuelpro-files
// Storage bucket and metadata in the user_documents table — both sync
// cross-device (RLS by owner_id = auth.uid()). This replaces the previous
// IndexedDB implementation which was browser-local and did NOT sync.
import { getSupabaseClient } from "@/supabase/client";

const BUCKET = "fuelpro-files";

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

/** Row shape in the user_documents table. */
interface DocRow {
  id: string;
  owner_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  mime_type: string | null;
  category: string | null;
  description: string | null;
  storage_bucket: string | null;
  created_at: string;
  updated_at: string;
  tags: string[] | null;
  folder_path: string | null;
  thumbnail: string | null;
}

function rowToMeta(r: DocRow): DocMetadata {
  return {
    id: r.id,
    name: r.file_name,
    size: r.file_size || 0,
    type: r.mime_type || r.file_type || "application/octet-stream",
    category: r.category || "General",
    tags: Array.isArray(r.tags) ? r.tags : [],
    uploadedAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
    folderPath: r.folder_path || "",
    thumbnail: r.thumbnail || undefined,
  };
}

export async function saveDocument(
  file: File,
  opts?: { folderPath?: string; content?: string; thumbnail?: string }
): Promise<DocMetadata> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated — cannot upload document.");

  const category = autoCategorize(file.name);
  const tags = getTags(file.name, category);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `documents/${user.id}/${Date.now()}-${safeName}`;

  // 1. Upload the file binary to Storage.
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  // 2. Insert metadata into user_documents.
  const { data, error: dbErr } = await supabase
    .from("user_documents")
    .insert({
      owner_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
      mime_type: file.type || null,
      category,
      storage_bucket: BUCKET,
      tags,
      folder_path: opts?.folderPath || "",
      thumbnail: opts?.thumbnail || null,
    })
    .select()
    .single();

  if (dbErr) {
    // Rollback the Storage upload so we don't leave orphaned files.
    await supabase.storage.from(BUCKET).remove([filePath]).catch(() => {});
    throw new Error(`Metadata insert failed: ${dbErr.message}`);
  }

  return rowToMeta(data as DocRow);
}

export async function getDocument(
  id: string
): Promise<{ meta: DocMetadata; data: ArrayBuffer } | null> {
  const supabase = getSupabaseClient();
  const { data: row, error } = await supabase
    .from("user_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !row) return null;

  const r = row as DocRow;
  const meta = rowToMeta(r);
  // Fetch the file binary from the Storage public URL.
  const { data: pubUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(r.file_path);
  const res = await fetch(pubUrlData.publicUrl);
  if (!res.ok) return { meta, data: new ArrayBuffer(0) };
  const data = await res.arrayBuffer();
  return { meta, data };
}

export async function listDocuments(opts?: {
  category?: string;
  search?: string;
  folderPath?: string;
}): Promise<DocMetadata[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("user_documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts?.category && opts.category !== "All") {
    query = query.eq("category", opts.category);
  }
  if (opts?.search) {
    query = query.ilike("file_name", `%${opts.search}%`);
  }
  if (opts?.folderPath !== undefined) {
    query = query.eq("folder_path", opts.folderPath);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as DocRow[]).map(rowToMeta);
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  // 1. Fetch the row to get the file_path (for Storage cleanup).
  const { data: row } = await supabase
    .from("user_documents")
    .select("file_path")
    .eq("id", id)
    .single();
  // 2. Delete the metadata row.
  const { error } = await supabase.from("user_documents").delete().eq("id", id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
  // 3. Delete the file from Storage (best-effort).
  if (row?.file_path) {
    await supabase.storage.from(BUCKET).remove([row.file_path]).catch(() => {});
  }
}

export async function countDocuments(): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("user_documents")
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return count || 0;
}

export async function getTotalStorageUsed(): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_documents")
    .select("file_size");
  if (error || !data) return 0;
  return (data as { file_size: number }[]).reduce(
    (sum, d) => sum + (d.file_size || 0),
    0
  );
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
