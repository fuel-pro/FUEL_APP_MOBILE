import { describe, it, expect } from "vitest";
import {
  normalizeAccessMode,
  accessModeLabel,
} from "@/react-app/lib/station-access-code-service";

describe("access-code access modes", () => {
  it("normalizes mode values (read / edit / full, case + junk tolerant)", () => {
    expect(normalizeAccessMode("read")).toBe("read");
    expect(normalizeAccessMode("edit")).toBe("edit");
    expect(normalizeAccessMode("full")).toBe("full");
    expect(normalizeAccessMode("READ")).toBe("read");
    expect(normalizeAccessMode("Edit")).toBe("edit");
    expect(normalizeAccessMode(undefined)).toBe("read");
    expect(normalizeAccessMode(null)).toBe("read");
    expect(normalizeAccessMode("junk")).toBe("read");
    expect(normalizeAccessMode("")).toBe("read");
  });

  it("labels modes for UI badges", () => {
    expect(accessModeLabel("read")).toContain("Read");
    expect(accessModeLabel("edit")).toContain("Edit");
    expect(accessModeLabel("full")).toContain("Normal");
    expect(accessModeLabel(undefined)).toContain("Read");
    expect(accessModeLabel(null)).toContain("Read");
  });
});
