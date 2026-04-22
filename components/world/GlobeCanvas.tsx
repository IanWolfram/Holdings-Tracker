"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { WorldData } from "@/types/geo.types";
import GlobeCanvasFallback from "./GlobeCanvasFallback";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLUSTER_DIST_THRESHOLD = 0.08;
const CLUSTER_REST_SEP = 0.022;
const CLUSTER_HOVER_SEP = 0.044;

// ---------------------------------------------------------------------------
// Types & Interfaces
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

interface CountryGeoData {
  centroid: THREE.Vector3;
  angularRadius: number;
}

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

interface HQMarkerState {
  ticker: string;
  countryCode: string;
  instanceId: number;
  outward: THREE.Vector3;
  hoverT: number;
  basePos: THREE.Vector3;
  dotRadius: number;
  dHalfH: number;
  eastDir: THREE.Vector3 | null;
  sepIndex: number;
  clusterPeers: string[];
  separationT: number;
  visible: boolean;
  renderedVisible: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
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
  let minDot = 1;
  for (const p of pts) {
    const d = centroid.dot(p.clone().normalize());
    if (d < minDot) minDot = d;
  }
  return { centroid, angularRadius: Math.acos(Math.max(-1, Math.min(1, minDot))) };
}

function zoomForAngularRadius(angularRadius: number, paddingFactor = 1.45): number {
  const tanHalfFov = Math.tan(22.5 * (Math.PI / 180));
  const d = paddingFactor * Math.sin(angularRadius) / tanHalfFov + Math.cos(angularRadius);
  return Math.max(1.3, Math.min(5.5, d));
}

function applyCountryBuffers(
  data: {
    linePositions: Float32Array;
    lineColors: Float32Array;
    dotPositions: Float32Array;
    dotColors: Float32Array;
    segmentToCountry: string[];
  },
  globeGroup: THREE.Group,
  countryLinesRef: React.MutableRefObject<THREE.Object3D[]>,
  segmentToCountryRef: React.MutableRefObject<string[]>
) {
  countryLinesRef.current.forEach((obj) => {
    globeGroup.remove(obj);
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
  countryLinesRef.current = [];
  segmentToCountryRef.current = data.segmentToCountry;

  if (data.linePositions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(data.linePositions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(data.lineColors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0, linewidth: 2 });
    const lines = new THREE.LineSegments(geom, mat);
    lines.userData = { isMergedBorder: true };
    globeGroup.add(lines);
    countryLinesRef.current.push(lines);
  }

  if (data.dotPositions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(data.dotPositions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(data.dotColors, 3));
    const mat = new THREE.PointsMaterial({ vertexColors: true, transparent: true, size: 0.007, sizeAttenuation: true });
    const dots = new THREE.Points(geom, mat);
    dots.userData = { isMergedDots: true };
    globeGroup.add(dots);
    countryLinesRef.current.push(dots);
  }
}

function applyStateBuffers(
  stateLinePositions: Float32Array,
  stateLineColors: Float32Array,
  globeGroup: THREE.Group,
  stateLinesRef: React.MutableRefObject<THREE.Object3D[]>
) {
  stateLinesRef.current.forEach((obj) => {
    globeGroup.remove(obj);
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
  stateLinesRef.current = [];

  if (stateLinePositions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(stateLinePositions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(stateLineColors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0, linewidth: 2 });
    const lines = new THREE.LineSegments(geom, mat);
    lines.userData = { isStateBorder: true };
    globeGroup.add(lines);
    stateLinesRef.current.push(lines);
  }
}

function rebuildHQMarkers(
  globeGroup: THREE.Group,
  worldData: WorldData,
  hqMarkersRef: React.MutableRefObject<HQMarkerState[]>,
  markerInstancesRef: React.MutableRefObject<{
    spheres: THREE.InstancedMesh;
    hitSpheres: THREE.InstancedMesh;
    diamonds: THREE.InstancedMesh;
  } | null>
) {
  if (markerInstancesRef.current) {
    globeGroup.remove(markerInstancesRef.current.spheres);
    globeGroup.remove(markerInstancesRef.current.hitSpheres);
    globeGroup.remove(markerInstancesRef.current.diamonds);
    markerInstancesRef.current.spheres.geometry.dispose();
    (markerInstancesRef.current.spheres.material as THREE.Material).dispose();
    markerInstancesRef.current.hitSpheres.geometry.dispose();
    (markerInstancesRef.current.hitSpheres.material as THREE.Material).dispose();
    markerInstancesRef.current.diamonds.geometry.dispose();
    (markerInstancesRef.current.diamonds.material as THREE.Material).dispose();
    markerInstancesRef.current = null;
  }
  hqMarkersRef.current = [];

  const profiles = Object.values(worldData.profiles);
  const count = profiles.length;
  if (count === 0) return;

  const sphereGeo = new THREE.SphereGeometry(1, 10, 10);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
  const spheres = new THREE.InstancedMesh(sphereGeo, sphereMat, count);

  const hitGeo = new THREE.SphereGeometry(1, 8, 8);
  const hitSpheres = new THREE.InstancedMesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }), count);
  hitSpheres.userData = { isMarkerInstance: true };

  const dGeo = new THREE.OctahedronGeometry(1, 0);
  dGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));
  const dMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const diamonds = new THREE.InstancedMesh(dGeo, dMat, count);

  markerInstancesRef.current = { spheres, hitSpheres, diamonds };
  globeGroup.add(spheres, hitSpheres, diamonds);

  profiles.forEach((profile, i) => {
    const state = worldData.countries[profile.countryCode];
    const posValue = state?.totalPositionValue ?? 0;
    const scale = posValue > 0 ? Math.max(0.5, Math.min(3, posValue / 50000)) : 1;
    const dotRadius = 0.009 + scale * 0.005;
    const surfacePos = latLonToVector3(profile.lat, profile.lon, 1.018);
    const dRadius = 0.013;
    hqMarkersRef.current.push({
      ticker: profile.ticker,
      countryCode: profile.countryCode,
      instanceId: i,
      outward: surfacePos.clone().normalize(),
      hoverT: 0,
      basePos: surfacePos.clone(),
      dotRadius,
      dHalfH: dRadius * 2.4,
      eastDir: null,
      sepIndex: 0,
      clusterPeers: [],
      separationT: 0,
      visible: true,
      renderedVisible: true,
    });
  });

  const markers = hqMarkersRef.current;
  const clusterOf = new Map<string, string[]>();
  for (let i = 0; i < markers.length; i++) {
    const a = markers[i];
    if (!clusterOf.has(a.ticker)) clusterOf.set(a.ticker, [a.ticker]);
    for (let j = i + 1; j < markers.length; j++) {
      const b = markers[j];
      if (a.basePos.distanceTo(b.basePos) > CLUSTER_DIST_THRESHOLD) continue;
      const ca = clusterOf.get(a.ticker) ?? [a.ticker];
      const cb = clusterOf.get(b.ticker) ?? [b.ticker];
      if (ca === cb) continue;
      const merged = [...ca, ...cb];
      for (const t of merged) clusterOf.set(t, merged);
    }
  }

  const seen = new Set<string[]>();
  for (const cluster of clusterOf.values()) {
    if (cluster.length < 2 || seen.has(cluster)) continue;
    seen.add(cluster);
    cluster.sort((a, b) => (worldData.profiles[a]?.lon ?? 0) - (worldData.profiles[b]?.lon ?? 0));
    const centroid = new THREE.Vector3();
    for (const t of cluster) centroid.add(markers.find((m) => m.ticker === t)!.basePos);
    centroid.divideScalar(cluster.length).normalize();
    const eastDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), centroid).normalize();
    const half = (cluster.length - 1) / 2;
    cluster.forEach((t, idx) => {
      const ms = markers.find((m) => m.ticker === t)!;
      ms.eastDir = eastDir.clone();
      ms.sepIndex = idx - half;
      ms.clusterPeers = cluster;
    });
  }
}

// ---------------------------------------------------------------------------
// Scene & Animation Logic
// ---------------------------------------------------------------------------

function getCameraShiftX(w: number) {
  return Math.min((384 - 32) / 2, w * 0.25);
}

const LOCAL_Y = new THREE.Vector3(0, 1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();
const _tmpDiamondPos = new THREE.Vector3();
const _n = new THREE.Vector3();
const _d = new THREE.Vector3();
const _globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.001);
const _localRay = new THREE.Ray();
const _invMat = new THREE.Matrix4();
const _sphereHit = new THREE.Vector3();
let _svgMountRect: DOMRect | null = null;
let _svgMountRectTs = 0;
let _svgAnchorRect: DOMRect | null = null;
let _svgAnchorRectTs = 0;

interface RenderState {
  isDragging: boolean;
  previousMousePosition: { x: number; y: number };
  dragVelocity: { x: number; y: number };
  targetZoom: number;
  fogDensity: number;
}

let lastSVGTime = 0;

function animateGlobe(
  globeGroup: THREE.Group,
  selectedMarker: THREE.Mesh | null,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  hqMarkers: HQMarkerState[],
  markerInstances: { spheres: THREE.InstancedMesh; hitSpheres: THREE.InstancedMesh; diamonds: THREE.InstancedMesh } | null,
  hoveredMarkerTicker: string | null,
  isFocused: boolean,
  targetQuat: THREE.Quaternion | null,
  focusZoom: number,
  localHit: THREE.Vector3 | null,
  mount: HTMLDivElement,
  state: RenderState,
  renderer: THREE.WebGLRenderer
) {
  const effectiveTarget = isFocused ? focusZoom : state.targetZoom;
  camera.position.z += (effectiveTarget - camera.position.z) * 0.16;

  if (selectedMarker) selectedMarker.rotateOnAxis(LOCAL_Y, 0.018);

  if (scene.fog instanceof THREE.Fog) {
    scene.fog.near = camera.position.z - 0.2;
    scene.fog.far = scene.fog.near + (0.05 + Math.pow(1.0 - state.fogDensity, 2) * 6.0);
  }

  if (!state.isDragging) {
    if (isFocused && targetQuat) {
      globeGroup.quaternion.slerp(targetQuat, 0.055);
      state.dragVelocity.x *= 0.9;
      state.dragVelocity.y *= 0.9;
    } else if (hoveredMarkerTicker) {
      state.dragVelocity.x *= 0.9;
      state.dragVelocity.y *= 0.9;
    } else {
      state.dragVelocity.x *= 0.95;
      state.dragVelocity.y *= 0.95;
      if (Math.abs(state.dragVelocity.x) < 0.1 && Math.abs(state.dragVelocity.y) < 0.1) {
        globeGroup.rotation.y += 0.0006;
      } else {
        const panFactor = 0.005 * (camera.position.z / 2.6);
        globeGroup.rotation.y += state.dragVelocity.x * panFactor;
        globeGroup.rotation.x += state.dragVelocity.y * panFactor;
      }
    }
  }

  if (markerInstances) {
    let markerDirty = false;
    for (const ms of hqMarkers) {
      const prevHoverT = ms.hoverT;
      const prevSepT = ms.separationT;
      ms.hoverT += ((ms.ticker === hoveredMarkerTicker ? 1 : 0) - ms.hoverT) * 0.14;

      if (ms.eastDir !== null && ms.clusterPeers.length > 1) {
        const anyPeerActive = hoveredMarkerTicker !== null && ms.clusterPeers.includes(hoveredMarkerTicker);
        ms.separationT += ((anyPeerActive ? 1 : 0) - ms.separationT) * 0.10;
      }

      if (
        Math.abs(ms.hoverT - prevHoverT) > 1e-4 ||
        Math.abs(ms.separationT - prevSepT) > 1e-4 ||
        ms.renderedVisible !== ms.visible
      ) markerDirty = true;
      ms.renderedVisible = ms.visible;

      const sepDist = CLUSTER_REST_SEP + (CLUSTER_HOVER_SEP - CLUSTER_REST_SEP) * ms.separationT;
      if (ms.eastDir) {
        _tmpPos.copy(ms.basePos).addScaledVector(ms.eastDir, ms.sepIndex * sepDist);
      } else {
        _tmpPos.copy(ms.basePos);
      }
      const vis = ms.visible ? 1 : 0;

      _scale.setScalar(ms.dotRadius * (1 - ms.hoverT * 0.5) * vis);
      _mat.compose(_tmpPos, _quat.set(0, 0, 0, 1), _scale);
      markerInstances.spheres.setMatrixAt(ms.instanceId, _mat);

      if (vis === 0) {
        // Zero-scale makes the matrix non-invertible, causing phantom raycaster
        // hits on invisible instances. Move them off-screen instead.
        _mat.makeTranslation(0, 0, -9999);
        markerInstances.hitSpheres.setMatrixAt(ms.instanceId, _mat);
      } else {
        _scale.setScalar(ms.dotRadius * 4);
        _mat.compose(_tmpPos, _quat.set(0, 0, 0, 1), _scale);
        markerInstances.hitSpheres.setMatrixAt(ms.instanceId, _mat);
      }

      _quat.setFromUnitVectors(UP, ms.outward);
      _scale.setScalar((ms.dHalfH / 2.4) * ms.hoverT * vis);
      _tmpDiamondPos.copy(_tmpPos).addScaledVector(ms.outward, ms.dHalfH);
      _mat.compose(_tmpDiamondPos, _quat, _scale);
      markerInstances.diamonds.setMatrixAt(ms.instanceId, _mat);
    }
    if (markerDirty) {
      markerInstances.spheres.instanceMatrix.needsUpdate = true;
      markerInstances.hitSpheres.instanceMatrix.needsUpdate = true;
      markerInstances.diamonds.instanceMatrix.needsUpdate = true;
    }
  }

  renderer.render(scene, camera);

  // SVG connector throttled to ~30fps
  const now = performance.now();
  if (isFocused && localHit && now - lastSVGTime > 33) {
    lastSVGTime = now;
    const worldPos = globeGroup.localToWorld(localHit.clone());
    const ndcPos = worldPos.project(camera);
    if (now - _svgMountRectTs > 300) { _svgMountRect = mount.getBoundingClientRect(); _svgMountRectTs = now; }
    const rect = _svgMountRect!;
    const sx = rect.left + (ndcPos.x + 1) / 2 * rect.width;
    const sy = rect.top + (-ndcPos.y + 1) / 2 * rect.height;
    if (isFinite(sx) && isFinite(sy)) {
      const pathEl = document.getElementById("focus-connector-path") as SVGPathElement | null;
      const anchorEl = document.getElementById("focus-panel-anchor");
      if (pathEl && anchorEl) {
        if (now - _svgAnchorRectTs > 300) { _svgAnchorRect = anchorEl.getBoundingClientRect(); _svgAnchorRectTs = now; }
        const pr = _svgAnchorRect!;
        const absDy = Math.abs(sy - pr.top);
        const d = `M ${sx} ${sy} C ${sx} ${sy - absDy * 0.55} ${pr.left - Math.min(absDy * 0.15, 30)} ${pr.top + (sy > pr.top ? 1 : -1) * absDy * 0.08} ${pr.left} ${pr.top}`;
        pathEl.setAttribute("d", d);
      }
    }
  }
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
  const countryLinesRef = useRef<THREE.Object3D[]>([]);
  const stateLinesRef = useRef<THREE.Object3D[]>([]);
  const stateGeoJSONCacheRef = useRef<GeoJSON | null>(null);
  const hqMarkersRef = useRef<HQMarkerState[]>([]);
  const markerInstancesRef = useRef<{
    spheres: THREE.InstancedMesh;
    hitSpheres: THREE.InstancedMesh;
    diamonds: THREE.InstancedMesh;
  } | null>(null);
  const selectedMarkerRef = useRef<THREE.Mesh | null>(null);
  const countryGeoDataRef = useRef<Record<string, CountryGeoData>>({});
  const focusZoomRef = useRef<number>(1.45);
  const frameRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);
  const hoverClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredMarkerTickerRef = useRef<string | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2(-10, -10));
  const targetQuatRef = useRef<THREE.Quaternion | null>(null);
  const isFocusedRef = useRef(false);
  const localHitRef = useRef<THREE.Vector3 | null>(null);
  const onFocusClickRef = useRef(onFocusClick);
  const onStockHoverRef = useRef(onStockHover);
  const onCountryHoverRef = useRef(onCountryHover);
  const prevHoveredTickerRef = useRef<string | null>(null);
  const segmentToCountryRef = useRef<string[]>([]);
  const geoJSONCacheRef = useRef<GeoJSON | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);

  useEffect(() => { onFocusClickRef.current = onFocusClick; }, [onFocusClick]);
  useEffect(() => { onStockHoverRef.current = onStockHover; }, [onStockHover]);
  useEffect(() => { onCountryHoverRef.current = onCountryHover; }, [onCountryHover]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused) {
      targetQuatRef.current = null;
      localHitRef.current = null;
    }
  }, [isFocused]);

  useEffect(() => {
    if (!navigateTo) return;
    const localPos = latLonToVector3(navigateTo.lat, navigateTo.lon, 1.018);
    localHitRef.current = localPos;
    targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(
      localPos.clone().normalize(),
      new THREE.Vector3(0, 0, 1)
    );
    focusZoomRef.current = 1.45;
    const pathEl = document.getElementById("focus-connector-path") as SVGPathElement | null;
    if (pathEl) pathEl.setAttribute("d", "M -9999 -9999");
  }, [navigateTo]);

  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup) return;

    if (selectedMarkerRef.current) {
      globeGroup.remove(selectedMarkerRef.current);
      selectedMarkerRef.current.geometry.dispose();
      (selectedMarkerRef.current.material as THREE.Material).dispose();
      selectedMarkerRef.current = null;
    }

    for (const ms of hqMarkersRef.current) ms.visible = true;

    if (!focusedTicker || !worldData) return;
    const profile = worldData.profiles[focusedTicker];
    if (!profile || profile.lat === undefined || profile.lon === undefined) return;

    const ms = hqMarkersRef.current.find((m) => m.ticker === focusedTicker);
    if (ms) ms.visible = false;

    const radius = 0.016;
    const geo = new THREE.OctahedronGeometry(radius, 0);
    geo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));
    const diamond = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.88, side: THREE.DoubleSide })
    );

    const surfacePos = ms?.eastDir && ms.clusterPeers.length > 1
      ? ms.basePos.clone().addScaledVector(ms.eastDir, ms.sepIndex * CLUSTER_HOVER_SEP)
      : (ms?.basePos?.clone() ?? latLonToVector3(profile.lat, profile.lon, 1.018));
    const outward = ms?.outward?.clone() ?? surfacePos.clone().normalize();
    diamond.position.copy(surfacePos.clone().addScaledVector(outward, radius * 2.4));
    diamond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);

    globeGroup.add(diamond);
    selectedMarkerRef.current = diamond;
  }, [focusedTicker, worldData]);

  // Main scene setup
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.Fog(0x0a110a, 1.0, 3.0);

    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 2.6);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) { setWebglAvailable(false); return; }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglAvailable(false);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); setWebglAvailable(false); }, false);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const atmGeo = new THREE.SphereGeometry(1.025, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.12, side: THREE.BackSide });
    globeGroup.add(new THREE.Mesh(atmGeo, atmMat));

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
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.012, transparent: true, opacity: 0.7 })));

    workerRef.current = new Worker(new URL("@/lib/world/geo.worker.ts", import.meta.url));
    workerRef.current.onmessage = (e) => {
      if (globeGroupRef.current) {
        applyStateBuffers(e.data.stateLinePositions, e.data.stateLineColors, globeGroupRef.current, stateLinesRef);
        applyCountryBuffers(e.data, globeGroupRef.current, countryLinesRef, segmentToCountryRef);
      }
    };

    const state: RenderState = {
      isDragging: false,
      previousMousePosition: { x: 0, y: 0 },
      dragVelocity: { x: 0, y: 0 },
      targetZoom: 2.6,
      fogDensity: 0.75,
    };

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      animateGlobe(
        globeGroup,
        selectedMarkerRef.current,
        camera,
        scene,
        hqMarkersRef.current,
        markerInstancesRef.current,
        hoveredMarkerTickerRef.current,
        isFocusedRef.current,
        targetQuatRef.current,
        focusZoomRef.current,
        localHitRef.current,
        mount,
        state,
        renderer
      );
    };
    animate();

    const zoomSlider = document.getElementById("globe-zoom-slider") as HTMLInputElement | null;
    const opacitySlider = document.getElementById("globe-opacity-slider") as HTMLInputElement | null;
    if (zoomSlider) zoomSlider.value = state.targetZoom.toString();
    if (opacitySlider) opacitySlider.value = state.fogDensity.toString();

    const onResize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.setViewOffset(w, h, -getCameraShiftX(w), 0, w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      state.targetZoom = Math.max(1.2, Math.min(state.targetZoom + e.deltaY * 0.012, 6.0));
      if (zoomSlider) zoomSlider.value = state.targetZoom.toString();
    };

    let mouseDownX = 0, mouseDownY = 0;
    let mouseIsDownOnMount = false;
    const onMouseDown = (e: MouseEvent) => {
      state.isDragging = true;
      mouseIsDownOnMount = true;
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
      state.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = (e: MouseEvent) => {
      state.isDragging = false;
      if (!mouseIsDownOnMount) return;
      mouseIsDownOnMount = false;
      if (Math.sqrt(Math.pow(e.clientX - mouseDownX, 2) + Math.pow(e.clientY - mouseDownY, 2)) > 5) return;

      const rect = mount.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const facingFilter = (h: THREE.Intersection) => {
        _n.copy(h.point).normalize();
        _d.copy(camera.position).sub(h.point).normalize();
        return _n.dot(_d) > 0.1;
      };

      const focusCountry = (code: string, hitPoint: THREE.Vector3) => {
        const geoData = countryGeoDataRef.current[code];
        localHitRef.current = geoData ? geoData.centroid.clone() : globeGroup.worldToLocal(hitPoint.clone());
        targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(
          localHitRef.current.clone().normalize(),
          new THREE.Vector3(0, 0, 1)
        );
        focusZoomRef.current = geoData ? zoomForAngularRadius(geoData.angularRadius) : 2.0;
        onFocusClickRef.current({ type: "country", code });
      };

      // Test stock markers first — the default Line.threshold (1 world-unit) is
      // far too large for the unit-sphere globe, so mixing borders and hitSpheres
      // in a single intersectObjects call causes border segments to shadow dots.
      // By testing hitSpheres (mesh geometry, exact intersection) first we guarantee
      // dot clicks always resolve to the correct stock, never to a country border.
      let markerHandled = false;
      if (markerInstancesRef.current) {
        const markerHits = raycasterRef.current
          .intersectObjects([markerInstancesRef.current.hitSpheres])
          .filter(facingFilter);
        if (markerHits.length > 0 && markerHits[0].instanceId !== undefined) {
          const ms = hqMarkersRef.current[markerHits[0].instanceId];
          if (ms?.visible) {
            localHitRef.current = globeGroup.worldToLocal(markerHits[0].point.clone());
            targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(
              localHitRef.current.clone().normalize(),
              new THREE.Vector3(0, 0, 1)
            );
            focusZoomRef.current = 1.45;
            onFocusClickRef.current({ type: "stock", ticker: ms.ticker });
            markerHandled = true;
          }
        }
      }

      if (!markerHandled) {
        // Test border lines (excludes decorative dot-fill Points meshes).
        const borderTargets = countryLinesRef.current.filter((obj) => !obj.userData.isMergedDots);
        const borderHits = raycasterRef.current.intersectObjects(borderTargets).filter(facingFilter);
        if (borderHits.length > 0) {
          const hit = borderHits[0];
          if ((hit.object.userData as { isMergedBorder?: boolean }).isMergedBorder && hit.index !== undefined) {
            const code = segmentToCountryRef.current[Math.floor(hit.index / 2)];
            if (code) focusCountry(code, hit.point);
          }
        } else {
          // No border/marker hit — intersect globe sphere to detect country by
          // centroid proximity, so clicking inside a country's area also works.
          _invMat.copy(globeGroup.matrixWorld).invert();
          _localRay.origin.copy(raycasterRef.current.ray.origin).applyMatrix4(_invMat);
          _localRay.direction.copy(raycasterRef.current.ray.direction).transformDirection(_invMat);
          if (_localRay.intersectSphere(_globeSphere, _sphereHit)) {
            _sphereHit.normalize();
            let bestDot = -1;
            let bestCode: string | null = null;
            for (const [entryCode, geoData] of Object.entries(countryGeoDataRef.current)) {
              const dot = geoData.centroid.dot(_sphereHit);
              if (dot > Math.cos(geoData.angularRadius * 1.1) && dot > bestDot) {
                bestDot = dot;
                bestCode = entryCode;
              }
            }
            if (bestCode) {
              focusCountry(bestCode, globeGroup.localToWorld(_sphereHit.clone()));
            } else {
              onFocusClickRef.current(null);
            }
          } else {
            onFocusClickRef.current(null);
          }
        }
      }
    };

    let lastRaycastTime = 0;
    const onMouseMove = (e: MouseEvent) => {
      if (state.isDragging) {
        state.dragVelocity.x = e.clientX - state.previousMousePosition.x;
        state.dragVelocity.y = e.clientY - state.previousMousePosition.y;
        const panFactor = 0.005 * (camera.position.z / 3.0);
        globeGroup.rotation.y += state.dragVelocity.x * panFactor;
        globeGroup.rotation.x += state.dragVelocity.y * panFactor;
        state.previousMousePosition = { x: e.clientX, y: e.clientY };
      }

      const now = performance.now();
      if (now - lastRaycastTime < 32) return;
      lastRaycastTime = now;

      const rect = mount.getBoundingClientRect();
      mouseRef.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      const hitTargets = markerInstancesRef.current ? [markerInstancesRef.current.hitSpheres] : [];
      const markerHits = raycasterRef.current.intersectObjects(hitTargets).filter(
        (h) => { _n.copy(h.point).normalize(); _d.copy(camera.position).sub(h.point).normalize(); return _n.dot(_d) > 0.1; }
      );
      const ticker = markerHits.length > 0 && markerHits[0].instanceId !== undefined
        ? hqMarkersRef.current[markerHits[0].instanceId]?.ticker ?? null
        : null;
      hoveredMarkerTickerRef.current = ticker;

      if (ticker !== prevHoveredTickerRef.current) {
        prevHoveredTickerRef.current = ticker;
        onStockHoverRef.current?.(ticker);
        if (ticker) {
          if (hoverClearTimerRef.current) clearTimeout(hoverClearTimerRef.current);
          hoveredRef.current = null;
          onCountryHoverRef.current(null);
        }
      }

      if (!ticker) {
        let code: string | null = null;
        _invMat.copy(globeGroup.matrixWorld).invert();
        _localRay.origin.copy(raycasterRef.current.ray.origin).applyMatrix4(_invMat);
        _localRay.direction.copy(raycasterRef.current.ray.direction).transformDirection(_invMat);
        if (_localRay.intersectSphere(_globeSphere, _sphereHit)) {
          _sphereHit.normalize();
          let bestDot = -1;
          for (const [entryCode, geoData] of Object.entries(countryGeoDataRef.current)) {
            const dot = geoData.centroid.dot(_sphereHit);
            if (dot > Math.cos(geoData.angularRadius * 1.1) && dot > bestDot) {
              bestDot = dot;
              code = entryCode;
            }
          }
        }
        if (code) {
          if (hoverClearTimerRef.current) { clearTimeout(hoverClearTimerRef.current); hoverClearTimerRef.current = null; }
          if (code !== hoveredRef.current) { hoveredRef.current = code; onCountryHoverRef.current(code); }
        } else if (hoveredRef.current) {
          if (!hoverClearTimerRef.current) {
            hoverClearTimerRef.current = setTimeout(() => {
              hoverClearTimerRef.current = null;
              hoveredRef.current = null;
              onCountryHoverRef.current(null);
            }, 220);
          }
        }
      }
    };

    const onMouseLeave = () => {
      state.isDragging = false;
      if (hoverClearTimerRef.current) clearTimeout(hoverClearTimerRef.current);
      hoveredRef.current = null;
      hoveredMarkerTickerRef.current = null;
      if (prevHoveredTickerRef.current) { prevHoveredTickerRef.current = null; onStockHoverRef.current?.(null); }
      onCountryHoverRef.current(null);
    };

    mount.addEventListener("wheel", onWheel, { passive: false });
    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("mousemove", onMouseMove);
    mount.addEventListener("mouseleave", onMouseLeave);
    zoomSlider?.addEventListener("input", (e) => { state.targetZoom = parseFloat((e.target as HTMLInputElement).value); });
    opacitySlider?.addEventListener("input", (e) => { state.fogDensity = parseFloat((e.target as HTMLInputElement).value); });

    return () => {
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      mount.removeEventListener("wheel", onWheel);
      mount.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("mouseleave", onMouseLeave);
      renderer.dispose();
      scene.clear();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-process GeoJSON via worker whenever worldData, relevanceThreshold, or focusedCountryCode changes
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    const cached = geoJSONCacheRef.current;
    if (cached) {
      worker.postMessage({ geoJSON: cached, stateGeoJSON: stateGeoJSONCacheRef.current, worldData, relevanceThreshold, focusedCountryCode });
      return;
    }

    Promise.all([
      fetch("/countries.geojson").then((r) => r.json()),
      fetch("/us-states.geojson").then((r) => r.json()).catch(() => null),
    ]).then(([geoJSON, stateGeoJSON]: [GeoJSON, GeoJSON | null]) => {
        geoJSONCacheRef.current = geoJSON;
        stateGeoJSONCacheRef.current = stateGeoJSON;
        for (const feature of geoJSON.features) {
          const code = feature.properties["ISO3166-1-Alpha-2"] ?? "";
          if (code) countryGeoDataRef.current[code] = computeCountryGeoData(feature);
        }
        workerRef.current?.postMessage({ geoJSON, stateGeoJSON, worldData, relevanceThreshold, focusedCountryCode });
      });
  }, [worldData, relevanceThreshold, focusedCountryCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup || !worldData) return;
    rebuildHQMarkers(globeGroup, worldData, hqMarkersRef, markerInstancesRef);
  }, [worldData]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
