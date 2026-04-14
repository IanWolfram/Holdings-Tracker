"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import TopBar from "@/components/TopBar";
import CountryTooltip from "@/components/world/CountryTooltip";
import WorldHUD from "@/components/world/WorldHUD";
import NewsCard from "@/components/NewsCard";
import type { WorldData, CountryState } from "@/types/geo.types";

const NewspaperIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00FF88]"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>);
const ChevronDownIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>);
const ChevronRightIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>);

// Three.js must NOT be imported during SSR — dynamic + ssr:false is mandatory
const GlobeCanvas = dynamic(
  () => import("@/components/world/GlobeCanvas"),
  { ssr: false }
);

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export default function WorldPage() {
  const [worldData, setWorldData] = useState<WorldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.4);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [newsPanelOpen, setNewsPanelOpen] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWorldData = useCallback(async () => {
    try {
      const res = await fetch("/api/world");
      if (!res.ok) {
        console.error("[world-page] /api/world returned", res.status);
        return;
      }
      const data: WorldData = await res.json();
      setWorldData(data);
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

  const hoveredState: CountryState | null =
    hoveredCountry && worldData
      ? (worldData.countries[hoveredCountry] ?? null)
      : null;

  // Aggregate and sort visible stories globally
  const linkedStories = useMemo(() => {
    if (!worldData) return [];
    const all = [];
    for (const state of Object.values(worldData.countries)) {
      const active = state.stories.filter((s) => s.relevanceScore >= relevanceThreshold);
      all.push(...active);
    }
    return all.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [worldData, relevanceThreshold]);

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
            onCountryHover={setHoveredCountry}
          />
        </div>

        {/* Global News Sidebar */}
        <div className="absolute top-4 left-6 z-20 flex flex-col items-start min-w-[320px] max-w-[360px] max-h-[85vh] pointer-events-none">
          <button
            onClick={() => setNewsPanelOpen(!newsPanelOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-700/50 backdrop-blur pointer-events-auto transition text-slate-300"
          >
            <NewspaperIcon />
            <span className="font-mono text-sm tracking-wide">
              Global Headlines ({linkedStories.length})
            </span>
            {newsPanelOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>

          {newsPanelOpen && linkedStories.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 w-full overflow-y-auto pointer-events-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {linkedStories.map((story) => (
                <NewsCard key={story.id} story={story} />
              ))}
            </div>
          )}
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

        {/* Country hover tooltip */}
        {hoveredState && (
          <CountryTooltip
            state={hoveredState}
            mouseX={mousePos.x}
            mouseY={mousePos.y}
          />
        )}
      </div>

      {/* HUD bar */}
      <WorldHUD
        worldData={worldData}
        relevanceThreshold={relevanceThreshold}
        onRelevanceChange={setRelevanceThreshold}
      />

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
