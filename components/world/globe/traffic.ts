import * as THREE from "three";
import type { CountryGeoData, GeoFeature } from "@/components/world/globe/types";
import { findCountryAtLatLon, latLonToVector3 } from "@/components/world/globe/math";

// ---------------------------------------------------------------------------
// Traffic system — animated tiny boats and planes that travel between random
// points on the globe.  Plane routes are great-circle arcs (fly over anything).
// Boat routes are A*-pathfound over an ocean grid so they never cross land.
// Every time a vehicle reaches its destination it is given a fresh random
// route, so the traffic is unique and continuously regenerating.
//
// Easter egg: clicking a vehicle "tracks" it — the camera zooms in and the
// globe rotates each frame to keep it centered (see animateGlobe).
// ---------------------------------------------------------------------------

const GREEN = 0x00ff88;
const RED = 0xff4455;
const CANOPY = 0x0a1626; // dark "glass" for cockpit windows
const CABIN = 0xcfd8dc; // light superstructure on boats
const POLE = 0x556070; // flagpole / mast

// Ocean grid resolution (degrees). 3° → 120×60 = 7200 cells.
const LAT_STEP = 3;
const LON_STEP = 3;
const GRID_W = 360 / LON_STEP; // 120
const GRID_H = 180 / LAT_STEP; // 60

const SURFACE_R = 1.004; // boats sit just above the surface
const PLANE_COUNT = 2;
const BOAT_COUNT = 2;

// Keep boat endpoints inside the meaningful shipping band (skip the poles).
const OCEAN_LAT_MIN = -65;
const OCEAN_LAT_MAX = 75;

type VehicleKind = "plane" | "boat";

interface Vehicle {
  kind: VehicleKind;
  mesh: THREE.Group; // detailed model: forward = +Z, up = +Y
  bodyMat: THREE.MeshLambertMaterial; // carries the green/red color
  routeLine: THREE.Line;
  path: THREE.Vector3[]; // densely sampled points along the route
  cumLen: number[]; // cumulative arc length, cumLen[0] = 0
  totalLen: number;
  dist: number; // distance travelled so far
  speed: number; // units per second
}

const cellLat = (y: number) => 90 - (y + 0.5) * LAT_STEP;
const cellLon = (x: number) => -180 + (x + 0.5) * LON_STEP;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Spherical-linear interpolation between two unit vectors.
function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = clamp(a.dot(b), -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-4) return a.clone();
  const so = Math.sin(omega);
  return a
    .clone()
    .multiplyScalar(Math.sin((1 - t) * omega) / so)
    .add(b.clone().multiplyScalar(Math.sin(t * omega) / so));
}

// Detailed plane model, built facing +Z (nose) with +Y up. Shared bodyMat lets
// the whole airframe recolor in one call when the route regenerates.
function buildPlaneModel(color: number): { group: THREE.Group; bodyMat: THREE.MeshLambertMaterial } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshBasicMaterial({ color: CANOPY });

  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.0035, 0.02), bodyMat);
  group.add(fuselage);

  const noseGeo = new THREE.ConeGeometry(0.0018, 0.006, 10);
  noseGeo.rotateX(Math.PI / 2); // apex points +Z
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.position.set(0, 0, 0.013);
  group.add(nose);

  const wings = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0012, 0.0065), bodyMat);
  wings.position.set(0, 0, 0.001);
  group.add(wings);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0011, 0.0045), bodyMat);
  tail.position.set(0, 0, -0.0095);
  group.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.006, 0.0045), bodyMat);
  fin.position.set(0, 0.003, -0.0095);
  group.add(fin);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.0019, 0.007), glassMat);
  canopy.position.set(0, 0.0022, 0.004);
  group.add(canopy);

  return { group, bodyMat };
}

// Detailed boat model, built facing +Z (bow) with +Y up: hull + cabin + a
// flagpole at the stern flying a square flag in the vehicle color.
function buildBoatModel(color: number): { group: THREE.Group; bodyMat: THREE.MeshLambertMaterial } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color }); // hull + flag
  const cabinMat = new THREE.MeshLambertMaterial({ color: CABIN });
  const poleMat = new THREE.MeshBasicMaterial({ color: POLE });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.018), bodyMat);
  group.add(hull);

  // Pointed bow wedge so the hull reads as a ship rather than a brick.
  const bowGeo = new THREE.ConeGeometry(0.0042, 0.006, 4);
  bowGeo.rotateX(Math.PI / 2); // apex points +Z
  bowGeo.scale(1, 0.66, 1);
  const bow = new THREE.Mesh(bowGeo, bodyMat);
  bow.position.set(0, -0.0006, 0.011);
  group.add(bow);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.0035, 0.007), cabinMat);
  cabin.position.set(0, 0.0037, -0.001);
  group.add(cabin);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.00035, 0.00035, 0.013, 6), poleMat);
  pole.position.set(0, 0.0065, -0.0075);
  group.add(pole);

  // Square flag, flying off the pole toward +X.
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.0065, 0.0006), bodyMat);
  flag.position.set(0.0035, 0.0102, -0.0075);
  group.add(flag);

  return { group, bodyMat };
}

// Minimal binary min-heap keyed by f-score, storing cell indices.
class MinHeap {
  private idx: number[] = [];
  private f: number[] = [];
  get size() {
    return this.idx.length;
  }
  push(i: number, fv: number) {
    this.idx.push(i);
    this.f.push(fv);
    let c = this.idx.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.f[p] <= this.f[c]) break;
      this.swap(p, c);
      c = p;
    }
  }
  pop(): number {
    const top = this.idx[0];
    const lastI = this.idx.pop()!;
    const lastF = this.f.pop()!;
    if (this.idx.length > 0) {
      this.idx[0] = lastI;
      this.f[0] = lastF;
      let p = 0;
      const n = this.idx.length;
      for (;;) {
        const l = 2 * p + 1;
        const r = l + 1;
        let s = p;
        if (l < n && this.f[l] < this.f[s]) s = l;
        if (r < n && this.f[r] < this.f[s]) s = r;
        if (s === p) break;
        this.swap(s, p);
        p = s;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.idx[a], this.idx[b]] = [this.idx[b], this.idx[a]];
    [this.f[a], this.f[b]] = [this.f[b], this.f[a]];
  }
}

export class TrafficSystem {
  private group: THREE.Group;
  private vehicles: Vehicle[] = [];
  private lastNow = 0;

  // Easter egg: a clicked vehicle is "tracked" — the camera zooms in and the
  // globe rotates each frame to keep it centered (see animateGlobe).
  private tracked: Vehicle | null = null;
  private trackedLocalPos = new THREE.Vector3();

  // Ocean grid + per-cell unit vectors (for A* heuristics and waypoint build).
  private ocean: Uint8Array;
  private cellVec: Float32Array;
  private oceanCells: number[] = [];
  private landCells: number[] = [];

  constructor(
    group: THREE.Group,
    features: GeoFeature[],
    geoData: Record<string, CountryGeoData>
  ) {
    this.group = group;
    this.ocean = new Uint8Array(GRID_W * GRID_H);
    this.cellVec = new Float32Array(GRID_W * GRID_H * 3);

    // Build the ocean grid: a cell is ocean when no country contains its center.
    for (let y = 0; y < GRID_H; y++) {
      const lat = cellLat(y);
      for (let x = 0; x < GRID_W; x++) {
        const lon = cellLon(x);
        const i = y * GRID_W + x;
        const v = latLonToVector3(lat, lon, 1);
        this.cellVec[i * 3] = v.x;
        this.cellVec[i * 3 + 1] = v.y;
        this.cellVec[i * 3 + 2] = v.z;
        const isLand = findCountryAtLatLon(lat, lon, features, geoData) !== null;
        if (isLand) {
          this.landCells.push(i);
        } else {
          this.ocean[i] = 1;
          if (lat >= OCEAN_LAT_MIN && lat <= OCEAN_LAT_MAX) this.oceanCells.push(i);
        }
      }
    }

    for (let i = 0; i < PLANE_COUNT; i++) this.vehicles.push(this.spawn("plane"));
    for (let i = 0; i < BOAT_COUNT; i++) this.vehicles.push(this.spawn("boat"));
  }

  private vec(i: number): THREE.Vector3 {
    return new THREE.Vector3(this.cellVec[i * 3], this.cellVec[i * 3 + 1], this.cellVec[i * 3 + 2]);
  }

  // A* over the ocean grid (8-neighbour, longitude wraps). Returns a list of
  // cell indices from start to goal, or null if unreachable.
  private findOceanPath(start: number, goal: number): number[] | null {
    const N = GRID_W * GRID_H;
    const g = new Float32Array(N).fill(Infinity);
    const cameFrom = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const goalVec = this.vec(goal);
    const heap = new MinHeap();
    g[start] = 0;
    heap.push(start, Math.acos(clamp(this.vec(start).dot(goalVec), -1, 1)));

    let expansions = 0;
    while (heap.size > 0 && expansions < 40000) {
      const cur = heap.pop();
      if (cur === goal) {
        const path: number[] = [];
        let c = goal;
        while (c !== -1) {
          path.push(c);
          c = cameFrom[c];
        }
        return path.reverse();
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      expansions++;

      const cx = cur % GRID_W;
      const cy = (cur / GRID_W) | 0;
      const curVec = this.vec(cur);
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= GRID_H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (cx + dx + GRID_W) % GRID_W; // wrap longitude
          const ni = ny * GRID_W + nx;
          if (!this.ocean[ni] || closed[ni]) continue;
          const nVec = this.vec(ni);
          const step = Math.acos(clamp(curVec.dot(nVec), -1, 1));
          const tentative = g[cur] + step;
          if (tentative < g[ni]) {
            g[ni] = tentative;
            cameFrom[ni] = cur;
            const h = Math.acos(clamp(nVec.dot(goalVec), -1, 1));
            heap.push(ni, tentative + h);
          }
        }
      }
    }
    return null;
  }

  private angBetween(a: number, b: number): number {
    return Math.acos(clamp(this.vec(a).dot(this.vec(b)), -1, 1));
  }

  // Build a smooth, surface-hugging point list from ocean grid waypoints.
  private buildBoatPath(cells: number[]): THREE.Vector3[] {
    const waypoints = cells.map((i) => {
      const x = i % GRID_W;
      const y = (i / GRID_W) | 0;
      return latLonToVector3(cellLat(y), cellLon(x), SURFACE_R);
    });
    if (waypoints.length < 2) return waypoints;
    const curve = new THREE.CatmullRomCurve3(waypoints, false, "catmullrom", 0.4);
    const segments = clamp(waypoints.length * 6, 24, 240);
    const pts = curve.getPoints(segments);
    // Renormalize onto the surface so the smoothing never dips under the globe.
    for (const p of pts) p.setLength(SURFACE_R);
    return pts;
  }

  // Great-circle arc that rises and falls — height scales with route length.
  private buildPlanePath(aLat: number, aLon: number, bLat: number, bLon: number): THREE.Vector3[] {
    const a = latLonToVector3(aLat, aLon, 1).normalize();
    const b = latLonToVector3(bLat, bLon, 1).normalize();
    const angle = Math.acos(clamp(a.dot(b), -1, 1));
    const arcHeight = 0.04 + 0.13 * (angle / Math.PI);
    const segments = 80;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const dir = slerpUnit(a, b, t).normalize();
      const r = 1.0 + arcHeight * Math.sin(Math.PI * t);
      pts.push(dir.multiplyScalar(r));
    }
    return pts;
  }

  private static cumulative(path: THREE.Vector3[]): { cumLen: number[]; totalLen: number } {
    const cumLen = [0];
    for (let i = 1; i < path.length; i++) {
      cumLen.push(cumLen[i - 1] + path[i].distanceTo(path[i - 1]));
    }
    return { cumLen, totalLen: cumLen[cumLen.length - 1] };
  }

  // Generate a fresh random route of the given kind; returns the point list.
  private makeRoute(kind: VehicleKind): THREE.Vector3[] {
    if (kind === "plane") {
      // Plane endpoints: random land cells with a meaningful separation.
      for (let tries = 0; tries < 30 && this.landCells.length > 1; tries++) {
        const sa = this.landCells[(Math.random() * this.landCells.length) | 0];
        const sb = this.landCells[(Math.random() * this.landCells.length) | 0];
        if (sa === sb) continue;
        const ang = this.angBetween(sa, sb);
        if (ang < 0.4 || ang > 2.7) continue;
        const ax = sa % GRID_W, ay = (sa / GRID_W) | 0;
        const bx = sb % GRID_W, by = (sb / GRID_W) | 0;
        return this.buildPlanePath(cellLat(ay), cellLon(ax), cellLat(by), cellLon(bx));
      }
      // Fallback: any two distinct land cells.
      const sa = this.landCells[0] ?? 0;
      const sb = this.landCells[1] ?? 1;
      const ax = sa % GRID_W, ay = (sa / GRID_W) | 0;
      const bx = sb % GRID_W, by = (sb / GRID_W) | 0;
      return this.buildPlanePath(cellLat(ay), cellLon(ax), cellLat(by), cellLon(bx));
    }

    // Boat: random ocean endpoints with a navigable A* path between them.
    for (let tries = 0; tries < 24 && this.oceanCells.length > 1; tries++) {
      const start = this.oceanCells[(Math.random() * this.oceanCells.length) | 0];
      const goal = this.oceanCells[(Math.random() * this.oceanCells.length) | 0];
      if (start === goal) continue;
      const ang = this.angBetween(start, goal);
      if (ang < 0.5 || ang > 2.4) continue;
      const cells = this.findOceanPath(start, goal);
      if (cells && cells.length >= 2) return this.buildBoatPath(cells);
    }
    // Fallback: a short two-cell hop so the vehicle always has a valid route.
    const a = this.oceanCells[0] ?? 0;
    const neighbors = this.oceanCells.filter((c) => c !== a);
    const b = neighbors[(Math.random() * neighbors.length) | 0] ?? a;
    return this.buildBoatPath([a, b]);
  }

  private spawn(kind: VehicleKind): Vehicle {
    const color = Math.random() < 0.5 ? GREEN : RED;
    const { group, bodyMat } = kind === "plane" ? buildPlaneModel(color) : buildBoatModel(color);
    // Invisible hit sphere enlarges the clickable area (the models are tiny).
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    group.add(hit);
    this.group.add(group);

    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.1 });
    const routeLine = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    this.group.add(routeLine);

    const v: Vehicle = {
      kind,
      mesh: group,
      bodyMat,
      routeLine,
      path: [],
      cumLen: [0],
      totalLen: 0,
      dist: 0,
      speed: kind === "plane" ? 0.035 + Math.random() * 0.035 : 0.014 + Math.random() * 0.014,
    };
    this.assignRoute(v);
    // Stagger starts so vehicles spread out along their routes.
    v.dist = Math.random() * v.totalLen * 0.6;
    return v;
  }

  private assignRoute(v: Vehicle) {
    const path = this.makeRoute(v.kind);
    const { cumLen, totalLen } = TrafficSystem.cumulative(path);
    v.path = path;
    v.cumLen = cumLen;
    v.totalLen = totalLen;
    v.dist = 0;

    // Refresh color for variety, and rebuild the faint route line.
    const color = Math.random() < 0.5 ? GREEN : RED;
    v.bodyMat.color.setHex(color);
    (v.routeLine.material as THREE.LineBasicMaterial).color.setHex(color);
    v.routeLine.geometry.dispose();
    v.routeLine.geometry = new THREE.BufferGeometry().setFromPoints(path);
  }

  // Position + travel tangent at a given distance along the route.
  private sampleAt(v: Vehicle, dist: number, outPos: THREE.Vector3, outTan: THREE.Vector3) {
    const { cumLen, path } = v;
    // Binary search for the segment containing `dist`.
    let lo = 0;
    let hi = cumLen.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumLen[mid] <= dist) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const segLen = cumLen[i] - cumLen[i - 1] || 1;
    const f = clamp((dist - cumLen[i - 1]) / segLen, 0, 1);
    outPos.copy(path[i - 1]).lerp(path[i], f);
    outTan.copy(path[i]).sub(path[i - 1]).normalize();
  }

  private _pos = new THREE.Vector3();
  private _tan = new THREE.Vector3();
  private _up = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _up2 = new THREE.Vector3();
  private _basis = new THREE.Matrix4();

  update() {
    const now = performance.now();
    const dt = this.lastNow ? Math.min((now - this.lastNow) / 1000, 0.1) : 0.016;
    this.lastNow = now;

    for (const v of this.vehicles) {
      v.dist += v.speed * dt;
      if (v.dist >= v.totalLen) {
        this.assignRoute(v);
        continue;
      }
      this.sampleAt(v, v.dist, this._pos, this._tan);
      v.mesh.position.copy(this._pos);
      if (v === this.tracked) this.trackedLocalPos.copy(this._pos);
      // Orient the model: nose/bow (+Z) along travel, up (+Y) along the surface
      // normal, so wings/hull stay level instead of rolling arbitrarily.
      if (this._tan.lengthSq() > 1e-8) {
        const up0 = this._up.copy(this._pos).normalize();
        const right = this._right.crossVectors(up0, this._tan).normalize();
        if (right.lengthSq() > 1e-8) {
          const up = this._up2.crossVectors(this._tan, right).normalize();
          this._basis.makeBasis(right, up, this._tan);
          v.mesh.quaternion.setFromRotationMatrix(this._basis);
        }
      }
    }
  }

  // Local-space position of the tracked vehicle (null when nothing is tracked).
  // Consumed by animateGlobe to rotate the globe and keep it centered.
  getTrackedLocal(): THREE.Vector3 | null {
    return this.tracked ? this.trackedLocalPos : null;
  }

  get isTracking(): boolean {
    return this.tracked !== null;
  }

  clearTracked() {
    this.tracked = null;
  }

  // Raycast the vehicle models; if one is hit, track it. Returns true on a hit.
  tryPick(raycaster: THREE.Raycaster): boolean {
    const hits = raycaster.intersectObjects(this.vehicles.map((v) => v.mesh), true);
    if (hits.length === 0) return false;
    let o: THREE.Object3D | null = hits[0].object;
    while (o) {
      const v = this.vehicles.find((x) => x.mesh === o);
      if (v) {
        this.tracked = v;
        this.trackedLocalPos.copy(v.mesh.position);
        return true;
      }
      o = o.parent;
    }
    return false;
  }

  dispose() {
    for (const v of this.vehicles) {
      this.group.remove(v.mesh);
      this.group.remove(v.routeLine);
      v.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      });
      v.routeLine.geometry.dispose();
      (v.routeLine.material as THREE.Material).dispose();
    }
    this.vehicles = [];
  }
}
