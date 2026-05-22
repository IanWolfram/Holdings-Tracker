// PositionChart.tsx — drop-in sparkline for PositionCard.
// Replaces the glowy version. Renders price line + forecast in a 110×34 viewBox.
//
// Usage:
//   <PositionChart
//     priceSeries={pricePoints}        // [{ t: number, price: number }, ...]
//     forecastSeries={forecastPoints}  // same shape (optional)
//     width={110}
//     height={34}
//     positive={pnl >= 0}              // optional — flips the color to red
//   />
//
// The component handles its own scaling: pass raw {t, price} arrays in any
// units and it normalizes them into the SVG viewBox.

import React, { useMemo } from 'react';

type Point = { t: number; price: number };

interface PositionChartProps {
  priceSeries: Point[];
  forecastSeries?: Point[];
  width?: number;
  height?: number;
  positive?: boolean;
  /** Tick labels along the x-axis (left → right). Defaults to 4 evenly-spaced labels. */
  ticks?: string[];
  /** Target number of points to render. The line is downsampled to this count. */
  targetPoints?: number;
  className?: string;
}

const CHART = {
  // viewBox padding for axis labels
  x0: 4,
  x1: 106,
  y0: 5,     // top of chart area
  y1: 25,    // bottom of chart area (line region)
  yBaseline: 26, // where the area path closes
  yAxis: 28,  // tick line
  yLabel: 33, // text labels
};

const COLOR = {
  positive: '#00ff88',
  positiveDim: '#00cc6e',
  negative: '#ff4444',
  negativeDim: '#cc3838',
  forecast: 'rgba(148, 163, 184, 0.22)', // slate-400 @ 22%
  tick: 'rgba(255, 255, 255, 0.10)',
  tickLabel: 'rgba(255, 255, 255, 0.32)',
  tickLabelActive: 'rgba(255, 255, 255, 0.55)',
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

// ─── component ───────────────────────────────────────────────────────────

export function PositionChart({
  priceSeries,
  forecastSeries,
  width = 110,
  height = 34,
  positive = true,
  ticks,
  targetPoints = 36,
  className = '',
}: PositionChartProps) {
  // Stable IDs in case multiple charts render on the same page (gradient ids must be unique).
  const uid = useMemo(
    () => `pc-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const { pricePath, areaPath, forecastPath, endpoint, tickLabels } = useMemo(() => {
    if (!priceSeries.length) {
      return { pricePath: '', areaPath: '', forecastPath: '', endpoint: null, tickLabels: [] };
    }

    // Combined range so price and forecast share a y-axis
    const all = forecastSeries ? [...priceSeries, ...forecastSeries] : priceSeries;
    const yMin = Math.min(...all.map((p) => p.price));
    const yMax = Math.max(...all.map((p) => p.price));
    // Padding so peaks/troughs don't touch the edges
    const pad = (yMax - yMin) * 0.08 || 1;
    const yLo = yMin - pad;
    const yHi = yMax + pad;

    const priceDs = downsample(priceSeries, targetPoints);
    const priceScaled = scaleSeries(priceDs, yLo, yHi, CHART.x0, CHART.x1);
    const pricePath = smoothPath(priceScaled);

    const areaPath =
      `${pricePath} L ${CHART.x1} ${CHART.yBaseline} L ${CHART.x0} ${CHART.yBaseline} Z`;

    let forecastPath = '';
    if (forecastSeries && forecastSeries.length > 1) {
      const fcDs = downsample(forecastSeries, targetPoints);
      const fcScaled = scaleSeries(fcDs, yLo, yHi, CHART.x0, CHART.x1);
      forecastPath = smoothPath(fcScaled);
    }

    const endpoint = priceScaled[priceScaled.length - 1];

    // Default ticks: 4 evenly across the x range, using array indices for labeling
    const defaultTicks = ticks ?? ['', '', '', ''];
    const tickXs = [CHART.x0, CHART.x0 + (CHART.x1 - CHART.x0) / 3, CHART.x0 + (2 * (CHART.x1 - CHART.x0)) / 3, CHART.x1];
    const tickLabels = defaultTicks.map((label, i) => ({
      x: tickXs[i],
      label,
      active: i === defaultTicks.length - 1,
    }));

    return { pricePath, areaPath, forecastPath, endpoint, tickLabels };
  }, [priceSeries, forecastSeries, targetPoints, ticks]);

  const main = positive ? COLOR.positive : COLOR.negative;
  const mainDim = positive ? COLOR.positiveDim : COLOR.negativeDim;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`-3 -1 ${CHART.x1 + 6} ${CHART.yLabel + 4}`}
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
      </defs>

      {/* x-axis labels */}
      {tickLabels.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={CHART.yLabel}
          textAnchor="middle"
          fontFamily="JetBrains Mono, ui-monospace, monospace"
          fontSize={4.5}
          letterSpacing={0.5}
          fontWeight={t.active ? 600 : 500}
          fill={t.active ? COLOR.tickLabelActive : COLOR.tickLabel}
        >
          {t.label}
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

      {/* area fill */}
      <path d={areaPath} fill={`url(#${uid}-area)`} />

      {/* price line — gradient dim → bright (left → right) */}
      <path
        d={pricePath}
        fill="none"
        stroke={`url(#${uid}-line)`}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* endpoint: halo + dot, no glow filter */}
      {endpoint && (
        <>
          <circle cx={endpoint[0]} cy={endpoint[1]} r={2.4} fill={main} fillOpacity={0.15} />
          <circle cx={endpoint[0]} cy={endpoint[1]} r={1.2} fill={main} />
        </>
      )}
    </svg>
  );
}

export default PositionChart;
