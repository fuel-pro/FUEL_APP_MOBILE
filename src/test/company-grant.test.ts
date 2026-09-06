import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateGrantCode,
  buildGrantLink,
  redeemCompanyGrant,
  GRANT_TAB_PRESETS,
} from "@/react-app/lib/company-grant-service";

// The redeem path calls getSupabaseClient().rpc(...) — stub it so we can
// exercise the success / failure / locked branches without a network.
const rpcMock = vi.fn();
vi.mock("@/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => ({
        data: { session: { user: { id: "owner-1" } } },
      })),
    },
    rpc: rpcMock,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({ error: null })),
      delete: vi.fn(() => ({ error: null })),
    })),
  })),
  supabase: {},
}));

describe("generateGrantCode", () => {
  it("produces a 18-char URL-safe code from the unambiguous alphabet", () => {
    const code = generateGrantCode();
    expect(code).toHaveLength(18);
    expect(code).toMatch(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789]+$/,
    );
  });

  it("is unique across many draws (crypto-random, ~93 bits)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(generateGrantCode());
    expect(seen.size).toBe(2000);
  });
});

describe("buildGrantLink", () => {
  it("encodes the grant code into the station-access hash route", () => {
    const link = buildGrantLink("AbC123");
    expect(link).toContain("/#/station-access?grant=AbC123");
  });

  it("URL-encodes the code so special chars never break the link", () => {
    const link = buildGrantLink("a b&c");
    expect(link).toContain(encodeURIComponent("a b&c"));
  });
});

describe("GRANT_TAB_PRESETS", () => {
  it("has an 'all sections' preset with an empty tab list (empty = all)", () => {
    const all = GRANT_TAB_PRESETS.find((p) => p.id === "all");
    expect(all).toBeDefined();
    expect(all!.tabs).toEqual([]);
  });

  it("presets are unique by id", () => {
    const ids = GRANT_TAB_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("redeemCompanyGrant", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns null for empty/whitespace codes", async () => {
    expect(await redeemCompanyGrant("")).toBeNull();
    expect(await redeemCompanyGrant("   ")).toBeNull();
  });

  it("returns null when the RPC reports no row (invalid/revoked/expired)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    expect(await redeemCompanyGrant("nope")).toBeNull();
  });

  it("returns null when the RPC errors (e.g. RPC not deployed yet)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "PGRST202" } });
    expect(await redeemCompanyGrant("abc")).toBeNull();
  });

  it("returns the access config on a successful redeem", async () => {
    rpcMock.mockResolvedValue({
      data: {
        grantId: "grant_1",
        memberName: "QA Tester",
        memberRole: "Manager",
        allowedTabs: ["dashboard", "pos"],
        readOnly: true,
        stationId: "station-1",
        stationOwnerId: "owner-1",
        expiresAt: "2026-10-01T00:00:00Z",
      },
      error: null,
    });
    const res = await redeemCompanyGrant("RealCode123");
    expect(res).not.toBeNull();
    expect(res!.stationId).toBe("station-1");
    expect(res!.stationOwnerId).toBe("owner-1");
    expect(res!.allowedTabs).toEqual(["dashboard", "pos"]);
    expect(res!.readOnly).toBe(true);
  });

  it("throws a clear error when the grant is brute-force locked", async () => {
    rpcMock.mockResolvedValue({
      data: { locked: true, retryAfter: "2026-09-06T00:00:00Z" },
      error: null,
    });
    await expect(redeemCompanyGrant("locked")).rejects.toThrow(/locked/i);
  });
});
