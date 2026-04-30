"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Position } from "@/types/position.types";

const STORAGE_KEY = "pulse:proposed-positions";
const MAX_PROPOSED = 10;

export interface ProposedPositionEntry {
  ticker: string;
  targetShares?: number;
  targetPrice?: number;
  addedAt: number;
}

function readStorage(): ProposedPositionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown) =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as ProposedPositionEntry).ticker === "string"
    ) as ProposedPositionEntry[];
  } catch {
    return [];
  }
}

function writeStorage(entries: ProposedPositionEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable or full
  }
}

export function useProposedPositions(heldTickers: string[] = []) {
  const [entries, setEntries] = useState<ProposedPositionEntry[]>(readStorage);

  useEffect(() => {
    const stored = readStorage();
    if (JSON.stringify(stored) !== JSON.stringify(entries)) {
      setEntries(stored);
    }
  }, [entries]);

  const heldSet = useMemo(
    () => new Set(heldTickers.map((t) => t.toUpperCase())),
    [heldTickers]
  );

  const addProposedPosition = useCallback(
    (ticker: string, targetShares?: number, targetPrice?: number) => {
      const upper = ticker.toUpperCase().trim();
      if (!upper || upper.length > 10) return false;
      if (heldSet.has(upper)) return false;
      if (entries.some((e) => e.ticker.toUpperCase() === upper)) return false;

      setEntries((prev) => {
        if (prev.length >= MAX_PROPOSED) return prev;
        const next = [
          ...prev,
          { ticker: upper, targetShares, targetPrice, addedAt: Date.now() },
        ];
        writeStorage(next);
        return next;
      });
      return true;
    },
    [heldSet, entries]
  );

  const removeProposedPosition = useCallback((ticker: string) => {
    const upper = ticker.toUpperCase().trim();
    setEntries((prev) => {
      const next = prev.filter((e) => e.ticker.toUpperCase() !== upper);
      writeStorage(next);
      return next;
    });
  }, []);

  // Auto-remove proposed positions that are now held
  useEffect(() => {
    const stale = entries.filter((e) => heldSet.has(e.ticker.toUpperCase()));
    if (stale.length > 0) {
      const next = entries.filter((e) => !heldSet.has(e.ticker.toUpperCase()));
      writeStorage(next);
      setEntries(next);
    }
  }, [entries, heldSet]);

  const proposedTickers = useMemo(
    () => entries.map((e) => e.ticker.toUpperCase()),
    [entries]
  );

  return {
    proposedEntries: entries,
    proposedTickers,
    addProposedPosition,
    removeProposedPosition,
  };
}