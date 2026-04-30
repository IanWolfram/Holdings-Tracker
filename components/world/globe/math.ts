import * as THREE from "three";
import type { CountryBBox, CountryGeoData, GeoFeature } from "@/components/world/globe/types";

export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function vector3ToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, n.y))) * (180 / Math.PI);
  let lon = Math.atan2(n.z, -n.x) * (180 / Math.PI) - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

export function computeCountryGeoData(feature: GeoFeature): CountryGeoData {
  const pts: THREE.Vector3[] = [];
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;
  const collect = (ring: number[][]) => {
    for (const [lon, lat] of ring) {
      pts.push(latLonToVector3(lat, lon, 1.0));
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  };

  if (feature.geometry.type === "Polygon") {
    (feature.geometry.coordinates as number[][][]).forEach(collect);
  } else if (feature.geometry.type === "MultiPolygon") {
    (feature.geometry.coordinates as number[][][][]).forEach((poly) => poly.forEach(collect));
  }

  if (pts.length === 0) {
    return { centroid: new THREE.Vector3(0, 0, 1), angularRadius: 0.1, bbox: { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 } };
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

  return { centroid, angularRadius: Math.acos(Math.max(-1, Math.min(1, minDot))), bbox: { minLat, maxLat, minLon, maxLon } };
}

export function zoomForAngularRadius(angularRadius: number, paddingFactor = 1.45): number {
  const tanHalfFov = Math.tan(22.5 * (Math.PI / 180));
  const d = paddingFactor * Math.sin(angularRadius) / tanHalfFov + Math.cos(angularRadius);
  return Math.max(1.3, Math.min(5.5, d));
}

export function getCameraShiftX(w: number) {
  return Math.min((384 - 32) / 2, w * 0.25);
}

// ---------------------------------------------------------------------------
// Point-in-polygon for accurate country identification
// ---------------------------------------------------------------------------

function pointInRing(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const lonI = ring[i][0], latI = ring[i][1];
    const lonJ = ring[j][0], latJ = ring[j][1];
    if (((latI > lat) !== (latJ > lat)) &&
        (lon < (lonJ - lonI) * (lat - latI) / (latJ - latI) + lonI)) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInGeoPolygon(lat: number, lon: number, feature: GeoFeature): boolean {
  const { geometry } = feature;
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as number[][][];
    if (pointInRing(lat, lon, rings[0])) {
      for (let i = 1; i < rings.length; i++) {
        if (pointInRing(lat, lon, rings[i])) return false;
      }
      return true;
    }
    return false;
  } else if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates as number[][][][];
    for (const polygon of polygons) {
      if (pointInRing(lat, lon, polygon[0])) {
        let inHole = false;
        for (let i = 1; i < polygon.length; i++) {
          if (pointInRing(lat, lon, polygon[i])) { inHole = true; break; }
        }
        if (!inHole) return true;
      }
    }
  }
  return false;
}

export function findCountryAtLatLon(
  lat: number,
  lon: number,
  features: GeoFeature[],
  geoDataMap: Record<string, CountryGeoData>
): string | null {
  for (const feature of features) {
    const code = feature.properties["ISO3166-1-Alpha-2"] ?? "";
    if (!code) continue;
    const geoData = geoDataMap[code];
    if (geoData?.bbox) {
      if (lat < geoData.bbox.minLat || lat > geoData.bbox.maxLat ||
          lon < geoData.bbox.minLon || lon > geoData.bbox.maxLon) {
        continue;
      }
    }
    if (pointInGeoPolygon(lat, lon, feature)) {
      return code;
    }
  }
  return null;
}