/**
 * IPTV-org Live TV integration tests.
 *
 * Verifies the VLC-equivalent catalog behavior in the News → Live TV tab:
 *  - iptv-org channels round-trip through the proxy contract (including
 *    alt_names, used for VLC-style search).
 *  - searchChannels finds a channel like "Zee One" by name, country and
 *    alternate name — the way VLC matches a network playlist.
 *  - the merge keeps primary (tvgarden) channels first and never duplicates.
 */
import { describe, it, expect } from "vitest";
import {
  iptvToLiveChannel,
  searchChannels,
  mergeChannelsWithIptv,
  type IptvChannel,
  type LiveChannel,
} from "@/react-app/services/LiveStreamService";

/** The exact Zee One entry from iptv-org (UK channel, entertainment). */
const ZEE_ONE: IptvChannel = {
  id: "ZeeOne.uk",
  name: "Zee One",
  url: "https://7689426c.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1mcl9aZWVNYWdpY19ITFM/playlist.m3u8",
  logo: "",
  country: "UK",
  language: "en",
  category: "entertainment",
  alt_names: ["ZeeOne", "Zee One (UK)"],
};

function makeChannel(name: string, country = "US"): LiveChannel {
  return {
    nanoid: `x-${name}`,
    name,
    stream_urls: ["https://example.com/playlist.m3u8"],
    youtube_urls: [],
    languages: [],
    country,
    isGeoBlocked: false,
  };
}

describe("iptv-live-channels — catalog integration", () => {
  it("converts an iptv-org channel to the unified LiveChannel shape with altNames", () => {
    const lc = iptvToLiveChannel(ZEE_ONE);
    expect(lc.nanoid).toBe("iptv-ZeeOne.uk");
    expect(lc.name).toBe("Zee One");
    expect(lc.stream_urls).toEqual([ZEE_ONE.url]);
    expect(lc.country).toBe("UK");
    expect(lc.altNames).toContain("ZeeOne");
    expect(lc.logo).toBeUndefined();
  });

  it("survives channels that lack alt_names (legacy payloads)", () => {
    const legacy: IptvChannel = {
      id: "Legacy.ch",
      name: "Legacy",
      url: "https://example.com/legacy.m3u8",
      logo: "",
      country: "CH",
      language: "",
      category: "",
    };
    const lc = iptvToLiveChannel(legacy);
    expect(lc.altNames).toEqual([]);
  });

  it("searchChannels finds a non-default-country channel like Zee One (VLC parity)", () => {
    // The app default view is the user's country (e.g. US); Zee One is a UK
    // channel that only appears when the FULL global catalog is loaded.
    const catalog = [
      makeChannel("CNN"),
      makeChannel("BBC One"),
      makeChannel("NBC"),
      iptvToLiveChannel(ZEE_ONE),
    ];
    const hits = searchChannels(catalog, "zee one");
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe("Zee One");
    expect(hits[0].country).toBe("UK");
  });

  it("searchChannels matches alternate names (VLC playlist metadata parity)", () => {
    const catalog = [
      makeChannel("Some Other Channel"),
      iptvToLiveChannel({ ...ZEE_ONE, alt_names: ["Zee Flashback"] }),
    ];
    expect(searchChannels(catalog, "zee flashback")).toHaveLength(1);
    expect(searchChannels(catalog, "flashback")).toHaveLength(1);
  });

  it("searchChannels matches the country code and is case-insensitive", () => {
    const catalog = [makeChannel("NTV", "KE"), makeChannel("ABN", "US")];
    expect(searchChannels(catalog, "ke")).toHaveLength(1);
    expect(searchChannels(catalog, "ntv")).toHaveLength(1);
    expect(searchChannels(catalog, "  ")).toHaveLength(2);
  });

  it("mergeChannelsWithIptv keeps primary first and dedupes by name", () => {
    const primary = [makeChannel("BBC One"), makeChannel("Zee One")];
    const iptv = [
      ZEE_ONE, // duplicate name — must be skipped
      {
        id: "ExtraOne.uk",
        name: "Extra One",
        url: "https://example.com/extra.m3u8",
        logo: "",
        country: "UK",
        language: "en",
        category: "entertainment",
      },
    ];
    const merged = mergeChannelsWithIptv(primary, iptv);
    expect(merged.map((c) => c.name)).toEqual([
      "BBC One",
      "Zee One",
      "Extra One",
    ]);
    expect(merged[1].nanoid).toBe("x-Zee One"); // primary copy kept
  });
});
