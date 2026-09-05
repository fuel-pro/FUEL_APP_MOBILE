/**
 * effective-tax.ts
 * Single source of truth for the EFFECTIVE tax regime the UI prints on
 * receipts / invoices / VAT returns.
 *
 * Resolution order:
 *   1. GeneralSettings "Tax Configuration" (cloud-backed
 *      `general_settings_v1`, read via the synchronous in-memory cache so a
 *      rate the owner set in Settings applies instantly on every tab).
 *   2. User-sitewide preferences (`user_preferences.vatRate`) — the legacy
 *      prefs GeneralSettings also writes.
 *   3. The country's statutory default (`getVATRate`).
 *
 * These helpers are cheap + synchronous + never throw, so they are safe to
 * call during render in any component treating tax figures.

 */
import { getVATRate } from "@/react-app/config/pricing";
import { cloudStorageService } from "@/react-app/lib/cloud-storage-service";
import {
  getEffectiveVatRate,
  getTaxLabel,
} from "@/react-app/lib/user-preferences";

const SETTINGS_KEY = "general_settings_v1";

interface TaxConfigShim {
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
  taxIncludedInPrice?: boolean;
}

function settingsTax(): TaxConfigShim | null {
  try {
    const cfg = cloudStorageService.getCached<Record<string, unknown>>(
      SETTINGS_KEY,
      undefined,
    ) as unknown as TaxConfigShim | null;
    if (cfg && typeof cfg === "object") {
      const enabled = cfg.taxEnabled !== false;
      const rate = Number(cfg.taxRate);
      return {
        taxEnabled: enabled,
        taxRate: Number.isFinite(rate) && rate > 0 ? rate : 0,
        taxLabel: typeof cfg.taxLabel === "string" ? cfg.taxLabel : "VAT",
        taxIncludedInPrice: Boolean(cfg.taxIncludedInPrice),
      };
    }
  } catch {
    /* cache miss / malformed row — fall through */
  }
  return null;
}

/** Effective VAT rate (fraction, e.g. 0.16) honoring the owner's override. */
export function getEffectiveVatRateFor(countryCode: string): number {
  const s = settingsTax();
  if (s) {
    // Owner explicitly disabled tax → 0%.
    if (s.taxEnabled === false) return 0;
    // taxRate > 0 → owner override (percent → fraction).
    if (typeof s.taxRate === "number" && s.taxRate > 0) return s.taxRate / 100;
    // taxRate === 0 means "use country default" (per the Settings hint).
  }
  const legacy = getEffectiveVatRate();
  if (legacy > 0 && legacy <= 1) return legacy;
  if (legacy > 1) return legacy / 100;
  return getVATRate(countryCode);
}

/** Effective tax label ("VAT", "GST", "Sales Tax", ...). */
export function getEffectiveTaxLabelFor(_countryCode: string): string {
  const s = settingsTax();
  if (s?.taxLabel) return s.taxLabel;
  return getTaxLabel();
}

/** Effective tax-included-in-price flag (prices already contain tax).
 *  Defaults to TRUE: regulated fuel prices are taxed at the pump, so the
 *  POS has always backed VAT out of the item total (inclusive math). */
export function getEffectiveTaxIncludedFor(_countryCode: string): boolean {
  const s = settingsTax();
  if (s) return Boolean(s.taxIncludedInPrice);
  return true;
}

/** Effective tax enabled flag. */
export function getEffectiveTaxEnabledFor(countryCode: string): boolean {
  const s = settingsTax();
  if (s) return s.taxEnabled !== false;
  const legacy = getEffectiveVatRate();
  return legacy > 0 || getVATRate(countryCode) > 0;
}
