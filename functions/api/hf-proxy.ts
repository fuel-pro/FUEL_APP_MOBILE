interface Env {}

const ALLOW = ["https://huggingface.co", "https://cdn-lfs.huggingface.co"];

/**
 * Cloudflare Pages Function - HuggingFace reverse-proxy (caption models).
 * Same purpose as /api/hf-proxy.ts (Vercel). Lives at
 * functions/api/hf-proxy.ts -> accessible at /api/hf-proxy on the same
 * origin as the SPA (zero CORS, zero external-CDN dependency, CDN-cached
 * model/WASM files after the first hit).
 *
 * GET /api/hf-proxy/<path>  ->  https://huggingface.co/<path>
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const prefix = "/api/hf-proxy/";
  const rawPath = url.pathname;
  if (!rawPath.startsWith(prefix)) {
    return new Response("Bad Request: expected /api/hf-proxy/<path>", {
      status: 400,
    });
  }
  const hfPath = rawPath.slice(prefix.length);
  if (!hfPath) {
    return new Response("Bad Request: missing path", { status: 400 });
  }
  const upstream = "https://huggingface.co/" + hfPath + (url.search || "");
  if (!ALLOW.some((a) => upstream.startsWith(a + "/"))) {
    return new Response("Forbidden", { status: 403 });
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
      return new Response("Upstream error: " + upstreamRes.status, {
        status: upstreamRes.status,
      });
    }
    const contentType =
      upstreamRes.headers.get("content-type") || "application/octet-stream";
    const isImmutable = /\.(onnx|wasm|bin|json|model|txt|vocab)(\?|$)/.test(
      hfPath,
    );
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": isImmutable
        ? "public, max-age=2592000, immutable"
        : "no-store",
      "Access-Control-Allow-Origin": "*",
      "CDN-Cache-Control": isImmutable
        ? "public, max-age=2592000, immutable"
        : "no-cache",
    });
    return new Response(await upstreamRes.arrayBuffer(), {
      status: upstreamRes.status,
      headers,
    });
  } catch (e) {
    return new Response(
      "Proxy error: " + (e instanceof Error ? e.message : String(e)),
      { status: 502 },
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
};
