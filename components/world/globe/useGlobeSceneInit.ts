import { useEffect, type RefObject, type MutableRefObject } from "react";
import * as THREE from "three";
import type { HQMarkerState, RenderState } from "./types";
import { applyCountryBuffers, applyStateBuffers } from "./buffers";

/**
 * Shared Three.js scene context created by useGlobeSceneInit and consumed
 * by useGlobeAnimation and useGlobeInteraction.
 */
export interface GlobeSceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  globeGroup: THREE.Group;
  mount: HTMLDivElement;
  state: RenderState;
}

interface UseGlobeSceneInitParams {
  sceneCtxRef: MutableRefObject<GlobeSceneContext | null>;
  mountRef: RefObject<HTMLDivElement | null>;
  globeGroupRef: MutableRefObject<THREE.Group | null>;
  workerRef: MutableRefObject<Worker | null>;
  countryLinesRef: MutableRefObject<THREE.Object3D[]>;
  stateLinesRef: MutableRefObject<THREE.Object3D[]>;
  segmentToCountryRef: MutableRefObject<string[]>;
  /** Marker and diamond refs for cleanup on unmount */
  hqMarkersRef: MutableRefObject<HQMarkerState[]>;
  selectedDiamondRef: MutableRefObject<THREE.Mesh | null>;
  setWebglAvailable: (v: boolean) => void;
}

/**
 * Creates the Three.js scene, camera, renderer, globe group, atmosphere mesh,
 * star field, GeoJSON worker, and render state.  Stores the result in
 * `sceneCtxRef` so sibling hooks (animation, interaction) can read from it.
 *
 * Cleanup (runs last on unmount, after animation and interaction cleanups):
 *   disposes markers, diamond, worker, renderer, scene, removes canvas.
 */
export function useGlobeSceneInit({
  sceneCtxRef,
  mountRef,
  globeGroupRef,
  workerRef,
  countryLinesRef,
  stateLinesRef,
  segmentToCountryRef,
  hqMarkersRef,
  selectedDiamondRef,
  setWebglAvailable,
}: UseGlobeSceneInitParams) {
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // -- WebGL detection ----------------------------------------------------
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) {
      setWebglAvailable(false);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglAvailable(false);
      return;
    }

    // -- Scene & camera -----------------------------------------------------
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a110a, 1.0, 3.0);

    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 2.6);
    camera.lookAt(0, 0, 0);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      setWebglAvailable(false);
    }, false);
    mount.appendChild(renderer.domElement);

    // -- Globe group & atmosphere --------------------------------------------
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const atmGeo = new THREE.SphereGeometry(1.025, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.12, side: THREE.BackSide });
    globeGroup.add(new THREE.Mesh(atmGeo, atmMat));

    // -- Star field ----------------------------------------------------------
    const starCount = 2500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 4 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.012, transparent: true, opacity: 0.7 })));

    // -- Geo worker ----------------------------------------------------------
    workerRef.current = new Worker(new URL("@/lib/world/geo.worker.ts", import.meta.url));
    workerRef.current.onmessage = (e) => {
      if (globeGroupRef.current) {
        applyStateBuffers(e.data.stateLinePositions, e.data.stateLineColors, globeGroupRef.current, stateLinesRef);
        applyCountryBuffers(e.data, globeGroupRef.current, countryLinesRef, segmentToCountryRef);
      }
    };

    // -- Render state --------------------------------------------------------
    const state: RenderState = {
      isDragging: false,
      previousMousePosition: { x: 0, y: 0 },
      dragVelocity: { x: 0, y: 0 },
      targetZoom: 2.6,
      fogDensity: 0.75,
    };

    // -- Store context for sibling hooks -------------------------------------
    sceneCtxRef.current = { scene, camera, renderer, globeGroup, mount, state };

    return () => {
      // Dispose HQ marker meshes (use current ref value, not a stale capture)
      for (const ms of hqMarkersRef.current) {
        ms.sphere.geometry.dispose();
        (ms.sphere.material as THREE.Material).dispose();
        ms.hitSphere.geometry.dispose();
        (ms.hitSphere.material as THREE.Material).dispose();
        ms.hoverDiamond.geometry.dispose();
        (ms.hoverDiamond.material as THREE.Material).dispose();
      }
      // Dispose selected diamond
      if (selectedDiamondRef.current) {
        selectedDiamondRef.current.geometry.dispose();
        (selectedDiamondRef.current.material as THREE.Material).dispose();
        selectedDiamondRef.current = null;
      }
      // Terminate worker
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      sceneCtxRef.current = null;
      renderer.dispose();
      scene.clear();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}