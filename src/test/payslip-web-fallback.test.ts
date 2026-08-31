import { describe, it, expect } from "vitest";
import {
  buildMailtoUrl,
  buildPayslipWebFallbacks,
  buildWhatsAppWebUrl,
  maskRecipient,
  normalizePhoneForSending,
  type CommGatewayConfig,
} from "@/react-app/lib/payslip-delivery";

describe("payslip web-redirect builders", () => {
  it("buildWhatsAppWebUrl normalizes phone + encodes message", () => {
    const url = buildWhatsAppWebUrl("254712345678", "Hello John");
    expect(url).toBe(
      `https://wa.me/254712345678?text=${encodeURIComponent("Hello John")}`,
    );
  });

  it("buildMailtoUrl pre-fills recipient, subject and body", () => {
    const url = buildMailtoUrl({
      to: "john@test.com",
      subject: "Your August 2026 Payslip",
      body: "Link: https://x/sup/1.pdf",
    });
    expect(url.startsWith("mailto:john%40test.com?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("subject")).toBe("Your August 2026 Payslip");
    expect(params.get("body")).toBe("Link: https://x/sup/1.pdf");
  });

  it("maskRecipient hides email + phone", () => {
    expect(maskRecipient("john@test.com")).toBe("jo***@test.com");
    expect(maskRecipient("254712345678")).toBe("254****78");
  });

  // normalizePhoneForSending depends on getDetectedCountryCode() which reads
  // localStorage; in jsdom with no station data it falls to a default code.
  it("normalizePhoneForSending keeps international numbers", () => {
    expect(normalizePhoneForSending("254712345678")).toBe("254712345678");
  });
});

describe("buildPayslipWebFallbacks", () => {
  const base: CommGatewayConfig = {};
  it("offers email fallback when email gateway unconfigured", () => {
    const fb = buildPayslipWebFallbacks({
      channel: "email",
      toEmail: "john@test.com",
      toPhone: "0712345678",
      publicUrl: "https://x/sup/1.pdf",
      filename: "Payslip_John.pdf",
      periodLabel: "August 2026",
      employeeName: "John",
      stationName: "QA Station",
      gateway: base,
    });
    expect(fb).toHaveLength(1);
    expect(fb[0].kind).toBe("email");
    expect(fb[0].url).toContain("mailto:john%40test.com");
  });

  it("offers whatsapp fallback when whatsapp gateway unconfigured", () => {
    const fb = buildPayslipWebFallbacks({
      channel: "whatsapp",
      toEmail: "",
      toPhone: "254712345678",
      publicUrl: "https://x/sup/1.pdf",
      filename: "Payslip_John.pdf",
      periodLabel: "August 2026",
      employeeName: "John",
      stationName: "QA Station",
      gateway: base,
    });
    expect(fb).toHaveLength(1);
    expect(fb[0].kind).toBe("whatsapp");
    expect(fb[0].url).toContain("https://wa.me/254712345678");
  });

  it("offers both fallbacks for channel=both", () => {
    const fb = buildPayslipWebFallbacks({
      channel: "both",
      toEmail: "john@test.com",
      toPhone: "254712345678",
      publicUrl: "https://x/sup/1.pdf",
      filename: "Payslip_John.pdf",
      periodLabel: "August 2026",
      employeeName: "John",
      stationName: "QA Station",
      gateway: base,
    });
    expect(fb.map((f) => f.kind).sort()).toEqual(["email", "whatsapp"]);
  });

  it("returns nothing when the needed gateway is configured", () => {
    const fb = buildPayslipWebFallbacks({
      channel: "email",
      toEmail: "john@test.com",
      toPhone: "",
      publicUrl: "https://x/sup/1.pdf",
      filename: "Payslip_John.pdf",
      periodLabel: "August 2026",
      employeeName: "John",
      stationName: "QA Station",
      gateway: {
        emailEnabled: true,
        emailApiKey: "sg_key",
      } as CommGatewayConfig,
    });
    expect(fb).toHaveLength(0);
  });
});
