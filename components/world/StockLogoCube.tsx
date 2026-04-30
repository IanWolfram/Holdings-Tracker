"use client";

import type { CompanyProfile } from "@/types/geo.types";
import { useState } from "react";

const CUBE = 26;
const HALF = CUBE / 2;

const FACE_TRANSFORMS = [
  `translateZ(${HALF}px)`,
  `rotateY(180deg) translateZ(${HALF}px)`,
  `rotateY(90deg) translateZ(${HALF}px)`,
  `rotateY(-90deg) translateZ(${HALF}px)`,
  `rotateX(90deg) translateZ(${HALF}px)`,
  `rotateX(-90deg) translateZ(${HALF}px)`,
];

interface Props {
  profiles: CompanyProfile[];
}

export default function StockLogoCube({ profiles }: Props) {
  if (profiles.length === 0) return null;

  return (
    <div
      id="marker-cubes"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 42,
      }}
    >
      <style>{`
        .mc-wrap.spinning { animation: mc-bounce 2.2s ease-in-out infinite; }
        .mc-inner { transition: none; }
        @keyframes mc-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
      `}</style>
      {profiles.map((p) => (
        <StockCube key={p.ticker} profile={p} />
      ))}
    </div>
  );
}

function StockCube({ profile }: { profile: CompanyProfile }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = profile.ticker
    .replace(/[^A-Z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
  const logoUrl = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(profile.ticker)}?format=svg`;

  return (
    <div
      id={`marker-cube-${profile.ticker}`}
      className="marker-cube-pos"
      data-ticker={profile.ticker}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        opacity: 0,
        willChange: "transform, opacity",
        pointerEvents: "none",
        perspective: 200,
      }}
    >
      <div className="mc-wrap" style={{ transformStyle: "preserve-3d" }}>
        <div
          className="mc-inner"
          style={{
            width: CUBE,
            height: CUBE,
            position: "relative",
            transformStyle: "preserve-3d",
          }}
        >
          {FACE_TRANSFORMS.map((ft, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
                background: logoFailed ? "rgba(9,14,9,0.92)" : "rgba(0,0,0,0.6)",
                borderRadius: 6,
                overflow: "hidden",
                transform: ft,
              }}
            >
              {/* Blurred color wash: logo stretched & blurred so edges match logo palette */}
              {!logoFailed && (
                <div
                  style={{
                    position: "absolute",
                    inset: -12,
                    borderRadius: 6,
                    backgroundImage: `url(${logoUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "blur(8px)",
                  }}
                />
              )}
              {/* Sharp logo centered on top */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                }}
              >
                {logoFailed ? (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 8,
                      fontWeight: 700,
                      color: "#00FF88",
                      textShadow: "0 0 4px rgba(0,255,136,0.4)",
                    }}
                  >
                    {initials}
                  </span>
                ) : (
                  <img
                    src={logoUrl}
                    alt={profile.ticker}
                    draggable={false}
                    onError={() => setLogoFailed(true)}
                    style={{
                      width: CUBE * 0.72,
                      height: CUBE * 0.72,
                      objectFit: "contain",
                      filter: "drop-shadow(0 0 2px rgba(0,255,136,0.15))",
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}