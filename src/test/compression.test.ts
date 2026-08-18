/**
 * Tests for the compression layer used by cloud-storage-service + document
 * uploads. Verifies round-trip fidelity, the envelope marker, the
 * small-payload skip threshold, backward-compat with legacy raw JSONB, and
 * the file compress/decompress helpers (including the FPGZ magic prefix).
 */

import { describe, it, expect } from "vitest";
import {
  compress,
  decompress,
  isCompressedEnvelope,
  COMPRESSION_MIN_BYTES,
  compressFile,
  decompressFile,
  isCompressibleFile,
} from "@/react-app/lib/compression";

describe("compression (JSONB envelope)", () => {
  it("round-trips a large object losslessly", () => {
    const big = {
      invoices: Array.from({ length: 50 }, (_, i) => ({
        id: `INV-${i}`,
        total: 1234.56 + i,
        items: Array.from({ length: 10 }, (_, j) => ({
          name: `Item ${j}`,
          qty: j,
          price: 9.99 * j,
        })),
      })),
    };
    const env = compress(big);
    expect(isCompressedEnvelope(env)).toBe(true);
    const restored = decompress(env) as typeof big;
    expect(restored).toEqual(big);
  });

  it("round-trips large arrays", () => {
    const arr = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `row ${i}`,
      value: Math.random() * 1000,
    }));
    const env = compress(arr);
    expect(isCompressedEnvelope(env)).toBe(true);
    expect(decompress(env)).toEqual(arr);
  });

  it("does NOT compress payloads below the threshold", () => {
    const tiny = { a: 1, b: "x" };
    const result = compress(tiny);
    expect(isCompressedEnvelope(result)).toBe(false);
    expect(result).toBe(tiny); // returned by reference, unchanged
  });

  it("skips incompressible (high-entropy) data even if large", () => {
    // Truly random bytes, base64-encoded, are near-optimal entropy; gzip
    // cannot shrink them. compress() must fall back to the raw value rather
    // than storing a larger envelope.
    const randomBytes = new Uint8Array(4000);
    for (let i = 0; i < randomBytes.length; i++)
      randomBytes[i] = Math.random() * 256;
    // btoa over binary strings: build via chunks.
    let bin = "";
    for (let i = 0; i < randomBytes.length; i++)
      bin += String.fromCharCode(randomBytes[i]);
    const random = btoa(bin);
    const result = compress({ blob: random });
    // For random data it should skip (envelope would be >= raw).
    expect(isCompressedEnvelope(result)).toBe(false);
  });

  it("treats legacy raw JSONB as already-decompressed (backward compat)", () => {
    const legacy = { foo: "bar", n: 42, arr: [1, 2, 3] };
    expect(isCompressedEnvelope(legacy)).toBe(false);
    expect(decompress(legacy)).toEqual(legacy);
  });

  it("returns null for null input", () => {
    expect(decompress(null)).toBeNull();
  });

  it("returns null for a corrupt envelope (graceful failure)", () => {
    const corrupt = { __c: 1, d: "!!!not-base64-gzip!!!", n: 10, z: 10 };
    expect(isCompressedEnvelope(corrupt)).toBe(true);
    expect(decompress(corrupt)).toBeNull();
  });

  it("compresses to a smaller on-wire size for real business data", () => {
    const business = {
      companyData: { name: "Test Station", kraPin: "P051234567X" },
      salesHistory: Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [`day-${i}`, { total: 5000 + i }]),
      ),
      pmsPumps: Array.from({ length: 4 }, (_, i) => ({
        id: `pms-${i}`,
        opening: 1000,
        closing: 1100 + i,
      })),
    };
    const env = compress(business)!;
    const wireSize = JSON.stringify(env).length;
    const rawSize = JSON.stringify(business).length;
    expect(isCompressedEnvelope(env)).toBe(true);
    expect(wireSize).toBeLessThan(rawSize);
    expect(decompress(env)).toEqual(business);
  });
});

describe("file compression (Storage uploads)", () => {
  it("compresses a large text file and restores it losslessly", async () => {
    const text = "hello world ".repeat(5000); // ~60 KB, very compressible
    const file = new File([text], "report.txt", { type: "text/plain" });
    const { blob, contentType, compressed } = await compressFile(
      file,
      "report.txt",
      "text/plain",
    );
    expect(compressed).toBe(true);
    expect(contentType).toBe("application/octet-stream");
    expect(blob.size).toBeLessThan(file.size);

    // Round-trip through decompressFile.
    const buf = await blob.arrayBuffer();
    const { blob: restored, compressed: wasCompressed } = await decompressFile(
      buf,
      "text/plain",
    );
    expect(wasCompressed).toBe(true);
    expect(await restored.text()).toBe(text);
  });

  it("does NOT compress tiny text files", async () => {
    const file = new File(["hi"], "tiny.txt", { type: "text/plain" });
    const { compressed } = await compressFile(file, "tiny.txt", "text/plain");
    expect(compressed).toBe(false);
  });

  it("does NOT compress already-compressed media (png)", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const file = new File([bytes], "photo.png", { type: "image/png" });
    const { compressed } = await compressFile(file, "photo.png", "image/png");
    expect(compressed).toBe(false);
  });

  it("passes through non-magic bytes unchanged in decompressFile", async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const { blob, compressed } = await decompressFile(
      original.buffer,
      "application/octet-stream",
    );
    expect(compressed).toBe(false);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(original);
  });

  it("isCompressibleFile correctly classifies types", () => {
    expect(isCompressibleFile("data.csv", "text/csv")).toBe(true);
    expect(isCompressibleFile("data.json", "application/json")).toBe(true);
    expect(isCompressibleFile("readme.md", "text/markdown")).toBe(true);
    expect(isCompressibleFile("spreadsheet.xls", "")).toBe(true);
    expect(isCompressibleFile("photo.jpg", "image/jpeg")).toBe(false);
    expect(isCompressibleFile("doc.pdf", "application/pdf")).toBe(false);
    expect(isCompressibleFile("archive.zip", "application/zip")).toBe(false);
    expect(isCompressibleFile("report.docx", "")).toBe(false); // OOXML zip
  });
});

describe("threshold constant", () => {
  it("exports a sane minimum", () => {
    expect(COMPRESSION_MIN_BYTES).toBeGreaterThan(0);
    expect(COMPRESSION_MIN_BYTES).toBeLessThan(2000);
  });
});
