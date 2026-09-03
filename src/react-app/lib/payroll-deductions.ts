/**
 * Station-defined custom deduction types ("STATUTORY & OTHER DEDUCTIONS"):
 * the payroll table's built-in columns are SHA, NSSF and Advance; a station
 * can add/remove its own deduction columns (e.g. HELB Loan, Union Dues,
 * Insurance). The type registry lives in payroll settings; per-employee
 * amounts live on each employee record.
 */

/** A station-defined custom deduction type (e.g. HELB Loan, Union Dues). */
export interface DeductionType {
  id: string;
  label: string;
}

/** Per-employee amount for a custom deduction type. */
export interface CustomDeduction {
  typeId: string;
  amount: number;
}

// Normalize a raw custom-deductions list (from cloud/localStorage) into a
// clean [{typeId, amount}] array — guards against partial/corrupt records.
export function normalizeCustomDeductions(raw: unknown): CustomDeduction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d) => ({
      typeId: String(d.typeId ?? d.type_id ?? ""),
      amount:
        typeof d.amount === "number"
          ? d.amount
          : parseFloat(String(d.amount)) || 0,
    }))
    .filter((d) => d.typeId !== "");
}

// Normalize a raw deduction-types list (from cloud/localStorage) into a
// clean DeductionType[] — guards against partial/corrupt records.
export function normalizeDeductionTypes(raw: unknown): DeductionType[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d) => ({
      id: String(d.id ?? ""),
      label: String(d.label ?? "").trim(),
    }))
    .filter((d) => d.id !== "" && d.label !== "");
}

/**
 * Single source of truth for net pay: basic − advance − sha − nssf − custom
 * deductions. Guards against NaN / Infinity (bad parse, missing field).
 */
export function calcNetPay(emp: {
  basicSalary: number;
  advance: number;
  sha: number;
  nssf: number;
  customDeductions?: CustomDeduction[];
}): number {
  const basic = Number.isFinite(emp.basicSalary) ? emp.basicSalary : 0;
  const advance = Number.isFinite(emp.advance) ? emp.advance : 0;
  const sha = Number.isFinite(emp.sha) ? emp.sha : 0;
  const nssf = Number.isFinite(emp.nssf) ? emp.nssf : 0;
  const custom = (emp.customDeductions ?? []).reduce(
    (s, d) => s + (Number.isFinite(d.amount) ? d.amount : 0),
    0,
  );
  return Math.round((basic - advance - sha - nssf - custom) * 100) / 100;
}

/** The employee's amount for a given deduction type (0 when absent). */
export function deductionAmountFor(
  customDeductions: CustomDeduction[] | undefined,
  typeId: string,
): number {
  return (customDeductions ?? []).find((d) => d.typeId === typeId)?.amount ?? 0;
}

/** Upsert an employee's amount for a deduction type (returns a new array). */
export function setDeductionAmount(
  customDeductions: CustomDeduction[] | undefined,
  typeId: string,
  amount: number,
): CustomDeduction[] {
  const existing = customDeductions ?? [];
  const idx = existing.findIndex((d) => d.typeId === typeId);
  return idx >= 0
    ? existing.map((d, i) => (i === idx ? { ...d, amount } : d))
    : [...existing, { typeId, amount }];
}
