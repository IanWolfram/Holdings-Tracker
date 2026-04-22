import type { MutableRefObject } from "react";
import * as THREE from "three";

export function applyCountryBuffers(
  data: {
    linePositions: Float32Array;
    lineColors: Float32Array;
    dotPositions: Float32Array;
    dotColors: Float32Array;
    segmentToCountry: string[];
  },
  globeGroup: THREE.Group,
  countryLinesRef: MutableRefObject<THREE.Object3D[]>,
  segmentToCountryRef: MutableRefObject<string[]>
) {
  countryLinesRef.current.forEach((obj) => {
    globeGroup.remove(obj);
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose());
    } else if (mat) {
      (mat as THREE.Material).dispose();
    }
  });
  countryLinesRef.current = [];
  segmentToCountryRef.current = data.segmentToCountry;

  if (data.linePositions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(data.linePositions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(data.lineColors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0, linewidth: 2 });
    const lines = new THREE.LineSegments(geom, mat);
    lines.userData = { isMergedBorder: true };
    globeGroup.add(lines);
    countryLinesRef.current.push(lines);
  }

  if (data.dotPositions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(data.dotPositions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(data.dotColors, 3));
    const mat = new THREE.PointsMaterial({ vertexColors: true, transparent: true, size: 0.007, sizeAttenuation: true });
    const dots = new THREE.Points(geom, mat);
    dots.userData = { isMergedDots: true };
    globeGroup.add(dots);
    countryLinesRef.current.push(dots);
  }
}

export function applyStateBuffers(
  stateLinePositions: Float32Array,
  stateLineColors: Float32Array,
  globeGroup: THREE.Group,
  stateLinesRef: MutableRefObject<THREE.Object3D[]>
) {
  stateLinesRef.current.forEach((obj) => {
    globeGroup.remove(obj);
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose());
    } else if (mat) {
      (mat as THREE.Material).dispose();
    }
  });
  stateLinesRef.current = [];

  if (stateLinePositions.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(stateLinePositions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(stateLineColors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0, linewidth: 2 });
    const lines = new THREE.LineSegments(geom, mat);
    lines.userData = { isStateBorder: true };
    globeGroup.add(lines);
    stateLinesRef.current.push(lines);
  }
}
