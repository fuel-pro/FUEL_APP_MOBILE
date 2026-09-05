/**
 * iptv-m3u.test.ts
 * Locks the iptv-org index.m3u parser used by /api/iptv-channels on BOTH
 * hosts (Vercel + Cloudflare Pages). The parser turns the canonical iptv-org
 * playlist format into the merged IptvChannel slice.
 */
import { describe, it, expect } from "vitest";
// The parser is pure TS with no Node/Vercel-specific imports, so it can be
// imported directly. The api handler itself (default export) is intentionally
// not imported here (it uses node:http types only at type level).
import { parseIptvM3u, mergeIptvSources } from "../../api/iptv-channels";

const sample =
  "#EXTM3U\n" +
  '#EXTINF:-1 tvg-id="ArirangTV.us" tvg-logo="https://example.com/arirang.png" group-title="International",Arirang TV\n' +
  "https://example.com/arirang.m3u8\n" +
  '#EXTINF:-1 tvg-id="CNA.cn" group-title="News",CNA\n' +
  "https://example.com/cna.m3u8\n" +
  '#EXTINF:-1 tvg-id="NoUrlChan",Group,No URL\n';

describe("parseIptvM3u", () => {
  it("parses EXTINF entries into channel rows", () => {
    const chans = parseIptvM3u(sample);
    expect(chans.length).toBe(2);
    const arirang = chans[0];
    expect(arirang.id).toBe("ArirangTV.us");
    expect(arirang.name).toBe("Arirang TV");
    expect(arirang.logo).toBe("https://example.com/arirang.png");
    expect(arirang.category).toBe("International");
    expect(arirang.url).toBe("https://example.com/arirang.m3u8");
  });

  it("skips entries without a stream URL (dead lines)", () => {
    const chans = parseIptvM3u(sample);
    expect(chans.some((c) => c.name === "No URL")).toBe(false);
  });

  it("falls back to a synthetic id when tvg-id is missing", () => {
    const text =
      '#EXTINF:-1 group-title="News",Plain Chan\n' +
      "https://example.com/plain.m3u8\n";
    const chans = parseIptvM3u(text);
    expect(chans[0].id.startsWith("m3u-")).toBe(true);
  });
});

describe("mergeIptvSources", () => {
  const jsonChans = [
    {
      id: "ArirangTV.us",
      name: "Arirang TV",
      url: "https://json.example.com/arirang.m3u8",
      logo: "",
      country: "us",
      language: "",
      category: "",
    },
  ];
  const m3uChans = [
    {
      id: "ArirangTV.us",
      name: "Arirang TV",
      url: "https://m3u.example.com/arirang.m3u8",
      logo: "https://example.com/arirang.png",
      country: "",
      language: "",
      category: "International",
    },
    {
      id: "CNA.cn",
      name: "CNA",
      url: "https://m3u.example.com/cna.m3u8",
      logo: "",
      country: "",
      language: "",
      category: "News",
    },
  ];

  it("keeps the JSON-API row for duplicate ids and fills gaps from m3u", () => {
    const merged = mergeIptvSources(jsonChans, m3uChans);
    expect(merged.length).toBe(2);
    const arirang = merged.find((c) => c.id === "ArirangTV.us");
    // JSON id wins for the url; m3u backfills category + logo only when the
    // JSON row lacked them (logo is NOT filled here because JSON wins fully;
    // category IS backfilled because JSON had empty category).
    expect(arirang?.url).toBe("https://json.example.com/arirang.m3u8");
    expect(arirang?.category).toBe("International");
    expect(merged.some((c) => c.id === "CNA.cn")).toBe(true);
  });
});
