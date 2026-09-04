// Compliance document registry — permits, licenses & compliance requirements
// per station/user, with expiry tracking, period-based records and
// auto-renewal assistance. Metadata lives in the app_kv cloud store
// (station-scoped key below); the actual files live in the `fuelpro-files`
// Supabase Storage bucket via documentStore (category "Compliance").
import jsPDF from "jspdf";

export const COMPLIANCE_DOCS_KEY = "compliance_documents";

export interface ComplianceDocHistoryEntry {
  archivedAt: string; // ISO
  expiryDate: string; // the expiry date that was replaced
  fileName?: string;
  note?: string;
}

export interface ComplianceDocument {
  id: string;
  name: string;
  permitType: string;
  issuer: string;
  /** Optional authority contact — enables auto-renew request emailing. */
  issuerEmail?: string;
  /** ISO yyyy-mm-dd; "" when unknown. */
  issueDate: string;
  /** ISO yyyy-mm-dd; "" means "does not expire". */
  expiryDate: string;
  /** Days before expiry when alerts start. Default 30. */
  reminderDays: number;
  /** When true, an expired doc auto-generates a renewal request letter. */
  autoRenew: boolean;
  /** Default renewal span used by one-click Renew. Default 12. */
  renewalPeriodMonths: number;
  notes?: string;
  /** Storage path in the fuelpro-files bucket (undefined = no file yet). */
  filePath?: string;
  /** Public download URL of the uploaded file (bucket is public-read). */
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  /** Dedup guard: the expiryDate value the auto-renew engine last handled. */
  autoRenewedFor?: string;
  /** Storage path of the auto-generated renewal request letter. */
  renewalLetterPath?: string;
  renewalLetterUrl?: string;
  renewalRequestedAt?: string;
  history: ComplianceDocHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ComplianceDocStatus =
  "active" | "expiring" | "expired" | "no-expiry" | "renewal-pending";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilExpiry(
  doc: Pick<ComplianceDocument, "expiryDate">,
  now: Date = new Date(),
): number | null {
  if (!doc.expiryDate) return null;
  const exp = new Date(doc.expiryDate + "T23:59:59");
  if (Number.isNaN(exp.getTime())) return null;
  return Math.floor((exp.getTime() - now.getTime()) / DAY_MS);
}

export function computeDocStatus(
  doc: Pick<
    ComplianceDocument,
    "expiryDate" | "reminderDays" | "renewalRequestedAt" | "autoRenewedFor"
  >,
  now: Date = new Date(),
): { status: ComplianceDocStatus; daysLeft: number | null } {
  const daysLeft = daysUntilExpiry(doc, now);
  if (daysLeft === null) return { status: "no-expiry", daysLeft: null };
  if (
    doc.renewalRequestedAt &&
    doc.autoRenewedFor === doc.expiryDate &&
    daysLeft < 0
  ) {
    return { status: "renewal-pending", daysLeft };
  }
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= (doc.reminderDays || 30))
    return { status: "expiring", daysLeft };
  return { status: "active", daysLeft };
}

export const STATUS_META: Record<
  ComplianceDocStatus,
  { label: string; badge: string }
> = {
  active: { label: "Active", badge: "bg-emerald-100 text-emerald-700" },
  expiring: { label: "Expiring soon", badge: "bg-amber-100 text-amber-700" },
  expired: { label: "Expired", badge: "bg-red-100 text-red-700" },
  "no-expiry": { label: "No expiry", badge: "bg-gray-100 text-gray-600" },
  "renewal-pending": {
    label: "Renewal pending",
    badge: "bg-indigo-100 text-indigo-700",
  },
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function compliancePeriodLabel(month: number, year: number): string {
  return `${MONTHS[(month - 1 + 12) % 12] ?? ""} ${year}`.trim();
}

/** Parse an ISO yyyy-mm-dd date into a { month, year } period (1-based). */
export function dateToPeriod(
  iso: string,
): { month: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso || "");
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function newComplianceDoc(
  partial: Partial<ComplianceDocument> = {},
): ComplianceDocument {
  const now = new Date().toISOString();
  return {
    id: `cdoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    permitType: "",
    issuer: "",
    issuerEmail: "",
    issueDate: "",
    expiryDate: "",
    reminderDays: 30,
    autoRenew: false,
    renewalPeriodMonths: 12,
    notes: "",
    history: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function upsertComplianceDoc(
  list: ComplianceDocument[],
  doc: ComplianceDocument,
): ComplianceDocument[] {
  const idx = list.findIndex((d) => d.id === doc.id);
  const next = [...list];
  if (idx >= 0) next[idx] = { ...doc, updatedAt: new Date().toISOString() };
  else next.unshift(doc);
  return next;
}

export function removeComplianceDoc(
  list: ComplianceDocument[],
  id: string,
): ComplianceDocument[] {
  return list.filter((d) => d.id !== id);
}

/**
 * Period-based record filtering (task: records per month/year). A document
 * matches a period when EITHER its expiry OR its issue date falls in it, so
 * "permits expiring in August 2026" and "permits issued in 2025" both work.
 */
export function filterComplianceDocs(
  docs: ComplianceDocument[],
  opts: {
    search?: string;
    month?: number | "";
    year?: number | "";
    status?: ComplianceDocStatus | "";
  },
  now: Date = new Date(),
): ComplianceDocument[] {
  const q = (opts.search || "").trim().toLowerCase();
  return docs.filter((d) => {
    if (q) {
      const hay =
        `${d.name} ${d.permitType} ${d.issuer} ${d.notes ?? ""} ${d.fileName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (opts.month !== undefined && opts.month !== "") {
      const expiry = dateToPeriod(d.expiryDate);
      const issue = dateToPeriod(d.issueDate);
      const m = opts.month as number;
      const matchExpiry = expiry && expiry.month === m;
      const matchIssue = issue && issue.month === m;
      if (!matchExpiry && !matchIssue) return false;
    }
    if (opts.year !== undefined && opts.year !== "") {
      const expiry = dateToPeriod(d.expiryDate);
      const issue = dateToPeriod(d.issueDate);
      const y = opts.year as number;
      const matchExpiry = expiry && expiry.year === y;
      const matchIssue = issue && issue.year === y;
      const matchCreated = new Date(d.createdAt).getFullYear() === y;
      if (!matchExpiry && !matchIssue && !matchCreated) return false;
    }
    if (opts.status) {
      const status = computeDocStatus(d, now).status;
      // "Expired" is the umbrella view: anything past its expiry date,
      // including docs whose renewal request is still pending.
      if (opts.status === "expired") {
        if (status !== "expired" && status !== "renewal-pending") return false;
      } else if (status !== opts.status) {
        return false;
      }
    }
    return true;
  });
}

/** True when an expired doc has auto-renew enabled and hasn't been handled. */
export function needsAutoRenewal(
  doc: ComplianceDocument,
  now: Date = new Date(),
): boolean {
  if (!doc.autoRenew) return false;
  const daysLeft = daysUntilExpiry(doc, now);
  if (daysLeft === null || daysLeft >= 0) return false;
  return doc.autoRenewedFor !== doc.expiryDate;
}

/** Roll an expiry date forward by N months (clamped to month end). */
export function rollExpiry(fromIso: string, months: number): string {
  const base = fromIso ? new Date(fromIso + "T00:00:00") : new Date();
  const valid = Number.isNaN(base.getTime()) ? new Date() : base;
  const d = new Date(valid.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0); // clamp to last day of target month
  return d.toISOString().slice(0, 10);
}

/**
 * Generate a renewal application letter PDF for an expired/expiring document,
 * addressed to the issuing authority, pre-filled with the station's identity.
 * Returns the jsPDF document (caller saves/uploads/sends).
 */
export function buildRenewalLetterPdf(opts: {
  doc: ComplianceDocument;
  stationName: string;
  stationAddress?: string;
  stationPhone?: string;
  stationEmail?: string;
}): jsPDF {
  const { doc } = opts;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(opts.stationName || "Fuel Station", pageW / 2, 20, {
    align: "center",
  });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const contact = [opts.stationAddress, opts.stationPhone, opts.stationEmail]
    .filter(Boolean)
    .join("  ·  ");
  if (contact) pdf.text(contact, pageW / 2, 27, { align: "center" });
  pdf.setLineWidth(0.5);
  pdf.line(20, 31, pageW - 20, 31);

  pdf.setFontSize(10);
  pdf.text(today, pageW - 20, 42, { align: "right" });
  pdf.text(
    [
      "To:",
      doc.issuer || "The Issuing Authority",
      doc.issuerEmail ? `Email: ${doc.issuerEmail}` : "",
    ].filter(Boolean),
    20,
    48,
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(
    `RE: APPLICATION FOR RENEWAL — ${(doc.name || doc.permitType || "PERMIT").toUpperCase()}`,
    20,
    72,
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const body = [
    `We hereby apply for the renewal of the above-referenced ${
      doc.permitType || "permit/license"
    } held by ${opts.stationName || "our station"}.`,
    "",
    `Document:        ${doc.name || "-"}`,
    `Type:              ${doc.permitType || "-"}`,
    `Issued by:       ${doc.issuer || "-"}`,
    `Issue date:     ${doc.issueDate || "-"}`,
    `Expiry date:   ${doc.expiryDate || "-"}`,
    "",
    "The document has reached (or is approaching) its expiry date. Kindly",
    "process our renewal at the earliest convenience and advise on any fees",
    "or further documentation required from our side.",
    "",
    "We remain available for any inspection or clarification.",
    "",
    "Yours faithfully,",
    "",
    "____________________________",
    "Authorized Signatory",
    opts.stationName || "",
  ];
  pdf.text(body, 20, 84);
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  pdf.text(
    "Generated automatically by FuelPro Compliance auto-renewal.",
    pageW / 2,
    290,
    { align: "center" },
  );
  return pdf;
}

/** Summary counts for the stats strip. */
export function summarizeComplianceDocs(
  docs: ComplianceDocument[],
  now: Date = new Date(),
): { total: number; active: number; expiring: number; expired: number } {
  const s = { total: docs.length, active: 0, expiring: 0, expired: 0 };
  for (const d of docs) {
    const { status } = computeDocStatus(d, now);
    if (status === "active" || status === "no-expiry") s.active++;
    else if (status === "expiring") s.expiring++;
    else s.expired++; // expired + renewal-pending
  }
  return s;
}
