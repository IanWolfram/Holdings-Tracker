"use client";

import type { WorldData } from "@/types/geo.types";
import GlobeCanvasFallback from "./GlobeCanvasFallback";
import { useGlobeScene } from "@/components/world/globe/useGlobeScene";
import type { GlobeFocusTarget } from "@/components/world/globe/focus";

export type { GlobeFocusTarget };

interface GlobeCanvasProps {
  worldData: WorldData | null;
  relevanceThreshold: number;
  onCountryHover: (code: string | null) => void;
  onStockHover?: (ticker: string | null) => void;
  onFocusClick: (target: GlobeFocusTarget) => void;
  isFocused: boolean;
  focusedTicker?: string | null;
  focusedCountryCode?: string | null;
  navigateTo?: { lat: number; lon: number } | null;
  onRelevanceChange?: (value: number) => void;
}

export default function GlobeCanvas({
  worldData,
  relevanceThreshold,
  onCountryHover,
  onStockHover,
  onFocusClick,
  isFocused,
  focusedTicker,
  focusedCountryCode,
  navigateTo,
  onRelevanceChange,
}: GlobeCanvasProps) {
  const { mountRef, webglAvailable } = useGlobeScene({
    worldData,
    relevanceThreshold,
    onCountryHover,
    onStockHover,
    onFocusClick,
    isFocused,
    focusedTicker,
    focusedCountryCode,
    navigateTo,
  });

  if (!webglAvailable) {
    return (
      <GlobeCanvasFallback
        worldData={worldData}
        relevanceThreshold={relevanceThreshold}
      />
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full relative">
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "radial-gradient(ellipse at center, #0a110a 0%, #050805 60%, #000000 100%)" }}
      />
      <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-4 bg-slate-900/80 px-5 py-4 rounded-xl border border-slate-700/50 backdrop-blur pointer-events-auto shadow-xl w-48">
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex justify-between items-center px-0.5">
            <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">Zoom</span>
          </div>
          <input
            id="globe-zoom-slider"
            type="range"
            min="1.2"
            max="6.0"
            step="0.01"
            defaultValue="2.6"
            className="w-full h-1 appearance-none bg-slate-800 rounded-full outline-none hover:bg-slate-700 transition cursor-ew-resize"
            style={{ accentColor: "#00FF88" }}
          />
        </div>
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex justify-between items-center px-0.5">
            <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">Shadow</span>
          </div>
          <input
            id="globe-opacity-slider"
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            defaultValue="0.85"
            className="w-full h-1 appearance-none bg-slate-800 rounded-full outline-none hover:bg-slate-700 transition cursor-ew-resize"
            style={{ accentColor: "#00FF88" }}
          />
        </div>
        {onRelevanceChange && (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex justify-between items-center px-0.5">
              <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">Relevance</span>
            </div>
            <input
              id="globe-relevance-slider"
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(relevanceThreshold * 100)}
              onChange={(e) => onRelevanceChange(parseInt(e.target.value) / 100)}
              className="w-full h-1 appearance-none bg-slate-800 rounded-full outline-none hover:bg-slate-700 transition cursor-pointer"
              style={{ accentColor: "#00FF88" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
