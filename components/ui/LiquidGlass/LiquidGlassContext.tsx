"use client";

import React, { createContext, useContext, useRef, useMemo } from "react";

interface LiquidGlassContextValue {
  maskId: string;
  maskRef: React.RefObject<SVGGElement | null>;
}

const LiquidGlassContext = createContext<LiquidGlassContextValue | null>(null);

export const useLiquidGlass = () => useContext(LiquidGlassContext);

export function LiquidGlassProvider({ children, maskId }: { children: React.ReactNode, maskId: string }) {
  const maskRef = useRef<SVGGElement>(null);

  const value = useMemo(() => ({ maskId, maskRef }), [maskId]);

  return (
    <LiquidGlassContext.Provider value={value}>
      {children}
      
      {/* The Global Mask Definition Layer (Hidden) */}
      <svg 
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" 
        aria-hidden="true" 
        style={{ opacity: 0, visibility: "hidden" }}
      >
        <defs>
          <filter id="liquid-glass-gooey" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>

          <mask id={maskId}>
            <g ref={maskRef} filter="url(#liquid-glass-gooey)" fill="white">
              {/* Children will portal silhouette shapes here */}
            </g>
          </mask>
        </defs>
      </svg>
    </LiquidGlassContext.Provider>
  );
}
