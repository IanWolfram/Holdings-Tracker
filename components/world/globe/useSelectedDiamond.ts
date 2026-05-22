import { useEffect, useRef } from "react";
import * as THREE from "three";
import { latLonToVector3 } from "./math";
import type { HQMarkerState } from "./types";
import type { WorldData } from "@/types/geo.types";

export function useSelectedDiamond(
  globeGroupRef: React.RefObject<THREE.Group | null>,
  selectedDiamondRef: React.MutableRefObject<THREE.Mesh | null>,
  hqMarkersRef: React.MutableRefObject<HQMarkerState[]>,
  focusedTicker: string | null | undefined,
  worldData: WorldData | null
) {
  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    if (!globeGroup) return;

    if (selectedDiamondRef.current) {
      globeGroup.remove(selectedDiamondRef.current);
      selectedDiamondRef.current.geometry.dispose();
      (selectedDiamondRef.current.material as THREE.Material).dispose();
      selectedDiamondRef.current = null;
    }

    for (const ms of hqMarkersRef.current) {
      ms.group.visible = true;
    }

    if (!focusedTicker || !worldData) return;
    const profile = worldData.profiles[focusedTicker];
    const ms = hqMarkersRef.current.find((m) => m.ticker === focusedTicker);
    if (!profile && !ms) return;

    if (ms) ms.group.visible = false;

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

    const surfacePos = profile
      ? latLonToVector3(profile.lat, profile.lon, 1.018)
      : ms?.basePos.clone() ?? new THREE.Vector3();
    const outward = surfacePos.clone().normalize();

    const halfHeight = radius * 2.4;
    diamond.position.copy(surfacePos.clone().addScaledVector(outward, halfHeight));

    const localUp = new THREE.Vector3(0, 1, 0);
    diamond.quaternion.setFromUnitVectors(localUp, outward);

    globeGroup.add(diamond);
    selectedDiamondRef.current = diamond;
  }, [focusedTicker, worldData]);
}