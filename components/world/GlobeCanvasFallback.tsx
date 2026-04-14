"use client";

import { useEffect, useRef, useState } from "react";
import type { WorldData } from "@/types/geo.types";

interface GeoFeature {
  type: string;
  properties: Record<string, string>;
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}
interface GeoJSON {
  features: GeoFeature[];
}

interface GlobeCanvasFallbackProps {
  worldData: WorldData | null;
  relevanceThreshold: number;
}

export default function GlobeCanvasFallback({
  worldData,
  relevanceThreshold,
}: GlobeCanvasFallbackProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [geoJSON, setGeoJSON] = useState<GeoJSON | null>(null);

  useEffect(() => {
    fetch("/countries.geojson")
      .then((r) => r.json())
      .then((data: GeoJSON) => setGeoJSON(data))
      .catch((err) => console.error("[globe-fallback] GeoJSON load failed:", err));
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    const canvas = canvasRef.current;
    if (!mount || !canvas || !geoJSON) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelFrame: number;
    let rotation = 0;

    const draw = () => {
      cancelFrame = requestAnimationFrame(draw);

      if (canvas.width !== mount.clientWidth || canvas.height !== mount.clientHeight) {
        canvas.width = mount.clientWidth;
        canvas.height = mount.clientHeight;
      }

      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);

      // Sphere bounds
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.45;

      // Base sphere background
      ctx.fillStyle = "#122416";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Setup styles
      rotation += 0.001;
      const centerLon = rotation * (180 / Math.PI); // degrees
      ctx.lineWidth = 1;
      // We want lines to look smooth
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      // Draw countries
      for (const feature of geoJSON.features) {
        const code = feature.properties["ISO3166-1-Alpha-2"] ?? "";
        const state = worldData?.countries[code];

        const hasRelevantStory = state?.stories.some(
          (s) => s.relevanceScore >= relevanceThreshold
        ) ?? false;

        const verdict = hasRelevantStory ? (state?.netVerdict ?? null) : null;
        
        let strokeStyle = "#335544";
        let opacity = 0.55;

        if (verdict === "BUY") {
          strokeStyle = "#00ff88";
          opacity = 1.0;
        } else if (verdict === "SELL") {
          strokeStyle = "#ff4444";
          opacity = 1.0;
        } else if (verdict === "HOLD") {
          strokeStyle = "#64748b";
          opacity = 1.0;
        }

        ctx.strokeStyle = strokeStyle;
        ctx.globalAlpha = opacity;

        const drawRing = (ring: number[][]) => {
          ctx.beginPath();
          let moved = false;

          for (let i = 0; i < ring.length; i++) {
            const [lon, lat] = ring[i];
            
            // Orthographic projection math
            const lam = lon * Math.PI / 180;
            const phi = lat * Math.PI / 180;
            const lam0 = centerLon * Math.PI / 180;
            
            // Calculate pointing vector dot product to see if point is on front hemisphere (cos >= 0)
            const cosC = Math.cos(phi) * Math.cos(lam - lam0);
            
            if (cosC < 0) {
              // point is behind globe, break path
              moved = false;
              continue;
            }

            const x = cx + radius * (Math.cos(phi) * Math.sin(lam - lam0));
            const y = cy - radius * Math.sin(phi);

            if (!moved) {
              ctx.moveTo(x, y);
              moved = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        };

        if (feature.geometry.type === "Polygon") {
          const coords = feature.geometry.coordinates as number[][][];
          coords.forEach(drawRing);
        } else if (feature.geometry.type === "MultiPolygon") {
          const coords = feature.geometry.coordinates as number[][][][];
          coords.forEach((polygon) => polygon.forEach(drawRing));
        }
      }

      ctx.globalAlpha = 1.0;
    };

    draw();

    return () => {
      cancelAnimationFrame(cancelFrame);
    };
  }, [geoJSON, worldData, relevanceThreshold]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at center, #0a110a 0%, #050805 60%, #000000 100%)",
      }}
    >
      {/* 2D Canvas for fallback drawing */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Warning indicator */}
      <div className="absolute top-4 right-4 pointer-events-none opacity-50 flex items-center space-x-2">
        <span className="material-symbols-outlined text-sm" style={{ color: "#475569" }}>
          speed
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#475569", fontSize: 10 }}>
          WebGL Hardware Accel Disabled (2D Fallback)
        </span>
      </div>
    </div>
  );
}
