"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import PositionCard from "@/components/PositionCard";
import type { CompanyProfile } from "@/types/geo.types";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";

interface Props {
  profile: CompanyProfile;
  position?: Position;
  onClose: () => void;
  stockIndex?: number;
  stockCount?: number;
}

export default function StockDetailPanel({ profile, position, onClose, stockIndex, stockCount }: Props) {
  const [stories, setStories] = useState<ClassifiedStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setStories([]);
    fetch(`/api/news?ticker=${encodeURIComponent(profile.ticker)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStories(data);
      })
      .catch((err) => console.error("[StockDetailPanel] news fetch failed:", err))
      .finally(() => setLoading(false));
  }, [profile.ticker]);

  // Synthesise a Position from profile if none provided (so the card still renders)
  const pos: Position = position ?? {
    ticker: profile.ticker,
    description: profile.name,
    quantity: 0,
    marketValue: 0,
    gainLoss: 0,
    pricePaid: 0,
    currentPrice: 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        top: 76,
        right: 20,
        zIndex: 40,
        pointerEvents: "none",
        width: 360,
        maxWidth: "calc(100vw - 48px)",
        maxHeight: "calc(100vh - 106px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Anchor for dashed connector from globe octahedron */}
      <span
        id="focus-panel-anchor"
        style={{ position: "absolute", left: 0, top: 40, width: 0, height: 0, pointerEvents: "none" }}
      />

      {/* Close + nav footer */}
      <div
        className="pointer-events-auto"
        style={{
          borderRadius: 13,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 106px)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,255,136,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* PositionCard — frosted=true triggers heavier blur + opaque background */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <PositionCard
            position={pos}
            stories={stories}
            loading={loading}
            frosted
          />
        </div>

        {/* Footer: nav hint + close button */}
        <div
          style={{
            background: "rgba(9,14,9,0.97)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            padding: "6px 13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          {stockIndex !== undefined && stockCount !== undefined ? (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#334155", letterSpacing: "0.05em" }}>
              ← {stockIndex} OF {stockCount} · ESC TO DISMISS →
            </span>
          ) : (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#1e293b", letterSpacing: "0.05em" }}>
              ESC OR CLICK OUTSIDE TO DISMISS
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "#334155",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              letterSpacing: "0.05em",
            }}
          >
            ✕ CLOSE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
