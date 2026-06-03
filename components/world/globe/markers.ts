import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { WorldData } from "@/types/geo.types";
import {
  CLUSTER_DIST_THRESHOLD,
  type HQMarkerState,
  type ProposedMarkerData,
} from "@/components/world/globe/types";
import { latLonToVector3 } from "@/components/world/globe/math";

const PROPOSED_COLOR = 0xeab308;

function createMarkerMeshes(
  dotRadius: number,
  dRadius: number,
  dHalfH: number,
  surfacePos: THREE.Vector3,
  outward: THREE.Vector3,
  ticker: string,
  countryCode: string,
  isProposed: boolean,
): { sphere: THREE.Mesh; hitSphere: THREE.Mesh; hoverDiamond: THREE.Mesh } {
  const sphereColor = isProposed ? PROPOSED_COLOR : 0xffffff;
  const sphereOpacity = isProposed ? 0.60 : 0.75;
  const diamondColor = isProposed ? PROPOSED_COLOR : 0x00ff88;

  const sphereGeo = new THREE.SphereGeometry(dotRadius, 10, 10);
  const sphereMat = new THREE.MeshBasicMaterial({ color: sphereColor, transparent: true, opacity: sphereOpacity });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(surfacePos);
  sphere.userData = { isMarker: true, ticker, countryCode };

  const sphereOutlineGeo = new THREE.SphereGeometry(dotRadius, 10, 10);
  const sphereOutlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 1 });
  const sphereOutline = new THREE.Mesh(sphereOutlineGeo, sphereOutlineMat);
  sphereOutline.scale.setScalar(1.18);
  sphere.add(sphereOutline);

  const hGeo = new THREE.SphereGeometry(dotRadius * 4, 8, 8);
  const hMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitSphere = new THREE.Mesh(hGeo, hMat);
  hitSphere.position.copy(surfacePos);
  hitSphere.userData = { isMarker: true, ticker, countryCode };

  const dGeo = new THREE.OctahedronGeometry(dRadius, 0);
  dGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));
  const dMat = new THREE.MeshBasicMaterial({ color: diamondColor, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const hoverDiamond = new THREE.Mesh(dGeo, dMat);
  hoverDiamond.position.copy(surfacePos.clone().addScaledVector(outward, dHalfH));
  hoverDiamond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
  hoverDiamond.scale.setScalar(0);

  const diamondOutlineGeo = new THREE.OctahedronGeometry(dRadius, 0);
  diamondOutlineGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.4, 1));
  const diamondOutlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  const diamondOutline = new THREE.Mesh(diamondOutlineGeo, diamondOutlineMat);
  diamondOutline.scale.setScalar(1.18);
  hoverDiamond.add(diamondOutline);

  const dEdgesGeo = new THREE.EdgesGeometry(dGeo);
  const dEdgesPos = dEdgesGeo.attributes.position;
  const dEdgeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const dYAxis = new THREE.Vector3(0, 1, 0);
  for (let ei = 0; ei < dEdgesPos.count; ei += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(dEdgesPos, ei);
    const b = new THREE.Vector3().fromBufferAttribute(dEdgesPos, ei + 1);
    const len = a.distanceTo(b);
    const cylGeo = new THREE.CylinderGeometry(dRadius * 0.05, dRadius * 0.05, len, 6, 1);
    const cyl = new THREE.Mesh(cylGeo, dEdgeMat);
    cyl.position.copy(a).add(b).multiplyScalar(0.5);
    cyl.quaternion.setFromUnitVectors(dYAxis, b.clone().sub(a).normalize());
    hoverDiamond.add(cyl);
  }
  dEdgesGeo.dispose();

  return { sphere, hitSphere, hoverDiamond };
}

export function rebuildHQMarkers(
  globeGroup: THREE.Group,
  worldData: WorldData,
  hqMarkersRef: MutableRefObject<HQMarkerState[]>,
  markerInstancesRef: MutableRefObject<{
    hitSpheres: THREE.InstancedMesh;
  } | null>,
  proposedMarkers?: ProposedMarkerData[]
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
  const heldTickers = new Set(profiles.map((p) => p.ticker));
  const dedupedProposed = (proposedMarkers ?? []).filter((pm) => !heldTickers.has(pm.ticker));
  const count = profiles.length + dedupedProposed.length;
  if (count === 0) {
    return;
  }

  const hitGeo = new THREE.SphereGeometry(1, 8, 8);
  const hitSpheres = new THREE.InstancedMesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }), count);
  hitSpheres.userData = { isMarkerInstance: true };

  markerInstancesRef.current = { hitSpheres };
  globeGroup.add(hitSpheres);

  let instanceIdx = 0;

  const addMarker = (
    ticker: string,
    countryCode: string,
    lat: number,
    lon: number,
    posValue: number,
    isProposed: boolean,
  ) => {
    const scale = posValue > 0 ? Math.max(0.5, Math.min(3, posValue / 50000)) : 1;
    const dotRadius = 0.009 + scale * 0.005;
    const dRadius = 0.013;
    const dHalfH = dRadius * 2.4;

    const surfacePos = latLonToVector3(lat, lon, 1.018);
    const outward = surfacePos.clone().normalize();
    const i = instanceIdx++;

    const { sphere, hitSphere, hoverDiamond } = createMarkerMeshes(
      dotRadius, dRadius, dHalfH, surfacePos, outward, ticker, countryCode, isProposed
    );

    const group = new THREE.Group();
    group.userData = { isMarkerGroup: true };
    group.add(sphere);
    group.add(hitSphere);
    group.add(hoverDiamond);
    globeGroup.add(group);

    hqMarkersRef.current.push({
      ticker,
      countryCode,
      instanceId: i,
      outward,
      hoverT: 0,
      basePos: surfacePos.clone(),
      dotRadius,
      dHalfH,
      spreadOffset: null,
      clusterPeers: [],
      separationT: 0,
      focusT: 0,
      isProposed,
      sphere,
      hitSphere,
      hoverDiamond,
      group,
      visible: true,
      renderedVisible: true,
    });
  };

  // Held position markers (white spheres, green diamonds)
  profiles.forEach((profile) => {
    const state = worldData.countries[profile.countryCode];
    const posValue = state?.totalPositionValue ?? 0;
    addMarker(profile.ticker, profile.countryCode, profile.lat, profile.lon, posValue, false);
  });

  // Proposed position markers (orange spheres, orange diamonds)
  dedupedProposed.forEach((pm) => {
    addMarker(pm.ticker, pm.countryCode, pm.lat, pm.lon, 0, true);
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
      // Same-country only: focusT is per-country, so a mixed-country cluster
      // would spread unevenly (only matching members move on country focus).
      if (a.countryCode !== b.countryCode || a.basePos.distanceTo(b.basePos) > CLUSTER_DIST_THRESHOLD) {
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

  // Desired arc gap between adjacent markers on the spread circle (globe-local
  // units; globe radius = 1). The circle radius grows with cluster size so the
  // gap stays roughly constant no matter how many markers share a location.
  const SPREAD_GAP = 0.07;

  const seen = new Set<string[]>();
  for (const cluster of clusterOf.values()) {
    if (cluster.length < 2 || seen.has(cluster)) {
      continue;
    }
    seen.add(cluster);
    // Stable order independent of held/proposed (proposed tickers aren't in
    // worldData.profiles), so the circular layout is deterministic.
    cluster.sort((a, b) => {
      const pa = markers.find((m) => m.ticker === a)!.basePos;
      const pb = markers.find((m) => m.ticker === b)!.basePos;
      return pa.x - pb.x || pa.y - pb.y || pa.z - pb.z;
    });

    const centroid = new THREE.Vector3();
    for (const t of cluster) {
      centroid.add(markers.find((m) => m.ticker === t)!.basePos);
    }
    centroid.divideScalar(cluster.length).normalize();

    // Orthonormal tangent basis at the cluster centroid.
    const eastDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), centroid).normalize();
    const northDir = new THREE.Vector3().crossVectors(centroid, eastDir).normalize();
    const center = centroid.clone().multiplyScalar(1.018);

    const n = cluster.length;
    const radius = Math.max(0.035, SPREAD_GAP / (2 * Math.sin(Math.PI / n)));

    cluster.forEach((t, idx) => {
      const ms = markers.find((m) => m.ticker === t)!;
      const angle = (2 * Math.PI * idx) / n;
      const dir = eastDir
        .clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(northDir, Math.sin(angle));
      // Offset that carries basePos onto its slot on the circle around `center`.
      ms.spreadOffset = center.clone().addScaledVector(dir, radius).sub(ms.basePos);
      ms.clusterPeers = cluster;
    });
  }
}