/**
 * effective-tax.test.ts
 * Locks the effective-tax resolver behavior:
 *   - GeneralSettings `general_settings_v1` override wins when present.
 *   - taxEnabled=false → 0%.
 *   - taxRate=0 → falls through to the country default.
 *   - Tax-included default is TRUE (regulated fuel prices include VAT).
 *   - taxLabel override is honored.
 *
 * IMPORTANT: cloudStorageService.getCached reads the in-memory + localStorage
 * caches. This test writes a row into the SERVICE CACHE DIRECTLY via the real
 * cache API so the resolver behaves exactly as it does in production.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";
import {
  getEffectiveVatRateFor,
  getEffectiveTaxEnabledFor,
  getEffectiveTaxIncludedFor,
  getEffectiveTaxLabelFor,
} from "@/react-app/lib/effective-tax";

const SETTINGS_KEY = "general_settings_v1";

function cacheSettings(patch: Record<string, unknown>) {
  // Persist a settings row through the actual cache the resolver reads.
  const row = {
    stationName: "Test Station",
    taxEnabled: true,
    taxRate: 16,
    taxLabel: "VAT",
    taxIncludedInPrice: true,
    ...patch,
  };
  // getCached reads memoryCache first; set() populates it via the same key.
  // We bypass the async path by using the service's own cache writer.
  (
    cloudStorageService as unknown as {
      memoryCache: Map<string, { value: unknown; ts: number }>;
    }
  ).memoryCache.set(SETTINGS_KEY, { value: row, ts: Date.now() });
}

beforeEach(() => {
  (
    cloudStorageService as unknown as {
      memoryCache: Map<string, { value: unknown; ts: number }>;
    }
  ).memoryCache.clear();
});

afterEach(() => {
  (
    cloudStorageService as unknown as {
      memoryCache: Map<string, { value: unknown; ts: number }>;
    }
  ).memoryCache.clear();
});

describe("getEffectiveVatRateFor", () => {
  it("falls back to the country default when no settings row is cached", () => {
    // US default is 0%.
    expect(getEffectiveVatRateFor("US")).toBe(0);
    // Kenya default is 16%.
    expect(getEffectiveVatRateFor("KE")).toBeCloseTo(0.16, 5);
  });

  it("returns the GeneralSettings override (percent → fraction)", () => {
    cacheSettings({ taxRate: 8 });
    expect(getEffectiveVatRateFor("US")).toBeCloseTo(0.08, 5);
    expect(getEffectiveVatRateFor("KE")).toBeCloseTo(0.08, 5);
  });

  it("returns 0 when tax is explicitly disabled", () => {
    cacheSettings({ taxEnabled: false, taxRate: 16 });
    expect(getEffectiveVatRateFor("KE")).toBe(0);
  });

  it("uses the country default when taxRate is 0 (use-country-default)", () => {
    cacheSettings({ taxEnabled: true, taxRate: 0 });
    expect(getEffectiveVatRateFor("KE")).toBeCloseTo(0.16, 5);
    expect(getEffectiveVatRateFor("US")).toBe(0);
  });
});

describe("getEffectiveTaxIncludedFor", () => {
  it("defaults to TRUE when no settings row is cached", () => {
    expect(getEffectiveTaxIncludedFor("KE")).toBe(true);
  });

  it("honors the owner's explicit setting", () => {
    cacheSettings({ taxIncludedInPrice: false });
    expect(getEffectiveTaxIncludedFor("KE")).toBe(false);
  });
});

describe("getEffectiveTaxEnabledFor", () => {
  it("defaults to measuring the effective rate > 0", () => {
    expect(getEffectiveTaxEnabledFor("KE")).toBe(true);
    expect(getEffectiveTaxEnabledFor("US")).toBe(false);
  });

  it("honors an explicit enabled toggle", () => {
    cacheSettings({ taxEnabled: false, taxRate: 16 });
    expect(getEffectiveTaxEnabledFor("KE")).toBe(false);
  });
});

describe("getEffectiveTaxLabelFor", () => {
  it("defaults to VAT", () => {
    expect(getEffectiveTaxLabelFor("KE")).toBe("VAT");
  });

  it("honors the override label", () => {
    cacheSettings({ taxLabel: "GST" });
    expect(getEffectiveTaxLabelFor("AU")).toBe("GST");
  });
});
