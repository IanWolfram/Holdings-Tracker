"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import TopBar from "@/components/layout/TopBar";
import WorldSidebar from "@/components/world/WorldSidebar";
import WorldOverlays from "@/components/world/WorldOverlays";
import { useWorldData } from "@/hooks/useWorldData";
import type { WorldData, CountryState, GeoStory } from "@/types/geo.types";
import type { GlobeFocusTarget } from "@/components/world/GlobeCanvas";

// Three.js must NOT be imported during SSR — dynamic + ssr:false is mandatory
const GlobeCanvas = dynamic(
  () => import("@/components/world/GlobeCanvas"),
  { ssr: false }
);

export default function WorldPage() {
  const { worldData, positions, loading, refreshWorldData } = useWorldData();
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

    // Add fake example stories to populate sector UI (development only)
    if (process.env.NODE_ENV === "development") {
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
          source: "newsapi",
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
    }

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
        onRefresh={refreshWorldData}
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

        <WorldSidebar
          groupedStories={groupedStories}
          newsPanelOpen={newsPanelOpen}
          setNewsPanelOpen={setNewsPanelOpen}
          holdingsOpen={holdingsOpen}
          setHoldingsOpen={setHoldingsOpen}
          holdings={holdings}
        />

        <WorldOverlays
          loading={loading}
          hoveredState={hoveredState}
          hoveredTicker={hoveredTicker}
          isFocused={isFocused}
          mousePos={mousePos}
          worldData={worldData}
          positions={positions}
          focusTarget={focusTarget}
          handleDismissFocus={handleDismissFocus}
          setHoveredTicker={setHoveredTicker}
          stockNavIndex={stockNavIndex}
          countryStocks={countryStocks}
        />
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
