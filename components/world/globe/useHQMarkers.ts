import { useEffect, useRef } from "react";
import * as THREE from "three";
import { rebuildHQMarkers } from "./markers";
import type { HQMarkerState, ProposedMarkerData } from "./types";
import type { WorldData } from "@/types/geo.types";

export function useHQMarkers(
  globeGroupRef: React.RefObject<THREE.Group | null>,
  hqMarkersRef: React.MutableRefObject<HQMarkerState[]>,
  markerInstancesRef: React.MutableRefObject<{
    hitSpheres: THREE.InstancedMesh;
  } | null>,
  proposedMarkers: ProposedMarkerData[] | undefined,
  worldData: WorldData | null
) {
  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup || !worldData) return;
    rebuildHQMarkers(globeGroup, worldData, hqMarkersRef, markerInstancesRef, proposedMarkers);
  }, [worldData, proposedMarkers]);
}