// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latLonToVector3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function dotFillPolygon(rings: number[][][], density: number = 0.85): number[][] {
  const dots: number[][] = [];
  if (rings.length === 0) return dots;

  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  for (let lat = minLat; lat <= maxLat; lat += density) {
    const latCos = Math.max(0.1, Math.abs(Math.cos(lat * (Math.PI / 180))));
    const lonStep = density / latCos;
    const rowOffset = (Math.floor(lat / density) % 2 === 0) ? 0 : lonStep * 0.5;
    for (let lon = minLon + rowOffset; lon <= maxLon; lon += lonStep) {
      let inside = false;
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i][0], yi = ring[i][1];
          const xj = ring[j][0], yj = ring[j][1];
          const intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
      }
      if (inside) dots.push([lon, lat]);
    }
  }
  return dots;
}

// THREE.js Color.setHex converts sRGB → linear before storing in r/g/b.
// Vertex colors are expected to be linear, so we replicate that here.
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function verdictColor(verdict: "BUY" | "SELL" | "HOLD" | null): [number, number, number] {
  let hex = 0x22442a;
  if (verdict === "BUY") hex = 0x00ff88;
  else if (verdict === "SELL") hex = 0xff4444;
  else if (verdict === "HOLD") hex = 0x64748b;
  const r = srgbToLinear((hex >> 16 & 255) / 255);
  const g = srgbToLinear((hex >> 8 & 255) / 255);
  const b = srgbToLinear((hex & 255) / 255);
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// Worker handler
// ---------------------------------------------------------------------------

self.onmessage = (e) => {
  const { geoJSON, stateGeoJSON, worldData, relevanceThreshold, focusedCountryCode } = e.data;

  const linePositions: number[] = [];
  const lineColors: number[] = [];
  const dotPositions: number[] = [];
  const dotColors: number[] = [];
  const segmentToCountry: string[] = [];

  for (const feature of geoJSON.features) {
    const code: string = feature.properties["ISO3166-1-Alpha-2"] ?? "";
    const state = worldData?.countries[code];

    const hasRelevantStory = state?.stories.some(
      (s: { relevanceScore: number }) => s.relevanceScore >= relevanceThreshold
    ) ?? false;

    const hasFocus = !!focusedCountryCode;
    const isFocusedCountry = hasFocus && code === focusedCountryCode;
    const showVerdict = hasRelevantStory && (!hasFocus || isFocusedCountry);
    const verdict = showVerdict ? (state?.netVerdict ?? null) : null;

    const [r_base, g_base, b_base] = verdictColor(verdict);
    const opacity = verdict !== null ? 1.0 : 0.45;
    const radius = verdict !== null ? 1.002 : 1.001;
    const r = r_base * opacity;
    const g = g_base * opacity;
    const b = b_base * opacity;

    const processRing = (ring: number[][]) => {
      const pts = ring.map(([lon, lat]) => latLonToVector3(lat, lon, radius));
      if (pts.length < 2) return;
      for (let i = 0; i < pts.length - 1; i++) {
        linePositions.push(...pts[i], ...pts[i + 1]);
        lineColors.push(r, g, b, r, g, b);
        segmentToCountry.push(code);
      }
    };

    const processDots = (polygonRings: number[][][]) => {
      if (verdict === null) return;
      const dots = dotFillPolygon(polygonRings, 0.9);
      for (const [lon, lat] of dots) {
        const v = latLonToVector3(lat, lon, radius - 0.001);
        dotPositions.push(...v);
        dotColors.push(r, g, b);
      }
    };

    if (feature.geometry.type === "Polygon") {
      const coords = feature.geometry.coordinates as number[][][];
      coords.forEach(processRing);
      processDots(coords);
    } else if (feature.geometry.type === "MultiPolygon") {
      const coords = feature.geometry.coordinates as number[][][][];
      coords.forEach((polygon: number[][][]) => {
        polygon.forEach(processRing);
        processDots(polygon);
      });
    }
  }

  // ── State lines ────────────────────────────────────────────────────────────
  const stateLinePositions: number[] = [];
  const stateLineColors: number[] = [];

  if (stateGeoJSON) {
    const hex = 0x22442a;
    const opacity = 0.28;
    const sr = srgbToLinear((hex >> 16 & 255) / 255) * opacity;
    const sg = srgbToLinear((hex >> 8  & 255) / 255) * opacity;
    const sb = srgbToLinear((hex       & 255) / 255) * opacity;
    const stateRadius = 1.0005;

    const processStateRing = (ring: number[][]) => {
      const pts = ring.map(([lon, lat]) => latLonToVector3(lat, lon, stateRadius));
      if (pts.length < 2) return;
      for (let i = 0; i < pts.length - 1; i++) {
        stateLinePositions.push(...pts[i], ...pts[i + 1]);
        stateLineColors.push(sr, sg, sb, sr, sg, sb);
      }
    };

    for (const feature of stateGeoJSON.features) {
      if (feature.geometry.type === "Polygon") {
        (feature.geometry.coordinates as number[][][]).forEach(processStateRing);
      } else if (feature.geometry.type === "MultiPolygon") {
        (feature.geometry.coordinates as number[][][][]).forEach(
          (poly: number[][][]) => poly.forEach(processStateRing)
        );
      }
    }
  }

  const res = {
    linePositions: new Float32Array(linePositions),
    lineColors: new Float32Array(lineColors),
    dotPositions: new Float32Array(dotPositions),
    dotColors: new Float32Array(dotColors),
    segmentToCountry,
    stateLinePositions: new Float32Array(stateLinePositions),
    stateLineColors: new Float32Array(stateLineColors),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).postMessage(res, [
    res.linePositions.buffer,
    res.lineColors.buffer,
    res.dotPositions.buffer,
    res.dotColors.buffer,
    res.stateLinePositions.buffer,
    res.stateLineColors.buffer,
  ]);
};
