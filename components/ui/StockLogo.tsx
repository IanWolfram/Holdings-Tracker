"use client";

import React, { useState } from "react";

interface StockLogoProps {
  ticker: string;
  size?: number;
}

export default function StockLogo({ ticker, size = 36 }: StockLogoProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  const logoUrl = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=svg`;

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size * 0.22,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
        background: logoFailed ? "rgba(255,255,255,0.04)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {logoFailed ? (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: Math.round(size * 0.32),
            fontWeight: 700,
            color: "#00FF88",
          }}
        >
          {initials}
        </span>
      ) : (
        <img
          src={logoUrl}
          alt={ticker}
          draggable={false}
          onError={() => setLogoFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
}