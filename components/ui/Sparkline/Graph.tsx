import React from "react";
import type { GraphProps } from "./types";
import { SparklinePath } from "./SparklinePath";
import { XAxis } from "./XAxis";

/**
 * Graph component - Main coordinator for the visualization
 */
export function Graph({ data, width = 60, height = 24, purchaseDate }: GraphProps) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        <div className="w-full h-[1px] bg-white/5" />
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const isPositive = data[data.length - 1] >= data[0];

  const pl = 4;
  const pr = 4;
  const py = 6;

  const toY = (val: number) =>
    (height - py * 2) - ((val - min) / range) * (height - py * 2) + py;
  const toX = (i: number) =>
    (i / (data.length - 1)) * (width - pl - pr) + pl;

  // Calculate purchase date line position
  let purchaseDateX: number | null = null;
  if (purchaseDate) {
    const now = Date.now();
    const daysOld = (now - purchaseDate) / (1000 * 60 * 60 * 24);
    const dataPointsBack = Math.min(Math.max(daysOld, 0), data.length - 1);
    purchaseDateX = toX(dataPointsBack);
  }

  const points = data.map((val, i) => ({ x: toX(i), y: toY(val) }));

  // SMA with window = ~25% of data length, min 3
  // Uses expanding window at start so the line is "complete" from i=0
  const window = Math.max(3, Math.floor(data.length * 0.25));
  const smaPoints = data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const subset = data.slice(start, i + 1);
    const avg = subset.reduce((s, v) => s + v, 0) / subset.length;
    return { x: toX(i), y: toY(avg) };
  });

  const priceColor = isPositive ? "#00FF88" : "#FF4444";

  return (
    <div className="relative group/spark flex flex-col gap-1" style={{ width }}>
      {/* Legend — offset right by half the Y-axis padding to center over the plot area */}
      <div className="flex items-center justify-center" style={{ paddingLeft: pl - pr }}>
      <div className="flex items-center gap-3 border border-white/10 px-2 py-1">
        <div className="flex items-center gap-1">
          <svg width="10" height="6">
            <circle cx="5" cy="3" r="2" fill={priceColor} />
          </svg>
          <span style={{ fontSize: 5, fontFamily: "monospace", color: "rgba(255,255,255,0.5)", fontWeight: "bold", letterSpacing: "0.05em" }}>
            PRICE
          </span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="10" height="6">
            <circle cx="5" cy="3" r="2" fill="rgba(148,163,184,0.7)" />
          </svg>
          <span style={{ fontSize: 5, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", fontWeight: "bold", letterSpacing: "0.05em" }}>
            SMA
          </span>
        </div>
      </div>
      </div>

      <svg width={width} height={height} className="overflow-visible select-none">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <XAxis
          pl={pl} pr={pr} py={py}
          width={width} height={height}
          points={points} dataLength={data.length}
        />

        {/* Interior Grid Line */}
        <line
          x1={pl} y1={height / 2} x2={width - pr} y2={height / 2}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />

        {/* Purchase Date Line */}
        {purchaseDateX !== null && (
          <line
            x1={purchaseDateX} y1={py} x2={purchaseDateX} y2={height - py}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={1.2}
            strokeDasharray="3,3"
          />
        )}

        {/* SMA dashed line */}
        {smaPoints.length >= 2 && (
          <path
            d={smaPoints.reduce((acc, p, i) =>
              i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, ""
            )}
            fill="none"
            stroke="rgba(148,163,184,0.55)"
            strokeWidth={1}
            strokeDasharray="3,2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        <SparklinePath points={points} isPositive={isPositive} />
      </svg>
    </div>
  );
}
