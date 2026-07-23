import { useCallback, useEffect, useState } from "react";

const LS_KEY = "pulse_tracked_politicians";

/** Read the persisted tracked-politician list, tolerating malformed storage. */
function readStored(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Per-user watchlist of politicians, persisted in localStorage. Used on the HOT
 * page to filter congressional trades down to a tracked individual.
 */
export function useTrackedPoliticians() {
  const [tracked, setTracked] = useState<string[]>([]);

  useEffect(() => {
    setTracked(readStored());
  }, []);

  const persist = useCallback((next: string[]) => {
    setTracked(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // storage may be unavailable (private mode); state still updates in-memory
    }
  }, []);

  const addTracked = useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return;
      setTracked((prev) => {
        if (prev.some((p) => p.toLowerCase() === n.toLowerCase())) return prev;
        const next = [...prev, n];
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const removeTracked = useCallback(
    (name: string) => {
      setTracked((prev) => {
        const next = prev.filter((p) => p.toLowerCase() !== name.toLowerCase());
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const isTracked = useCallback(
    (name: string) => tracked.some((p) => p.toLowerCase() === name.trim().toLowerCase()),
    [tracked],
  );

  return { tracked, addTracked, removeTracked, isTracked, setTracked: persist };
}
