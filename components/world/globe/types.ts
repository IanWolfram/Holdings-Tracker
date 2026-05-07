import type * as THREE from "three";

export const CLUSTER_DIST_THRESHOLD = 0.08;
export const CLUSTER_REST_SEP = 0.022;
export const CLUSTER_HOVER_SEP = 0.044;

export interface GeoFeature {
  type: string;
  properties: Record<string, string>;
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoJSON {
  features: GeoFeature[];
}

export interface CountryBBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface CountryGeoData {
  centroid: THREE.Vector3;
  angularRadius: number;
  bbox: CountryBBox;
}

export interface HQMarkerState {
  ticker: string;
  countryCode: string;
  instanceId: number;
  outward: THREE.Vector3;
  hoverT: number;
  basePos: THREE.Vector3;
  dotRadius: number;
  dHalfH: number;
  eastDir: THREE.Vector3 | null;
  sepIndex: number;
  clusterPeers: string[];
  separationT: number;
  focusT: number;
  spinSpeed: number;
  sphereGroup: THREE.Group | null;
  visible: boolean;
  renderedVisible: boolean;
}

export interface RenderState {
  isDragging: boolean;
  previousMousePosition: { x: number; y: number };
  dragVelocity: { x: number; y: number };
  targetZoom: number;
  fogDensity: number;
}
