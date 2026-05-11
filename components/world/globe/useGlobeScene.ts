import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { WorldData } from "@/types/geo.types";
import type {
  CountryGeoData,
  GeoJSON,
  HQMarkerState,
  RenderState,
} from "@/components/world/globe/types";
import {
  computeCountryGeoData,
  findCountryAtLatLon,
  getCameraShiftX,
  latLonToVector3,
  vector3ToLatLon,
  zoomForAngularRadius,
} from "@/components/world/globe/math";
import { applyCountryBuffers, applyStateBuffers } from "@/components/world/globe/buffers";
import { rebuildHQMarkers } from "@/components/world/globe/markers";
import { animateGlobe } from "@/components/world/globe/animation";
import type { GlobeFocusTarget } from "@/components/world/globe/focus";

interface UseGlobeSceneParams {
  worldData: WorldData | null;
  relevanceThreshold: number;
  onCountryHover: (code: string | null) => void;
  onStockHover?: (ticker: string | null) => void;
  onFocusClick: (target: GlobeFocusTarget) => void;
  isFocused: boolean;
  focusedTicker?: string | null;
  focusedCountryCode?: string | null;
  navigateTo?: { lat: number; lon: number } | null;
}

const _n = new THREE.Vector3();
const _d = new THREE.Vector3();
const _globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.001);
const _localRay = new THREE.Ray();
const _invMat = new THREE.Matrix4();
const _sphereHit = new THREE.Vector3();

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
}: UseGlobeSceneParams) {
  const mountRef = useRef<HTMLDivElement>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const countryLinesRef = useRef<THREE.Object3D[]>([]);
  const stateLinesRef = useRef<THREE.Object3D[]>([]);
  const stateGeoJSONCacheRef = useRef<GeoJSON | null>(null);
  const hqMarkersRef = useRef<HQMarkerState[]>([]);
  const markerInstancesRef = useRef<{
    hitSpheres: THREE.InstancedMesh;
  } | null>(null);
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
  const focusedTickerRef = useRef<string | null>(null);
  const selectedDiamondRef = useRef<THREE.Mesh | null>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);

  useEffect(() => {
    onFocusClickRef.current = onFocusClick;
  }, [onFocusClick]);
  useEffect(() => {
    onStockHoverRef.current = onStockHover;
  }, [onStockHover]);
  useEffect(() => {
    onCountryHoverRef.current = onCountryHover;
  }, [onCountryHover]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused) {
      targetQuatRef.current = null;
      localHitRef.current = null;
    }
  }, [isFocused]);

  useEffect(() => {
    focusedTickerRef.current = focusedTicker ?? null;
  }, [focusedTicker]);

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
    if (!profile || profile.lat === undefined || profile.lon === undefined) return;

    // Hide the entire group for this ticker (selected diamond replaces it)
    const ms = hqMarkersRef.current.find((m) => m.ticker === focusedTicker);
    if (ms) ms.group.visible = false;

    // Build the plumbob: a vertically elongated octahedron (diamond shape)
    const radius = 0.016;
    const geo = new THREE.OctahedronGeometry(radius, 0);
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
    const halfHeight = radius * 2.4;
    diamond.position.copy(surfacePos.clone().addScaledVector(outward, halfHeight));

    // Orient so local +Y points radially outward from globe center
    const localUp = new THREE.Vector3(0, 1, 0);
    diamond.quaternion.setFromUnitVectors(localUp, outward);

    globeGroup.add(diamond);
    selectedDiamondRef.current = diamond;
  }, [focusedTicker, worldData]);

  useEffect(() => {
    if (!navigateTo) {
      return;
    }
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

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a110a, 1.0, 3.0);

    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 2.6);
    camera.lookAt(0, 0, 0);

    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) {
      setWebglAvailable(false);
      return;
    }

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
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      setWebglAvailable(false);
    }, false);
    mount.appendChild(renderer.domElement);

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
        camera,
        scene,
        hqMarkersRef.current,
        markerInstancesRef.current,
        selectedDiamondRef.current,
        hoveredMarkerTickerRef.current,
        focusedTickerRef.current,
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
    if (zoomSlider) {
      zoomSlider.value = state.targetZoom.toString();
    }
    if (opacitySlider) {
      opacitySlider.value = state.fogDensity.toString();
    }

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
      if (zoomSlider) {
        zoomSlider.value = state.targetZoom.toString();
      }
    };

    let mouseDownX = 0;
    let mouseDownY = 0;
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
      if (!mouseIsDownOnMount) {
        return;
      }
      mouseIsDownOnMount = false;
      if (Math.sqrt(Math.pow(e.clientX - mouseDownX, 2) + Math.pow(e.clientY - mouseDownY, 2)) > 5) {
        return;
      }

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
            focusZoomRef.current = 1.15;
            onFocusClickRef.current({ type: "stock", ticker: ms.ticker });
            markerHandled = true;
          }
        }
      }

      if (!markerHandled) {
        const borderTargets = countryLinesRef.current.filter((obj) => !obj.userData.isMergedDots);
        const borderHits = raycasterRef.current.intersectObjects(borderTargets).filter(facingFilter);
        if (borderHits.length > 0) {
          const hit = borderHits[0];
          if ((hit.object.userData as { isMergedBorder?: boolean }).isMergedBorder && hit.index !== undefined) {
            const code = segmentToCountryRef.current[Math.floor(hit.index / 2)];
            if (code) {
              focusCountry(code, hit.point);
            }
          }
        } else {
          _invMat.copy(globeGroup.matrixWorld).invert();
          _localRay.origin.copy(raycasterRef.current.ray.origin).applyMatrix4(_invMat);
          _localRay.direction.copy(raycasterRef.current.ray.direction).transformDirection(_invMat);
          if (_localRay.intersectSphere(_globeSphere, _sphereHit)) {
            const { lat, lon } = vector3ToLatLon(_sphereHit);
            const geoJSON = geoJSONCacheRef.current;
            const code = geoJSON ? findCountryAtLatLon(lat, lon, geoJSON.features, countryGeoDataRef.current) : null;
            if (code) {
              focusCountry(code, globeGroup.localToWorld(_sphereHit.clone()));
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
      if (now - lastRaycastTime < 32) {
        return;
      }
      lastRaycastTime = now;

      const rect = mount.getBoundingClientRect();
      mouseRef.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      const hitTargets = markerInstancesRef.current ? [markerInstancesRef.current.hitSpheres] : [];
      const markerHits = raycasterRef.current.intersectObjects(hitTargets).filter(
        (h) => {
          _n.copy(h.point).normalize();
          _d.copy(camera.position).sub(h.point).normalize();
          return _n.dot(_d) > 0.1;
        }
      );
      const ticker = markerHits.length > 0 && markerHits[0].instanceId !== undefined
        ? hqMarkersRef.current[markerHits[0].instanceId]?.ticker ?? null
        : null;
      hoveredMarkerTickerRef.current = ticker;

      if (ticker !== prevHoveredTickerRef.current) {
        prevHoveredTickerRef.current = ticker;
        onStockHoverRef.current?.(ticker);
        if (ticker) {
          if (hoverClearTimerRef.current) {
            clearTimeout(hoverClearTimerRef.current);
          }
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
          const { lat, lon } = vector3ToLatLon(_sphereHit);
          const geoJSON = geoJSONCacheRef.current;
          code = geoJSON ? findCountryAtLatLon(lat, lon, geoJSON.features, countryGeoDataRef.current) : null;
        }
        if (code) {
          if (hoverClearTimerRef.current) {
            clearTimeout(hoverClearTimerRef.current);
            hoverClearTimerRef.current = null;
          }
          if (code !== hoveredRef.current) {
            hoveredRef.current = code;
            onCountryHoverRef.current(code);
          }
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
      if (hoverClearTimerRef.current) {
        clearTimeout(hoverClearTimerRef.current);
      }
      hoveredRef.current = null;
      hoveredMarkerTickerRef.current = null;
      if (prevHoveredTickerRef.current) {
        prevHoveredTickerRef.current = null;
        onStockHoverRef.current?.(null);
      }
      onCountryHoverRef.current(null);
    };

    mount.addEventListener("wheel", onWheel, { passive: false });
    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("mousemove", onMouseMove);
    mount.addEventListener("mouseleave", onMouseLeave);
    zoomSlider?.addEventListener("input", (e) => {
      state.targetZoom = parseFloat((e.target as HTMLInputElement).value);
    });
    opacitySlider?.addEventListener("input", (e) => {
      state.fogDensity = parseFloat((e.target as HTMLInputElement).value);
    });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      mount.removeEventListener("wheel", onWheel);
      mount.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("mouseleave", onMouseLeave);
      // Dispose marker sphere groups
      for (const ms of hqMarkersRef.current) {
        ms.sphere.geometry.dispose();
        (ms.sphere.material as THREE.Material).dispose();
        ms.hitSphere.geometry.dispose();
        (ms.hitSphere.material as THREE.Material).dispose();
        ms.hoverDiamond.geometry.dispose();
        (ms.hoverDiamond.material as THREE.Material).dispose();
      }
      // Dispose selected diamond plumbob
      if (selectedDiamondRef.current) {
        selectedDiamondRef.current.geometry.dispose();
        (selectedDiamondRef.current.material as THREE.Material).dispose();
        selectedDiamondRef.current = null;
      }
      renderer.dispose();
      scene.clear();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) {
      return;
    }

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
    });
  }, [worldData, relevanceThreshold, focusedCountryCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup || !worldData) {
      return;
    }
    rebuildHQMarkers(globeGroup, worldData, hqMarkersRef, markerInstancesRef);
  }, [worldData]);

  return { mountRef, webglAvailable };
}