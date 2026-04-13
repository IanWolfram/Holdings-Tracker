import React from "react";
import { GraphProps } from "./types";
import { SparklinePath } from "./SparklinePath";
import { YAxis } from "./YAxis";
import { XAxis } from "./XAxis";

/**
 * Graph component - Main coordinator for the visualization
 */
export function Graph({ data, width = 60, height = 24 }: GraphProps) {
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
  
  const pl = 16; 
  const pr = 2;
  const py = 4;

  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * (width - pl - pr) + pl,
    y: (height - py * 2) - ((val - min) / range) * (height - py * 2) + py,
  }));

  return (
    <div className="relative group/spark" style={{ width, height }}>
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
        <YAxis pl={pl} py={py} height={height} max={max} min={min} />
        
        {/* Interior Grid Line */}
        <line 
          x1={pl} y1={height / 2} x2={width - pr} y2={height / 2} 
          stroke="currentColor" 
          className="text-white/5" 
          strokeWidth={0.5} 
          strokeDasharray="2,2" 
        />

        <SparklinePath points={points} isPositive={isPositive} />
      </svg>
    </div>
  );
}
