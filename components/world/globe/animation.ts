import * as THREE from "three";
import {
  CLUSTER_HOVER_SEP,
  CLUSTER_REST_SEP,
  type HQMarkerState,
  type RenderState,
} from "@/components/world/globe/types";

const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();
const _n = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hoverBasePos = new THREE.Vector3();
const _hoverWorldPos = new THREE.Vector3();
const LOCAL_Y = new THREE.Vector3(0, 1, 0);
let _labelTicker: string | null = null;
let _svgMountRect: DOMRect | null = null;
let _svgMountRectTs = 0;
let _svgAnchorRect: DOMRect | null = null;
let _svgAnchorRectTs = 0;
let lastSVGTime = 0;
let _lastAnimTime = 0;

export function animateGlobe(
  globeGroup: THREE.Group,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  hqMarkers: HQMarkerState[],
  markerInstances: { hitSpheres: THREE.InstancedMesh } | null,
  selectedDiamond: THREE.Mesh | null,
  hoveredMarkerTicker: string | null,
  focusedTicker: string | null,
  isFocused: boolean,
  targetQuat: THREE.Quaternion | null,
  focusZoom: number,
  localHit: THREE.Vector3 | null,
  mount: HTMLDivElement,
  state: RenderState,
  renderer: THREE.WebGLRenderer,
  showProposed: boolean = true
) {
  const animNow = performance.now();
  const dt = _lastAnimTime ? Math.min((animNow - _lastAnimTime) / 1000, 0.1) : 0.016;
  _lastAnimTime = animNow;

  const effectiveTarget = isFocused ? focusZoom : state.targetZoom;
  camera.position.z += (effectiveTarget - camera.position.z) * 0.16;

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

  // Spin the selected diamond plumbob around its outward axis
  if (selectedDiamond) {
    selectedDiamond.rotateOnAxis(LOCAL_Y, 0.018);
  }

  // Compensate marker world-size for camera zoom so on-screen size stays constant.
  const REFERENCE_CAMERA_Z = 2.6;
  const zoomScale = camera.position.z / REFERENCE_CAMERA_Z;

  if (markerInstances) {
    let hitDirty = false;

    for (const ms of hqMarkers) {
      const prevHoverT = ms.hoverT;
      const prevSepT = ms.separationT;
      const isHovered = ms.ticker === hoveredMarkerTicker;
      const isFocusedMarker = ms.ticker === focusedTicker;
      const effectiveVisible = ms.isProposed ? showProposed && ms.visible : ms.visible;
      ms.hoverT += ((isHovered ? 1 : 0) - ms.hoverT) * 0.14;

      if (ms.eastDir !== null && ms.clusterPeers.length > 1) {
        const anyPeerActive = hoveredMarkerTicker !== null && ms.clusterPeers.includes(hoveredMarkerTicker);
        ms.separationT += ((anyPeerActive ? 1 : 0) - ms.separationT) * 0.10;
      }

      if (
        Math.abs(ms.hoverT - prevHoverT) > 1e-4 ||
        Math.abs(ms.separationT - prevSepT) > 1e-4 ||
        ms.renderedVisible !== effectiveVisible
      ) {
        hitDirty = true;
      }
      ms.renderedVisible = effectiveVisible;

      const sepDist = CLUSTER_REST_SEP + (CLUSTER_HOVER_SEP - CLUSTER_REST_SEP) * ms.separationT;
      if (ms.eastDir) {
        _tmpPos.copy(ms.basePos).addScaledVector(ms.eastDir, ms.sepIndex * sepDist);
      } else {
        _tmpPos.copy(ms.basePos);
      }

      // Hit spheres for raycasting
      if (!effectiveVisible) {
        _mat.makeTranslation(0, 0, -9999);
        markerInstances.hitSpheres.setMatrixAt(ms.instanceId, _mat);
      } else {
        _scale.setScalar(ms.dotRadius * 4 * zoomScale);
        _mat.compose(_tmpPos, _quat.set(0, 0, 0, 1), _scale);
        markerInstances.hitSpheres.setMatrixAt(ms.instanceId, _mat);
      }

      // Back-face culling: hide group when it faces away from camera
      _n.copy(ms.outward).applyQuaternion(globeGroup.quaternion).normalize();
      _d.copy(camera.position).normalize();
      const facing = _n.dot(_d);
      const shouldBeVisible = effectiveVisible && facing > 0.05;

      // When a marker is focused, hide its hover group (plumbob replaces it)
      ms.group.visible = shouldBeVisible && !isFocusedMarker;

      if (ms.group.visible) {
        // Sphere: fade out and shrink as hoverT rises, scaled by camera zoom
        const sphereMat = ms.sphere.material as THREE.MeshBasicMaterial;
        const sphereOpacity = 1 - ms.hoverT;
        sphereMat.opacity = sphereOpacity;
        for (const child of ms.sphere.children) {
          const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
          if (m && "opacity" in m) {
            m.opacity = sphereOpacity;
          }
        }
        ms.sphere.scale.setScalar((1 - ms.hoverT * 0.5) * zoomScale);

        // Diamond: scale up from 0 to 1 as hoverT rises, scaled by camera zoom
        ms.hoverDiamond.scale.setScalar(ms.hoverT * zoomScale);
      }
    }
    if (hitDirty) {
      markerInstances.hitSpheres.instanceMatrix.needsUpdate = true;
    }
  }

  // Hover/focus label positioning
  const activeTicker = hoveredMarkerTicker ?? focusedTicker;
  if (hoveredMarkerTicker) {
    _labelTicker = hoveredMarkerTicker;
  } else if (!focusedTicker) {
    // only clear when neither hover nor focus is active
  }
  const labelTicker = activeTicker ?? _labelTicker;
  const labelMs = labelTicker
    ? hqMarkers.find((m) => m.ticker === labelTicker)
    : null;
  const labelEl = document.getElementById("marker-hover-label");
  const labelOpacity = labelMs
    ? (labelMs.ticker === focusedTicker ? 1 : labelMs.hoverT)
    : 0;
  if (labelEl && labelMs && labelOpacity > 0.01) {
    const sepDist2 =
      CLUSTER_REST_SEP +
      (CLUSTER_HOVER_SEP - CLUSTER_REST_SEP) * labelMs.separationT;
    if (labelMs.eastDir) {
      _hoverBasePos
        .copy(labelMs.basePos)
        .addScaledVector(labelMs.eastDir, labelMs.sepIndex * sepDist2);
    } else {
      _hoverBasePos.copy(labelMs.basePos);
    }
    _hoverWorldPos
      .copy(_hoverBasePos)
      .addScaledVector(labelMs.outward, 0.05);
    globeGroup.localToWorld(_hoverWorldPos);
    _hoverWorldPos.project(camera);
    const rect = mount.getBoundingClientRect();
    const sx = rect.left + ((_hoverWorldPos.x + 1) / 2) * rect.width;
    const sy = rect.top + ((-_hoverWorldPos.y + 1) / 2) * rect.height;
    if (isFinite(sx) && isFinite(sy)) {
      labelEl.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy - 6)}px) translate(-50%, -100%)`;
      labelEl.style.opacity = String(labelOpacity);
    }
  } else if (labelEl) {
    labelEl.style.opacity = "0";
    if (labelOpacity <= 0.01 && !focusedTicker) {
      _labelTicker = null;
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
    const sy = rect.top + ((-ndcPos.y + 1) / 2) * rect.height;
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