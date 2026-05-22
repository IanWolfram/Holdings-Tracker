import { useEffect, type MutableRefObject } from "react";
import type * as THREE from "three";
import { animateGlobe } from "./animation";
import type { GlobeSceneContext } from "./useGlobeSceneInit";
import type { HQMarkerState } from "./types";

interface UseGlobeAnimationParams {
  sceneCtxRef: MutableRefObject<GlobeSceneContext | null>;
  frameRef: MutableRefObject<number>;
  hqMarkersRef: MutableRefObject<HQMarkerState[]>;
  markerInstancesRef: MutableRefObject<{ hitSpheres: THREE.InstancedMesh } | null>;
  selectedDiamondRef: MutableRefObject<THREE.Mesh | null>;
  hoveredMarkerTickerRef: MutableRefObject<string | null>;
  focusedTickerRef: MutableRefObject<string | null>;
  isFocusedRef: MutableRefObject<boolean>;
  targetQuatRef: MutableRefObject<THREE.Quaternion | null>;
  focusZoomRef: MutableRefObject<number>;
  localHitRef: MutableRefObject<THREE.Vector3 | null>;
  showProposedRef: MutableRefObject<boolean>;
}

/**
 * Starts the requestAnimationFrame render loop that calls `animateGlobe`
 * every frame.  Reads the Three.js scene context from `sceneCtxRef`
 * (populated by useGlobeSceneInit) and all marker/focus refs for the
 * per-frame animation state.
 */
export function useGlobeAnimation({
  sceneCtxRef,
  frameRef,
  hqMarkersRef,
  markerInstancesRef,
  selectedDiamondRef,
  hoveredMarkerTickerRef,
  focusedTickerRef,
  isFocusedRef,
  targetQuatRef,
  focusZoomRef,
  localHitRef,
  showProposedRef,
}: UseGlobeAnimationParams) {
  useEffect(() => {
    const animate = () => {
      const ctx = sceneCtxRef.current;
      if (!ctx) return;
      frameRef.current = requestAnimationFrame(animate);
      animateGlobe(
        ctx.globeGroup,
        ctx.camera,
        ctx.scene,
        hqMarkersRef.current,
        markerInstancesRef.current,
        selectedDiamondRef.current,
        hoveredMarkerTickerRef.current,
        focusedTickerRef.current,
        isFocusedRef.current,
        targetQuatRef.current,
        focusZoomRef.current,
        localHitRef.current,
        ctx.mount,
        ctx.state,
        ctx.renderer,
        showProposedRef.current
      );
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}