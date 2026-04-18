"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import CountryTooltip from "@/components/world/CountryTooltip";
import CountryFocusPanel from "@/components/world/CountryFocusPanel";
import StockFocusPanel from "@/components/world/StockFocusPanel";
import StockDetailPanel from "@/components/world/StockDetailPanel";
import NewsCard from "@/components/NewsCard";
import NewsCollapsible from "@/components/NewsCollapsible";
import type { WorldData, CountryState, GeoStory } from "@/types/geo.types";
import type { GlobeFocusTarget } from "@/components/world/GlobeCanvas";
import type { Position } from "@/types/position.types";

const NewspaperIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00FF88]"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>);

// Sector icons — 13×13 stroke SVGs
const S = ({ children, c, vb = "0 0 24 24" }: { children: React.ReactNode; c: string; vb?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox={vb} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const SECTOR_ICONS: Record<string, React.ReactNode> = {
  "Semiconductors": <S c="#7a9ec4"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 7V4M12 7V4M15 7V4M9 17v3M12 17v3M15 17v3M7 9H4M7 12H4M7 15H4M17 9h3M17 12h3M17 15h3"/></S>,
  "Technology": <S c="#8c9eb4"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></S>,
  "Healthcare": <S c="#b87070"><path d="M12 2v20M2 12h20"/></S>,
  "Agriculture": <S c="#b89a44">
    {/* 5 stalks — start at y=6 to leave room for grain heads */}
    <path d="M7.5 6L9 22" strokeWidth="1.1"/>
    <path d="M9.5 6L10.5 22" strokeWidth="1.1"/>
    <path d="M12 6L12 22" strokeWidth="1.1"/>
    <path d="M14.5 6L13.5 22" strokeWidth="1.1"/>
    <path d="M16.5 6L15 22" strokeWidth="1.1"/>
    {/* String tie */}
    <path d="M8.5 13Q12 14 15.5 13" strokeWidth="1.5"/>
    <path d="M8.5 15.5Q12 16.5 15.5 15.5" strokeWidth="1.5"/>
    {/* Grain heads — short stem up + two angled spikes each side */}
    <path d="M7.5 6V3.5 M7.5 4.5L6.2 2.5 M7.5 4.5L8.8 2.5" strokeWidth="1"/>
    <path d="M9.5 6V3.5 M9.5 4.5L8.2 2.5 M9.5 4.5L10.8 2.5" strokeWidth="1"/>
    <path d="M12 6V3.5 M12 4.5L10.7 2.5 M12 4.5L13.3 2.5" strokeWidth="1"/>
    <path d="M14.5 6V3.5 M14.5 4.5L13.2 2.5 M14.5 4.5L15.8 2.5" strokeWidth="1"/>
    <path d="M16.5 6V3.5 M16.5 4.5L15.2 2.5 M16.5 4.5L17.8 2.5" strokeWidth="1"/>
  </S>,
  "Energy": <S c="#c49050"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z"/></S>,
  "Financials": <S c="#7aaa84"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></S>,
  "Financial Services": <S c="#7aaa84"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></S>,
  "Consumer Discretionary": <S c="#9484b8"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></S>,
  "Consumer Staples": <S c="#5e9898"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></S>,
  "Industrials": <S c="#7a8ea6"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></S>,
  "Materials": <S c="#5a96a6"><circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 2a10 10 0 0 0 0 20"/><path d="M2 12h20"/></S>,
  "Real Estate": <S c="#a87e5a"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></S>,
  "Utilities": <S c="#a8a040"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></S>,
  "Communication Services": <S c="#7878b4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02Z"/></S>,
  "Unclassified": <S c="#607090"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></S>,
};
const ChevronDownIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>);
const ChevronRightIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>);
const BriefcaseIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00FF88]"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>);

// Three.js must NOT be imported during SSR — dynamic + ssr:false is mandatory
const GlobeCanvas = dynamic(
  () => import("@/components/world/GlobeCanvas"),
  { ssr: false }
);

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export default function WorldPage() {
  const [worldData, setWorldData] = useState<WorldData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.4);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<GlobeFocusTarget>(null);
  const [navigatePos, setNavigatePos] = useState<{ lat: number; lon: number } | null>(null);
  const focusTargetRef = useRef<GlobeFocusTarget>(null);
  const worldDataRef = useRef<WorldData | null>(null);
  const [newsPanelOpen, setNewsPanelOpen] = useState(true);
  const [holdingsOpen, setHoldingsOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWorldData = useCallback(async () => {
    try {
      const [worldRes, posRes] = await Promise.all([
        fetch("/api/world"),
        fetch("/api/positions"),
      ]);
      if (!worldRes.ok) {
        console.error("[world-page] /api/world returned", worldRes.status);
      } else {
        const data: WorldData = await worldRes.json();
        setWorldData(data);
      }
      if (posRes.ok) {
        const posData: Position[] = await posRes.json();
        setPositions(posData);
      }
    } catch (err) {
      console.error("[world-page] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorldData();
    intervalRef.current = setInterval(fetchWorldData, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchWorldData]);

  // Keep stable refs in sync so the keyboard handler never reads stale closure values
  useEffect(() => { focusTargetRef.current = focusTarget; }, [focusTarget]);
  useEffect(() => { worldDataRef.current = worldData; }, [worldData]);

  const handleFocusClick = useCallback((target: GlobeFocusTarget) => {
    setFocusTarget(target);
    if (target) {
      setHoveredCountry(null);
      setHoveredTicker(null);
    }
  }, []);

  const handleDismissFocus = useCallback(() => {
    setFocusTarget(null);
    setNavigatePos(null);
  }, []);

  // Keyboard navigation: Escape dismisses, ArrowLeft/Right cycles stocks in the focused country.
  // Uses refs (not closure values) so the handler never goes stale between renders.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismissFocus();
        return;
      }

      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const ft = focusTargetRef.current;
      const wd = worldDataRef.current;
      if (!ft || ft.type !== "stock" || !wd) return;

      // Prevent browser scroll / any other default arrow-key behavior
      e.preventDefault();

      const profile = wd.profiles[ft.ticker];
      if (!profile) return;

      const siblings = Object.values(wd.profiles)
        .filter((p) => p.countryCode === profile.countryCode)
        .sort((a, b) => a.ticker.localeCompare(b.ticker));

      if (siblings.length < 2) return; // nothing to cycle

      const currentIdx = siblings.findIndex((s) => s.ticker === ft.ticker);
      if (currentIdx === -1) return;

      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx = (currentIdx + delta + siblings.length) % siblings.length;
      const next = siblings[nextIdx];

      setFocusTarget({ type: "stock", ticker: next.ticker });
      setNavigatePos({ lat: next.lat, lon: next.lon });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDismissFocus]); // stable — reads focusTargetRef/worldDataRef at call time

  // Stocks in the same country as the focused ticker — for arrow-key nav indicator
  const countryStocks = useMemo(() => {
    if (focusTarget?.type !== "stock" || !worldData) return [];
    const profile = worldData.profiles[focusTarget.ticker];
    if (!profile) return [];
    return Object.values(worldData.profiles)
      .filter((p) => p.countryCode === profile.countryCode)
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [focusTarget, worldData]);

  const stockNavIndex = useMemo(() => {
    if (focusTarget?.type !== "stock") return -1;
    return countryStocks.findIndex((p) => p.ticker === focusTarget.ticker);
  }, [focusTarget, countryStocks]);

  const isFocused = focusTarget !== null;

  const handleCountryHover = useCallback((code: string | null) => {
    if (!isFocused) setHoveredCountry(code);
  }, [isFocused]);

  const handleStockHover = useCallback((ticker: string | null) => {
    setHoveredTicker(ticker);
  }, []);

  const hoveredState: CountryState | null =
    hoveredCountry && worldData
      ? (worldData.countries[hoveredCountry] ?? null)
      : null;

  const linkedStories = useMemo(() => {
    if (!worldData) return [];
    const uniqueMap = new Map();
    
    for (const state of Object.values(worldData.countries)) {
      for (const s of state.stories) {
        const score = s.relevanceScore ?? 0;
        if (score >= relevanceThreshold) {
           if (!uniqueMap.has(s.url)) {
             uniqueMap.set(s.url, s);
           } else {
             // Keep highest score if duplicates exist across regions
             if (score > (uniqueMap.get(s.url).relevanceScore ?? 0)) {
                uniqueMap.set(s.url, s);
             }
           }
        }
      }
    }
    return Array.from(uniqueMap.values()).sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  }, [worldData, relevanceThreshold]);

  // Group globally visible stories by Sector
  const groupedStories = useMemo(() => {
    const groups: Record<string, typeof linkedStories> = {};
    for (const story of linkedStories) {
       const sector = worldData?.profiles[story.ticker]?.sector || "Unclassified";
       if (!groups[sector]) groups[sector] = [];
       groups[sector].push(story);
    }

    // Add fake example stories to populate sector UI
    const fakeStories: GeoStory[] = [
      {
        ticker: "NVDA",
        headline: "TSMC Secures $10B Subsidy for Next-Gen 2nm Wafer Fabrication Facility",
        summary: "Massive expansion in global supply chains...",
        url: "https://example.com/fake-semi",
        datetime: Date.now() / 1000 - 3600,
        verdict: "BUY",
        confidence: 0.92,
        reason: "Supply chain monopoly secured for the next generation of architectures.",
        source: "finnhub",
        originCountryCode: "TW",
        relevanceScore: 0.98
      },
      {
        ticker: "DE",
        headline: "Brazil Drought Risks 15% Reduction in Global Soybean Yields",
        summary: "Agricultural equipment manufacturers brace for impact...",
        url: "https://example.com/fake-agri",
        datetime: Date.now() / 1000 - 86400,
        verdict: "SELL",
        confidence: 0.85,
        reason: "Yield reductions directly correlate to lowered cap-ex on heavy machinery.",
        source: "reddit",
        originCountryCode: "BR",
        relevanceScore: 0.91
      },
      {
        ticker: "PFE",
        headline: "EMA Approves Breakthrough mRNA Therapy for Trial Expansion",
        summary: "European regulators fast-track phase 3 trials...",
        url: "https://example.com/fake-health",
        datetime: Date.now() / 1000 - 18000,
        verdict: "HOLD",
        confidence: 0.76,
        reason: "Approval is positive, but trial completion is 2 years out.",
        source: "finnhub",
        originCountryCode: "DE",
        relevanceScore: 0.88
      }
    ];

    if (!groups["Semiconductors"]) groups["Semiconductors"] = [fakeStories[0]];
    if (!groups["Agriculture"]) groups["Agriculture"] = [fakeStories[1]];
    if (!groups["Healthcare"]) groups["Healthcare"] = [fakeStories[2]];

    // Sort sectors by the highest relevance score found within them
    const sortedEntries = Object.entries(groups).sort((a, b) => {
       const maxA = Math.max(...a[1].map(s => s.relevanceScore ?? 0));
       const maxB = Math.max(...b[1].map(s => s.relevanceScore ?? 0));
       return maxB - maxA;
    });
    return sortedEntries;
  }, [linkedStories, worldData]);

  // Extract user's holdings
  const holdings = useMemo(() => {
    if (!worldData) return [];
    return Object.values(worldData.profiles).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [worldData]);

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: "#050805" }}
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* TopBar */}
      <TopBar
        lastUpdated={worldData ? new Date(worldData.fetchedAt) : null}
        refreshing={loading}
        onRefresh={fetchWorldData}
      />

      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {/* Globe canvas (fills area) */}
        <div className="absolute inset-0">
          <GlobeCanvas
            worldData={worldData}
            relevanceThreshold={relevanceThreshold}
            onCountryHover={handleCountryHover}
            onStockHover={handleStockHover}
            onFocusClick={handleFocusClick}
            isFocused={isFocused}
            focusedTicker={focusTarget?.type === "stock" ? focusTarget.ticker : null}
            focusedCountryCode={
              focusTarget?.type === "country"
                ? focusTarget.code
                : focusTarget?.type === "stock" && worldData?.profiles[focusTarget.ticker]?.countryCode
                ? worldData.profiles[focusTarget.ticker].countryCode
                : null
            }
            navigateTo={navigatePos}
            onRelevanceChange={setRelevanceThreshold}
          />
        </div>

        {/* Global Sidebar Container */}
        <div className="absolute top-4 left-6 z-20 flex flex-col items-start gap-4 w-[340px] max-h-[85vh] pointer-events-none">
          
          {/* Global News Dropdown */}
          <div className="flex flex-col w-full pointer-events-none">
            <button
              onClick={() => setNewsPanelOpen(!newsPanelOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-700/50 backdrop-blur pointer-events-auto transition text-slate-300 w-fit shrink-0"
            >
              <NewspaperIcon />
              <span className="font-mono text-sm tracking-wide">
                Sectors ({groupedStories.length})
              </span>
              {newsPanelOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </button>
  
            {newsPanelOpen && groupedStories.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 w-full overflow-y-auto pointer-events-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent max-h-[45vh]">
                {groupedStories.map(([sector, stories]) => (
                  <NewsCollapsible
                    key={sector}
                    badge={<span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{sector}</span>}
                    icon={SECTOR_ICONS[sector] ?? SECTOR_ICONS["Unclassified"]}
                    count={stories.length}
                    defaultExpanded={false}
                    fullyCollapsible={true}
                  >
                    {stories.map((story, i) => (
                      <NewsCard key={story.url || `story-${i}`} story={story} />
                    ))}
                  </NewsCollapsible>
                ))}
              </div>
            )}
          </div>

          {/* My Holdings Dropdown */}
          <div className="flex flex-col w-full pointer-events-none">
             <button
                onClick={() => setHoldingsOpen(!holdingsOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-700/50 backdrop-blur pointer-events-auto transition text-slate-300 w-fit shrink-0"
             >
                <BriefcaseIcon />
                <span className="font-mono text-sm tracking-wide">
                  My Holdings ({holdings.length})
                </span>
                {holdingsOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
             </button>
             
             {holdingsOpen && holdings.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 w-full overflow-y-auto pointer-events-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent max-h-[35vh]">
                   {holdings.map(h => (
                     <div key={h.ticker} className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5 backdrop-blur-sm shadow-sm hover:bg-black/60 transition-colors">
                        <div className="flex flex-col min-w-0">
                           <span className="font-mono font-bold text-white tracking-widest">{h.ticker}</span>
                           <span className="font-sans text-[10px] text-slate-500 truncate max-w-[200px]" title={h.name}>{h.name}</span>
                        </div>
                        <span className="font-mono text-[9px] text-slate-400 font-bold px-1.5 py-0.5 rounded bg-slate-800/50 border border-slate-700/50 shrink-0 ml-2">
                           {h.countryCode}
                        </span>
                     </div>
                   ))}
                </div>
             )}
          </div>

        </div>

        {/* First-load overlay */}
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "rgba(5, 8, 5, 0.75)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: 10,
            }}
          >
            <div className="text-center space-y-4">
              {/* Spinning ring */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  border: "2px solid rgba(0,255,136,0.2)",
                  borderTop: "2px solid #00FF88",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto",
                }}
              />
              <p
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 15,
                  color: "#94a3b8",
                  margin: 0,
                }}
              >
                Building world intelligence…
              </p>
              <p
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#334155",
                  margin: 0,
                }}
              >
                First load: 2–3 min (cached for 15 min after)
              </p>
            </div>
          </div>
        )}

        {/* Country hover tooltip — hidden while any focus panel is open or a stock is hovered */}
        {hoveredState && !isFocused && !hoveredTicker && (
          <CountryTooltip
            state={hoveredState}
            mouseX={mousePos.x}
            mouseY={mousePos.y}
          />
        )}

        {/* Stock hover panel — shown when hovering a white HQ dot (not clicked/focused) */}
        <AnimatePresence>
          {hoveredTicker && worldData?.profiles[hoveredTicker] && (
            <StockFocusPanel
              profile={worldData.profiles[hoveredTicker]}
              stories={(() => {
                const seen = new Set<string>();
                const out: GeoStory[] = [];
                for (const state of Object.values(worldData.countries)) {
                  for (const s of state.stories) {
                    if (s.ticker === hoveredTicker && !seen.has(s.url)) {
                      seen.add(s.url);
                      out.push(s);
                    }
                  }
                }
                return out.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
              })()}
              position={positions.find((p) => p.ticker === hoveredTicker)}
              onClose={() => setHoveredTicker(null)}
              isHoverPreview
            />
          )}
        </AnimatePresence>

        {/* Backdrop — pointer-events-none so globe dots remain hoverable while focused;
            dismiss is handled by the canvas's own empty-click handler */}
        {isFocused && (
          <div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{ background: "transparent" }}
          />
        )}

        {/* SVG connector overlay — only for stock focus (country focus uses 3D worm instead) */}
        {focusTarget?.type === "stock" && (
          <svg style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 39, overflow: "visible" }}>
            <defs>
              <filter id="connector-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path id="focus-connector-path" d="M -9999 -9999" stroke="rgba(0,255,136,0.38)" strokeWidth="1.5" fill="none" strokeDasharray="5 4" filter="url(#connector-glow)" />
          </svg>
        )}

        {/* Country overview panel */}
        <AnimatePresence>
          {focusTarget?.type === "country" && worldData?.countries[focusTarget.code] && (
            <CountryFocusPanel
              state={worldData.countries[focusTarget.code]}
              onClose={handleDismissFocus}
            />
          )}
        </AnimatePresence>

        {/* Stock / company detail panel (full PositionCard + live news) */}
        <AnimatePresence>
          {focusTarget?.type === "stock" && worldData?.profiles[focusTarget.ticker] && (
            <StockDetailPanel
              profile={worldData.profiles[focusTarget.ticker]}
              position={positions.find((p) => p.ticker === focusTarget.ticker)}
              onClose={handleDismissFocus}
              stockIndex={stockNavIndex >= 0 ? stockNavIndex + 1 : undefined}
              stockCount={countryStocks.length > 1 ? countryStocks.length : undefined}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Spinner keyframes */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
