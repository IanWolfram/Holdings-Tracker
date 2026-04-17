"use client";

import { useState } from "react";

interface CompanyLogoProps {
  ticker: string;
  size?: number;
  radius?: number;
}

export default function CompanyLogo({ ticker, size = 40, radius = 8 }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  const initials = ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();

  if (failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          flexShrink: 0,
          background: "rgba(0,255,136,0.07)",
          border: "1px solid rgba(0,255,136,0.14)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: Math.round(size * 0.3),
            fontWeight: 700,
            color: "#00FF88",
            letterSpacing: "-0.02em",
          }}
        >
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=svg`}
      alt={ticker}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        objectFit: "contain",
        flexShrink: 0,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      onError={() => setFailed(true)}
    />
  );
}
