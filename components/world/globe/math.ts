import * as THREE from "three";
import type { CountryGeoData, GeoFeature } from "@/components/world/globe/types";

export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function computeCountryGeoData(feature: GeoFeature): CountryGeoData {
  const pts: THREE.Vector3[] = [];
  const collect = (ring: number[][]) => {
    for (const [lon, lat] of ring) {
      pts.push(latLonToVector3(lat, lon, 1.0));
    }
  };

  if (feature.geometry.type === "Polygon") {
    (feature.geometry.coordinates as number[][][]).forEach(collect);
  } else if (feature.geometry.type === "MultiPolygon") {
    (feature.geometry.coordinates as number[][][][]).forEach((poly) => poly.forEach(collect));
  }

  if (pts.length === 0) {
    return { centroid: new THREE.Vector3(0, 0, 1), angularRadius: 0.1 };
  }

  const centroid = new THREE.Vector3();
  for (const p of pts) {
    centroid.add(p);
  }
  centroid.divideScalar(pts.length).normalize();

  let minDot = 1;
  for (const p of pts) {
    const d = centroid.dot(p.clone().normalize());
    if (d < minDot) {
      minDot = d;
    }
  }

  return { centroid, angularRadius: Math.acos(Math.max(-1, Math.min(1, minDot))) };
}

export function zoomForAngularRadius(angularRadius: number, paddingFactor = 1.45): number {
  const tanHalfFov = Math.tan(22.5 * (Math.PI / 180));
  const d = paddingFactor * Math.sin(angularRadius) / tanHalfFov + Math.cos(angularRadius);
  return Math.max(1.3, Math.min(5.5, d));
}

export function getCameraShiftX(w: number) {
  return Math.min((384 - 32) / 2, w * 0.25);
}
