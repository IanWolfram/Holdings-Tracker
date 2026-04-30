import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { WorldData } from "@/types/geo.types";
import {
  CLUSTER_DIST_THRESHOLD,
  type HQMarkerState,
} from "@/components/world/globe/types";
import { latLonToVector3 } from "@/components/world/globe/math";

export function rebuildHQMarkers(
  globeGroup: THREE.Group,
  worldData: WorldData,
  hqMarkersRef: MutableRefObject<HQMarkerState[]>,
  markerInstancesRef: MutableRefObject<{
    hitSpheres: THREE.InstancedMesh;
  } | null>
) {
  if (markerInstancesRef.current) {
    globeGroup.remove(markerInstancesRef.current.hitSpheres);
    markerInstancesRef.current.hitSpheres.geometry.dispose();
    (markerInstancesRef.current.hitSpheres.material as THREE.Material).dispose();
    markerInstancesRef.current = null;
  }
  hqMarkersRef.current = [];

  const profiles = Object.values(worldData.profiles);
  const count = profiles.length;
  if (count === 0) {
    return;
  }

  const hitGeo = new THREE.SphereGeometry(1, 8, 8);
  const hitSpheres = new THREE.InstancedMesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }), count);
  hitSpheres.userData = { isMarkerInstance: true };

  markerInstancesRef.current = { hitSpheres };
  globeGroup.add(hitSpheres);

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
      focusT: 0,
      spinAngle: 0,
      visible: true,
      renderedVisible: true,
    });
  });

  const markers = hqMarkersRef.current;
  const clusterOf = new Map<string, string[]>();
  for (let i = 0; i < markers.length; i++) {
    const a = markers[i];
    if (!clusterOf.has(a.ticker)) {
      clusterOf.set(a.ticker, [a.ticker]);
    }
    for (let j = i + 1; j < markers.length; j++) {
      const b = markers[j];
      if (a.basePos.distanceTo(b.basePos) > CLUSTER_DIST_THRESHOLD) {
        continue;
      }
      const ca = clusterOf.get(a.ticker) ?? [a.ticker];
      const cb = clusterOf.get(b.ticker) ?? [b.ticker];
      if (ca === cb) {
        continue;
      }
      const merged = [...ca, ...cb];
      for (const t of merged) {
        clusterOf.set(t, merged);
      }
    }
  }

  const seen = new Set<string[]>();
  for (const cluster of clusterOf.values()) {
    if (cluster.length < 2 || seen.has(cluster)) {
      continue;
    }
    seen.add(cluster);
    cluster.sort((a, b) => (worldData.profiles[a]?.lon ?? 0) - (worldData.profiles[b]?.lon ?? 0));
    const centroid = new THREE.Vector3();
    for (const t of cluster) {
      centroid.add(markers.find((m) => m.ticker === t)!.basePos);
    }
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
