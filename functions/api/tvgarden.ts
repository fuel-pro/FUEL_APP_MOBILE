/**
 * Cloudflare Pages Function — tvgarden Catalog + Channels API
 *
 * Mirrors the Vercel handler in api/tvgarden.ts. Serves two purposes:
 *   1. GET /api/tvgarden              -> the reverse-engineered catalog
 *      (218 countries + 27 TV categories + 22 radio categories) so the
 *      frontend can build filter dropdowns dynamically.
 *   2. GET /api/tvgarden?mode=tv&type=countries&id=us -> alias for
 *      /api/live-channels (fetch + decode + filter channels).
 *
 * The reverse-engineered contract is inlined here (Cloudflare Pages
 * Functions bundle each file independently). Keep in sync with
 * api/_lib/tvgarden.ts.
 *
 * Lives at functions/api/tvgarden.ts -> /api/tvgarden
 */

interface TvgChannel {
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

// === Reverse-engineered catalog (from tvgarden sitemaps + API probing) ===

const TVGARDEN_COUNTRIES = (
  "ad ae af ag ai al am ao ar as at au aw ax az ba bb bd be bf bg bh bi bj " +
  "bm bn bo bq br bs bw by bz ca cc cd cf cg ch ci cl cn co cr cu cv cw cy " +
  "cz de dk dm do dz ec ee eg er es et fi fk fm fo fr ga gd ge gf gg gh gi " +
  "gl gn gp gr gt gu gw gy hk hn hr ht hu id ie il im in io iq ir is it jm " +
  "jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly " +
  "ma mc md me mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc " +
  "ne ng ni nl no np nz om pa pe pf ph pk pl pm pr ps pt pw py qa re ro rs " +
  "ru rw sa sd se sg sh si sk sl sm sn so sr sv sx sy td tf tg th tj tm tn " +
  "to tr tt tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws xk ye yt za " +
  "zm zw"
).split(" ");

const TVGARDEN_TV_CATEGORIES = [
  { id: "news", label: "News" },
  { id: "movies", label: "Movies" },
  { id: "sports", label: "Sports" },
  { id: "music", label: "Music" },
  { id: "entertainment", label: "Entertainment" },
  { id: "kids", label: "Kids" },
  { id: "documentary", label: "Documentary" },
  { id: "education", label: "Education" },
  { id: "religious", label: "Religious" },
  { id: "business", label: "Business" },
  { id: "general", label: "General" },
  { id: "family", label: "Family" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "culture", label: "Culture" },
  { id: "classic", label: "Classic" },
  { id: "weather", label: "Weather" },
  { id: "travel", label: "Travel" },
  { id: "auto", label: "Auto" },
  { id: "animation", label: "Animation" },
  { id: "comedy", label: "Comedy" },
  { id: "cooking", label: "Cooking" },
  { id: "legislative", label: "Legislative" },
  { id: "outdoor", label: "Outdoor" },
  { id: "relax", label: "Relax" },
  { id: "science", label: "Science" },
  { id: "series", label: "Series" },
  { id: "shop", label: "Shop" },
];

const TVGARDEN_RADIO_CATEGORIES = [
  { id: "news", label: "News" },
  { id: "talk", label: "Talk" },
  { id: "sports", label: "Sports" },
  { id: "politics", label: "Politics" },
  { id: "hits", label: "Hits" },
  { id: "pop", label: "Pop" },
  { id: "rock", label: "Rock" },
  { id: "electronic", label: "Electronic" },
  { id: "indie", label: "Indie" },
  { id: "metal", label: "Metal" },
  { id: "jazz", label: "Jazz" },
  { id: "classical", label: "Classical" },
  { id: "soul", label: "Soul" },
  { id: "blues", label: "Blues" },
  { id: "reggae", label: "Reggae" },
  { id: "folk", label: "Folk" },
  { id: "country", label: "Country" },
  { id: "latin", label: "Latin" },
  { id: "schlager", label: "Schlager" },
  { id: "oldies", label: "Oldies" },
  { id: "chill", label: "Chill" },
  { id: "christmas", label: "Christmas" },
  { id: "religious", label: "Religious" },
];

const COUNTRY_NAMES: Record<string, string> = {
  ad: "Andorra",
  ae: "United Arab Emirates",
  af: "Afghanistan",
  ag: "Antigua & Barbuda",
  ai: "Anguilla",
  al: "Albania",
  am: "Armenia",
  ao: "Angola",
  ar: "Argentina",
  as: "American Samoa",
  at: "Austria",
  au: "Australia",
  aw: "Aruba",
  ax: "Åland Islands",
  az: "Azerbaijan",
  ba: "Bosnia & Herzegovina",
  bb: "Barbados",
  bd: "Bangladesh",
  be: "Belgium",
  bf: "Burkina Faso",
  bg: "Bulgaria",
  bh: "Bahrain",
  bi: "Burundi",
  bj: "Benin",
  bm: "Bermuda",
  bn: "Brunei",
  bo: "Bolivia",
  bq: "Bonaire",
  br: "Brazil",
  bs: "Bahamas",
  bw: "Botswana",
  by: "Belarus",
  bz: "Belize",
  ca: "Canada",
  cc: "Cocos Islands",
  cd: "DR Congo",
  cf: "Central African Rep.",
  cg: "Congo",
  ch: "Switzerland",
  ci: "Côte d'Ivoire",
  cl: "Chile",
  cn: "China",
  co: "Colombia",
  cr: "Costa Rica",
  cu: "Cuba",
  cv: "Cape Verde",
  cw: "Curaçao",
  cy: "Cyprus",
  cz: "Czechia",
  de: "Germany",
  dk: "Denmark",
  dm: "Dominica",
  do: "Dominican Rep.",
  dz: "Algeria",
  ec: "Ecuador",
  ee: "Estonia",
  eg: "Egypt",
  er: "Eritrea",
  es: "Spain",
  et: "Ethiopia",
  fi: "Finland",
  fk: "Falkland Islands",
  fm: "Micronesia",
  fo: "Faroe Islands",
  fr: "France",
  ga: "Gabon",
  gd: "Grenada",
  ge: "Georgia",
  gf: "French Guiana",
  gg: "Guernsey",
  gh: "Ghana",
  gi: "Gibraltar",
  gl: "Greenland",
  gn: "Guinea",
  gp: "Guadeloupe",
  gr: "Greece",
  gt: "Guatemala",
  gu: "Guam",
  gw: "Guinea-Bissau",
  gy: "Guyana",
  hk: "Hong Kong",
  hn: "Honduras",
  hr: "Croatia",
  ht: "Haiti",
  hu: "Hungary",
  id: "Indonesia",
  ie: "Ireland",
  il: "Israel",
  im: "Isle of Man",
  in: "India",
  io: "British Indian Ocean",
  iq: "Iraq",
  ir: "Iran",
  is: "Iceland",
  it: "Italy",
  jm: "Jamaica",
  jo: "Jordan",
  jp: "Japan",
  ke: "Kenya",
  kg: "Kyrgyzstan",
  kh: "Cambodia",
  ki: "Kiribati",
  km: "Comoros",
  kn: "St. Kitts & Nevis",
  kp: "North Korea",
  kr: "South Korea",
  kw: "Kuwait",
  ky: "Cayman Islands",
  kz: "Kazakhstan",
  la: "Laos",
  lb: "Lebanon",
  lc: "St. Lucia",
  li: "Liechtenstein",
  lk: "Sri Lanka",
  lr: "Liberia",
  ls: "Lesotho",
  lt: "Lithuania",
  lu: "Luxembourg",
  lv: "Latvia",
  ly: "Libya",
  ma: "Morocco",
  mc: "Monaco",
  md: "Moldova",
  me: "Montenegro",
  mg: "Madagascar",
  mh: "Marshall Islands",
  mk: "North Macedonia",
  ml: "Mali",
  mm: "Myanmar",
  mn: "Mongolia",
  mo: "Macao",
  mp: "Northern Mariana Islands",
  mq: "Martinique",
  mr: "Mauritania",
  ms: "Montserrat",
  mt: "Malta",
  mu: "Mauritius",
  mv: "Maldives",
  mw: "Malawi",
  mx: "Mexico",
  my: "Malaysia",
  mz: "Mozambique",
  na: "Namibia",
  nc: "New Caledonia",
  ne: "Niger",
  ng: "Nigeria",
  ni: "Nicaragua",
  nl: "Netherlands",
  no: "Norway",
  np: "Nepal",
  nz: "New Zealand",
  om: "Oman",
  pa: "Panama",
  pe: "Peru",
  pf: "French Polynesia",
  ph: "Philippines",
  pk: "Pakistan",
  pl: "Poland",
  pm: "St. Pierre & Miquelon",
  pr: "Puerto Rico",
  ps: "Palestine",
  pt: "Portugal",
  pw: "Palau",
  py: "Paraguay",
  qa: "Qatar",
  re: "Réunion",
  ro: "Romania",
  rs: "Serbia",
  ru: "Russia",
  rw: "Rwanda",
  sa: "Saudi Arabia",
  sd: "Sudan",
  se: "Sweden",
  sg: "Singapore",
  sh: "St. Helena",
  si: "Slovenia",
  sk: "Slovakia",
  sl: "Sierra Leone",
  sm: "San Marino",
  sn: "Senegal",
  so: "Somalia",
  sr: "Suriname",
  sv: "El Salvador",
  sx: "Sint Maarten",
  sy: "Syria",
  td: "Chad",
  tf: "French Southern",
  tg: "Togo",
  th: "Thailand",
  tj: "Tajikistan",
  tm: "Turkmenistan",
  tn: "Tunisia",
  to: "Tonga",
  tr: "Turkey",
  tt: "Trinidad & Tobago",
  tw: "Taiwan",
  tz: "Tanzania",
  ua: "Ukraine",
  ug: "Uganda",
  uk: "United Kingdom",
  us: "United States",
  uy: "Uruguay",
  uz: "Uzbekistan",
  va: "Vatican City",
  vc: "St. Vincent",
  ve: "Venezuela",
  vg: "British Virgin Islands",
  vi: "U.S. Virgin Islands",
  vn: "Vietnam",
  vu: "Vanuatu",
  wf: "Wallis & Futuna",
  ws: "Samoa",
  xk: "Kosovo",
  ye: "Yemen",
  yt: "Mayotte",
  za: "South Africa",
  zm: "Zambia",
  zw: "Zimbabwe",
};

const ALL_CATEGORY_IDS = new Set<string>([
  ...TVGARDEN_TV_CATEGORIES.map((c) => c.id),
  ...TVGARDEN_RADIO_CATEGORIES.map((c) => c.id),
]);
const COUNTRY_SET = new Set(TVGARDEN_COUNTRIES);

function isValidTvgRequest(mode: string, type: string, id: string): boolean {
  if (mode !== "tv" && mode !== "radio") return false;
  if (type !== "countries" && type !== "categories") return false;
  if (!id) return false;
  return type === "countries" ? COUNTRY_SET.has(id) : ALL_CATEGORY_IDS.has(id);
}

async function decodeTvgardenBody(buffer: ArrayBuffer): Promise<TvgChannel[]> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      const ds = new DecompressionStream("gzip");
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      const data = JSON.parse(await new Response(stream).text());
      return Array.isArray(data) ? (data as TvgChannel[]) : [];
    } catch {
      return [];
    }
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(data) ? (data as TvgChannel[]) : [];
  } catch {
    return [];
  }
}

function filterPlayable(channels: TvgChannel[]): TvgChannel[] {
  return channels.filter(
    (ch) =>
      (Array.isArray(ch.stream_urls) && ch.stream_urls.length > 0) ||
      (Array.isArray(ch.youtube_urls) && ch.youtube_urls.length > 0),
  );
}

const cache = new Map<string, { data: TvgChannel[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get("mode") || "";
  const type = url.searchParams.get("type") || "";
  const id = (url.searchParams.get("id") || "").toLowerCase();

  // No mode/type/id -> return the catalog index
  if (!mode && !type && !id) {
    const catalog = {
      countries: TVGARDEN_COUNTRIES.map((c) => ({
        code: c,
        name: COUNTRY_NAMES[c] || c.toUpperCase(),
      })),
      tvCategories: TVGARDEN_TV_CATEGORIES,
      radioCategories: TVGARDEN_RADIO_CATEGORIES,
      sourceCount: {
        countries: TVGARDEN_COUNTRIES.length,
        tvCategories: TVGARDEN_TV_CATEGORIES.length,
        radioCategories: TVGARDEN_RADIO_CATEGORIES.length,
      },
    };
    return new Response(JSON.stringify(catalog), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // mode/type/id -> fetch channels (alias for /api/live-channels)
  if (!isValidTvgRequest(mode, type, id)) {
    return new Response(
      JSON.stringify({ error: "Invalid mode/type/id", channels: [], count: 0 }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
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
    const upstreamRes = await fetch(upstreamUrl);
    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({ channels: [], count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const channels = await decodeTvgardenBody(await upstreamRes.arrayBuffer());
    const playable = filterPlayable(channels);
    cache.set(cacheKey, { data: playable, ts: Date.now() });
    return new Response(
      JSON.stringify({ channels: playable, count: playable.length }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err) {
    console.error("[tvgarden] fetch error:", err);
    return new Response(JSON.stringify({ channels: [], count: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};
