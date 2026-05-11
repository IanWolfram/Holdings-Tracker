"use client";

import type { CompanyProfile } from "@/types/geo.types";
import React, { useState } from "react";
import { PARQET_LOGO_BASE_URL } from "@/lib/constants";

const FACE_TRANSFORMS = (half: number) => [
  `translateZ(${half}px)`,
  `rotateY(180deg) translateZ(${half}px)`,
  `rotateY(90deg) translateZ(${half}px)`,
  `rotateY(-90deg) translateZ(${half}px)`,
  `rotateX(90deg) translateZ(${half}px)`,
  `rotateX(-90deg) translateZ(${half}px)`,
];


// ============ World Variant (multiple cubes on globe) ============

interface WorldCubeProps {
  profiles: CompanyProfile[];
}

export default function StockLogoCube({ profiles }: WorldCubeProps) {
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
        <WorldStockCube key={p.ticker} profile={p} />
      ))}
    </div>
  );
}

function WorldStockCube({ profile }: { profile: CompanyProfile }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = profile.ticker
    .replace(/[^A-Z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
  const logoUrl = `${PARQET_LOGO_BASE_URL}/${encodeURIComponent(profile.ticker)}?format=svg`;

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
      <CubeInner
        size={26}
        logoUrl={logoUrl}
        initials={initials}
        logoFailed={logoFailed}
        setLogoFailed={setLogoFailed}
        variant="world"
      />
    </div>
  );
}

// ============ Terminal Variant (single cube for UI) ============

interface TerminalCubeProps {
  ticker: string;
  size?: number;
  spinning?: boolean;
}

export function TerminalCube({ ticker, size = 36, spinning = false }: TerminalCubeProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [animClass, setAnimClass] = useState("");
  const initials = ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  const logoUrl = `${PARQET_LOGO_BASE_URL}/${encodeURIComponent(ticker)}?format=svg`;

  const POP_DURATION = 1.4; // seconds for the pop-out transition

  // When hover starts: pop out into 3D, then start spin after transition
  // When hover ends: stop spin immediately, collapse back to 2D
  React.useEffect(() => {
    if (spinning) {
      // Start 3D pop-out transition
      setIs3D(true);
      setAnimClass("");
      // Start spinning after the pop-out finishes
      const t = setTimeout(() => setAnimClass("tc-spinning"), POP_DURATION * 1000);
      return () => clearTimeout(t);
    } else {
      // Stop spin, collapse back
      setAnimClass("");
      setIs3D(false);
    }
  }, [spinning]);

  return (
    <div
      style={{
        width: size + 10,
        height: size + 10,
        flexShrink: 0,
        perspective: size * 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes tc-spin {
          0%   { transform: rotateX(-15deg) rotateY(20deg) scale3d(1.15,1.15,1.15); }
          100% { transform: rotateX(-15deg) rotateY(380deg) scale3d(1.15,1.15,1.15); }
        }
        .tc-spinning {
          animation: tc-spin 12s linear infinite;
        }
      `}</style>
      <div
        className={animClass}
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: is3D ? "preserve-3d" : "flat",
          transform: is3D
            ? "rotateX(-15deg) rotateY(20deg) scale3d(1.15,1.15,1.15)"
            : "rotateX(0deg) rotateY(0deg) scale(1)",
          transition: `transform ${POP_DURATION}s cubic-bezier(0.22, 1, 0.36, 1), transform-style ${POP_DURATION}s`,
        }}
      >
        <CubeInner
          size={size}
          logoUrl={logoUrl}
          initials={initials}
          logoFailed={logoFailed}
          setLogoFailed={setLogoFailed}
          variant="terminal"
          flat={!is3D}
        />
      </div>
    </div>
  );
}

// ============ Shared Cube Inner Component ============

interface CubeInnerProps {
  size: number;
  logoUrl: string;
  initials: string;
  logoFailed: boolean;
  setLogoFailed: (failed: boolean) => void;
  variant: "world" | "terminal";
  flat?: boolean;
}

function CubeInner({ size, logoUrl, initials, logoFailed, setLogoFailed, variant, flat = false }: CubeInnerProps) {
  const half = size / 2;
  const borderRadius = 0;

  // Flat 2D mode - just show a single face
  if (flat) {
    return (
      <div
        className={variant === "world" ? "mc-wrap" : undefined}
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "flat",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#000",
            borderRadius: borderRadius,
            overflow: "hidden",
          }}
        >
          {!logoFailed && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 0,
                backgroundImage: `url(${logoUrl})`,
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          )}
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
                  fontSize: variant === "world" ? 8 : Math.round(size * 0.28),
                  fontWeight: 700,
                  color: "#00FF88",
                  ...(variant === "world" && { textShadow: "0 0 4px rgba(0,255,136,0.4)" }),
                }}
              >
                {initials}
              </span>
            ) : (
              <img
                src={logoUrl}
                alt={initials}
                draggable={false}
                onError={() => setLogoFailed(true)}
                style={{
                  width: size * 0.88,
                  height: size * 0.88,
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3D cube mode - show all 6 faces
  return (
    <div
      className={variant === "world" ? "mc-wrap" : undefined}
      style={{
        width: size,
        height: size,
        position: "relative",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Rotation wrapper for world cubes (globe animation targets .mc-inner) */}
      <div
        className={variant === "world" ? "mc-inner" : undefined}
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
      {/* Main 6 faces */}
      {FACE_TRANSFORMS(half).map((ft, i) => (
        <div
          key={`face-${i}`}
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            background: "#000",
            borderRadius: borderRadius,
            overflow: "hidden",
            transform: ft,
          }}
        >
          {/* Logo background fills entire face */}
          {!logoFailed && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 0,
                backgroundImage: `url(${logoUrl})`,
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
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
                  fontSize: variant === "world" ? 8 : Math.round(size * 0.28),
                  fontWeight: 700,
                  color: "#00FF88",
                  ...(variant === "world" && { textShadow: "0 0 4px rgba(0,255,136,0.4)" }),
                }}
              >
                {initials}
              </span>
            ) : (
              <img
                src={logoUrl}
                alt={initials}
                draggable={false}
                onError={() => setLogoFailed(true)}
                style={{
                  width: size * 0.88,
                  height: size * 0.88,
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
