// PositionChart.tsx — drop-in sparkline for PositionCard.
// Renders a price line + forecast in an SVG that fills its container width.
//
// Usage:
//   <PositionChart
//     priceSeries={pricePoints}        // [{ t: number, price: number }, ...]
//     forecastSeries={forecastPoints}  // same shape (optional)
//     height={36}                      // pixel height; width fills the parent
//     positive={pnl >= 0}              // optional — flips the color to red
//   />
//
// The component measures its own rendered width and stretches the plot to fill
// it (no distortion), so it adapts to whatever column the card grid hands it.

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Point = { t: number; price: number };

interface PositionChartProps {
  priceSeries: Point[];
  forecastSeries?: Point[];
  height?: number;
  positive?: boolean;
  /**
   * When set, renders the cost-basis style: a dashed horizontal line at this
   * price, the price line drawn green above the line and red below it.
   * Overrides `positive` coloring.
   */
  costBasis?: number;
  /** Tick labels positioned along the x-axis. `pos` is a 0→1 fraction of the chart width. */
  ticks?: { pos: number; label: string }[];
  /** Marks the purchase point: `t` matches a `priceSeries` index. Drawn as a vertical line. */
  buyMarker?: { t: number };
  /** Target number of points to render. The line is downsampled to this count. */
  targetPoints?: number;
  className?: string;
}

const CHART = {
  x0: 4,          // plot left (after the y-label gutter)
  x1Fallback: 158, // plot right used until the real width is measured
  y0: 5,          // top of chart area
  y1: 25,         // bottom of chart area (line region)
  yBaseline: 26,  // where the area path closes
  yAxis: 28,      // tick line
  yLabel: 33,     // text labels
  gutter: 15,     // left gutter (viewBox extends to -gutter) for y-axis labels
  rightPad: 3,    // padding to the right of the plot
};
// viewBox height in user units (top margin of 1 + content down to yLabel + 4).
const VBH = CHART.yLabel + 4;

const COLOR = {
  positive: '#00ff88',
  positiveDim: '#00cc6e',
  negative: '#ff4444',
  negativeDim: '#cc3838',
  forecast: 'rgba(148, 163, 184, 0.22)', // slate-400 @ 22%
  tick: 'rgba(255, 255, 255, 0.10)',
  tickLabel: 'rgba(255, 255, 255, 0.32)',
  tickLabelActive: 'rgba(255, 255, 255, 0.55)',
  costLine: 'rgba(234, 179, 8, 0.55)', // amber dashed cost-basis reference
};

// ─── helpers ─────────────────────────────────────────────────────────────

function downsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  const out: T[] = [];
  const step = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

function scaleSeries(
  pts: Point[],
  yMin: number,
  yMax: number,
  xMin: number,
  xMax: number
): Array<[number, number]> {
  const tMin = pts[0].t;
  const tMax = pts[pts.length - 1].t;
  const tSpan = Math.max(1e-9, tMax - tMin);
  const pSpan = Math.max(1e-9, yMax - yMin);
  return pts.map((p) => {
    const x = xMin + ((p.t - tMin) / tSpan) * (xMax - xMin);
    // invert y: higher price → smaller y (SVG)
    const y = CHART.y1 - ((p.price - yMin) / pSpan) * (CHART.y1 - CHART.y0);
    return [x, y];
  });
}

// Catmull-Rom → cubic Bezier path (smooth line through every point)
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function fmtPrice(v: number): string {
  const abs = Math.abs(v);
  const s = abs >= 100 ? Math.round(v).toString() : abs >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `$${s}`;
}

// ─── component ───────────────────────────────────────────────────────────

export function PositionChart({
  priceSeries,
  forecastSeries,
  height = 34,
  positive = true,
  costBasis,
  ticks,
  buyMarker,
  targetPoints = 56,
  className = '',
}: PositionChartProps) {
  const costMode = typeof costBasis === 'number' && costBasis > 0;
  // Stable IDs in case multiple charts render on the same page (gradient ids must be unique).
  const uid = useMemo(() => `pc-${Math.random().toString(36).slice(2, 8)}`, []);

  // Measure the rendered width so the plot can stretch to fill the column.
  const svgRef = useRef<SVGSVGElement>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setBoxW(entries[0]?.contentRect.width ?? el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Inner plot right edge. Pick x1 so the viewBox aspect matches the rendered
  // box (width / height) — that way `meet` fills the width with no distortion.
  const x1 = boxW > 0
    ? Math.max(120, (VBH * boxW) / height - (CHART.gutter + CHART.rightPad))
    : CHART.x1Fallback;
  const vbWidth = x1 + CHART.gutter + CHART.rightPad;

  const { pricePath, pricePathBefore, pricePathAfter, areaPath, forecastPath, endpoint, tickLabels, yLabels, yCost, markerX } = useMemo(() => {
    if (!priceSeries.length) {
      return { pricePath: '', pricePathBefore: '', pricePathAfter: '', areaPath: '', forecastPath: '', endpoint: null, tickLabels: [], yLabels: [], yCost: null, markerX: null };
    }

    // Combined range so price, forecast and the cost line share a y-axis.
    const all = forecastSeries ? [...priceSeries, ...forecastSeries] : priceSeries;
    const prices = all.map((p) => p.price);
    if (costMode) prices.push(costBasis as number);
    const yMin = Math.min(...prices);
    const yMax = Math.max(...prices);
    // Padding so peaks/troughs don't touch the edges
    const pad = (yMax - yMin) * 0.08 || 1;
    const yLo = yMin - pad;
    const yHi = yMax + pad;
    const pSpan = Math.max(1e-9, yHi - yLo);
    const priceToY = (p: number) => CHART.y1 - ((p - yLo) / pSpan) * (CHART.y1 - CHART.y0);

    const priceDs = downsample(priceSeries, targetPoints);
    const priceScaled = scaleSeries(priceDs, yLo, yHi, CHART.x0, x1);
    const pricePath = smoothPath(priceScaled);

    const areaPath = `${pricePath} L ${x1} ${CHART.yBaseline} L ${CHART.x0} ${CHART.yBaseline} Z`;

    let forecastPath = '';
    if (forecastSeries && forecastSeries.length > 1) {
      const fcDs = downsample(forecastSeries, targetPoints);
      const fcScaled = scaleSeries(fcDs, yLo, yHi, CHART.x0, x1);
      forecastPath = smoothPath(fcScaled);
    }

    const endpoint = priceScaled[priceScaled.length - 1];
    const yCost = costMode ? priceToY(costBasis as number) : null;

    // x-position of the purchase date.
    let markerX: number | null = null;
    if (buyMarker) {
      const tMin = priceSeries[0].t;
      const tMax = priceSeries[priceSeries.length - 1].t;
      const tSpan = Math.max(1e-9, tMax - tMin);
      markerX = CHART.x0 + ((buyMarker.t - tMin) / tSpan) * (x1 - CHART.x0);
    }

    // Split the scaled points into before-buy (dashed) and after-buy (solid).
    let pricePathBefore = '';
    let pricePathAfter = '';
    if (markerX != null && priceScaled.length > 1) {
      const beforePts: Array<[number, number]> = [];
      const afterPts: Array<[number, number]> = [];
      for (const pt of priceScaled) {
        if (pt[0] <= markerX) {
          beforePts.push(pt);
        } else {
          afterPts.push(pt);
        }
      }
      // Ensure the buy-point itself bridges both segments.
      if (beforePts.length > 0 && afterPts.length > 0) {
        afterPts.unshift(beforePts[beforePts.length - 1]);
      }
      pricePathBefore = beforePts.length >= 2 ? smoothPath(beforePts) : '';
      pricePathAfter = afterPts.length >= 2 ? smoothPath(afterPts) : '';
    }

    const tickLabels = (ticks ?? []).map((t) => ({
      x: CHART.x0 + t.pos * (x1 - CHART.x0),
      label: t.label,
      active: t.pos >= 0.985,
      anchor: t.pos <= 0.04 ? 'start' : t.pos >= 0.96 ? 'end' : 'middle',
    }));

    // Up to 3 price labels (high / mid / low) along the left edge, on the shared y-scale.
    const yLabels = [yMax, (yMin + yMax) / 2, yMin].map((v) => ({ y: priceToY(v), label: fmtPrice(v) }));

    return { pricePath, pricePathBefore, pricePathAfter, areaPath, forecastPath, endpoint, tickLabels, yLabels, yCost, markerX };
  }, [priceSeries, forecastSeries, targetPoints, ticks, costMode, costBasis, buyMarker, x1]);

  const main = positive ? COLOR.positive : COLOR.negative;
  const mainDim = positive ? COLOR.positiveDim : COLOR.negativeDim;
  // In cost mode the endpoint dot matches whichever side of the cost line it sits on.
  const endAboveCost = endpoint && yCost != null ? endpoint[1] <= yCost : true;
  const endColor = costMode ? (endAboveCost ? COLOR.positive : COLOR.negative) : main;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      viewBox={`${-CHART.gutter} -1 ${vbWidth} ${VBH}`}
      preserveAspectRatio="xMidYMid meet"
      className={`block overflow-visible select-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={main} stopOpacity={0.32} />
          <stop offset="60%" stopColor={mainDim} stopOpacity={0.08} />
          <stop offset="100%" stopColor={main} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={mainDim} />
          <stop offset="100%" stopColor={main} />
        </linearGradient>
        {costMode && yCost != null && (
          <>
            <clipPath id={`${uid}-above`}>
              <rect x={-CHART.gutter} y={-5} width={vbWidth} height={yCost + 5} />
            </clipPath>
            <clipPath id={`${uid}-below`}>
              <rect x={-CHART.gutter} y={yCost} width={vbWidth} height={CHART.yLabel + 10 - yCost} />
            </clipPath>
          </>
        )}
      </defs>

      {/* x-axis labels */}
      {tickLabels.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={CHART.yLabel}
          textAnchor={t.anchor as 'start' | 'middle' | 'end'}
          fontFamily="JetBrains Mono, ui-monospace, monospace"
          fontSize={4.5}
          letterSpacing={0.5}
          fontWeight={t.active ? 600 : 500}
          fill={t.active ? COLOR.tickLabelActive : COLOR.tickLabel}
        >
          {t.label}
        </text>
      ))}

      {/* y-axis price labels — high / mid / low along the left gutter */}
      {yLabels.map((l, i) => (
        <text
          key={`y${i}`}
          x={CHART.x0 - 3}
          y={l.y}
          textAnchor="end"
          dominantBaseline="central"
          fontFamily="JetBrains Mono, ui-monospace, monospace"
          fontSize={4}
          letterSpacing={0.3}
          fontWeight={500}
          fill={COLOR.tickLabel}
        >
          {l.label}
        </text>
      ))}

      {/* forecast — quiet slate, no dashes */}
      {forecastPath && (
        <path
          d={forecastPath}
          fill="none"
          stroke={COLOR.forecast}
          strokeWidth={0.6}
          strokeLinecap="round"
        />
      )}

      {costMode && yCost != null ? (
        <>
          {/* price line split by the cost line: green above, red below */}
          {markerX != null && pricePathBefore && pricePathAfter ? (
            <>
              <path
                d={pricePathBefore}
                fill="none"
                stroke={COLOR.positive}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2 1.6"
                clipPath={`url(#${uid}-above)`}
              />
              <path
                d={pricePathBefore}
                fill="none"
                stroke={COLOR.negative}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2 1.6"
                clipPath={`url(#${uid}-below)`}
              />
              <path
                d={pricePathAfter}
                fill="none"
                stroke={COLOR.positive}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                clipPath={`url(#${uid}-above)`}
              />
              <path
                d={pricePathAfter}
                fill="none"
                stroke={COLOR.negative}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                clipPath={`url(#${uid}-below)`}
              />
            </>
          ) : (
            <>
              <path
                d={pricePath}
                fill="none"
                stroke={COLOR.positive}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                clipPath={`url(#${uid}-above)`}
              />
              <path
                d={pricePath}
                fill="none"
                stroke={COLOR.negative}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                clipPath={`url(#${uid}-below)`}
              />
            </>
          )}
          {/* dashed cost-basis reference */}
          <line
            x1={CHART.x0}
            y1={yCost}
            x2={x1}
            y2={yCost}
            stroke={COLOR.costLine}
            strokeWidth={0.6}
            strokeDasharray="2 1.6"
          />
        </>
      ) : (
        <>
          {/* area fill */}
          <path d={areaPath} fill={`url(#${uid}-area)`} />
          {/* price line — dashed before buy, solid after */}
          {markerX != null && pricePathBefore && pricePathAfter ? (
            <>
              <path
                d={pricePathBefore}
                fill="none"
                stroke={`url(#${uid}-line)`}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2 1.6"
              />
              <path
                d={pricePathAfter}
                fill="none"
                stroke={`url(#${uid}-line)`}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <path
              d={pricePath}
              fill="none"
              stroke={`url(#${uid}-line)`}
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </>
      )}

      {/* endpoint: halo + dot, no glow filter */}
      {endpoint && (
        <>
          <circle cx={endpoint[0]} cy={endpoint[1]} r={2.4} fill={endColor} fillOpacity={0.15} />
          <circle cx={endpoint[0]} cy={endpoint[1]} r={1.2} fill={endColor} />
        </>
      )}
    </svg>
  );
}

export default PositionChart;
