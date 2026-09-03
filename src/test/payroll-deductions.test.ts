import { describe, it, expect } from "vitest";
import {
  calcNetPay,
  deductionAmountFor,
  normalizeCustomDeductions,
  normalizeDeductionTypes,
  setDeductionAmount,
} from "@/react-app/lib/payroll-deductions";

describe("normalizeDeductionTypes", () => {
  it("returns [] for non-arrays", () => {
    expect(normalizeDeductionTypes(null)).toEqual([]);
    expect(normalizeDeductionTypes(undefined)).toEqual([]);
    expect(normalizeDeductionTypes("x")).toEqual([]);
  });

  it("keeps valid entries and drops incomplete ones", () => {
    expect(
      normalizeDeductionTypes([
        { id: "ded_1", label: "HELB Loan" },
        { id: "ded_2", label: "" }, // empty label dropped
        { label: "No ID" }, // no id dropped
        null,
      ]),
    ).toEqual([{ id: "ded_1", label: "HELB Loan" }]);
  });
});

describe("normalizeCustomDeductions", () => {
  it("returns [] for non-arrays", () => {
    expect(normalizeCustomDeductions(null)).toEqual([]);
    expect(normalizeCustomDeductions({})).toEqual([]);
  });

  it("accepts snake_case type_id and string amounts", () => {
    expect(
      normalizeCustomDeductions([
        { type_id: "ded_1", amount: "250.5" },
        { typeId: "ded_2", amount: 100 },
      ]),
    ).toEqual([
      { typeId: "ded_1", amount: 250.5 },
      { typeId: "ded_2", amount: 100 },
    ]);
  });

  it("drops entries with no typeId and coerces NaN amounts to 0", () => {
    expect(
      normalizeCustomDeductions([
        { amount: 50 }, // no typeId dropped
        { typeId: "ded_1", amount: "abc" },
      ]),
    ).toEqual([{ typeId: "ded_1", amount: 0 }]);
  });
});

describe("calcNetPay with custom deductions", () => {
  it("subtracts custom deductions in addition to sha/nssf/advance", () => {
    expect(
      calcNetPay({
        basicSalary: 45000,
        advance: 2500,
        sha: 1237.5,
        nssf: 480,
        customDeductions: [
          { typeId: "ded_helb", amount: 2000 },
          { typeId: "ded_union", amount: 300 },
        ],
      }),
    ).toBe(38482.5);
  });

  it("is unchanged when no custom deductions exist (backwards compatible)", () => {
    expect(
      calcNetPay({ basicSalary: 45000, advance: 0, sha: 1237.5, nssf: 480 }),
    ).toBe(43282.5);
  });

  it("guards NaN / Infinity inputs", () => {
    expect(
      calcNetPay({
        basicSalary: NaN,
        advance: Infinity,
        sha: 100,
        nssf: 50,
        customDeductions: [{ typeId: "ded_1", amount: NaN }],
      }),
    ).toBe(-150);
  });
});

describe("deductionAmountFor / setDeductionAmount", () => {
  it("returns 0 for an absent type", () => {
    expect(deductionAmountFor(undefined, "ded_1")).toBe(0);
    expect(deductionAmountFor([], "ded_1")).toBe(0);
  });

  it("sets a new type amount without dropping existing ones", () => {
    const next = setDeductionAmount(
      [{ typeId: "ded_1", amount: 100 }],
      "ded_2",
      250,
    );
    expect(next).toEqual([
      { typeId: "ded_1", amount: 100 },
      { typeId: "ded_2", amount: 250 },
    ]);
  });

  it("updates an existing type amount in place", () => {
    const next = setDeductionAmount(
      [
        { typeId: "ded_1", amount: 100 },
        { typeId: "ded_2", amount: 250 },
      ],
      "ded_2",
      300,
    );
    expect(next).toEqual([
      { typeId: "ded_1", amount: 100 },
      { typeId: "ded_2", amount: 300 },
    ]);
    expect(deductionAmountFor(next, "ded_2")).toBe(300);
  });
});
