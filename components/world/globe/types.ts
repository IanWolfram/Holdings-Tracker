import type * as THREE from "three";

export const CLUSTER_DIST_THRESHOLD = 0.08;

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
  // Vector (globe-local) from basePos to this marker's slot on the spread
  // circle. null when the marker isn't part of a multi-marker cluster.
  spreadOffset: THREE.Vector3 | null;
  clusterPeers: string[];
  separationT: number;  // 0→1 hover-driven spread (a cluster peer is hovered)
  focusT: number;       // 0→1 focus-driven spread (the marker's country is focused)
  isProposed: boolean;        // true = orange proposed-position marker
  sphere: THREE.Mesh;          // white/orange sphere — visible at hoverT = 0
  hitSphere: THREE.Mesh;      // invisible larger sphere for hover/click detection
  hoverDiamond: THREE.Mesh;   // green/orange diamond — visible at hoverT = 1
  group: THREE.Group;
  visible: boolean;
  renderedVisible: boolean;
}

export interface ProposedMarkerData {
  ticker: string;
  lat: number;
  lon: number;
  countryCode: string;
}

export interface RenderState {
  isDragging: boolean;
  previousMousePosition: { x: number; y: number };
  dragVelocity: { x: number; y: number };
  targetZoom: number;
  fogDensity: number;
}
