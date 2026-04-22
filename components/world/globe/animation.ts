import * as THREE from "three";
import {
  CLUSTER_HOVER_SEP,
  CLUSTER_REST_SEP,
  type HQMarkerState,
  type RenderState,
} from "@/components/world/globe/types";

const LOCAL_Y = new THREE.Vector3(0, 1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();
const _tmpDiamondPos = new THREE.Vector3();
let _svgMountRect: DOMRect | null = null;
let _svgMountRectTs = 0;
let _svgAnchorRect: DOMRect | null = null;
let _svgAnchorRectTs = 0;
let lastSVGTime = 0;

export function animateGlobe(
  globeGroup: THREE.Group,
  selectedMarker: THREE.Mesh | null,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  hqMarkers: HQMarkerState[],
  markerInstances: { spheres: THREE.InstancedMesh; hitSpheres: THREE.InstancedMesh; diamonds: THREE.InstancedMesh } | null,
  hoveredMarkerTicker: string | null,
  isFocused: boolean,
  targetQuat: THREE.Quaternion | null,
  focusZoom: number,
  localHit: THREE.Vector3 | null,
  mount: HTMLDivElement,
  state: RenderState,
  renderer: THREE.WebGLRenderer
) {
  const effectiveTarget = isFocused ? focusZoom : state.targetZoom;
  camera.position.z += (effectiveTarget - camera.position.z) * 0.16;

  if (selectedMarker) {
    selectedMarker.rotateOnAxis(LOCAL_Y, 0.018);
  }

  if (scene.fog instanceof THREE.Fog) {
    scene.fog.near = camera.position.z - 0.2;
    scene.fog.far = scene.fog.near + (0.05 + Math.pow(1.0 - state.fogDensity, 2) * 6.0);
  }

  if (!state.isDragging) {
    if (isFocused && targetQuat) {
      globeGroup.quaternion.slerp(targetQuat, 0.055);
      state.dragVelocity.x *= 0.9;
      state.dragVelocity.y *= 0.9;
    } else if (hoveredMarkerTicker) {
      state.dragVelocity.x *= 0.9;
      state.dragVelocity.y *= 0.9;
    } else {
      state.dragVelocity.x *= 0.95;
      state.dragVelocity.y *= 0.95;
      if (Math.abs(state.dragVelocity.x) < 0.1 && Math.abs(state.dragVelocity.y) < 0.1) {
        globeGroup.rotation.y += 0.0006;
      } else {
        const panFactor = 0.005 * (camera.position.z / 2.6);
        globeGroup.rotation.y += state.dragVelocity.x * panFactor;
        globeGroup.rotation.x += state.dragVelocity.y * panFactor;
      }
    }
  }

  if (markerInstances) {
    let markerDirty = false;
    for (const ms of hqMarkers) {
      const prevHoverT = ms.hoverT;
      const prevSepT = ms.separationT;
      ms.hoverT += ((ms.ticker === hoveredMarkerTicker ? 1 : 0) - ms.hoverT) * 0.14;

      if (ms.eastDir !== null && ms.clusterPeers.length > 1) {
        const anyPeerActive = hoveredMarkerTicker !== null && ms.clusterPeers.includes(hoveredMarkerTicker);
        ms.separationT += ((anyPeerActive ? 1 : 0) - ms.separationT) * 0.10;
      }

      if (
        Math.abs(ms.hoverT - prevHoverT) > 1e-4 ||
        Math.abs(ms.separationT - prevSepT) > 1e-4 ||
        ms.renderedVisible !== ms.visible
      ) {
        markerDirty = true;
      }
      ms.renderedVisible = ms.visible;

      const sepDist = CLUSTER_REST_SEP + (CLUSTER_HOVER_SEP - CLUSTER_REST_SEP) * ms.separationT;
      if (ms.eastDir) {
        _tmpPos.copy(ms.basePos).addScaledVector(ms.eastDir, ms.sepIndex * sepDist);
      } else {
        _tmpPos.copy(ms.basePos);
      }
      const vis = ms.visible ? 1 : 0;

      _scale.setScalar(ms.dotRadius * (1 - ms.hoverT * 0.5) * vis);
      _mat.compose(_tmpPos, _quat.set(0, 0, 0, 1), _scale);
      markerInstances.spheres.setMatrixAt(ms.instanceId, _mat);

      if (vis === 0) {
        _mat.makeTranslation(0, 0, -9999);
        markerInstances.hitSpheres.setMatrixAt(ms.instanceId, _mat);
      } else {
        _scale.setScalar(ms.dotRadius * 4);
        _mat.compose(_tmpPos, _quat.set(0, 0, 0, 1), _scale);
        markerInstances.hitSpheres.setMatrixAt(ms.instanceId, _mat);
      }

      _quat.setFromUnitVectors(UP, ms.outward);
      _scale.setScalar((ms.dHalfH / 2.4) * ms.hoverT * vis);
      _tmpDiamondPos.copy(_tmpPos).addScaledVector(ms.outward, ms.dHalfH);
      _mat.compose(_tmpDiamondPos, _quat, _scale);
      markerInstances.diamonds.setMatrixAt(ms.instanceId, _mat);
    }
    if (markerDirty) {
      markerInstances.spheres.instanceMatrix.needsUpdate = true;
      markerInstances.hitSpheres.instanceMatrix.needsUpdate = true;
      markerInstances.diamonds.instanceMatrix.needsUpdate = true;
    }
  }

  renderer.render(scene, camera);

  const now = performance.now();
  if (isFocused && localHit && now - lastSVGTime > 33) {
    lastSVGTime = now;
    const worldPos = globeGroup.localToWorld(localHit.clone());
    const ndcPos = worldPos.project(camera);
    if (now - _svgMountRectTs > 300) {
      _svgMountRect = mount.getBoundingClientRect();
      _svgMountRectTs = now;
    }
    const rect = _svgMountRect;
    if (!rect) {
      return;
    }
    const sx = rect.left + (ndcPos.x + 1) / 2 * rect.width;
    const sy = rect.top + (-ndcPos.y + 1) / 2 * rect.height;
    if (isFinite(sx) && isFinite(sy)) {
      const pathEl = document.getElementById("focus-connector-path") as SVGPathElement | null;
      const anchorEl = document.getElementById("focus-panel-anchor");
      if (pathEl && anchorEl) {
        if (now - _svgAnchorRectTs > 300) {
          _svgAnchorRect = anchorEl.getBoundingClientRect();
          _svgAnchorRectTs = now;
        }
        const pr = _svgAnchorRect;
        if (!pr) {
          return;
        }
        const absDy = Math.abs(sy - pr.top);
        const d = `M ${sx} ${sy} C ${sx} ${sy - absDy * 0.55} ${pr.left - Math.min(absDy * 0.15, 30)} ${pr.top + (sy > pr.top ? 1 : -1) * absDy * 0.08} ${pr.left} ${pr.top}`;
        pathEl.setAttribute("d", d);
      }
    }
  }
}
