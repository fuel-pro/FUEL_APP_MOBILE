import type { IncomingMessage, ServerResponse } from "node:http";

const ALLOW = ["https://huggingface.co", "https://cdn-lfs.huggingface.co"];

/**
 * GET /api/hf-proxy/<path>  ->  https://huggingface.co/<path>
 * First-party HuggingFace reverse-proxy for the on-device caption models
 * (Whisper + opus-mt). The browser calls the SAME-ORIGIN path so there is
 * no CORS, no service-worker involvement, no client-CDN reachability
 * dependency -- the caption model can load even when huggingface.co is
 * unreachable from the user's network/region (server-side fetch).
 * Redirects to cdn-lfs.huggingface.co are followed server-side.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const method = req.method || "GET";
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }
  if (method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
    return;
  }

  const url = new URL(req.url || "/", "http://internal");
  const rawPath = url.pathname; // /api/hf-proxy/Xenova/whisper-tiny/resolve/main/...
  const prefix = "/api/hf-proxy/";
  if (!rawPath.startsWith(prefix)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad Request: expected /api/hf-proxy/<huggingface-path>");
    return;
  }
  const hfPath = rawPath.slice(prefix.length);
  if (!hfPath) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad Request: missing path");
    return;
  }
  // HuggingFace query params (?download / ?resolve) pass through.
  const upstream = "https://huggingface.co/" + hfPath + (url.search || "");
  if (!ALLOW.some((a) => upstream.startsWith(a + "/"))) {
    res.writeHead(403, { "Content-Type": "text/plain" });
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
      res.writeHead(upstreamRes.status, { "Content-Type": "text/plain" });
      res.end("Upstream error: " + upstreamRes.status);
      return;
    }
    const contentType =
      upstreamRes.headers.get("content-type") || "application/octet-stream";
    // Model + WASM files are immutable; the CDN can hold them for a month.
    const isImmutable =
      /\.(onnx|wasm|bin|json|model|txt|vocab)(\?|$)/.test(hfPath) ||
      (upstreamRes.headers.get("content-length")?.length ?? 0) > 0;
    res.writeHead(upstreamRes.status, {
      "Content-Type": contentType,
      "Cache-Control": isImmutable
        ? "public, max-age=2592000, immutable"
        : "no-store",
      "Access-Control-Allow-Origin": "*",
      "CDN-Cache-Control": isImmutable
        ? "public, max-age=2592000, immutable"
        : "no-cache",
    });
    res.end(Buffer.from(await upstreamRes.arrayBuffer()));
  } catch (e) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Proxy error: " + (e instanceof Error ? e.message : String(e)));
  }
}
