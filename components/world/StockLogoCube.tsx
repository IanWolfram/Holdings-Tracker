"use client";

import React, { useState } from "react";

// ============ Terminal Variant (single cube for UI) ============

interface TerminalCubeProps {
  ticker: string;
  size?: number;
  spinning?: boolean;
}

export default function TerminalCube({ ticker, size = 36, spinning = false }: TerminalCubeProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [animClass, setAnimClass] = useState("");
  const initials = ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  const logoUrl = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=svg`;

  const POP_DURATION = 1.4; // seconds for the pop-out transition

  React.useEffect(() => {
    if (spinning) {
      setIs3D(true);
      setAnimClass("");
      const t = setTimeout(() => setAnimClass("tc-spinning"), POP_DURATION * 1000);
      return () => clearTimeout(t);
    } else {
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
  flat?: boolean;
}

function CubeInner({ size, logoUrl, initials, logoFailed, setLogoFailed, flat = false }: CubeInnerProps) {
  if (flat) {
    return (
      <div
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
            overflow: "hidden",
          }}
        >
          {!logoFailed && (
            <div
              style={{
                position: "absolute",
                inset: 0,
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
                  fontSize: Math.round(size * 0.28),
                  fontWeight: 700,
                  color: "#00FF88",
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

  // 3D sphere mode
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 35% 25%, rgba(255,255,255,0.15) 0%, transparent 50%), #0a0a0a",
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: `
              inset -4px -4px 12px rgba(0,0,0,0.6),
              inset 3px 3px 8px rgba(255,255,255,0.12),
              2px 4px 12px rgba(0,0,0,0.4)
            `,
          }}
        >
          {!logoFailed && (
            <div
              style={{
                position: "absolute",
                inset: "8%",
                borderRadius: "50%",
                backgroundImage: `url(${logoUrl})`,
                backgroundSize: "contain",
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
                  fontSize: Math.round(size * 0.28),
                  fontWeight: 700,
                  color: "#00FF88",
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
    </div>
  );
}