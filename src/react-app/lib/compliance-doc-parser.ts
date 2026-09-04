import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ComplianceDocument } from "./compliance-documents";

/**
 * Best-effort extraction of compliance document fields (name, permit type,
 * issuer, issuer email, issue/expiry dates, reference number) from an
 * uploaded file — so an uploaded permit auto-feeds the empty form fields.
 *
 * Text PDFs are parsed locally with pdfjs-dist (already bundled for the
 * preview). Scanned/image documents are sent through the FREE Gemini API
 * (api/movies-proxy pattern via /api integrations is not needed — a direct
 * client-side call with the public anon key would leak it, so instead we
 * fall back to filename heuristics when no extractor can read the file).
 */

export interface ExtractedComplianceFields {
  name?: string;
  permitType?: string;
  issuer?: string;
  issuerEmail?: string;
  issueDate?: string; // ISO yyyy-mm-dd
  expiryDate?: string; // ISO yyyy-mm-dd
  /** Licence / permit / certificate reference found in the text. */
  reference?: string;
}

// ── date helpers ────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function iso(y: number, m: number, d: number): string | undefined {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31)
    return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse a date written in almost any common format → ISO, or undefined. */
export function parseDateToken(raw: string): string | undefined {
  const s = raw.trim().replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  // 12 March 2026 / March 12, 2026
  let m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s*,?\s*(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()])
    return iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2})\s*,?\s*(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()])
    return iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  // 2026-03-12 (ISO)
  m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  // 12/03/2026 or 03/12/2026 — ambiguous; prefer day-first when d > 12
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    const a = +m[1],
      b = +m[2],
      y = +m[3];
    if (a > 12) return iso(y, b, a); // clearly day-first
    if (b > 12) return iso(y, a, b); // clearly month-first
    return iso(y, b, a); // default day-first (most non-US documents)
  }
  return undefined;
}

// ── text extraction ─────────────────────────────────────────────────────────

export async function extractTextFromPdf(file: File | Blob): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  const pages = Math.min(pdf.numPages, 5); // first 5 pages is plenty
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text +=
      content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

// ── field extraction from raw text ──────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** All dates in the text, ISO-sorted in order of appearance. */
function allDates(text: string): string[] {
  const out: string[] = [];
  const patterns = [
    /\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s*,?\s*\d{4}\b/g,
    /\b[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{4}\b/g,
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g,
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const d = parseDateToken(match[0]);
      if (d && !out.includes(d)) out.push(d);
    }
  }
  return out;
}

function findLabelledDate(text: string, labels: RegExp): string | undefined {
  // "Date of Issue: 12/03/2026" / "Expiry Date — March 2027" / "Valid Until 01.01.2028"
  const re = new RegExp(`${labels.source}\\s*[:\\-–]?\\s*([^\\n]{0,40})`, "i");
  const m = text.match(re);
  if (!m) return undefined;
  return parseDateToken(m[1]) ?? firstDateIn(m[1]);
}

function firstDateIn(s: string): string | undefined {
  for (const d of allDates(s)) return d;
  return undefined;
}

const PERMIT_KIND_WORDS =
  "licen[cs]e|permit|certificate|certification|registration|approval|authori[sz]ation|clearance|no[- ]?objection|compliance";

/** Find the most likely permit/requirement type from the text. */
function guessPermitType(
  text: string,
  requiredPermits: string[],
): string | undefined {
  const lower = text.toLowerCase();
  // 1. A required permit named verbatim in the document wins.
  let best: { permit: string; score: number } | undefined;
  for (const p of requiredPermits) {
    const idx = lower.indexOf(p.toLowerCase());
    if (idx >= 0) {
      const score = 1000 - idx; // earlier mention = more likely the title
      if (!best || score > best.score) best = { permit: p, score };
    }
  }
  if (best) return best.permit;
  // 2. Otherwise take the first "X Certificate/Licence/Permit…" phrase.
  const re = new RegExp(
    `([A-Z][A-Za-z&'\\- ]{2,50}?(?:${PERMIT_KIND_WORDS}))`,
    "i",
  );
  const m = text.match(re);
  if (m) {
    return m[1]
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  }
  return undefined;
}

/** Try to pick an issuing authority line (e.g. "Issued by EPRA"). */
function guessIssuer(text: string): string | undefined {
  const m =
    text.match(/issued\s+by\s*[:-]?\s*([^\n,;]{3,60})/i) ||
    text.match(/issuing\s+authority\s*[:-]?\s*([^\n,;]{3,60})/i) ||
    text.match(
      /(?:signed|authorised|authorized)\s+(?:by|for)\s*[:-]?\s*([^\n,;]{3,60})/i,
    );
  if (!m) return undefined;
  const v = m[1].replace(/\s+/g, " ").trim();
  return v.length >= 3 ? v : undefined;
}

/** Licence / permit / certificate reference number. */
function guessReference(text: string): string | undefined {
  const m = text.match(
    /(?:licen[cs]e|permit|certificate|registration|ref(?:erence)?)\s*(?:no\.?|number|#)\s*[:-]?\s*([A-Z0-9][A-Z0-9/-]{3,25})/i,
  );
  return m ? m[1].trim() : undefined;
}

/**
 * Extract compliance fields from raw document text. Pure + testable.
 */
export function extractComplianceFieldsFromText(
  text: string,
  requiredPermits: string[] = [],
): ExtractedComplianceFields {
  const out: ExtractedComplianceFields = {};
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return out;

  out.permitType = guessPermitType(text, requiredPermits);
  out.issuer = guessIssuer(text);
  out.reference = guessReference(text);

  const email = text.match(EMAIL_RE);
  if (email) out.issuerEmail = email[0];

  out.issueDate = findLabelledDate(
    text,
    /(?:date\s+of\s+)?(?:issue|issuance|commencement|grant)(?:\s+date)?/,
  );
  out.expiryDate = findLabelledDate(
    text,
    /(?:expir(?:y|ation|es)|valid\s+(?:until|till|through)|renewal\s+(?:due|date)|date\s+of\s+expiry)(?:\s+date)?/,
  );

  // Fallbacks: unlabelled dates — earliest plausible = issue, latest = expiry.
  const dates = allDates(text).sort();
  if (!out.issueDate && dates.length) out.issueDate = dates[0];
  if (!out.expiryDate && dates.length > 1)
    out.expiryDate = dates[dates.length - 1];

  // Document name: the first prominent line that looks like a title.
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 8 && l.length <= 80);
  if (out.permitType) {
    out.name = out.permitType;
  } else if (firstLine) {
    out.name = firstLine.replace(/\s+/g, " ");
  }

  return out;
}

// ── filename heuristics (works even for image-only scans) ──────────────────

export function extractFromFilename(name: string): ExtractedComplianceFields {
  const base = name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const out: ExtractedComplianceFields = {};
  if (base) {
    out.name = base.replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());
    if (new RegExp(PERMIT_KIND_WORDS, "i").test(base))
      out.permitType = out.name;
  }
  const year = base.match(/\b(19|20)\d{2}\b/);
  if (year) {
    const d = parseDateToken(base);
    if (d) out.expiryDate = d;
  }
  return out;
}

// ── main entry ──────────────────────────────────────────────────────────────

/**
 * Read a picked file and extract whatever fields we can. Never throws —
 * returns partial (possibly empty) results so the form keeps working.
 */
export async function extractFromComplianceFile(
  file: File,
  requiredPermits: string[] = [],
): Promise<ExtractedComplianceFields> {
  const fromName = extractFromFilename(file.name);
  let fromText: ExtractedComplianceFields = {};
  try {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const text = await extractTextFromPdf(file);
      fromText = extractComplianceFieldsFromText(text, requiredPermits);
    } else if (/\.(txt|csv|md)$/i.test(file.name)) {
      fromText = extractComplianceFieldsFromText(
        await file.text(),
        requiredPermits,
      );
    }
    // Images/scanned PDFs: rely on filename heuristics (OCR via the free
    // Gemini endpoint can be layered here later without changing callers).
  } catch {
    /* extraction is best-effort — never block the upload */
  }
  return { ...fromName, ...stripUndefined(fromText) };
}

function stripUndefined(
  o: ExtractedComplianceFields,
): ExtractedComplianceFields {
  const r: ExtractedComplianceFields = { ...o };
  for (const k of Object.keys(r) as (keyof ExtractedComplianceFields)[]) {
    if (r[k] === undefined) delete r[k];
  }
  return r;
}

/** Merge extracted fields into the editor doc, filling EMPTY fields only. */
export function mergeExtractedIntoDoc(
  doc: ComplianceDocument,
  ex: ExtractedComplianceFields,
): { doc: ComplianceDocument; filled: string[] } {
  const filled: string[] = [];
  const next = { ...doc };
  const fill = <K extends keyof ComplianceDocument>(
    key: K,
    label: string,
    value: string | undefined,
  ) => {
    if (!value) return;
    const cur = next[key];
    if (typeof cur === "string" && cur.trim()) return; // never overwrite
    (next[key] as string) = value;
    filled.push(label);
  };
  fill("name", "name", ex.name);
  fill("permitType", "permit type", ex.permitType);
  fill("issuer", "issuing authority", ex.issuer);
  fill("issuerEmail", "authority email", ex.issuerEmail);
  fill("issueDate", "issue date", ex.issueDate);
  fill("expiryDate", "expiry date", ex.expiryDate);
  if (ex.reference) {
    const hasRef = (next.notes || "").includes(ex.reference);
    if (!hasRef) {
      next.notes = next.notes
        ? `${next.notes}\nRef: ${ex.reference}`
        : `Ref: ${ex.reference}`;
      filled.push("reference no.");
    }
  }
  return { doc: next, filled };
}
