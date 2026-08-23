/**
 * Cloudflare Pages Function — Live Channels API
 *
 * Same purpose as /api/live-channels.ts (Vercel): proxies the upstream
 * live-channel JSON API (which doesn't send CORS headers), decompresses
 * gzip, filters out channels with no playable URL, and returns with CORS.
 *
 * Lives at functions/api/live-channels.ts → /api/live-channels
 *
 * GET /api/live-channels?mode=tv|radio&type=countries|categories&id=us|news
 */

interface LiveChannel {
  nanoid: string;
  name: string;
  stream_urls: string[];
  youtube_urls: string[];
  languages: string[];
  country: string;
  isGeoBlocked: boolean;
}

interface Env {}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
};

// In-memory cache (per Worker isolate, 5-min TTL)
const cache = new Map<string, { data: LiveChannel[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Decompress gzip bytes using DecompressionStream (Web Streams API,
 * available in Cloudflare Workers). Falls back to raw text if not gzip.
 */
async function decompressGzip(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  // Check for gzip magic bytes (0x1f 0x8b)
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      const ds = new DecompressionStream("gzip");
      const decompressedStream = new Blob([bytes]).stream().pipeThrough(ds);
      const decompressed = await new Response(decompressedStream).text();
      return decompressed;
    } catch {
      // If DecompressionStream fails, try interpreting as raw text
      return new TextDecoder().decode(bytes);
    }
  }
  return new TextDecoder().decode(bytes);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);

  const mode = url.searchParams.get("mode") || "tv";
  const type = url.searchParams.get("type") || "countries";
  const id = (url.searchParams.get("id") || "us").toLowerCase();

  if (!["tv", "radio"].includes(mode)) {
    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!["countries", "categories"].includes(type)) {
    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const cacheKey = `${mode}/${type}/${id}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new Response(
      JSON.stringify({ channels: cached.data, count: cached.data.length }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  const upstreamUrl = `https://tvgarden.world/api/${mode}/${type}/${id}.json`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: { "Accept-Encoding": "identity" },
    });

    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({ channels: [], count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const buffer = await upstreamRes.arrayBuffer();
    const jsonText = await decompressGzip(buffer);
    const data = JSON.parse(jsonText);
    const channels: LiveChannel[] = Array.isArray(data) ? data : [];

    // Filter out channels with no playable URL (never show dead streams)
    const playable = channels.filter(
      (ch) =>
        (ch.stream_urls && ch.stream_urls.length > 0) ||
        (ch.youtube_urls && ch.youtube_urls.length > 0),
    );

    cache.set(cacheKey, { data: playable, ts: Date.now() });

    return new Response(
      JSON.stringify({ channels: playable, count: playable.length }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err) {
    console.error("[live-channels] fetch error:", err);
    return new Response(JSON.stringify({ channels: [], count: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};
