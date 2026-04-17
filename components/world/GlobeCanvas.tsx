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
// Country centroid + angular-radius helpers (for zoom-to-fit)
// ---------------------------------------------------------------------------

interface CountryGeoData {
  centroid: THREE.Vector3; // unit vector in globe-local space
  angularRadius: number;   // radians
}

function computeCountryGeoData(feature: GeoFeature): CountryGeoData {
  const pts: THREE.Vector3[] = [];

  const collect = (ring: number[][]) => {
    for (const [lon, lat] of ring) pts.push(latLonToVector3(lat, lon, 1.0));
  };

  if (feature.geometry.type === "Polygon") {
    (feature.geometry.coordinates as number[][][]).forEach(collect);
  } else if (feature.geometry.type === "MultiPolygon") {
    (feature.geometry.coordinates as number[][][][]).forEach((poly) => poly.forEach(collect));
  }

  if (pts.length === 0) return { centroid: new THREE.Vector3(0, 0, 1), angularRadius: 0.1 };

  const centroid = new THREE.Vector3();
  for (const p of pts) centroid.add(p);
  centroid.divideScalar(pts.length).normalize();

  let minDot = 1; // dot product 1 = 0°, -1 = 180°
  for (const p of pts) {
    const d = centroid.dot(p.clone().normalize());
    if (d < minDot) minDot = d;
  }
  const angularRadius = Math.acos(Math.max(-1, Math.min(1, minDot)));

  return { centroid, angularRadius };
}

/** Given a country's angular half-extent, compute the camera Z distance that fits it on screen. */
function zoomForAngularRadius(angularRadius: number, paddingFactor = 1.45): number {
  // Camera FOV = 45°, so tan(half-fov) = tan(22.5°)
  const tanHalfFov = Math.tan(22.5 * (Math.PI / 180));
  const r = angularRadius;
  const d = paddingFactor * Math.sin(r) / tanHalfFov + Math.cos(r);
  return Math.max(1.3, Math.min(5.5, d));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type GlobeFocusTarget =
  | { type: "country"; code: string }
  | { type: "stock"; ticker: string }
  | null;

interface GlobeCanvasProps {
  worldData: WorldData | null;
  relevanceThreshold: number;
  onCountryHover: (code: string | null) => void;
  onStockHover?: (ticker: string | null) => void;
  onFocusClick: (target: GlobeFocusTarget) => void;
  isFocused: boolean;
  focusedTicker?: string | null;
  focusedCountryCode?: string | null;
  navigateTo?: { lat: number; lon: number } | null;
  onRelevanceChange?: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Per-marker hover animation state
// ---------------------------------------------------------------------------

interface HQMarkerState {
  ticker: string;
  countryCode: string;
  sphere: THREE.Mesh;      // white sphere — visible at hoverT = 0
  hitSphere: THREE.Mesh;   // invisible larger sphere used for hover/click detection
  hoverDiamond: THREE.Mesh; // green diamond — visible at hoverT = 1
  group: THREE.Group;
  outward: THREE.Vector3;  // unit surface normal (used for diamond orientation)
  hoverT: number;          // 0 = fully sphere, 1 = fully diamond
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GlobeCanvas({
  worldData,
  relevanceThreshold,
  onCountryHover,
  onStockHover,
  onFocusClick,
  isFocused,
  focusedTicker,
  focusedCountryCode,
  navigateTo,
  onRelevanceChange,
}: GlobeCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const countryLinesRef = useRef<THREE.Line[]>([]);
  const hqMarkersRef = useRef<HQMarkerState[]>([]);       // per-marker hover state
  const selectedMarkerRef = useRef<THREE.Mesh | null>(null); // active diamond plumbob
  const countryGeoDataRef = useRef<Record<string, CountryGeoData>>({}); // centroid + angularRadius per country
  const focusZoomRef = useRef<number>(1.45); // dynamic per-click target zoom
  const frameRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);           // country code
  const hoverClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // debounce hover-clear
  const hoveredMarkerTickerRef = useRef<string | null>(null); // HQ dot ticker
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2(-10, -10));
  const targetQuatRef = useRef<THREE.Quaternion | null>(null);
  const isFocusedRef = useRef(false);
  const localHitRef = useRef<THREE.Vector3 | null>(null); // hit point in globe-local space
  const onFocusClickRef = useRef(onFocusClick);
  const onStockHoverRef = useRef(onStockHover);
  const prevHoveredTickerRef = useRef<string | null>(null); // last ticker we reported via onStockHover
  // ── Country border points (used for raycasting / centroid) ──────────────
  const countryBorderPtsRef = useRef<Record<string, THREE.Vector3[]>>({});
  const geoJSONCacheRef = useRef<GeoJSON | null>(null); // parsed GeoJSON, reused across rebuilds
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);

  // Keep stable refs in sync with latest props (avoids stale closures in the animation loop)
  useEffect(() => { onFocusClickRef.current = onFocusClick; }, [onFocusClick]);
  useEffect(() => { onStockHoverRef.current = onStockHover; }, [onStockHover]);

  // Sync focus state from parent — clears target so auto-rotate resumes on dismiss
  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused) {
      targetQuatRef.current = null;
      localHitRef.current = null;
    }
  }, [isFocused]);

  // Arrow-key navigation: parent passes new lat/lon, we update globe-local hit + target quat + zoom
  useEffect(() => {
    if (!navigateTo) return;
    const localPos = latLonToVector3(navigateTo.lat, navigateTo.lon, 1.018);
    localHitRef.current = localPos;
    const norm = localPos.clone().normalize();
    targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(norm, new THREE.Vector3(0, 0, 1));
    focusZoomRef.current = 1.45; // stock zoom
    // Reset path off-screen so the stale line doesn't persist while the globe rotates
    const pathEl = document.getElementById("focus-connector-path") as SVGPathElement | null;
    if (pathEl) pathEl.setAttribute("d", "M -9999 -9999");
  }, [navigateTo]);

  // Diamond plumbob selected-marker — appears on the focused HQ dot, spins around surface normal
  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup) return;

    // Tear down old diamond
    if (selectedMarkerRef.current) {
      globeGroup.remove(selectedMarkerRef.current);
      selectedMarkerRef.current.geometry.dispose();
      (selectedMarkerRef.current.material as THREE.Material).dispose();
      selectedMarkerRef.current = null;
    }

    // Restore all marker groups to fully visible
    for (const ms of hqMarkersRef.current) {
      ms.group.visible = true;
    }

    if (!focusedTicker || !worldData) return;
    const profile = worldData.profiles[focusedTicker];
    if (!profile || profile.lat === undefined || profile.lon === undefined) return;

    // Hide the entire group for this ticker (selected diamond replaces it)
    const ms = hqMarkersRef.current.find((m) => m.ticker === focusedTicker);
    if (ms) ms.group.visible = false;

    // Build the plumbob: a vertically elongated octahedron (diamond shape)
    const radius = 0.016;
    const geo = new THREE.OctahedronGeometry(radius, 0);
    // Stretch Y to create the classic tall diamond / plumbob silhouette
    geo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));

    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });

    const diamond = new THREE.Mesh(geo, mat);

    // Surface position — 1.018 matches marker placement
    const surfacePos = latLonToVector3(profile.lat, profile.lon, 1.018);
    const outward = surfacePos.clone().normalize();

    // Sit the bottom tip ON the surface: move center up by one half-height
    // half-height = radius * 2.4 (the Y scale factor)
    const halfHeight = radius * 2.4;
    diamond.position.copy(surfacePos.clone().addScaledVector(outward, halfHeight));

    // Orient so local +Y points radially outward from globe center
    const localUp = new THREE.Vector3(0, 1, 0);
    diamond.quaternion.setFromUnitVectors(localUp, outward);

    globeGroup.add(diamond);
    selectedMarkerRef.current = diamond;
  }, [focusedTicker, worldData]);

  // Worm removed — selected country border is now fully static.

  // Restrict raycaster thresholds to prevent bleeding between adjacent/overlapping countries
  raycasterRef.current.params.Line = { threshold: 0.005 };
  raycasterRef.current.params.Points = { threshold: 0.005 };

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
      // Reset border pts lookup (will be repopulated below)
      countryBorderPtsRef.current = {};

      for (const feature of geoJSON.features) {
        const code = feature.properties["ISO3166-1-Alpha-2"] ?? "";
        const state = worldData?.countries[code];

        // Are any stories above relevance threshold?
        const hasRelevantStory = state?.stories.some(
          (s) => s.relevanceScore >= relevanceThreshold
        ) ?? false;

        // When a country is focused, suppress the red/green verdict treatment on all OTHER
        // countries so the selected country stands out cleanly. Non-focused countries fall
        // back to the default faint green border with no fill dots.
        const hasFocus = !!focusedCountryCode;
        const isFocusedCountry = hasFocus && code === focusedCountryCode;
        const showVerdict = hasRelevantStory && (!hasFocus || isFocusedCountry);

        const verdict = showVerdict ? (state?.netVerdict ?? null) : null;
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

          // Accumulate border pts for worm animation (at a slightly raised radius for z-fighting)
          if (!countryBorderPtsRef.current[code]) countryBorderPtsRef.current[code] = [];
          for (const p of points) {
            countryBorderPtsRef.current[code].push(p.clone().normalize().multiplyScalar(1.0045));
          }

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
        };

        const drawPolygonFill = (polygonRings: number[][][]) => {
            if (verdict === null) return;
            // Fill polygon with geodesic dot grid
            const dots = dotFillPolygon(polygonRings, 0.9);
            // Render fill dots slightly below border lines so the border always shows on top
            const dotPoints: THREE.Vector3[] = dots.map(([lon, lat]) => latLonToVector3(lat, lon, radius - 0.001));
            
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
    [worldData, relevanceThreshold, focusedCountryCode]
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

    // ── Load GeoJSON + compute per-country centroid/radius ────────────────
    fetch("/countries.geojson")
      .then((r) => r.json())
      .then((geoJSON: GeoJSON) => {
        geoJSONCacheRef.current = geoJSON;
        buildCountryLines(geoJSON, scene, globeGroup);
        // Pre-compute centroid + angular radius for every country (used for zoom-to-fit)
        for (const feature of geoJSON.features) {
          const code = feature.properties["ISO3166-1-Alpha-2"] ?? "";
          if (code) countryGeoDataRef.current[code] = computeCountryGeoData(feature);
        }
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
    let currentShiftX = 0; // tracked by onResize, used for NDC→screen projection

    // ── Animation loop ─────────────────────────────────────────────────────
    const LOCAL_Y = new THREE.Vector3(0, 1, 0); // reused every frame for diamond spin
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      // Smooth zoom interpolation — zoom in when focused (per-click target), otherwise follow slider
      const effectiveTarget = isFocusedRef.current ? focusZoomRef.current : targetZoom;
      camera.position.z += (effectiveTarget - camera.position.z) * 0.1;

      // Spin the selected diamond plumbob around its outward axis
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.rotateOnAxis(LOCAL_Y, 0.018);
      }

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
        if (isFocusedRef.current && targetQuatRef.current) {
          // Smoothly slerp toward the target orientation; stop auto-spin
          globeGroup.quaternion.slerp(targetQuatRef.current, 0.055);
          dragVelocity.x *= 0.9;
          dragVelocity.y *= 0.9;
        } else if (hoveredMarkerTickerRef.current) {
          // Hovering over an HQ dot — freeze rotation so the pop animation is stable
          dragVelocity.x *= 0.9;
          dragVelocity.y *= 0.9;
        } else {
          // Inertia + idle auto-rotation
          dragVelocity.x *= 0.95;
          dragVelocity.y *= 0.95;
          if (Math.abs(dragVelocity.x) < 0.1 && Math.abs(dragVelocity.y) < 0.1) {
            globeGroup.rotation.y += 0.0006;
          } else {
            globeGroup.rotation.y += dragVelocity.x * 0.005;
            globeGroup.rotation.x += dragVelocity.y * 0.005;
          }
        }
      }

      // ── HQ marker hover animation (sphere → diamond crossfade) ───────────
      const hoveredTicker = hoveredMarkerTickerRef.current;
      for (const ms of hqMarkersRef.current) {
        if (!ms.group.visible) continue; // skip the focused/selected marker
        const target = ms.ticker === hoveredTicker ? 1 : 0;
        ms.hoverT += (target - ms.hoverT) * 0.14; // smooth lerp ~0.14/frame

        // Sphere: fade out and shrink as hoverT rises
        const sphereMat = ms.sphere.material as THREE.MeshBasicMaterial;
        sphereMat.opacity = 0.75 * (1 - ms.hoverT);
        ms.sphere.scale.setScalar(1 - ms.hoverT * 0.5);

        // Diamond: scale up from 0 to 1 as hoverT rises
        ms.hoverDiamond.scale.setScalar(ms.hoverT);
      }

      renderer.render(scene, camera);

      // ── Live SVG connector update ─────────────────────────────────────────
      // After render (so globeGroup.matrixWorld is current), project the stored
      // local-space hit point back to screen coordinates and update the SVG
      // elements directly — no React state, no re-renders, just 60fps DOM writes.
      if (isFocusedRef.current && localHitRef.current) {
        const worldPos = globeGroup.localToWorld(localHitRef.current.clone());
        const ndcPos = worldPos.project(camera);
        const rect = mount.getBoundingClientRect();
        // setViewOffset modifies the projection matrix so project() already gives
        // the correct screen-space NDC — standard formula, no shiftX correction.
        const sx = rect.left + (ndcPos.x + 1) / 2 * rect.width;
        const sy = rect.top + (-ndcPos.y + 1) / 2 * rect.height;

        if (isFinite(sx) && isFinite(sy)) {
          const pathEl = document.getElementById("focus-connector-path") as SVGPathElement | null;
          const panelAnchorEl = document.getElementById("focus-panel-anchor");
          if (pathEl && panelAnchorEl) {
            const pr = panelAnchorEl.getBoundingClientRect();
            const ex = pr.left;
            const ey = pr.top;
            const absDy = Math.abs(sy - ey);
            // Cubic bezier: rise from globe point, curve into panel bottom-left
            const d = `M ${sx} ${sy} C ${sx} ${sy - absDy * 0.55} ${ex - Math.min(absDy * 0.15, 30)} ${ey + (sy > ey ? 1 : -1) * absDy * 0.08} ${ex} ${ey}`;
            pathEl.setAttribute("d", d);
          }
        }
      }
    };
    animate();

    // ── Resize handler ─────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;

      // Dynamically calculate horizontal pixel shift to perfectly center the globe
      // in the physical gap between the thick left sidebar and the right sliders.
      // Left Panel ≈ 384px (width + margin). Right Panel empty (≈ 32px edge margin).
      // Formula: (LeftPadding - RightPadding) / 2
      const shiftX = Math.min((384 - 32) / 2, w * 0.25);
      currentShiftX = shiftX; // keep in sync for NDC→screen projection in animate loop

      // A negative X offset repositions the internal frustum to the left,
      // flawlessly pushing the visual 3D simulation to the right monitor space.
      camera.setViewOffset(w, h, -shiftX, 0, w, h);

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

    let mouseDownX = 0, mouseDownY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      dragVelocity = { x: 0, y: 0 };
    };

    const onMouseUp = (e: MouseEvent) => {
      isDragging = false;
      const dx = e.clientX - mouseDownX;
      const dy = e.clientY - mouseDownY;
      // Treat as drag if mouse moved more than 5px — suppress click
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;

      // Raycast at click position against country lines + HQ markers
      const rect = mount.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const allTargets = [
        ...countryLinesRef.current,
        ...hqMarkersRef.current.filter((ms) => ms.group.visible).map((ms) => ms.hitSphere) as unknown as THREE.Line[],
      ];
      const hits = raycasterRef.current.intersectObjects(allTargets);
      const validHits = hits.filter((hit) => {
        const normal = hit.point.clone().normalize();
        const toCamera = camera.position.clone().sub(hit.point).normalize();
        return normal.dot(toCamera) > 0.1;
      });

      if (validHits.length > 0) {
        const hit = validHits[0];
        const ud = hit.object.userData as { code?: string; isMarker?: boolean; ticker?: string };

        if (ud.isMarker && ud.ticker) {
          // ── White HQ dot — use the visual sphere's center, not the raw hit point,
          // so the connector always originates from the dot regardless of hitbox size.
          const ms = hqMarkersRef.current.find((m) => m.ticker === ud.ticker);
          const dotWorldPos = ms
            ? globeGroup.localToWorld(ms.sphere.position.clone())
            : hit.point.clone();
          localHitRef.current = globeGroup.worldToLocal(dotWorldPos);
          const norm = localHitRef.current.clone().normalize();
          targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(norm, new THREE.Vector3(0, 0, 1));
          focusZoomRef.current = 1.45;
          onFocusClickRef.current({ type: "stock", ticker: ud.ticker });
        } else if (ud.code) {
          // ── Country border/fill — center on country centroid + zoom to fit ─
          const geoData = countryGeoDataRef.current[ud.code];
          if (geoData) {
            // centroid is already in globe-local space (computed from latLonToVector3)
            localHitRef.current = geoData.centroid.clone();
            const norm = geoData.centroid.clone().normalize();
            targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(norm, new THREE.Vector3(0, 0, 1));
            focusZoomRef.current = zoomForAngularRadius(geoData.angularRadius);
          } else {
            // Fallback: use raw hit point
            localHitRef.current = globeGroup.worldToLocal(hit.point.clone());
            const norm = localHitRef.current.clone().normalize();
            targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(norm, new THREE.Vector3(0, 0, 1));
            focusZoomRef.current = 2.0;
          }
          onFocusClickRef.current({ type: "country", code: ud.code });
        } else {
          onFocusClickRef.current(null);
        }
      } else {
        // Clicked empty space — dismiss
        onFocusClickRef.current(null);
      }
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

      // ── HQ marker hover (checked first — takes priority over country hover) ──
      const sphereMeshes = hqMarkersRef.current
        .filter((ms) => ms.group.visible)
        .map((ms) => ms.hitSphere);
      const markerHits = raycasterRef.current.intersectObjects(sphereMeshes);
      const validMarkerHits = markerHits.filter((hit) => {
        const normal = hit.point.clone().normalize();
        const toCamera = camera.position.clone().sub(hit.point).normalize();
        return normal.dot(toCamera) > 0.1;
      });
      const newHoveredTicker = validMarkerHits.length > 0
        ? (validMarkerHits[0].object.userData as { ticker: string }).ticker ?? null
        : null;
      hoveredMarkerTickerRef.current = newHoveredTicker;

      // Fire onStockHover when the hovered ticker changes
      if (newHoveredTicker !== prevHoveredTickerRef.current) {
        prevHoveredTickerRef.current = newHoveredTicker;
        onStockHoverRef.current?.(newHoveredTicker);
        // When a marker is hovered, clear any pending country hover so country tooltip hides
        if (newHoveredTicker !== null) {
          if (hoverClearTimerRef.current) {
            clearTimeout(hoverClearTimerRef.current);
            hoverClearTimerRef.current = null;
          }
          hoveredRef.current = null;
          onCountryHover(null);
        }
      }

      // ── Country hover (skipped when a marker is under the cursor) ───────
      if (newHoveredTicker === null) {
        const countryHits = raycasterRef.current.intersectObjects(countryLinesRef.current);
        const validCountryHits = countryHits.filter((hit) => {
          const normal = hit.point.clone().normalize();
          const toCamera = camera.position.clone().sub(hit.point).normalize();
          return normal.dot(toCamera) > 0.1;
        });
        const code = validCountryHits.length > 0
          ? (validCountryHits[0].object.userData as { code: string }).code ?? null
          : null;
        if (code !== null) {
          // A country is under the cursor — apply immediately and cancel any pending clear
          if (hoverClearTimerRef.current) {
            clearTimeout(hoverClearTimerRef.current);
            hoverClearTimerRef.current = null;
          }
          if (code !== hoveredRef.current) {
            hoveredRef.current = code;
            onCountryHover(code);
          }
        } else if (hoveredRef.current !== null) {
          // No country hit — debounce the clear by 220 ms so brief gaps don't flicker the tooltip
          if (!hoverClearTimerRef.current) {
            hoverClearTimerRef.current = setTimeout(() => {
              hoverClearTimerRef.current = null;
              hoveredRef.current = null;
              onCountryHover(null);
            }, 220);
          }
        }
      }
    };
    
    mount.addEventListener("wheel", onWheel, { passive: false });
    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("mousemove", onMouseMove);

    const onMouseLeave = () => {
      isDragging = false;
      if (hoverClearTimerRef.current) {
        clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      hoveredRef.current = null;
      hoveredMarkerTickerRef.current = null;
      if (prevHoveredTickerRef.current !== null) {
        prevHoveredTickerRef.current = null;
        onStockHoverRef.current?.(null);
      }
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

  // Rebuild country lines whenever worldData, relevanceThreshold, or focus changes.
  // Uses cached GeoJSON to avoid re-hitting the network on every rebuild.
  useEffect(() => {
    const scene = sceneRef.current;
    const globeGroup = globeGroupRef.current;
    if (!scene || !globeGroup) return;

    const cached = geoJSONCacheRef.current;
    if (cached) {
      buildCountryLines(cached, scene, globeGroup);
      return;
    }

    fetch("/countries.geojson")
      .then((r) => r.json())
      .then((geoJSON: GeoJSON) => {
        geoJSONCacheRef.current = geoJSON;
        buildCountryLines(geoJSON, scene, globeGroup);
      })
      .catch(() => {/* already logged */});
  }, [worldData, relevanceThreshold, buildCountryLines]);

  // Rebuild HQ markers when worldData changes
  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup) return;

    // Tear down old marker groups
    for (const ms of hqMarkersRef.current) {
      globeGroup.remove(ms.group);
      ms.sphere.geometry.dispose();
      (ms.sphere.material as THREE.Material).dispose();
      ms.hitSphere.geometry.dispose();
      (ms.hitSphere.material as THREE.Material).dispose();
      ms.hoverDiamond.geometry.dispose();
      (ms.hoverDiamond.material as THREE.Material).dispose();
    }
    hqMarkersRef.current = [];

    if (!worldData) return;

    for (const profile of Object.values(worldData.profiles)) {
      const state = worldData.countries[profile.countryCode];
      const posValue = state?.totalPositionValue ?? 0;
      const scale = posValue > 0 ? Math.max(0.5, Math.min(3, posValue / 50000)) : 1;
      const dotRadius = 0.009 + scale * 0.005;

      const surfacePos = latLonToVector3(profile.lat, profile.lon, 1.018);
      const outward = surfacePos.clone().normalize();

      // ── White sphere (default state) ────────────────────────────────────
      const sphereGeo = new THREE.SphereGeometry(dotRadius, 10, 10);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.75,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(surfacePos);
      sphere.userData = { isMarker: true, ticker: profile.ticker, countryCode: profile.countryCode };

      // ── Invisible hit-sphere (larger radius for easier hover/click) ───────
      const hitGeo = new THREE.SphereGeometry(dotRadius * 4, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitSphere = new THREE.Mesh(hitGeo, hitMat);
      hitSphere.position.copy(surfacePos);
      hitSphere.userData = { isMarker: true, ticker: profile.ticker, countryCode: profile.countryCode };

      // ── Hover diamond (appears on mouseover) ────────────────────────────
      const dRadius = 0.013;
      const dHalfH = dRadius * 2.4;
      const dGeo = new THREE.OctahedronGeometry(dRadius, 0);
      dGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));
      const dMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      });
      const hoverDiamond = new THREE.Mesh(dGeo, dMat);
      // Bottom tip sits on surface, center offset outward by half-height
      hoverDiamond.position.copy(surfacePos.clone().addScaledVector(outward, dHalfH));
      // Orient local +Y along outward normal
      hoverDiamond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
      hoverDiamond.scale.setScalar(0); // starts invisible

      // ── Group ───────────────────────────────────────────────────────────
      const group = new THREE.Group();
      group.userData = { isMarkerGroup: true };
      group.add(sphere);
      group.add(hitSphere);
      group.add(hoverDiamond);
      globeGroup.add(group);

      hqMarkersRef.current.push({
        ticker: profile.ticker,
        countryCode: profile.countryCode,
        sphere,
        hitSphere,
        hoverDiamond,
        group,
        outward,
        hoverT: 0,
      });
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
      
      {/* Globe Controls Container */}
      <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-4 bg-slate-900/80 px-5 py-4 rounded-xl border border-slate-700/50 backdrop-blur pointer-events-auto shadow-xl w-48">
         <div className="flex flex-col gap-1.5 w-full">
            <div className="flex justify-between items-center px-0.5">
               <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">Zoom</span>
            </div>
            <input
               id="globe-zoom-slider"
               type="range"
               min="1.2"
               max="6.0"
               step="0.01"
               defaultValue="2.6"
               className="w-full h-1 appearance-none bg-slate-800 rounded-full outline-none hover:bg-slate-700 transition cursor-ew-resize"
               style={{ accentColor: "#00FF88" }}
            />
         </div>
         
         <div className="flex flex-col gap-1.5 w-full">
            <div className="flex justify-between items-center px-0.5">
               <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">Shadow</span>
            </div>
            <input
               id="globe-opacity-slider"
               type="range"
               min="0.0"
               max="1.0"
               step="0.01"
               defaultValue="0.85"
               className="w-full h-1 appearance-none bg-slate-800 rounded-full outline-none hover:bg-slate-700 transition cursor-ew-resize"
               style={{ accentColor: "#00FF88" }}
            />
         </div>

         {onRelevanceChange && (
           <div className="flex flex-col gap-1.5 w-full">
              <div className="flex justify-between items-center px-0.5">
                 <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">Relevance</span>
              </div>
              <input
                 id="globe-relevance-slider"
                 type="range"
                 min="0"
                 max="100"
                 step="5"
                 value={Math.round(relevanceThreshold * 100)}
                 onChange={(e) => onRelevanceChange(parseInt(e.target.value) / 100)}
                 className="w-full h-1 appearance-none bg-slate-800 rounded-full outline-none hover:bg-slate-700 transition cursor-pointer"
                 style={{ accentColor: "#00FF88" }}
              />
           </div>
         )}
      </div>
    </div>
  );
}
