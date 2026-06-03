import { useEffect, type MutableRefObject } from "react";
import * as THREE from "three";
import type { GlobeSceneContext } from "./useGlobeSceneInit";
import type { CountryGeoData, GeoJSON, HQMarkerState } from "./types";
import type { GlobeFocusTarget } from "./focus";
import type { TrafficSystem } from "./traffic";
import {
  findCountryAtLatLon,
  getCameraShiftX,
  latLonToVector3,
  vector3ToLatLon,
  zoomForAngularRadius,
} from "./math";

// Reusable Three.js objects for raycasting (module-level to avoid GC pressure)
const _n = new THREE.Vector3();
const _d = new THREE.Vector3();
const _globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.001);
const _localRay = new THREE.Ray();
const _invMat = new THREE.Matrix4();
const _sphereHit = new THREE.Vector3();

interface UseGlobeInteractionParams {
  sceneCtxRef: MutableRefObject<GlobeSceneContext | null>;
  raycasterRef: MutableRefObject<THREE.Raycaster>;
  mouseRef: MutableRefObject<THREE.Vector2>;
  hqMarkersRef: MutableRefObject<HQMarkerState[]>;
  markerInstancesRef: MutableRefObject<{ hitSpheres: THREE.InstancedMesh } | null>;
  hoveredMarkerTickerRef: MutableRefObject<string | null>;
  hoveredRef: MutableRefObject<string | null>;
  prevHoveredTickerRef: MutableRefObject<string | null>;
  hoverClearTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  countryGeoDataRef: MutableRefObject<Record<string, CountryGeoData>>;
  geoJSONCacheRef: MutableRefObject<GeoJSON | null>;
  targetQuatRef: MutableRefObject<THREE.Quaternion | null>;
  focusZoomRef: MutableRefObject<number>;
  localHitRef: MutableRefObject<THREE.Vector3 | null>;
  onFocusClickRef: MutableRefObject<(target: GlobeFocusTarget) => void>;
  onStockHoverRef: MutableRefObject<((ticker: string | null) => void) | undefined>;
  onCountryHoverRef: MutableRefObject<(code: string | null) => void>;
  countryFocusOverrideRef: MutableRefObject<{
    code: string;
    lat: number;
    lon: number;
    angularRadius: number;
  } | null>;
  trafficRef: MutableRefObject<TrafficSystem | null>;
}

/**
 * Attaches mouse, wheel, resize, and slider event handlers to the globe
 * mount element.  Reads the Three.js scene context from `sceneCtxRef`
 * (populated by useGlobeSceneInit).
 *
 * Handles:
 *   - ResizeObserver for camera/renderer updates
 *   - Wheel zoom
 *   - Mouse drag to rotate the globe
 *   - Click (mouseup) to focus a country or marker
 *   - Mousemove to hover-highlight markers and countries
 *   - Slider inputs for zoom and fog density
 */
export function useGlobeInteraction({
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
  countryFocusOverrideRef,
  trafficRef,
}: UseGlobeInteractionParams) {
  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;
    const { camera, globeGroup, mount, state, renderer } = ctx;

    // -- Slider references ---------------------------------------------------
    const zoomSlider = document.getElementById("globe-zoom-slider") as HTMLInputElement | null;
    const opacitySlider = document.getElementById("globe-opacity-slider") as HTMLInputElement | null;
    if (zoomSlider) {
      zoomSlider.value = state.targetZoom.toString();
    }
    if (opacitySlider) {
      opacitySlider.value = state.fogDensity.toString();
    }

    // -- Resize handler -----------------------------------------------------
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

    // -- Wheel zoom ----------------------------------------------------------
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      state.targetZoom = Math.max(1.2, Math.min(state.targetZoom + e.deltaY * 0.012, 6.0));
      if (zoomSlider) {
        zoomSlider.value = state.targetZoom.toString();
      }
    };

    // -- Mouse drag ----------------------------------------------------------
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

    const facingFilter = (h: THREE.Intersection) => {
      _n.copy(h.point).normalize();
      _d.copy(camera.position).sub(h.point).normalize();
      return _n.dot(_d) > 0.1;
    };

    const focusCountry = (code: string, hitPoint: THREE.Vector3) => {
      const geoData = countryGeoDataRef.current[code];
      // Fit-to-positions override: when the user has positions inside this
      // country, frame their bounding circle instead of the country's full
      // territory — avoids being pinned to a country centroid that's far
      // from any actual holding (e.g. US centroid leaves the camera too
      // zoomed out when all positions cluster in a few cities).
      const override = countryFocusOverrideRef.current;
      if (override && override.code === code) {
        localHitRef.current = latLonToVector3(override.lat, override.lon, 1);
        targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(
          localHitRef.current.clone().normalize(),
          new THREE.Vector3(0, 0, 1)
        );
        // Tight padding (1.1x vs the default 1.45x) — the override already
        // bounds exactly the user's positions, so only a small margin is
        // needed to keep marker dots off the screen edge.
        focusZoomRef.current = zoomForAngularRadius(override.angularRadius, 1.1);
        onFocusClickRef.current({ type: "country", code });
        return;
      }
      localHitRef.current = geoData ? geoData.centroid.clone() : globeGroup.worldToLocal(hitPoint.clone());
      targetQuatRef.current = new THREE.Quaternion().setFromUnitVectors(
        localHitRef.current.clone().normalize(),
        new THREE.Vector3(0, 0, 1)
      );
      focusZoomRef.current = geoData ? zoomForAngularRadius(geoData.angularRadius) : 2.0;
      onFocusClickRef.current({ type: "country", code });
    };

    // -- Mouse up (click) ----------------------------------------------------
    const onMouseUp = (e: MouseEvent) => {
      state.isDragging = false;
      if (!mouseIsDownOnMount) return;
      mouseIsDownOnMount = false;
      if (Math.sqrt(Math.pow(e.clientX - mouseDownX, 2) + Math.pow(e.clientY - mouseDownY, 2)) > 5) return;

      const rect = mount.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      let markerHandled = false;
      if (markerInstancesRef.current) {
        const markerHits = raycasterRef.current
          .intersectObjects([markerInstancesRef.current.hitSpheres])
          .filter(facingFilter);
        if (markerHits.length > 0 && markerHits[0].instanceId !== undefined) {
          const ms = hqMarkersRef.current[markerHits[0].instanceId];
          if (ms?.visible) {
            // Anchor to the plumbob center (matches useEffect that builds the selected diamond:
            // surfacePos + outward * radius * 2.4 with radius = 0.016) so the dashed connector
            // attaches to the octahedron itself rather than wherever the cursor happened to hit.
            localHitRef.current = ms.basePos.clone().addScaledVector(ms.outward, 0.016 * 2.4);
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

      // Easter egg: clicking a boat/plane tracks it — the camera zooms in and
      // follows it along its route (handled per-frame in animateGlobe).
      const traffic = trafficRef.current;
      let vehicleHandled = false;
      if (!markerHandled && traffic?.tryPick(raycasterRef.current)) {
        camera.clearViewOffset(); // no side panel while tracking, so center the view
        onFocusClickRef.current(null); // close any open focus panel
        vehicleHandled = true;
      }

      // Any non-vehicle click exits tracking and restores the panel view offset.
      if (!vehicleHandled && traffic?.isTracking) {
        traffic.clearTracked();
        onResize();
      }

      if (!markerHandled && !vehicleHandled) {
        // Resolve the clicked country via sphere intersection + point-in-polygon —
        // identical to the hover path so click and hover always agree. (Raycasting
        // against the merged border LineSegments is unreliable: Raycaster's default
        // Line threshold of 1 unit on a unit-radius globe matches near-arbitrary
        // segments, sending focus to the wrong country.)
        _invMat.copy(globeGroup.matrixWorld).invert();
        _localRay.origin.copy(raycasterRef.current.ray.origin).applyMatrix4(_invMat);
        _localRay.direction.copy(raycasterRef.current.ray.direction).transformDirection(_invMat);
        if (_localRay.intersectSphere(_globeSphere, _sphereHit)) {
          const { lat, lon } = vector3ToLatLon(_sphereHit);
          const geoJSON = geoJSONCacheRef.current;
          const code = geoJSON
            ? findCountryAtLatLon(lat, lon, geoJSON.features, countryGeoDataRef.current)
            : null;
          if (code) {
            focusCountry(code, globeGroup.localToWorld(_sphereHit.clone()));
          } else {
            onFocusClickRef.current(null);
          }
        } else {
          onFocusClickRef.current(null);
        }
      }
    };

    // -- Mouse move (hover) --------------------------------------------------
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
        (h) => {
          _n.copy(h.point).normalize();
          _d.copy(camera.position).sub(h.point).normalize();
          return _n.dot(_d) > 0.1;
        }
      );
      const ticker =
        markerHits.length > 0 && markerHits[0].instanceId !== undefined
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
          code = geoJSON
            ? findCountryAtLatLon(lat, lon, geoJSON.features, countryGeoDataRef.current)
            : null;
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

    // -- Mouse leave ---------------------------------------------------------
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

    // -- Slider listeners (named so they can be removed) ----------------------
    const onZoomInput = (e: Event) => {
      state.targetZoom = parseFloat((e.target as HTMLInputElement).value);
    };
    const onOpacityInput = (e: Event) => {
      state.fogDensity = parseFloat((e.target as HTMLInputElement).value);
    };

    // -- Attach event listeners ----------------------------------------------
    mount.addEventListener("wheel", onWheel, { passive: false });
    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("mousemove", onMouseMove);
    mount.addEventListener("mouseleave", onMouseLeave);
    zoomSlider?.addEventListener("input", onZoomInput);
    opacitySlider?.addEventListener("input", onOpacityInput);

    return () => {
      resizeObserver.disconnect();
      mount.removeEventListener("wheel", onWheel);
      mount.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("mouseleave", onMouseLeave);
      zoomSlider?.removeEventListener("input", onZoomInput);
      opacitySlider?.removeEventListener("input", onOpacityInput);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}