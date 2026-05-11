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

  const _yAxis = new THREE.Vector3(0, 1, 0);

  profiles.forEach((profile, i) => {
    const state = worldData.countries[profile.countryCode];
    const posValue = state?.totalPositionValue ?? 0;
    const scale = posValue > 0 ? Math.max(0.5, Math.min(3, posValue / 50000)) : 1;
    const dotRadius = 0.009 + scale * 0.005;

    const surfacePos = latLonToVector3(profile.lat, profile.lon, 1.018);
    const outward = surfacePos.clone().normalize();

    // White sphere (default state)
    const sphereGeo = new THREE.SphereGeometry(dotRadius, 10, 10);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.copy(surfacePos);
    sphere.userData = { isMarker: true, ticker: profile.ticker, countryCode: profile.countryCode };

    // Invisible hit-sphere (larger radius for easier hover/click)
    const hGeo = new THREE.SphereGeometry(dotRadius * 4, 8, 8);
    const hMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitSphere = new THREE.Mesh(hGeo, hMat);
    hitSphere.position.copy(surfacePos);
    hitSphere.userData = { isMarker: true, ticker: profile.ticker, countryCode: profile.countryCode };

    // Hover diamond (appears on mouseover)
    const dRadius = 0.013;
    const dHalfH = dRadius * 2.4;
    const dGeo = new THREE.OctahedronGeometry(dRadius, 0);
    dGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));
    const dMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const hoverDiamond = new THREE.Mesh(dGeo, dMat);
    hoverDiamond.position.copy(surfacePos.clone().addScaledVector(outward, dHalfH));
    hoverDiamond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
    hoverDiamond.scale.setScalar(0); // starts invisible

    // Group
    const group = new THREE.Group();
    group.userData = { isMarkerGroup: true };
    group.add(sphere);
    group.add(hitSphere);
    group.add(hoverDiamond);
    globeGroup.add(group);

    hqMarkersRef.current.push({
      ticker: profile.ticker,
      countryCode: profile.countryCode,
      instanceId: i,
      outward,
      hoverT: 0,
      basePos: surfacePos.clone(),
      dotRadius,
      dHalfH,
      eastDir: null,
      sepIndex: 0,
      clusterPeers: [],
      separationT: 0,
      focusT: 0,
      sphere,
      hitSphere,
      hoverDiamond,
      group,
      visible: true,
      renderedVisible: true,
    });
  });

  // Cluster detection
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