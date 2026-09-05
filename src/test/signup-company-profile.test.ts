import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedSignupProfile } from "@/react-app/lib/signup-company-profile";

const LOCAL_KEY = "fuelpro_company_profile";

describe("signup company profile (why signup data must show up later)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("reads the localStorage cache written by AuthLogin", () => {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({
        name: "Acme Fuels",
        phone: "+254700123456",
        address: "45 Main Street, Nairobi",
        regNo: "REG-001",
        taxId: "P051234567X",
      }),
    );
    const p = getCachedSignupProfile();
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Acme Fuels");
    expect(p!.phone).toBe("+254700123456");
    expect(p!.taxId).toBe("P051234567X");
  });

  it("returns null when no profile was saved", () => {
    expect(getCachedSignupProfile()).toBeNull();
  });

  it("returns null for corrupt cache instead of throwing", () => {
    localStorage.setItem(LOCAL_KEY, "{not json!{{");
    expect(getCachedSignupProfile()).toBeNull();
  });

  it("prefers the cloud copy and falls back to the cache on cloud errors", async () => {
    const cloudGet = vi
      .fn()
      .mockResolvedValue({ name: "Cloud Fuels", phone: "123" });
    const cloudService = { get: cloudGet };
    vi.doMock("@/react-app/lib/cloud-storage-service", () => ({
      default: cloudService,
    }));
    const { getSignupProfile: gsp } =
      await import("@/react-app/lib/signup-company-profile");
    const p = await gsp();
    expect(p?.name).toBe("Cloud Fuels");
    expect(cloudGet).toHaveBeenCalledWith("company_profile");
  });

  it("falls back to the local cache when cloud read fails", async () => {
    vi.doMock("@/react-app/lib/cloud-storage-service", () => ({
      default: {
        get: vi.fn().mockRejectedValue(new Error("network down")),
      },
    }));
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ name: "Local Fuels" }));
    const { getSignupProfile: gsp } =
      await import("@/react-app/lib/signup-company-profile");
    const p = await gsp();
    expect(p?.name).toBe("Local Fuels");
  });
});
