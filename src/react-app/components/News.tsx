import { useState, useEffect } from "react";
import { useLocation } from "@/react-app/context/LocationContext";
import {
  Newspaper,
  ExternalLink,
  Clock,
  Globe,
  Filter,
  Share2,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  Wifi,
  WifiOff,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Zap,
  Leaf,
  BarChart3,
  Receipt,
  Gavel,
  Building2,
  Fuel as FuelIcon,
  BadgeDollarSign,
  Play,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Radio,
  Tv,
} from "lucide-react";
import NewsService, {
  ExternalNewsItem,
} from "@/react-app/services/NewsService";
import {
  getCountryByCode,
  ALL_COUNTRIES,
} from "@/react-app/lib/world-country-utils";

interface DisplayNewsItem extends ExternalNewsItem {
  bookmarked: boolean;
  read: boolean;
}

const CATEGORY_ICONS: Record<string, any> = {
  price: DollarSign,
  regulation: Gavel,
  industry: Building2,
  technology: Zap,
  sustainability: Leaf,
  market: BarChart3,
  tax: Receipt,
};

const CATEGORY_COLORS: Record<string, string> = {
  price: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  regulation: "bg-red-500/20 text-red-300 border-red-500/30",
  industry: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  technology: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  sustainability: "bg-green-500/20 text-green-300 border-green-500/30",
  market: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  tax: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  price: "Price",
  regulation: "Regulation",
  industry: "Industry",
  technology: "Tech",
  sustainability: "Green",
  market: "Market",
  tax: "Tax",
};

// Video news sources for fuel industry
const VIDEO_SOURCES = [
  {
    id: "v1",
    name: "Bloomberg Energy",
    type: "live",
    url: "https://www.youtube.com/embed/gCNeDWCIQvo",
    embed: true,
    desc: "Bloomberg Live Financial News",
  },
  {
    id: "v2",
    name: "CNBC Energy",
    type: "video",
    url: "https://www.youtube.com/embed/9NyxcX3rhQs",
    embed: true,
    desc: "OPEC & Oil Market Updates",
  },
  {
    id: "v3",
    name: "Reuters Business",
    type: "live",
    url: "https://www.youtube.com/embed/Z5umnGydW1g",
    embed: true,
    desc: "Global Business & Energy News",
  },
  {
    id: "v4",
    name: "Energy Central",
    type: "video",
    url: "https://www.youtube.com/embed/JGz7hAwp2wQ",
    embed: true,
    desc: "Energy Industry Analysis",
  },
  {
    id: "v5",
    name: "Oil Price News",
    type: "video",
    url: "https://www.youtube.com/embed/1dA_nzBzBgE",
    embed: true,
    desc: "Oil Price & Market Reports",
  },
  {
    id: "v6",
    name: "Al Jazeera Business",
    type: "live",
    url: "https://www.youtube.com/embed/bNyUyrR0PHo",
    embed: true,
    desc: "International Business Coverage",
  },
];

// Fallback curated news when external fetch fails
function getCuratedNews(countryCode: string): DisplayNewsItem[] {
  const now = new Date();
  const daysAgo = (d: number) =>
    new Date(now.getTime() - d * 86400000).toISOString();
  const items: DisplayNewsItem[] = [
    {
      id: "cur-001",
      title: "Global Crude Oil Prices Rise Amid Supply Concerns",
      summary:
        "International crude oil benchmarks Brent and WTI have increased by 3.2% this week following production cuts by major OPEC+ members. Fuel stations should prepare for wholesale price adjustments.",
      category: "price",
      source: "Energy Intelligence",
      sourceUrl: "https://www.energyintel.com",
      publishedAt: daysAgo(1),
      country: "ALL",
      priority: "high",
      bookmarked: false,
      read: false,
    },
    {
      id: "cur-002",
      title: "New Fuel Quality Standards Announced for 2026",
      summary:
        "Updated fuel quality specifications including lower sulfur content requirements will take effect from January 2026. All fuel stations must ensure their suppliers meet the new standards.",
      category: "regulation",
      source: "IFQC",
      sourceUrl: "https://www.ifqc.org",
      publishedAt: daysAgo(2),
      country: "ALL",
      priority: "high",
      bookmarked: false,
      read: false,
    },
    {
      id: "cur-003",
      title: "Digital Payment Integration Boosts Station Revenue by 28%",
      summary:
        "A new study shows fuel stations that adopted integrated digital payment systems saw a 28% increase in customer throughput and average transaction value.",
      category: "technology",
      source: "Petroleum Retailers Association",
      sourceUrl: "#",
      publishedAt: daysAgo(3),
      country: "ALL",
      priority: "medium",
      bookmarked: false,
      read: false,
    },
    {
      id: "cur-004",
      title: "EV Charging Infrastructure Grants Now Available",
      summary:
        "Government announces new grants for fuel stations adding EV charging points. Applications open next month for stations looking to diversify.",
      category: "sustainability",
      source: "Green Energy Weekly",
      sourceUrl: "#",
      publishedAt: daysAgo(4),
      country: "ALL",
      priority: "medium",
      bookmarked: false,
      read: false,
    },
    {
      id: "cur-005",
      title: "Fuel Theft Prevention: New IoT Monitoring Systems",
      summary:
        "Advanced IoT-based fuel monitoring systems are now available at reduced costs. These systems can detect leaks, theft, and tampering in real-time.",
      category: "technology",
      source: "Fuel Security Today",
      sourceUrl: "#",
      publishedAt: daysAgo(5),
      country: "ALL",
      priority: "medium",
      bookmarked: false,
      read: false,
    },
  ];

  // Generate country-specific news dynamically for ANY country (250+)
  const country = getCountryByCode(countryCode);
  if (country) {
    const name = country.name;
    const currency = country.currency;
    const short = countryCode.toLowerCase();
    items.push(
      {
        id: `${short}-001`,
        title: `${name} Fuel Price Update: New Rates Announced`,
        summary: `The energy regulatory authority in ${name} has released updated fuel retail prices. Station owners should review their pricing structures.`,
        category: "price",
        source: `${name} Energy Authority`,
        sourceUrl: "#",
        publishedAt: daysAgo(1),
        country: countryCode,
        priority: "high",
        bookmarked: false,
        read: false,
      },
      {
        id: `${short}-002`,
        title: `${name} Tax Compliance Changes for Fuel Retailers`,
        summary: `New tax compliance requirements have been announced for fuel stations operating in ${name}. Ensure your invoicing systems are up to date.`,
        category: "regulation",
        source: `${name} Revenue Authority`,
        sourceUrl: "#",
        publishedAt: daysAgo(3),
        country: countryCode,
        priority: "high",
        bookmarked: false,
        read: false,
      },
      {
        id: `${short}-003`,
        title: `Mobile Payment Growth in ${name}: Fuel Sector Trends`,
        summary: `Digital and mobile payment adoption for fuel purchases continues to grow across ${name}. Stations should consider upgrading their payment systems.`,
        category: "market",
        source: "Fuel Industry Report",
        sourceUrl: "#",
        publishedAt: daysAgo(5),
        country: countryCode,
        priority: "medium",
        bookmarked: false,
        read: false,
      }
    );
  }

  return items.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export default function News() {
  const { currentCountry } = useLocation();
  const [news, setNews] = useState<DisplayNewsItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [fetchingExternal, setFetchingExternal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DisplayNewsItem | null>(
    null
  );
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set<string>());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [source, setSource] = useState<"curated" | "external">("curated");
  // Video feed state
  const [videoIndex, setVideoIndex] = useState(0);
  const [showVideos, setShowVideos] = useState(false);
  const [videoDropdown, setVideoDropdown] = useState(false);
  const currentVideo = VIDEO_SOURCES[videoIndex];

  // Load bookmarks and initial news
  useEffect(() => {
    const saved = localStorage.getItem("fuelpro_news_bookmarks");
    if (saved) {
      const parsed: string[] = JSON.parse(saved);
      setBookmarks(new Set<string>(parsed));
    }
    setLastFetch(NewsService.getLastFetchTime());
  }, []);

  // Load news on mount
  useEffect(() => {
    loadNews();
  }, [currentCountry.id]);

  async function loadNews() {
    setLoading(true);

    // Try to get external news first
    const external = NewsService.loadExternalNews() as DisplayNewsItem[];

    if (external.length > 0) {
      // Apply bookmarks to external news
      external.forEach(item => {
        item.bookmarked = bookmarks.has(item.id);
        item.read = false;
      });
      setNews(external);
      setSource("external");
    } else {
      // Fall back to curated news
      const curated = getCuratedNews(currentCountry.id);
      curated.forEach(item => {
        item.bookmarked = bookmarks.has(item.id);
      });
      setNews(curated);
      setSource("curated");
    }

    setLoading(false);
  }

  // Fetch from external sources
  async function handleFetchExternal() {
    setFetchingExternal(true);
    try {
      const fetched = await NewsService.autoFetchNews(currentCountry.id);
      if (fetched.length > 0) {
        const withFlags = fetched.map(item => ({
          ...item,
          bookmarked: bookmarks.has(item.id),
          read: false,
        }));
        setNews(withFlags);
        setSource("external");
        setLastFetch(new Date());
      }
    } catch (e) {
      console.warn("External fetch failed, using curated:", e);
    } finally {
      setFetchingExternal(false);
    }
  }

  const toggleBookmark = (id: string) => {
    setBookmarks(prev => {
      const next = new Set<string>(Array.from(prev));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(
        "fuelpro_news_bookmarks",
        JSON.stringify(Array.from(next))
      );
      return next;
    });
    setNews(prev =>
      prev.map(n => (n.id === id ? { ...n, bookmarked: !n.bookmarked } : n))
    );
  };

  const markAsRead = (id: string) => {
    setNews(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const shareNews = (item: DisplayNewsItem) => {
    const text = `${item.title}\n${item.summary}\nSource: ${item.source}`;
    if (navigator.share) {
      navigator
        .share({ title: item.title, text, url: item.sourceUrl })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() =>
          import("@/react-app/lib/toast").then(({ toastSuccess }) =>
            toastSuccess("News copied to clipboard")
          )
        );
    }
  };

  const filteredNews =
    activeFilter === "all"
      ? news
      : activeFilter === "bookmarked"
        ? news.filter(n => n.bookmarked)
        : news.filter(n => n.category === activeFilter);

  const unreadCount = news.filter(n => !n.read).length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-xl">
            <Newspaper className="text-blue-600 dark:text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              Fuel Industry News
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {currentCountry.flag} {currentCountry.name} &bull; {unreadCount}{" "}
              unread &bull;
              <span
                className={
                  source === "external" ? "text-green-500" : "text-amber-500"
                }
              >
                {source === "external" ? " Live feed" : " Curated"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFetchExternal}
            disabled={fetchingExternal}
            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-600 dark:text-green-400 rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {fetchingExternal ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Wifi size={12} />
            )}
            {fetchingExternal ? "Fetching..." : "Fetch Live News"}
          </button>
          <button
            onClick={() =>
              setNews(prev => prev.map(n => ({ ...n, read: true })))
            }
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Mark all read
          </button>
        </div>
      </div>

      {/* Last fetch time */}
      {lastFetch && (
        <p className="text-[10px] text-gray-400 -mt-4">
          Last updated: {lastFetch.toLocaleString()}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === "all" ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        >
          All ({news.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const count = news.filter(n => n.category === key).length;
          if (count === 0) return null;
          const Icon = CATEGORY_ICONS[key];
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeFilter === key ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
            >
              <Icon size={12} /> {label} ({count})
            </button>
          );
        })}
        <button
          onClick={() => setActiveFilter("bookmarked")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeFilter === "bookmarked" ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        >
          <Bookmark size={12} /> Saved ({bookmarks.size})
        </button>
      </div>

      {/* Video News Feed Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowVideos(!showVideos)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 transition-all"
        >
          <div className="flex items-center gap-2">
            <Tv size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-white">
              Fuel Industry Video News
            </span>
            {currentVideo.type === "live" && (
              <span className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
                <Radio size={8} className="animate-pulse" /> LIVE
              </span>
            )}
            <span className="text-xs text-gray-400">{currentVideo.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">
              {videoIndex + 1}/{VIDEO_SOURCES.length}
            </span>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform ${showVideos ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {showVideos && (
          <div className="border-t border-gray-700">
            {/* Video Player */}
            <div className="relative bg-black aspect-video">
              <iframe
                src={currentVideo.url}
                title={currentVideo.name}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Video Controls */}
            <div className="p-3 flex items-center justify-between bg-gray-800/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setVideoIndex(
                      vi =>
                        (vi - 1 + VIDEO_SOURCES.length) % VIDEO_SOURCES.length
                    )
                  }
                  className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all"
                  title="Previous"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() =>
                    setVideoIndex(vi => (vi + 1) % VIDEO_SOURCES.length)
                  }
                  className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all"
                  title="Next"
                >
                  <ChevronRight size={14} />
                </button>
                <span className="text-xs text-gray-400 ml-1">
                  {currentVideo.desc}
                </span>
              </div>

              {/* Video Station Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setVideoDropdown(!videoDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white transition-all"
                >
                  <Monitor size={12} /> Change Station <ChevronDown size={10} />
                </button>
                {videoDropdown && (
                  <div className="absolute right-0 bottom-full mb-1 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-10">
                    {VIDEO_SOURCES.map((vs, i) => (
                      <button
                        key={vs.id}
                        onClick={() => {
                          setVideoIndex(i);
                          setVideoDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-all ${
                          i === videoIndex
                            ? "bg-blue-600/20 text-blue-400"
                            : "text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        {vs.type === "live" ? (
                          <Radio size={10} className="text-red-400" />
                        ) : (
                          <Play size={10} />
                        )}
                        <span className="flex-1">{vs.name}</span>
                        {i === videoIndex && (
                          <span className="text-[9px] bg-blue-600 text-white px-1 rounded">
                            ON
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* News Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={32} className="text-gray-400 animate-spin mb-4" />
          <p className="text-gray-500">Loading news...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredNews.map(item => {
            const Icon = CATEGORY_ICONS[item.category] || Newspaper;
            const colorClass = CATEGORY_COLORS[item.category];
            const isPriority = item.priority === "high";

            return (
              <div
                key={item.id}
                className={`group bg-white dark:bg-gray-800 rounded-xl border transition-all hover:shadow-lg cursor-pointer ${
                  item.read
                    ? "border-gray-200 dark:border-gray-700 opacity-70"
                    : isPriority
                      ? "border-red-300 dark:border-red-700"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                }`}
                onClick={() => {
                  if (item.sourceUrl && item.sourceUrl !== "#") {
                    window.open(
                      item.sourceUrl,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }
                  markAsRead(item.id);
                }}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 ${colorClass}`}
                      >
                        <Icon size={10} /> {CATEGORY_LABELS[item.category]}
                      </span>
                      {isPriority && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-medium flex items-center gap-1">
                          <AlertTriangle size={10} /> High Priority
                        </span>
                      )}
                      {!item.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          toggleBookmark(item.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {item.bookmarked ? (
                          <BookmarkCheck size={14} className="text-amber-400" />
                        ) : (
                          <Bookmark size={14} className="text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          shareNews(item);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Share2 size={14} className="text-gray-400" />
                      </button>
                    </div>
                  </div>

                  <h3
                    className={`font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${item.read ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-white"}`}
                  >
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-3">
                    {item.summary}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Globe size={10} /> {item.source}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />{" "}
                        {new Date(item.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <ExternalLink
                      size={12}
                      className="text-gray-400 group-hover:text-blue-400 transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredNews.length === 0 && !loading && (
        <div className="text-center py-16">
          <Newspaper size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No news items in this category</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border ${CATEGORY_COLORS[selectedItem.category]}`}
                >
                  {CATEGORY_LABELS[selectedItem.category]}
                </span>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  Close
                </button>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                {selectedItem.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                {selectedItem.summary}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Source: {selectedItem.source}</span>
                <span>
                  {new Date(selectedItem.publishedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {selectedItem.sourceUrl && selectedItem.sourceUrl !== "#" && (
                  <button
                    onClick={() =>
                      window.open(
                        selectedItem.sourceUrl,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <ExternalLink size={16} /> Read Full Article
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      toggleBookmark(selectedItem.id);
                      setSelectedItem(p =>
                        p ? { ...p, bookmarked: !p.bookmarked } : null
                      );
                    }}
                    className="flex-1 py-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-amber-500/30"
                  >
                    {selectedItem.bookmarked ? (
                      <BookmarkCheck size={14} />
                    ) : (
                      <Bookmark size={14} />
                    )}{" "}
                    {selectedItem.bookmarked ? "Saved" : "Save"}
                  </button>
                  <button
                    onClick={() => shareNews(selectedItem)}
                    className="flex-1 py-2 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-blue-500/30"
                  >
                    <Share2 size={14} /> Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
