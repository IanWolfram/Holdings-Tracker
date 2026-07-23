import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { WorldData } from "@/types/geo.types";
import type {
  CountryGeoData,
  GeoJSON,
  HQMarkerState,
  ProposedMarkerData,
} from "@/components/world/globe/types";
import type { GlobeFocusTarget } from "@/components/world/globe/focus";
import { computeCountryGeoData, latLonToVector3 } from "@/components/world/globe/math";
import { rebuildHQMarkers } from "@/components/world/globe/markers";
import { TrafficSystem } from "@/components/world/globe/traffic";
import { useSyncedRef } from "./useSyncedRef";
import { useGlobeSceneInit, type GlobeSceneContext } from "./useGlobeSceneInit";
import { useGlobeAnimation } from "./useGlobeAnimation";
import { useGlobeInteraction } from "./useGlobeInteraction";

interface UseGlobeSceneParams {
  worldData: WorldData | null;
  relevanceThreshold: number;
  onCountryHover: (code: string | null) => void;
  onStockHover?: (ticker: string | null, coLocated?: string[]) => void;
  onFocusClick: (target: GlobeFocusTarget) => void;
  isFocused: boolean;
  focusedTicker?: string | null;
  focusedCountryCode?: string | null;
  navigateTo?: { lat: number; lon: number } | null;
  // Fit-to-positions camera overrides keyed by country code. When a focused
  // country has an entry, the camera frames `{ lat, lon, angularRadius }`
  // (the user's in-country holdings) instead of the country's full-territory
  // geo data. Countries absent from the map fall back to default framing.
  countryFocusOverrides?: Record<string, { lat: number; lon: number; angularRadius: number }> | null;
  // Ticker hovered from outside the canvas (the country panel's logo row).
  // Highlights that marker's octahedron exactly like an on-globe hover.
  externalHoveredTicker?: string | null;
  proposedMarkers?: ProposedMarkerData[];
  showProposed?: boolean;
}

export function useGlobeScene({
  worldData,
  relevanceThreshold,
  onCountryHover,
  onStockHover,
  onFocusClick,
  isFocused,
  focusedTicker,
  focusedCountryCode,
  navigateTo,
  countryFocusOverrides,
  externalHoveredTicker,
  proposedMarkers,
  showProposed = true,
}: UseGlobeSceneParams) {
  // -- Refs -----------------------------------------------------------------
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneCtxRef = useRef<GlobeSceneContext | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const countryLinesRef = useRef<THREE.Object3D[]>([]);
  const stateLinesRef = useRef<THREE.Object3D[]>([]);
  const stateGeoJSONCacheRef = useRef<GeoJSON | null>(null);
  const hqMarkersRef = useRef<HQMarkerState[]>([]);
  const markerInstancesRef = useRef<{ hitSpheres: THREE.InstancedMesh } | null>(null);
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
  const prevHoveredTickerRef = useRef<string | null>(null);
  const segmentToCountryRef = useRef<string[]>([]);
  const geoJSONCacheRef = useRef<GeoJSON | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const selectedDiamondRef = useRef<THREE.Mesh | null>(null);
  const trafficRef = useRef<TrafficSystem | null>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);

  // -- Synced callback refs (always hold the latest value without re-triggering effects) --
  const onFocusClickRef = useSyncedRef(onFocusClick);
  const showProposedRef = useSyncedRef(showProposed);
  const onStockHoverRef = useSyncedRef(onStockHover);
  const onCountryHoverRef = useSyncedRef(onCountryHover);
  const focusedTickerRef = useSyncedRef(focusedTicker ?? null);
  const focusedCountryRef = useSyncedRef(focusedCountryCode ?? null);
  const countryFocusOverridesRef = useSyncedRef(countryFocusOverrides ?? null);
  const externalHoveredTickerRef = useSyncedRef(externalHoveredTicker ?? null);

  // -- Small local effects --------------------------------------------------

  // isFocused has side effects (clearing targetQuat/localHit), so it stays manual
  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused) {
      targetQuatRef.current = null;
      localHitRef.current = null;
    }
  }, [isFocused]);

  // Diamond plumbob selected-marker — appears on the focused HQ dot, spins around surface normal
  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup) return;

    // Tear down old diamond
    if (selectedDiamondRef.current) {
      globeGroup.remove(selectedDiamondRef.current);
      selectedDiamondRef.current.geometry.dispose();
      (selectedDiamondRef.current.material as THREE.Material).dispose();
      selectedDiamondRef.current = null;
    }

    // Restore all marker groups to fully visible
    for (const ms of hqMarkersRef.current) {
      ms.group.visible = true;
    }

    if (!focusedTicker || !worldData) return;
    const profile = worldData.profiles[focusedTicker];
    const ms = hqMarkersRef.current.find((m) => m.ticker === focusedTicker);
    // Proposed tickers may not be in worldData.profiles — use marker state for position
    if (!profile && !ms) return;

    // Hide the entire group for this ticker (selected diamond replaces it)
    if (ms) ms.group.visible = false;

    // Build the plumbob: a vertically elongated octahedron (diamond shape)
    const radius = 0.016;
    const geo = new THREE.OctahedronGeometry(radius, 0);
    geo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));

    const mat = new THREE.MeshBasicMaterial({
      color: ms?.isProposed ? 0xeab308 : 0x00ff88,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });

    const diamond = new THREE.Mesh(geo, mat);

    const outlineGeo = new THREE.OctahedronGeometry(radius, 0);
    outlineGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
    });
    const outline = new THREE.Mesh(outlineGeo, outlineMat);
    outline.scale.setScalar(1.18);
    diamond.add(outline);

    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edgesPos = edgesGeo.attributes.position;
    const edgesGroup = new THREE.Group();
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < edgesPos.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(edgesPos, i);
      const b = new THREE.Vector3().fromBufferAttribute(edgesPos, i + 1);
      const len = a.distanceTo(b);
      const cylGeo = new THREE.CylinderGeometry(radius * 0.05, radius * 0.05, len, 6, 1);
      const cyl = new THREE.Mesh(cylGeo, edgeMat);
      cyl.position.copy(a).add(b).multiplyScalar(0.5);
      cyl.quaternion.setFromUnitVectors(yAxis, b.clone().sub(a).normalize());
      edgesGroup.add(cyl);
    }
    edgesGeo.dispose();
    diamond.add(edgesGroup);

    // Surface position — 1.018 matches marker placement
    // For proposed tickers not in worldData.profiles, use marker state
    const baseSurface = profile
      ? latLonToVector3(profile.lat, profile.lon, 1.018)
      : ms!.basePos.clone();
    // When the focused stock's country is focused, its cluster is spread onto a
    // circle. Place the plumbob on the same spread slot so it doesn't snap back
    // to the stacked centroid when the marker becomes the selection.
    const countryFocused = !!focusedCountryCode && ms?.countryCode === focusedCountryCode;
    const surfacePos = ms?.spreadOffset && countryFocused
      ? baseSurface.add(ms.spreadOffset)
      : baseSurface;
    const outward = surfacePos.clone().normalize();

    // Sit the bottom tip ON the surface: move center up by one half-height
    const halfHeight = radius * 2.4;
    diamond.position.copy(surfacePos.clone().addScaledVector(outward, halfHeight));

    // Orient so local +Y points radially outward from globe center
    const localUp = new THREE.Vector3(0, 1, 0);
    diamond.quaternion.setFromUnitVectors(localUp, outward);

    globeGroup.add(diamond);
    selectedDiamondRef.current = diamond;
  }, [focusedTicker, focusedCountryCode, worldData]);

  // navigateTo — compute target rotation for camera focus
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
    if (pathEl) {
      pathEl.setAttribute("d", "M -9999 -9999");
    }
  }, [navigateTo]);

  // -- Sub-hooks (declaration order = mount order; cleanup runs reverse) -----
  // 1. Init populates sceneCtxRef
  useGlobeSceneInit({
    sceneCtxRef,
    mountRef,
    globeGroupRef,
    workerRef,
    countryLinesRef,
    stateLinesRef,
    segmentToCountryRef,
    hqMarkersRef,
    selectedDiamondRef,
    setWebglAvailable,
  });

  // 2. Animation reads sceneCtxRef and starts the render loop
  useGlobeAnimation({
    sceneCtxRef,
    frameRef,
    hqMarkersRef,
    markerInstancesRef,
    selectedDiamondRef,
    hoveredMarkerTickerRef,
    externalHoveredTickerRef,
    focusedTickerRef,
    focusedCountryRef,
    isFocusedRef,
    targetQuatRef,
    focusZoomRef,
    localHitRef,
    showProposedRef,
    trafficRef,
  });

  // 3. Interaction reads sceneCtxRef and attaches event handlers
  useGlobeInteraction({
    sceneCtxRef,
    raycasterRef,
    mouseRef,
    hqMarkersRef,
    markerInstancesRef,
    hoveredMarkerTickerRef,
    hoveredRef,
    prevHoveredTickerRef,
    hoverClearTimerRef,
    countryGeoDataRef,
    geoJSONCacheRef,
    targetQuatRef,
    focusZoomRef,
    localHitRef,
    onFocusClickRef,
    onStockHoverRef,
    onCountryHoverRef,
    countryFocusOverridesRef,
    trafficRef,
  });

  // -- Data effects (geo data + marker rebuilding) -------------------------

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
        if (code) {
          countryGeoDataRef.current[code] = computeCountryGeoData(feature);
        }
      }
      workerRef.current?.postMessage({ geoJSON, stateGeoJSON, worldData, relevanceThreshold, focusedCountryCode });

      // Build the boat/plane traffic system once, after the land geometry is
      // available (its ocean grid is derived from the country polygons). The
      // grid build is ~250ms, so defer to idle time to avoid stuttering mount.
      const buildTraffic = () => {
        if (!trafficRef.current && globeGroupRef.current && sceneCtxRef.current) {
          trafficRef.current = new TrafficSystem(globeGroupRef.current, geoJSON.features, countryGeoDataRef.current);
        }
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(buildTraffic, { timeout: 2500 });
      } else {
        setTimeout(buildTraffic, 300);
      }
    });
  }, [worldData, relevanceThreshold, focusedCountryCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dispose the traffic system on unmount (runs independently of the data effect
  // so route regeneration doesn't tear it down).
  useEffect(() => {
    return () => {
      trafficRef.current?.dispose();
      trafficRef.current = null;
    };
  }, []);

  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup || !worldData) return;
    rebuildHQMarkers(globeGroup, worldData, hqMarkersRef, markerInstancesRef, proposedMarkers);
  }, [worldData, proposedMarkers]);

  return { mountRef, webglAvailable };
}