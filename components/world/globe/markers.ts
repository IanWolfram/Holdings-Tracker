import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { WorldData } from "@/types/geo.types";
import {
  CLUSTER_DIST_THRESHOLD,
  type HQMarkerState,
} from "@/components/world/globe/types";
import { latLonToVector3 } from "@/components/world/globe/math";
import { createFallbackTexture, loadLogoTexture } from "@/lib/logo-texture";

// Fresnel glow shader — green rim glow at sphere edges
const glowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const glowFragmentShader = `
  uniform vec3 glowColor;
  uniform float intensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = 1.0 - dot(vNormal, vViewDir);
    fresnel = pow(max(0.0, fresnel), 3.0) * intensity;
    gl_FragColor = vec4(glowColor, fresnel);
  }
`;

const glowMaterial = new THREE.ShaderMaterial({
  vertexShader: glowVertexShader,
  fragmentShader: glowFragmentShader,
  uniforms: {
    glowColor: { value: new THREE.Color(0x00ff88) },
    intensity: { value: 0.6 },
  },
  transparent: true,
  depthWrite: false,
  side: THREE.FrontSide,
  blending: THREE.AdditiveBlending,
});

// Shared geometries — reused across all markers
const logoGeo = new THREE.SphereGeometry(0.025, 24, 16);
const glowGeo = new THREE.SphereGeometry(0.03, 24, 16);

let loadVersion = 0;

function disposeSphereGroup(group: THREE.Group) {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry && mesh.geometry !== logoGeo && mesh.geometry !== glowGeo) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mat = mesh.material as THREE.Material;
      if ("map" in mat && (mat as THREE.MeshBasicMaterial).map) {
        ((mat as THREE.MeshBasicMaterial).map as THREE.Texture).dispose();
      }
      // Don't dispose shared glow material
      if (mat !== glowMaterial) {
        mat.dispose();
      }
    }
  });
}

export function rebuildHQMarkers(
  globeGroup: THREE.Group,
  worldData: WorldData,
  hqMarkersRef: MutableRefObject<HQMarkerState[]>,
  markerInstancesRef: MutableRefObject<{
    hitSpheres: THREE.InstancedMesh;
  } | null>
) {
  // Dispose existing visual sphere groups
  for (const ms of hqMarkersRef.current) {
    if (ms.sphereGroup) {
      globeGroup.remove(ms.sphereGroup);
      disposeSphereGroup(ms.sphereGroup);
      ms.sphereGroup = null;
    }
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

  const currentVersion = ++loadVersion;

  const hitGeo = new THREE.SphereGeometry(1, 8, 8);
  const hitSpheres = new THREE.InstancedMesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }), count);
  hitSpheres.userData = { isMarkerInstance: true };

  markerInstancesRef.current = { hitSpheres };
  globeGroup.add(hitSpheres);

  const _eastDir = new THREE.Vector3();
  const _northDir = new THREE.Vector3();
  const _yAxis = new THREE.Vector3(0, 1, 0);
  const _rotMatrix = new THREE.Matrix4();

  profiles.forEach((profile, i) => {
    const state = worldData.countries[profile.countryCode];
    const posValue = state?.totalPositionValue ?? 0;
    const scale = posValue > 0 ? Math.max(0.5, Math.min(3, posValue / 50000)) : 1;
    const dotRadius = 0.009 + scale * 0.005;
    const surfacePos = latLonToVector3(profile.lat, profile.lon, 1.018);
    const dRadius = 0.013;
    const outward = surfacePos.clone().normalize();

    // Create logo sphere with fallback texture
    const fallbackTexture = createFallbackTexture(profile.ticker);
    const logoMat = new THREE.MeshBasicMaterial({
      map: fallbackTexture,
      transparent: true,
      depthWrite: true,
    });
    const logoMesh = new THREE.Mesh(logoGeo, logoMat);

    // Create glow sphere (shares the material — same color/intensity for all)
    const glowMesh = new THREE.Mesh(glowGeo, glowMaterial);

    // Group both spheres
    const group = new THREE.Group();
    group.add(logoMesh);
    group.add(glowMesh);

    // Orient group: local Z = outward, local Y = north, local X = east
    _eastDir.crossVectors(_yAxis, outward).normalize();
    if (_eastDir.lengthSq() < 0.001) {
      // Pole case — outward is nearly parallel to Y
      _eastDir.set(1, 0, 0);
    }
    _northDir.crossVectors(outward, _eastDir).normalize();
    _rotMatrix.makeBasis(_eastDir, _northDir, outward);
    group.quaternion.setFromRotationMatrix(_rotMatrix);

    group.position.copy(surfacePos);
    globeGroup.add(group);

    // Async: replace fallback texture with real logo
    loadLogoTexture(profile.ticker).then((texture) => {
      if (loadVersion !== currentVersion || !texture) return;
      const ms = hqMarkersRef.current.find((m) => m.ticker === profile.ticker);
      if (!ms?.sphereGroup) return;
      const lm = ms.sphereGroup.children[0] as THREE.Mesh;
      const oldMap = (lm.material as THREE.MeshBasicMaterial).map;
      (lm.material as THREE.MeshBasicMaterial).map = texture;
      (lm.material as THREE.MeshBasicMaterial).needsUpdate = true;
      if (oldMap !== texture) oldMap?.dispose();
    });

    hqMarkersRef.current.push({
      ticker: profile.ticker,
      countryCode: profile.countryCode,
      instanceId: i,
      outward,
      hoverT: 0,
      basePos: surfacePos.clone(),
      dotRadius,
      dHalfH: dRadius * 2.4,
      eastDir: null,
      sepIndex: 0,
      clusterPeers: [],
      separationT: 0,
      focusT: 0,
      spinSpeed: 0,
      sphereGroup: group,
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