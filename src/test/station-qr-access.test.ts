/**
 * station-qr-access.test.ts
 * Pure-helper tests for the secure Company QR access grants.
 *
 * The table CRUD + redeem RPC require a live Supabase (DB + migration 027),
 * so those are exercised manually/integration. This file locks the pure,
 * deterministic logic: token generation, deep-link building, expiry
 * formatting and grant-activity (expiry/enabled/maxUses) evaluation.
 */
import { describe, it, expect } from "vitest";
import {
  generateQrToken,
  buildQrGrantUrl,
  formatGrantExpiry,
  isGrantActive,
  type StationQrGrant,
} from "@/react-app/lib/station-qr-access-service";

function grant(overrides: Partial<StationQrGrant> = {}): StationQrGrant {
  return {
    token: "tok",
    stationId: "station-1",
    ownerId: "owner-1",
    memberLabel: "Guest",
    memberRole: "Guest",
    allowedTabs: [],
    readOnly: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    maxUses: 0,
    usedCount: 0,
    enabled: true,
    note: "",
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    ...overrides,
  };
}

describe("generateQrToken", () => {
  it("returns a URL-safe opaque token (base64url) of ~43 chars", () => {
    const a = generateQrToken();
    const b = generateQrToken();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toContain("+");
    expect(a).not.toContain("/");
    expect(a).not.toContain("=");
    expect(a).not.toBe(b);
  });
});

describe("buildQrGrantUrl", () => {
  it("builds the deep link with token + station id", () => {
    const url = buildQrGrantUrl(
      "tok-abc",
      "station-9",
      "https://fuel-app-mobile.vercel.app",
    );
    expect(url).toContain(
      "https://fuel-app-mobile.vercel.app/#/station-access",
    );
    expect(url).toContain("qr=tok-abc");
    expect(url).toContain("sid=station-9");
  });

  it("always produces the station-access path + token + station id", () => {
    // In jsdom, window.location.origin is the test host (http://localhost:3000).
    // What matters is the deep-link shape: path + qr token + sid.
    const url = buildQrGrantUrl("tok", "s1");
    expect(url).toContain("/#/station-access?qr=tok&sid=s1");
  });
});

describe("formatGrantExpiry", () => {
  it("formats a valid ISO date", () => {
    const iso = new Date(Date.now() + 60_000).toISOString();
    expect(formatGrantExpiry(iso)).not.toBe("");
  });

  it("returns empty for invalid/empty input", () => {
    expect(formatGrantExpiry("")).toBe("");
    expect(formatGrantExpiry("not-a-date")).toBe("");
  });
});

describe("isGrantActive", () => {
  it("is active for a fresh unlimited grant", () => {
    expect(isGrantActive(grant())).toBe(true);
  });

  it("rejects disabled grants", () => {
    expect(isGrantActive(grant({ enabled: false }))).toBe(false);
  });

  it("rejects expired grants", () => {
    expect(
      isGrantActive(
        grant({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
      ),
    ).toBe(false);
  });

  it("rejects grants whose maxUses is reached", () => {
    expect(isGrantActive(grant({ maxUses: 3, usedCount: 3 }))).toBe(false);
    expect(isGrantActive(grant({ maxUses: 3, usedCount: 2 }))).toBe(true);
  });
});
