"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import type { WorldData } from "@/types/geo.types";
import GlobeCanvasFallback from "./GlobeCanvasFallback";

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Generates an array of [lon, lat] points for a cleanly spaced dot grid inside a polygon
function dotFillPolygon(rings: number[][][], density: number = 0.85): number[][] {
  const dots: number[][] = [];
  if (rings.length === 0) return dots;

  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  // Bounding box from all rings (supporting holes)
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  // Iterate over latitude with fixed density
  for (let lat = minLat; lat <= maxLat; lat += density) {
    // Correct longitudinal density so dots don't bunch up exponentially near the poles
    const latCos = Math.max(0.1, Math.abs(Math.cos(lat * (Math.PI / 180))));
    const lonStep = density / latCos;
    
    // Offset every other row by half a step for a nice staggered/hexagonal dot pattern
    const rowOffset = (Math.floor(lat / density) % 2 === 0) ? 0 : lonStep * 0.5;

    for (let lon = minLon + rowOffset; lon <= maxLon; lon += lonStep) {
      let inside = false;
      // Raycast across all rings to flawlessly handle intricate boundaries and hollow interior lakes
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i][0], yi = ring[i][1];
          const xj = ring[j][0], yj = ring[j][1];
          
          const intersect = ((yi > lat) !== (yj > lat)) &&
                            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
      }
      if (inside) dots.push([lon, lat]);
    }
  }
  return dots;
}

// ---------------------------------------------------------------------------
// Country border color from verdict
// ---------------------------------------------------------------------------

function verdictColor(verdict: "BUY" | "SELL" | "HOLD" | null): number {
  if (verdict === "BUY") return 0x00ff88;
  if (verdict === "SELL") return 0xff4444;
  if (verdict === "HOLD") return 0x64748b;
  return 0x22442a; // Faint green, bright enough to be visible through clear glass
}

// ---------------------------------------------------------------------------
// GeoJSON types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GlobeCanvasProps {
  worldData: WorldData | null;
  relevanceThreshold: number;
  onCountryHover: (code: string | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GlobeCanvas({
  worldData,
  relevanceThreshold,
  onCountryHover,
}: GlobeCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const countryLinesRef = useRef<THREE.Line[]>([]);
  const frameRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2(-10, -10));
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);

  // Increase raycaster line threshold for easier country hover
  raycasterRef.current.params.Line = { threshold: 0.015 };

  // Build country border lines from GeoJSON coordinates
  const buildCountryLines = useCallback(
    (geoJSON: GeoJSON, scene: THREE.Scene, globeGroup: THREE.Group) => {
      // Clear old lines
      countryLinesRef.current.forEach((l) => {
        globeGroup.remove(l);
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });
      countryLinesRef.current = [];

      for (const feature of geoJSON.features) {
        const code = feature.properties["ISO3166-1-Alpha-2"] ?? "";
        const state = worldData?.countries[code];

        // Are any stories above relevance threshold?
        const hasRelevantStory = state?.stories.some(
          (s) => s.relevanceScore >= relevanceThreshold
        ) ?? false;

        const verdict = hasRelevantStory ? (state?.netVerdict ?? null) : null;
        const color = verdictColor(verdict);
        const opacity = verdict !== null ? 1.0 : 0.45;
        
        // Push active countries slightly outward to perfectly overlap inactive borders without Z-fighting
        const radius = verdict !== null ? 1.002 : 1.001;

        const drawRing = (ring: number[][]) => {
          // 1. Draw outer boundary
          const points: THREE.Vector3[] = ring.map(([lon, lat]) =>
            latLonToVector3(lat, lon, radius)
          );
          if (points.length < 2) return;

          const geom = new THREE.BufferGeometry().setFromPoints(points);
          const mat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: verdict !== null ? 1.0 : opacity, // Boost prominent border
          });
          const line = new THREE.Line(geom, mat);
          line.userData = { code, verdict };
          globeGroup.add(line);
          countryLinesRef.current.push(line);

        const drawPolygonFill = (polygonRings: number[][][]) => {
            if (verdict === null) return;
            // Fill polygon with geodesic dot grid
            const dots = dotFillPolygon(polygonRings, 0.9);
            const dotPoints: THREE.Vector3[] = dots.map(([lon, lat]) => latLonToVector3(lat, lon, radius));
            
            if (dotPoints.length > 0) {
               const dotGeom = new THREE.BufferGeometry().setFromPoints(dotPoints);
               const dotMat = new THREE.PointsMaterial({
                   color,
                   transparent: true,
                   opacity: 0.9,
                   size: 0.007,           // tiny, crisp points 
                   sizeAttenuation: true  // scales into distance
               });
               const pointCloud = new THREE.Points(dotGeom, dotMat);
               pointCloud.userData = { code, verdict: "DOT_FILL" };
               globeGroup.add(pointCloud);
               countryLinesRef.current.push(pointCloud as unknown as THREE.Line);
            }
        };

        if (feature.geometry.type === "Polygon") {
          const coords = feature.geometry.coordinates as number[][][];
          coords.forEach(drawRing);
          drawPolygonFill(coords);
        } else if (feature.geometry.type === "MultiPolygon") {
          const coords = feature.geometry.coordinates as number[][][][];
          coords.forEach((polygon) => {
             polygon.forEach(drawRing);
             drawPolygonFill(polygon);
          });
        }
      }
    },
    [worldData, relevanceThreshold]
  );

  // Main scene setup
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Use a true depth fog exactly matching the CSS radial gradient center 
    // to seamlessly melt the backside lines into the background without turning them grey!
    scene.fog = new THREE.Fog(0x0a110a, 1.0, 3.0);

    // ── Lighting ───────────────────────────────────────────────────────────
    // All lights removed! The glass sphere will now only transmit light from the
    // background lines and stars, without catching any white ambient glare from the scene.

    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 2.6);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // ── Probe WebGL before Three.js tries (suppresses Three's own console.error) ─
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) {
      console.warn("[globe] WebGL not available in this environment — showing fallback");
      setWebglAvailable(false);
      return;
    }

    // ── Renderer ─────────────────────────────────────────────────────────────
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.warn("[globe] WebGL renderer creation failed:", err);
      setWebglAvailable(false);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    
    // Add context loss listener so we seamlessly fallback
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      console.warn("[globe] WebGL context lost! Falling back to 2D Canvas.");
      setWebglAvailable(false);
    }, false);

    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Globe group ────────────────────────────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // ── Atmosphere glow (Thinner, tighter halo) ────────────────────────────
    const atmGeo = new THREE.SphereGeometry(1.025, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    globeGroup.add(new THREE.Mesh(atmGeo, atmMat));

    // ── Starfield ──────────────────────────────────────────────────────────
    const starCount = 2500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 4 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.012,
      transparent: true,
      opacity: 0.7,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Load GeoJSON ───────────────────────────────────────────────────────
    fetch("/countries.geojson")
      .then((r) => r.json())
      .then((geoJSON: GeoJSON) => {
        buildCountryLines(geoJSON, scene, globeGroup);
      })
      .catch((err) => console.error("[globe] GeoJSON load failed:", err));

    // ── HQ markers (built from worldData prop) ─────────────────────────────
    // Will be rebuilt whenever worldData changes (see second useEffect)

    // ── Interaction State ──────────────────────────────────────────────────
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let dragVelocity = { x: 0, y: 0 };
    let targetZoom = 2.6;
    let fogDensity = 0.75;

    // ── Animation loop ─────────────────────────────────────────────────────
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      
      // Smooth zoom interpolation
      camera.position.z += (targetZoom - camera.position.z) * 0.1;

      // Ensure the fog continuously adapts to the camera's zoom distance and the user's opacity slider
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = camera.position.z - 0.2;  // Lines remain 100% sharp from the front to midway
        
        // As opacity slider goes from 0 to 1, we shorten the fog far distance.
        // If Opacity = 1.0 (Max shadow): Fog hits 100% density right at the equator (near + 0.05).
        // If Opacity = 0.0 (Clear): Fog stretches way out, making the backside fully visible.
        const visibilityRange = 0.05 + Math.pow(1.0 - fogDensity, 2) * 6.0;
        scene.fog.far = scene.fog.near + visibilityRange;
      }

      if (!isDragging) {
        dragVelocity.x *= 0.95;
        dragVelocity.y *= 0.95;
        
        if (Math.abs(dragVelocity.x) < 0.1 && Math.abs(dragVelocity.y) < 0.1) {
          globeGroup.rotation.y += 0.0006;
        } else {
          globeGroup.rotation.y += dragVelocity.x * 0.005;
          globeGroup.rotation.x += dragVelocity.y * 0.005;
        }
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // ── Resize handler ─────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    // ── Mouse handler ──────────────────────────────────────────────────────
    const zoomSlider = document.getElementById("globe-zoom-slider") as HTMLInputElement | null;
    if (zoomSlider) {
      zoomSlider.value = targetZoom.toString();
      zoomSlider.addEventListener("input", (e) => {
         targetZoom = parseFloat((e.target as HTMLInputElement).value);
      });
    }

    const opacitySlider = document.getElementById("globe-opacity-slider") as HTMLInputElement | null;
    if (opacitySlider) {
      opacitySlider.value = fogDensity.toString();
      opacitySlider.addEventListener("input", (e) => {
         fogDensity = parseFloat((e.target as HTMLInputElement).value);
      });
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoom += e.deltaY * 0.002;
      targetZoom = Math.max(1.2, Math.min(targetZoom, 6.0));
      if (zoomSlider) zoomSlider.value = targetZoom.toString();
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      dragVelocity = { x: 0, y: 0 };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        dragVelocity.x = e.clientX - previousMousePosition.x;
        dragVelocity.y = e.clientY - previousMousePosition.y;
        globeGroup.rotation.y += dragVelocity.x * 0.005;
        globeGroup.rotation.x += dragVelocity.y * 0.005;
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }

      const rect = mount.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(countryLinesRef.current);

      const code = hits.length > 0
        ? (hits[0].object.userData as { code: string }).code ?? null
        : null;

      if (code !== hoveredRef.current) {
        hoveredRef.current = code;
        onCountryHover(code);
      }
    };
    
    mount.addEventListener("wheel", onWheel, { passive: false });
    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("mousemove", onMouseMove);

    const onMouseLeave = () => {
      isDragging = false;
      hoveredRef.current = null;
      onCountryHover(null);
    };
    mount.addEventListener("mouseleave", onMouseLeave);

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      mount.removeEventListener("wheel", onWheel);
      mount.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("mouseleave", onMouseLeave);
      renderer.dispose();
      scene.clear();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild country lines whenever worldData or relevanceThreshold changes
  useEffect(() => {
    const scene = sceneRef.current;
    const globeGroup = globeGroupRef.current;
    if (!scene || !globeGroup) return;

    fetch("/countries.geojson")
      .then((r) => r.json())
      .then((geoJSON: GeoJSON) => buildCountryLines(geoJSON, scene, globeGroup))
      .catch(() => {/* already logged */});
  }, [worldData, relevanceThreshold, buildCountryLines]);

  // Rebuild HQ markers when worldData changes
  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup) return;

    // Remove old markers
    const toRemove = globeGroup.children.filter(
      (c) => c.userData?.["isMarker"] === true
    );
    toRemove.forEach((m) => {
      globeGroup.remove(m);
      if (m instanceof THREE.Mesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });

    if (!worldData) return;

    const positions = Object.values(worldData.profiles);
    const maxValue = positions.reduce((max, p) => {
      // We don't have position values in CompanyProfile, but we can size uniformly
      return max; // placeholder — uniform size
    }, 1);

    for (const profile of positions) {
      const state = worldData.countries[profile.countryCode];
      const posValue = state?.totalPositionValue ?? 0;
      const scale = posValue > 0 ? Math.max(0.5, Math.min(3, posValue / 50000)) : 1;
      const dotRadius = 0.008 + scale * 0.006;

      const geo = new THREE.SphereGeometry(dotRadius, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = latLonToVector3(profile.lat, profile.lon, 1.018);
      mesh.position.copy(pos);
      mesh.userData = { isMarker: true, ticker: profile.ticker };
      globeGroup.add(mesh);
    }
  }, [worldData]);

  // ── No-WebGL fallback ──────────────────────────────────────────────────
  if (!webglAvailable) {
    return (
      <GlobeCanvasFallback
        worldData={worldData}
        relevanceThreshold={relevanceThreshold}
      />
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full relative">
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "radial-gradient(ellipse at center, #0a110a 0%, #050805 60%, #000000 100%)" }}
      />
      
      {/* Target zoom slider overlay */}
      <div className="absolute bottom-24 right-8 z-20 flex flex-col items-center gap-3">
         <span className="text-xs font-mono text-slate-500 tracking-widest uppercase" style={{ writingMode: "vertical-lr" }}>Zoom</span>
         <input
            id="globe-zoom-slider"
            type="range"
            min="1.2"
            max="6.0"
            step="0.01"
            defaultValue="2.6"
            className="h-32 appearance-none bg-slate-800/80 rounded-full outline-none hover:bg-slate-700 transition cursor-ns-resize"
            style={{
              writingMode: "vertical-bc", 
              WebkitAppearance: "slider-vertical" 
            }}
         />
      </div>

      {/* Secondary control overlay */}
      <div className="absolute bottom-24 right-20 z-20 flex flex-col items-center gap-3">
         <span className="text-xs font-mono text-slate-500 tracking-widest uppercase" style={{ writingMode: "vertical-lr" }}>Shadow</span>
         <input
            id="globe-opacity-slider"
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            defaultValue="0.85"
            className="h-32 appearance-none bg-slate-800/80 rounded-full outline-none hover:bg-slate-700 transition cursor-ns-resize"
            style={{
              writingMode: "vertical-bc", 
              WebkitAppearance: "slider-vertical" 
            }}
         />
      </div>
    </div>
  );
}
