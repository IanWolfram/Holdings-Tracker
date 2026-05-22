import { useEffect } from "react";
import * as THREE from "three";
import type { CountryGeoData, GeoJSON } from "./types";
import type { WorldData } from "@/types/geo.types";
import { computeCountryGeoData } from "./math";

export function useGeoData(
  workerRef: React.MutableRefObject<Worker | null>,
  geoJSONCacheRef: React.MutableRefObject<GeoJSON | null>,
  stateGeoJSONCacheRef: React.MutableRefObject<GeoJSON | null>,
  countryGeoDataRef: React.MutableRefObject<Record<string, CountryGeoData>>,
  globeGroupRef: React.RefObject<THREE.Group | null>,
  countryLinesRef: React.MutableRefObject<THREE.Object3D[]>,
  stateLinesRef: React.MutableRefObject<THREE.Object3D[]>,
  segmentToCountryRef: React.MutableRefObject<string[]>,
  worldData: WorldData | null,
  relevanceThreshold: number,
  focusedCountryCode: string | undefined
) {
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    const cached = geoJSONCacheRef.current;
    if (cached) {
      worker.postMessage({ geoJSON: cached, stateGeoJSON: stateGeoJSONCacheRef.current, worldData, relevanceThreshold, focusedCountryCode });
      return;
    }

    Promise.all([
      fetch("/countries.geojson").then((r) => r.json()),
      fetch("/us-states.geojson").then((r) => r.json()).catch(() => null),
    ]).then(([geoJSON, stateGeoJSON]: [GeoJSON, GeoJSON | null]) => {
      geoJSONCacheRef.current = geoJSON;
      stateGeoJSONCacheRef.current = stateGeoJSON;
      for (const feature of geoJSON.features) {
        const code = feature.properties["ISO3166-1-Alpha-2"] ?? "";
        if (code) {
          countryGeoDataRef.current[code] = computeCountryGeoData(feature);
        }
      }
      workerRef.current?.postMessage({ geoJSON, stateGeoJSON, worldData, relevanceThreshold, focusedCountryCode });
    });
  }, [worldData, relevanceThreshold, focusedCountryCode]);
}