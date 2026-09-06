/**
 * Cloudflare Pages Function: GET /api/hf-proxy/<path> -> https://huggingface.co/<path>
 * Same-role first-party proxy as the Vercel handler. Cloudflare serves a
 * CDN-cached copy of model/WASM files after the first fetch, so the caption
 * model loads fast and reliably on fuel-app-mobile.pages.dev with zero
 * client-side CORS/region dependency.
 */
const ALLOW = ["https://huggingface.co", "https://cdn-lfs.huggingface.co"];

export const onRequestGet = async ({ request }: { request: Request }) => {
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
