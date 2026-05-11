import { useCallback, useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { Position } from "@/types/position.types";
import type { WorldData } from "@/types/geo.types";

const POLL_INTERVAL_MS = 15 * 60 * 1000;

export function useWorldData() {
  const [worldData, setWorldData] = useState<WorldData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshWorldData = useCallback(async () => {
    try {
      const [worldRes, posRes] = await Promise.all([
        authedFetch("/api/world"),
        authedFetch("/api/positions"),
      ]);
      if (!worldRes.ok) {
        console.error("[world-page] /api/world returned", worldRes.status);
      } else {
        const data: WorldData = await worldRes.json();
        setWorldData(data);
      }
      if (posRes.ok) {
        const posData: Position[] = await posRes.json();
        setPositions(posData);
      }
    } catch (err) {
      console.error("[world-page] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorldData();
    intervalRef.current = setInterval(refreshWorldData, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshWorldData]);

  return { worldData, positions, loading, refreshWorldData };
}
