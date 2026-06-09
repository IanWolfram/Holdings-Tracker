"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import TopBar from "@/components/layout/TopBar";
import WorldSidebar from "@/components/world/WorldSidebar";
import WorldOverlays from "@/components/world/WorldOverlays";
import { useWorldData } from "@/hooks/useWorldData";
import { useProposedPositions } from "@/hooks/useProposedPositions";
import { TICKER_COORDS } from "@/lib/ticker-coords";
import type { WorldData, CountryState, GeoStory } from "@/types/geo.types";
import type { GlobeFocusTarget } from "@/components/world/GlobeCanvas";
import type { ProposedMarkerData } from "@/components/world/globe/types";

// Three.js must NOT be imported during SSR — dynamic + ssr:false is mandatory
const GlobeCanvas = dynamic(
  () => import("@/components/world/GlobeCanvas"),
  { ssr: false }
);

export default function WorldPage() {
  const { worldData, positions, loading, refreshWorldData } = useWorldData();
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.4);
  const [showProposed, setShowProposed] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("globe-show-proposed") !== "false"
  );
  const heldTickers = useMemo(() => positions.map((p) => p.ticker), [positions]);
  const { proposedEntries } = useProposedPositions(heldTickers);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  // Ticker hovered from inside the country focus panel's logo row. Kept
  // separate from globe-driven `hoveredTicker` so panel hover and map hover
  // never feed back into each other; it highlights the marker's octahedron.
  const [panelHoveredTicker, setPanelHoveredTicker] = useState<string | null>(null);
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

  // Selecting a stock from the country panel behaves exactly like clicking its
  // HQ marker dot on the globe — focuses the ticker (spawns the octahedron) and
  // navigates the camera in close to its location.
  const handleStockSelect = useCallback((ticker: string) => {
    const profile = worldDataRef.current?.profiles[ticker];
    setFocusTarget({ type: "stock", ticker });
    setHoveredCountry(null);
    setHoveredTicker(null);
    if (profile) {
      setNavigatePos({ lat: profile.lat, lon: profile.lon });
    }
  }, []);

  // Keyboard navigation: Escape dismisses, ArrowLeft/Right cycles stocks in the focused country.
  // Uses refs (not closure values) so the handler never goes stale between renders.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismissFocus();
        return;
      }

      if (
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight" &&
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown"
      )
        return;

      const ft = focusTargetRef.current;
      const wd = worldDataRef.current;
      if (!ft || ft.type !== "stock" || !wd) return;

      e.preventDefault();

      const profile = wd.profiles[ft.ticker];
      if (!profile) return;

      // Pick the nearest stock in the pressed compass direction. Buckets are
      // 90° wedges around east/north/west/south (45° from each axis).
      const candidates = Object.values(wd.profiles).filter((p) => p.ticker !== ft.ticker);
      if (candidates.length === 0) return;

      let best: { ticker: string; lat: number; lon: number; dist: number } | null = null;
      for (const p of candidates) {
        const dLat = p.lat - profile.lat;
        let dLon = p.lon - profile.lon;
        if (dLon > 180) dLon -= 360;
        if (dLon < -180) dLon += 360;

        const angle = Math.atan2(dLat, dLon); // east = 0, north = +π/2

        let inBucket = false;
        if (e.key === "ArrowRight") inBucket = Math.abs(angle) <= Math.PI / 4;
        else if (e.key === "ArrowLeft") inBucket = Math.abs(angle) >= (3 * Math.PI) / 4;
        else if (e.key === "ArrowUp") inBucket = angle > Math.PI / 4 && angle < (3 * Math.PI) / 4;
        else if (e.key === "ArrowDown") inBucket = angle < -Math.PI / 4 && angle > -(3 * Math.PI) / 4;

        if (!inBucket) continue;

        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (!best || dist < best.dist) {
          best = { ticker: p.ticker, lat: p.lat, lon: p.lon, dist };
        }
      }

      if (!best) return;

      setFocusTarget({ type: "stock", ticker: best.ticker });
      setNavigatePos({ lat: best.lat, lon: best.lon });
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

  // Fit-to-positions camera overrides, keyed by country code. Instead of
  // framing a whole country (its centroid skews far from where the user
  // actually holds positions — e.g. the US polygon spans Alaska→Hawaii→Maine,
  // so full-territory framing zooms the camera out to hemisphere scale), build
  // the smallest circle around the user's in-country positions and frame that.
  //
  // Computed for EVERY held country, independent of the current focus, so the
  // value is already populated in the globe's ref when `focusCountry` reads it
  // synchronously on click. (Gating this on the current `focusTarget` created a
  // chicken-and-egg: the first click fell through to full-territory framing
  // because the override hadn't been recomputed yet.) Countries with no held
  // positions are absent from the map and fall back to default geo framing.
  const countryFocusOverrides = useMemo(() => {
    if (!worldData) return null;

    const byCountry = new Map<string, { lat: number; lon: number }[]>();
    for (const p of positions) {
      if (p.isProposed) continue;
      const profile = worldData.profiles[p.ticker];
      if (!profile) continue;
      if (!Number.isFinite(profile.lat) || !Number.isFinite(profile.lon)) continue;
      const arr = byCountry.get(profile.countryCode);
      if (arr) arr.push({ lat: profile.lat, lon: profile.lon });
      else byCountry.set(profile.countryCode, [{ lat: profile.lat, lon: profile.lon }]);
    }
    if (byCountry.size === 0) return null;

    const overrides: Record<string, { lat: number; lon: number; angularRadius: number }> = {};
    for (const [code, pts] of byCountry) {
      // Great-circle centroid via averaged unit vectors (handles antimeridian
      // and high-latitude wrap correctly, unlike a naive lat/lon mean).
      let cx = 0, cy = 0, cz = 0;
      for (const { lat, lon } of pts) {
        const phi = (lat * Math.PI) / 180;
        const lam = (lon * Math.PI) / 180;
        cx += Math.cos(phi) * Math.cos(lam);
        cy += Math.cos(phi) * Math.sin(lam);
        cz += Math.sin(phi);
      }
      const norm = Math.hypot(cx, cy, cz);
      cx /= norm; cy /= norm; cz /= norm;
      const centerLat = (Math.asin(cz) * 180) / Math.PI;
      const centerLon = (Math.atan2(cy, cx) * 180) / Math.PI;

      // Max angular distance from centroid to any position (radians).
      let maxAngle = 0;
      for (const { lat, lon } of pts) {
        const phi = (lat * Math.PI) / 180;
        const lam = (lon * Math.PI) / 180;
        const x = Math.cos(phi) * Math.cos(lam);
        const y = Math.cos(phi) * Math.sin(lam);
        const z = Math.sin(phi);
        const dot = Math.max(-1, Math.min(1, x * cx + y * cy + z * cz));
        const a = Math.acos(dot);
        if (a > maxAngle) maxAngle = a;
      }
      // Floor so the camera doesn't pinhole onto a single city; ceiling so
      // even a globe-spanning portfolio doesn't blow past the country view.
      // No extra margin — `zoomForAngularRadius` in `useGlobeScene` already
      // applies a small padding factor on top of this for the override path.
      const angularRadius = Math.min(0.6, Math.max(0.08, maxAngle));
      overrides[code] = { lat: centerLat, lon: centerLon, angularRadius };
    }
    return overrides;
  }, [worldData, positions]);

  // Derive proposed marker data for the globe (resolve coordinates)
  const proposedMarkers: ProposedMarkerData[] = useMemo(() => {
    if (!proposedEntries.length) return [];
    const heldSet = new Set(Object.keys(worldData?.profiles ?? {}));
    return proposedEntries
      .filter((e) => !heldSet.has(e.ticker))
      .map((e) => {
        const existing = worldData?.profiles[e.ticker];
        if (existing && Number.isFinite(existing.lat) && Number.isFinite(existing.lon)) {
          return { ticker: e.ticker, lat: existing.lat, lon: existing.lon, countryCode: existing.countryCode };
        }
        const coords = TICKER_COORDS[e.ticker];
        if (coords) {
          return { ticker: e.ticker, lat: coords.lat, lon: coords.lon, countryCode: "US" };
        }
        return null;
      })
      .filter((m): m is ProposedMarkerData => m !== null);
  }, [proposedEntries, worldData]);

  // Persist toggle state
  useEffect(() => {
    localStorage.setItem("globe-show-proposed", String(showProposed));
  }, [showProposed]);

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
            countryFocusOverrides={countryFocusOverrides}
            externalHoveredTicker={panelHoveredTicker}
            proposedMarkers={proposedMarkers}
            showProposed={showProposed}
            onShowProposedChange={setShowProposed}
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
          onStockSelect={handleStockSelect}
          onStockHover={setPanelHoveredTicker}
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
