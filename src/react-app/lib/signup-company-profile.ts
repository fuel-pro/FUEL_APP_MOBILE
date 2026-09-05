/**
 * signup-company-profile — the company details a user enters during signup
 * (AuthLogin) so they are NOT orphaned. AuthLogin persists them to the
 * `company_profile` cloud key + the `fuelpro_company_profile` localStorage
 * cache, but nothing read them — the SetupWizard (and therefore FuelContext
 * companyData) started blank, so "data set at signup" never showed up.
 *
 * This module is the single reader. SetupWizard prefills its form from here
 * on first run; the wizard's SET_COMPANY_DATA then carries the values into
 * the authoritative FuelContext companyData.
 */

export interface SignupCompanyProfile {
  name?: string;
  phone?: string;
  address?: string;
  industry?: string;
  regNo?: string;
  taxId?: string;
  createdAt?: string;
}

const LOCAL_KEY = "fuelpro_company_profile";
const CLOUD_KEY = "company_profile";

/** Synchronous read from the localStorage cache (written by AuthLogin). */
export function getCachedSignupProfile(): SignupCompanyProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Async read from the cloud KV (cross-device), falling back to the cache. */
export async function getSignupProfile(): Promise<SignupCompanyProfile | null> {
  try {
    const { default: cloudStorageService } =
      await import("@/react-app/lib/cloud-storage-service");
    const cloud =
      await cloudStorageService.get<SignupCompanyProfile>(CLOUD_KEY);
    if (cloud && typeof cloud === "object") return cloud;
  } catch {
    /* fall through to the cache */
  }
  return getCachedSignupProfile();
}
