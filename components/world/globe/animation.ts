import * as THREE from "three";
import {
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
const FORWARD = new THREE.Vector3(0, 0, 1);
const _trackUp = new THREE.Vector3();
const _trackQuat = new THREE.Quaternion();
const TRACK_ZOOM = 1.7;
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
  focusedCountryCode: string | null,
  isFocused: boolean,
  targetQuat: THREE.Quaternion | null,
  focusZoom: number,
  localHit: THREE.Vector3 | null,
  mount: HTMLDivElement,
  state: RenderState,
  renderer: THREE.WebGLRenderer,
  showProposed: boolean = true,
  trackedLocal: THREE.Vector3 | null = null
) {
  const animNow = performance.now();
  const dt = _lastAnimTime ? Math.min((animNow - _lastAnimTime) / 1000, 0.1) : 0.016;
  _lastAnimTime = animNow;

  const isTracking = trackedLocal !== null;
  const effectiveTarget = isTracking ? TRACK_ZOOM : isFocused ? focusZoom : state.targetZoom;
  camera.position.z += (effectiveTarget - camera.position.z) * 0.16;

  if (scene.fog instanceof THREE.Fog) {
    scene.fog.near = camera.position.z - 0.2;
    scene.fog.far = scene.fog.near + (0.05 + Math.pow(1.0 - state.fogDensity, 2) * 6.0);
  }

  if (!state.isDragging) {
    if (isTracking && trackedLocal) {
      // Rotate the globe so the tracked vehicle's current position faces the
      // camera. trackedLocal updates every frame as the vehicle moves, so the
      // camera continuously follows it along its route.
      _trackUp.copy(trackedLocal).normalize();
      _trackQuat.setFromUnitVectors(_trackUp, FORWARD);
      globeGroup.quaternion.slerp(_trackQuat, 0.1);
      state.dragVelocity.x *= 0.9;
      state.dragVelocity.y *= 0.9;
    } else if (isFocused && targetQuat) {
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
      const prevFocusT = ms.focusT;
      // Hovering any marker in a co-located cluster activates the whole cluster,
      // so every stacked marker raises its diamond (and gets labeled) at once
      // instead of only the single one directly under the cursor.
      const isHovered =
        ms.ticker === hoveredMarkerTicker ||
        (hoveredMarkerTicker !== null && ms.clusterPeers.includes(hoveredMarkerTicker));
      const isFocusedMarker = ms.ticker === focusedTicker;
      const effectiveVisible = ms.isProposed ? showProposed && ms.visible : ms.visible;
      ms.hoverT += ((isHovered ? 1 : 0) - ms.hoverT) * 0.14;

      // Clustered markers spread onto a circle when a peer is hovered
      // (separationT) or when their country is focused (focusT). Either one
      // pulls them off the shared origin point so they're never stacked.
      if (ms.spreadOffset !== null) {
        const peerHovered = hoveredMarkerTicker !== null && ms.clusterPeers.includes(hoveredMarkerTicker);
        const countryFocused = focusedCountryCode !== null && ms.countryCode === focusedCountryCode;
        ms.separationT += ((peerHovered ? 1 : 0) - ms.separationT) * 0.10;
        ms.focusT += ((countryFocused ? 1 : 0) - ms.focusT) * 0.10;
      }

      if (
        Math.abs(ms.hoverT - prevHoverT) > 1e-4 ||
        Math.abs(ms.separationT - prevSepT) > 1e-4 ||
        Math.abs(ms.focusT - prevFocusT) > 1e-4 ||
        ms.renderedVisible !== effectiveVisible
      ) {
        hitDirty = true;
      }
      ms.renderedVisible = effectiveVisible;

      const spreadT = Math.max(ms.focusT, ms.separationT);
      if (ms.spreadOffset) {
        _tmpPos.copy(ms.basePos).addScaledVector(ms.spreadOffset, spreadT);
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
        // Move the visible meshes onto the spread position. (Only clustered
        // markers have a spreadOffset; lone markers stay at their build-time
        // position, so skip the per-frame writes for them.)
        if (ms.spreadOffset) {
          ms.sphere.position.copy(_tmpPos);
          ms.hoverDiamond.position.copy(_tmpPos).addScaledVector(ms.outward, ms.dHalfH);
        }

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

  // Per-marker hover/focus labels: one label element positioned above each
  // octahedron, so co-located markers each get their own abbreviation above
  // their own diamond instead of a single stacked list.
  const labelRect = mount.getBoundingClientRect();
  for (const ms of hqMarkers) {
    const labelEl = document.getElementById(`marker-hover-label-${ms.ticker}`);
    if (!labelEl) continue;
    const labelOpacity = ms.ticker === focusedTicker ? 1 : ms.hoverT;
    if (labelOpacity <= 0.01) {
      labelEl.style.opacity = "0";
      continue;
    }
    if (ms.spreadOffset) {
      const labelSpreadT = Math.max(ms.focusT, ms.separationT);
      _hoverBasePos.copy(ms.basePos).addScaledVector(ms.spreadOffset, labelSpreadT);
    } else {
      _hoverBasePos.copy(ms.basePos);
    }
    _hoverWorldPos.copy(_hoverBasePos).addScaledVector(ms.outward, 0.05);
    globeGroup.localToWorld(_hoverWorldPos);
    _hoverWorldPos.project(camera);
    const sx = labelRect.left + ((_hoverWorldPos.x + 1) / 2) * labelRect.width;
    const sy = labelRect.top + ((-_hoverWorldPos.y + 1) / 2) * labelRect.height;
    if (isFinite(sx) && isFinite(sy)) {
      labelEl.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy - 6)}px) translate(-50%, -100%)`;
      labelEl.style.opacity = String(labelOpacity);
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