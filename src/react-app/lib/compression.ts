/**
 * Compression layer for cloud persistence.
 *
 * Goal: shrink every payload stored in Supabase (the `app_kv` JSONB blob +
 * per-component keys) and every text-based file uploaded to Storage, so the
 * project stays well within the Free-Plan quotas (storage size AND egress).
 *
 * Strategy:
 *  - `compress(value)` serializes the value to JSON, gzips it with `pako`,
 *    and wraps the result in a small envelope that is JSONB-safe:
 *        { "__c": 1, "d": "<base64 gzip>", "n": <original byte length> }
 *    The envelope is stored in the `data` column instead of the raw object,
 *    so a 200 KB invoice history collapses to ~15-30 KB on the wire.
 *  - `decompress(raw)` detects the envelope by the `__c` marker and restores
 *    the original value. Anything without the marker is returned untouched,
 *    so legacy rows (raw JSONB arrays/objects) keep working and auto-heal:
 *    the next `set()` repersists them compressed.
 *  - A configurable size threshold skips compression for tiny payloads where
 *    the base64 + gzip overhead would exceed the savings.
 *
 * The envelope lives entirely inside the JSONB column (base64 is valid JSON),
 * so no schema change is required and PostgREST/Realtime continue to return
 * the column as a parsed object. `coerceJson` in cloud-storage-service runs
 * first (unwrapping any double-encoded string), then `decompress` unwraps
 * the envelope.
 */

import { gzip, ungzip } from "pako";

/** Envelope marker. Bumped if the on-disk format ever changes. */
const ENVELOPE_VERSION = 1;
const ENVELOPE_KEY = "__c";

/**
 * Minimum JSON byte length before compression is attempted. Below this the
 * gzip header + base64 expansion can make the payload LARGER, so we store
 * the raw value to avoid wasting space.
 */
export const COMPRESSION_MIN_BYTES = 384;

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked build is materially faster than String.fromCharCode.apply on
  // large arrays (avoids blowing the call stack and minimizes allocations).
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 0x8000) {
    const slice = bytes.subarray(i, Math.min(i + 0x8000, len));
    let binary = "";
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
    out += btoa(binary);
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface CompressedEnvelope {
  [ENVELOPE_KEY]: typeof ENVELOPE_VERSION;
  /** base64-encoded gzip bytes of the JSON-serialized value. */
  d: string;
  /** Original (uncompressed) JSON byte length, for stats/health. */
  n: number;
  /** Compressed byte length (base64-decoded), for ratio reporting. */
  z: number;
}

export function isCompressedEnvelope(raw: unknown): raw is CompressedEnvelope {
  return (
    raw != null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    (raw as Record<string, unknown>)[ENVELOPE_KEY] === ENVELOPE_VERSION &&
    typeof (raw as Record<string, unknown>).d === "string"
  );
}

/**
 * Compress a JSON-serializable value into the envelope, OR return the value
 * unchanged when it is too small to benefit or compression fails.
 *
 * Returns the original `value` reference (not a copy) when skipping, so
 * callers can cheaply detect "did we compress?" via `isCompressedEnvelope`.
 */
export function compress<T>(value: T): T | CompressedEnvelope {
  try {
    const json = JSON.stringify(value);
    // JSON.stringify returns undefined for functions/symbols; guard.
    if (json == null) return value;

    // Don't bother compressing tiny payloads.
    if (json.length < COMPRESSION_MIN_BYTES) return value;

    const bytes = new TextEncoder().encode(json);
    const zipped = gzip(bytes, { level: 6 });
    const base64 = bytesToBase64(zipped);

    // Safety net: if compression made it BIGGER (already-random / incompressible
    // data), keep the raw value. This is rare but possible for short, high-
    // entropy strings.
    if (base64.length >= json.length) return value;

    return {
      [ENVELOPE_KEY]: ENVELOPE_VERSION,
      d: base64,
      n: bytes.length,
      z: zipped.length,
    } as CompressedEnvelope;
  } catch {
    // Never let compression break a save — fall back to raw.
    return value;
  }
}

/**
 * Restore a value produced by `compress`. If `raw` is not an envelope (legacy
 * raw JSONB), it is returned unchanged so existing rows keep working.
 */
export function decompress<T = unknown>(raw: unknown): T | null {
  if (raw == null) return null;
  if (!isCompressedEnvelope(raw)) return raw as T;
  try {
    const bytes = base64ToBytes(raw.d);
    const jsonBytes = ungzip(bytes);
    const json = new TextDecoder().decode(jsonBytes);
    return JSON.parse(json) as T;
  } catch {
    // Corrupt envelope — treat as no data rather than crashing the UI.
    return null;
  }
}

/** Approximate compression ratio for diagnostics (1 = no change, 0.1 = 10x). */
export function compressionRatio(raw: unknown): number | null {
  if (!isCompressedEnvelope(raw)) return null;
  if (raw.n === 0) return null;
  return raw.z / raw.n;
}

// ─────────────────────────────────────────────────────────────────────
// File (binary) compression — for Storage uploads.
//
// Some file types are already compressed (images, video, audio, PDF, office
// OOXML zips, existing archives). Gzipping them again rarely shrinks and can
// even grow the file. We only compress "compressible" text-like and
// uncompressed-document types, where gzip typically saves 60-90%.
// ─────────────────────────────────────────────────────────────────────

/**
 * MIME types / extensions that benefit from gzip. Binary media formats that
 * are already deflate-compressed (PNG, JPG, MP4, MP3, PDF, OOXML zips) are
 * intentionally excluded — re-compressing them wastes CPU and can grow bytes.
 */
const COMPRESSIBLE_EXTS = new Set([
  "txt",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "ndjson",
  "xml",
  "html",
  "htm",
  "md",
  "rst",
  "log",
  "yaml",
  "yml",
  "svg",
  "sql",
  "js",
  "css",
  "rtf",
  // Legacy Office (binary container, but content is highly compressible).
  "doc",
  "xls",
  "ppt",
  // OpenDocument
  // (these are zip-based -> already compressed, EXCLUDED)
]);

const COMPRESSIBLE_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-yaml",
  "image/svg+xml",
];

/** MIME types we must NOT re-compress (already deflate/entropy compressed). */
const SKIP_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "heic",
  "bmp",
  "ico",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "mp3",
  "wav",
  "flac",
  "aac",
  "ogg",
  "pdf",
  "zip",
  "rar",
  "7z",
  "gz",
  "gzip",
  "br",
  "zst",
  "tar",
  "docx",
  "xlsx",
  "pptx",
  "odt",
  "ods",
  "odp",
  "epub",
  "jar",
  "woff",
  "woff2",
]);

export function isCompressibleFile(name: string, mimeType?: string): boolean {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (SKIP_EXTS.has(ext)) return false;
  if (COMPRESSIBLE_EXTS.has(ext)) return true;
  const mime = (mimeType || "").toLowerCase();
  return COMPRESSIBLE_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

/** Magic prefix stored at the start of a compressed Storage object. */
const GZ_MAGIC = "FPGZ"; // FuelPro GZipped — 4 ASCII bytes.

/**
 * Gzip a File/Blob if it is compressible and large enough to benefit. Returns
 * the (possibly compressed) Blob and the MIME type to store it as, plus a
 * `compressed` flag to persist on the document metadata so the downloader
 * knows to inflate it. Non-compressible files are returned unchanged.
 */
export async function compressFile(
  file: File | Blob,
  name: string,
  mimeType?: string,
): Promise<{ blob: Blob; contentType: string; compressed: boolean }> {
  const contentType = mimeType || file.type || "application/octet-stream";
  if (!isCompressibleFile(name, mimeType)) {
    return { blob: file, contentType, compressed: false };
  }
  // Skip tiny files where gzip overhead exceeds savings.
  if (file.size < COMPRESSION_MIN_BYTES) {
    return { blob: file, contentType, compressed: false };
  }
  try {
    const buf = await file.arrayBuffer();
    const zipped = gzip(new Uint8Array(buf), { level: 6 });
    // Only use the compressed version if it is meaningfully smaller.
    if (zipped.length + GZ_MAGIC.length >= buf.byteLength) {
      return { blob: file, contentType, compressed: false };
    }
    // Prepend the magic so downloads can detect it without metadata.
    const out = new Uint8Array(GZ_MAGIC.length + zipped.length);
    for (let i = 0; i < GZ_MAGIC.length; i++) out[i] = GZ_MAGIC.charCodeAt(i);
    out.set(zipped, GZ_MAGIC.length);
    return {
      blob: new Blob([out], { type: "application/octet-stream" }),
      contentType: "application/octet-stream",
      compressed: true,
    };
  } catch {
    return { blob: file, contentType, compressed: false };
  }
}

/**
 * Detect and inflate a gzip-compressed Storage object. If the bytes start with
 * the GZ_MAGIC prefix, the remainder is ungzip'd and returned as a Blob of the
 * original `contentType`. Otherwise the bytes are returned unchanged.
 */
export async function decompressFile(
  bytes: ArrayBuffer,
  fallbackContentType = "application/octet-stream",
): Promise<{ blob: Blob; compressed: boolean }> {
  const view = new Uint8Array(bytes);
  if (view.length < GZ_MAGIC.length) {
    return {
      blob: new Blob([bytes], { type: fallbackContentType }),
      compressed: false,
    };
  }
  let isMagic = true;
  for (let i = 0; i < GZ_MAGIC.length; i++) {
    if (view[i] !== GZ_MAGIC.charCodeAt(i)) {
      isMagic = false;
      break;
    }
  }
  if (!isMagic) {
    return {
      blob: new Blob([bytes], { type: fallbackContentType }),
      compressed: false,
    };
  }
  try {
    const restored = ungzip(view.subarray(GZ_MAGIC.length));
    return {
      blob: new Blob([restored], { type: fallbackContentType }),
      compressed: true,
    };
  } catch {
    return {
      blob: new Blob([bytes], { type: fallbackContentType }),
      compressed: false,
    };
  }
}
