// Test hatch logic
export function hatchPolygon(ring: number[][], density: number = 1.0): number[][][] {
  const segments: number[][][] = [];
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const minC = minLat - maxLon;
  const maxC = maxLat - minLon;
  // increase density by lowering step
  for (let c = minC - 1; c <= maxC + 1; c += density) {
    const intersections: number[] = [];
    for (let i = 0; i < ring.length - 1; i++) {
        const p1 = ring[i];
        const p2 = ring[i + 1];
        const d1 = p1[1] - p1[0] - c;
        const d2 = p2[1] - p2[0] - c;
        if (d1 * d2 < 0) {
           const t = d1 / (d1 - d2);
           const intLon = p1[0] + t * (p2[0] - p1[0]);
           intersections.push(intLon);
        } else if (d1 === 0) intersections.push(p1[0]);
    }
    // Remove duplicates due to exact vertex hits
    const uniqueInt = Array.from(new Set(intersections.map(n => Number(n.toFixed(5))))).sort((a,b) => a - b);
    for (let i = 0; i < uniqueInt.length - 1; i += 2) {
       segments.push([
         [uniqueInt[i], uniqueInt[i] + c],
         [uniqueInt[i + 1], uniqueInt[i + 1] + c]
       ]);
    }
  }
  return segments;
}
