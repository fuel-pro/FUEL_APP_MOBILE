/**
 * Integrations API (Vercel serverless)
 *
 * REAL production integration dispatcher. Every action makes an actual call
 * to the actual institution (Safaricom Daraja, Kopo Kopo, Twilio, Africa's
 * Talking, SendGrid, Mailgun, Resend, Meta WhatsApp Cloud, KRA eTIMS OSCU,
 * arbitrary webhook endpoints). No simulation.
 *
 * POST /api/integrations?action=<action>
 *   actions: ping | mpesa-stk-push | mpesa-query | kopokopo-pull |
 *            sms-send | email-send | whatsapp-send | webhook-fire |
 *            kra-etims-init | kra-etims-invoice
 *
 * The station's own institution credentials arrive in the request body
 * (bring-your-own-key relay — see api/_lib/integrations-core.ts).
 */
import type { IncomingMessage, ServerResponse } from "http";
import { dispatchIntegration } from "./_lib/integrations-core.js";

/** Allowed upstream hosts for the hf-proxy binary relay. */
const HF_ALLOW = ["https://huggingface.co", "https://cdn-lfs.huggingface.co"];

/**
 * GET /api/integrations?action=hf-proxy&p=<huggingface/model/path>
 * First-party HuggingFace relay for the on-device caption models (Whisper +
 * opus-mt). Folds the same-origin proxy into THIS existing serverless
 * function so we do not add a new api/*.ts slot (Vercel Hobby 12-func cap).
 * The browser fetches `?p=path`; we server-side fetch https://huggingface.co/<path>.
 * Immutable model/WASM files are CDN-cached.
 */
async function hfProxy(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const qs = Object.fromEntries(
    new URLSearchParams((req.url || "").split("?")[1] || ""),
  );
  const p = String(qs.p || "").replace(/^\/+/, "");
  if (!p) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("Bad Request: missing p");
    return;
  }
  const upstream =
    "https://huggingface.co/" + p.replace(/^https?:\/\/huggingface\.co\//, "");
  if (!HF_ALLOW.some((a) => upstream.startsWith(a + "/"))) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");
    res.end("Forbidden: only HuggingFace paths are allowed");
    return;
  }
  try {
    const upstreamRes = await fetch(upstream, {
      redirect: "follow",
      headers: {
        "User-Agent": "FuelPro/1.0 (+fuel-app-mobile)",
        Accept: "*/*",
      },
    });
    if (!upstreamRes.ok && upstreamRes.status !== 304) {
      res.statusCode = upstreamRes.status;
      res.setHeader("Content-Type", "text/plain");
      res.end("Upstream error: " + upstreamRes.status);
      return;
    }
    const contentType =
      upstreamRes.headers.get("content-type") || "application/octet-stream";
    const isImmutable = /\.(onnx|wasm|bin|json|model|txt|vocab)(\?|$)/.test(p);
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Cache-Control",
      isImmutable ? "public, max-age=2592000, immutable" : "no-store",
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "CDN-Cache-Control",
      isImmutable ? "public, max-age=2592000, immutable" : "no-cache",
    );
    res.statusCode = upstreamRes.status;
    res.end(Buffer.from(await upstreamRes.arrayBuffer()));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain");
    res.end("Proxy error: " + (e instanceof Error ? e.message : String(e)));
  }
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

function wrapRes(res: ServerResponse): ApiResponse {
  const r = res as ApiResponse;
  r.status = (code: number) => {
    res.statusCode = code;
    return r;
  };
  r.json = (body: unknown) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  return r;
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readBody(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const out = wrapRes(res);
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const qs = Object.fromEntries(
    new URLSearchParams((req.url || "").split("?")[1] || ""),
  );
  const action = String(qs.action || "");
  const body = req.method === "POST" ? await readBody(req) : {};

  // Binary relay for the on-device caption models (same-origin, no new
  // function slot — keeps Vercel Hobby under the 12-func cap).
  if (action === "hf-proxy") {
    await hfProxy(req, res);
    return;
  }

  if (!action) {
    out.status(400).json({ success: false, error: "Missing action parameter" });
    return;
  }

  try {
    const result = await dispatchIntegration(action, body);
    out.status(result.success ? 200 : 200).json(result); // 200 with success flag (upstream detail in body)
  } catch (e) {
    out.status(500).json({ success: false, error: (e as Error).message });
  }
}
