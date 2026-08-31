/**
 * Payslip delivery service — generates-uploads-sends employee payslip PDFs
 * via the real integrations dispatcher (email with PDF attachment, WhatsApp
 * document message with a public link). Recipients are identified from the
 * employee's OWN payroll record (phone / email) — no manual re-entry.
 */
import { getSupabaseClient } from "@/supabase/client";
import { getDetectedCountryCode } from "./currency";

export type PayslipChannel = "email" | "whatsapp" | "both";

export interface PayslipDeliveryConfig {
  enabled: boolean;
  channel: PayslipChannel;
  /** Day of month (1–28) to auto-send payslips. */
  sendDay: number;
  /** Auto-send on the configured day when the app is open. */
  autoSend: boolean;
  /** Last period key ("YYYY-MM") auto-sent, to avoid duplicates. */
  lastAutoSentPeriod: string;
}

export const PAYSLIP_CONFIG_KEY = "payroll_payslip_config";
export const PAYSLIP_LOG_KEY = "payroll_payslip_log";

export const defaultPayslipConfig: PayslipDeliveryConfig = {
  enabled: false,
  channel: "email",
  sendDay: 1,
  autoSend: false,
  lastAutoSentPeriod: "",
};

export interface PayslipSendLogEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string; // "August 2026"
  channel: PayslipChannel;
  recipient: string; // masked email/phone
  status: "sent" | "failed" | "pending";
  error?: string;
  sentAt: string;
  manual: boolean;
}

const DIALING_CODES: Record<string, string> = {
  KE: "254",
  UG: "256",
  TZ: "255",
  RW: "250",
  GH: "233",
  NG: "234",
  ZA: "27",
  US: "1",
  GB: "44",
  IN: "91",
  PH: "63",
  MY: "60",
  CN: "86",
  JP: "81",
  KR: "82",
  AU: "61",
  NZ: "64",
  CA: "1",
  BR: "55",
  MX: "52",
  AR: "54",
  CL: "56",
  CO: "57",
  PE: "51",
  TR: "90",
  RU: "7",
  DE: "49",
  FR: "33",
  IT: "39",
  ES: "34",
  NL: "31",
  PT: "351",
  SE: "46",
  NO: "47",
  DK: "45",
  FI: "358",
  PL: "48",
  AE: "971",
  SA: "966",
  EG: "20",
  PK: "92",
  BD: "880",
  TH: "66",
  VN: "84",
};

/**
 * Normalize a payroll phone number to an international E.164-ish digit string
 * for WhatsApp/M-PESA-style recipients. Handles leading-0 local format.
 */
export function normalizePhoneForSending(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  // Already international (no leading 0, has the country dialing code length)
  if (!digits.startsWith("0")) return digits;
  const cc = getDetectedCountryCode();
  const dialing = DIALING_CODES[cc] || "";
  return dialing + digits.slice(1);
}

export function maskRecipient(v: string): string {
  if (!v) return "";
  if (v.includes("@")) {
    const [u, d] = v.split("@");
    return `${u.slice(0, 2)}***@${d}`;
  }
  if (v.length > 5) return `${v.slice(0, 3)}****${v.slice(-2)}`;
  return "****";
}

/** Current payroll period key, e.g. "2026-08". */
export function currentPeriodKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentPeriodLabel(): string {
  const d = new Date();
  return `${d.toLocaleString("default", { month: "long" })} ${d.getFullYear()}`;
}

/**
 * Upload a payslip PDF (as a Blob) to the public `fuelpro-files` bucket and
 * return its public URL. The URL is used as the WhatsApp document link and as
 * the fallback link inside the email body.
 */
export async function uploadPayslipPdf(
  pdfBlob: Blob,
  ownerId: string,
  filename: string,
): Promise<{ url: string; path: string }> {
  const client = getSupabaseClient();
  const safeName = filename.replace(/[^\w.-]+/g, "_");
  const path = `payslips/${ownerId}/${Date.now()}_${safeName}`;
  const { error: upErr } = await client.storage
    .from("fuelpro-files")
    .upload(path, pdfBlob, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });
  if (upErr) throw new Error(`Payslip upload failed: ${upErr.message}`);
  const { data } = client.storage.from("fuelpro-files").getPublicUrl(path);
  if (!data?.publicUrl)
    throw new Error("Payslip upload succeeded but returned no public URL");
  return { url: data.publicUrl, path };
}

export interface CommGatewayConfig {
  // email
  emailEnabled?: boolean;
  emailProvider?: string;
  emailApiKey?: string;
  emailDomain?: string;
  senderEmail?: string;
  smtpUser?: string;
  stationName?: string;
  // whatsapp
  whatsappEnabled?: boolean;
  whatsappPhone?: string; // phone_number_id
  whatsappToken?: string;
}

export interface PayslipSendResult {
  channel: PayslipChannel;
  success: boolean;
  error?: string;
}

/**
 * Send a payslip PDF to an employee via the chosen channel.
 * `pdfBase64` = base64 PDF body (email attachment); `publicUrl` = the uploaded
 * storage URL (WhatsApp document link + email fallback link).
 */
export async function deliverPayslip(opts: {
  channel: PayslipChannel;
  toEmail: string;
  toPhone: string; // raw payroll phone
  filename: string;
  pdfBase64: string;
  publicUrl: string;
  periodLabel: string;
  employeeName: string;
  gateway: CommGatewayConfig;
}): Promise<PayslipSendResult> {
  const { callIntegration } = await import("./integrations-client");
  const results: string[] = [];
  const errs: string[] = [];
  const channel = opts.channel;
  const tryEmail = channel === "email" || channel === "both";
  const tryWhatsApp = channel === "whatsapp" || channel === "both";

  if (tryEmail) {
    if (!opts.toEmail?.includes("@")) {
      errs.push("no employee email on file");
    } else if (!(opts.gateway.emailEnabled && opts.gateway.emailApiKey)) {
      errs.push("email gateway not configured");
    } else {
      try {
        const res = await callIntegration("email-send", {
          provider: opts.gateway.emailProvider || "sendgrid",
          to: opts.toEmail,
          subject: `Your ${opts.periodLabel} Payslip — ${opts.gateway.stationName || "Payroll"}`,
          text:
            `Dear ${opts.employeeName},\n\n` +
            `Please find attached your payslip for ${opts.periodLabel}.\n\n` +
            `If the attachment does not open, you can also download it here:\n${opts.publicUrl}\n\n` +
            `Thank you,\n${opts.gateway.stationName || "Payroll"}`,
          fromEmail: opts.gateway.senderEmail || opts.gateway.smtpUser || "",
          fromName: opts.gateway.stationName || "Payroll",
          apiKey: opts.gateway.emailApiKey,
          domain: opts.gateway.emailDomain,
          attachment: {
            filename: opts.filename,
            contentBase64: opts.pdfBase64,
            mimeType: "application/pdf",
          },
        });
        if (res.success) results.push("email");
        else errs.push(`email: ${res.error || "send failed"}`);
      } catch (e) {
        errs.push(`email: ${(e as Error).message}`);
      }
    }
  }

  if (tryWhatsApp) {
    const waTo = normalizePhoneForSending(opts.toPhone);
    if (!waTo) {
      errs.push("no employee phone on file");
    } else if (!(
      opts.gateway.whatsappEnabled &&
      opts.gateway.whatsappPhone &&
      opts.gateway.whatsappToken
    )) {
      errs.push("WhatsApp gateway not configured");
    } else {
      try {
        const res = await callIntegration("whatsapp-send", {
          phoneNumberId: opts.gateway.whatsappPhone,
          token: opts.gateway.whatsappToken,
          to: waTo,
          message: `Your ${opts.periodLabel} payslip is attached.`,
          documentUrl: opts.publicUrl,
          documentFilename: opts.filename,
        });
        if (res.success) results.push("whatsapp");
        else errs.push(`whatsapp: ${res.error || "send failed"}`);
      } catch (e) {
        errs.push(`whatsapp: ${(e as Error).message}`);
      }
    }
  }

  return {
    channel,
    success: results.length > 0,
    error: errs.length ? errs.join(" | ") : undefined,
  };
}
