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

/** Fetch proposed positions from server for the current user. */
async function fetchFromServer(): Promise<ProposedPositionEntry[]> {
  try {
    const res = await fetch("/api/account/proposed-positions");
    if (!res.ok) return [];
    const { positions } = (await res.json()) as {
      positions: { ticker: string; target_shares: number | null; target_price: number | null; added_at: string }[];
    };
    return positions.map((p) => ({
      ticker: p.ticker,
      targetShares: p.target_shares ?? undefined,
      targetPrice: p.target_price ?? undefined,
      addedAt: new Date(p.added_at).getTime(),
    }));
  } catch {
    return [];
  }
}

export function useProposedPositions(heldTickers: string[] = []) {
  const [entries, setEntries] = useState<ProposedPositionEntry[]>(readStorage);
  const [loaded, setLoaded] = useState(false);

  // On mount, load from server and merge with localStorage
  useEffect(() => {
    if (loaded) return;
    fetchFromServer().then((serverEntries) => {
      const localEntries = readStorage();
      const localMap = new Map(localEntries.map((e) => [e.ticker, e]));
      // Server is authoritative; add any local-only entries
      const merged = serverEntries.map((se) => {
        const local = localMap.get(se.ticker);
        // Prefer the one with more detail or newer timestamp
        if (local && local.addedAt > se.addedAt) return local;
        return se;
      });
      // Add local entries not on server yet (will be pushed on add)
      for (const le of localEntries) {
        if (!merged.some((e) => e.ticker === le.ticker)) {
          merged.push(le);
        }
      }
      writeStorage(merged);
      setEntries(merged);
      setLoaded(true);
    });
  }, [loaded]);

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

      // Persist to server (fire-and-forget)
      fetch("/api/account/proposed-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: upper, targetShares, targetPrice }),
      }).catch(() => {});

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

    // Persist to server (fire-and-forget)
    fetch(`/api/account/proposed-positions?ticker=${encodeURIComponent(upper)}`, {
      method: "DELETE",
    }).catch(() => {});
  }, []);

  // Auto-remove proposed positions that are now held
  useEffect(() => {
    const stale = entries.filter((e) => heldSet.has(e.ticker.toUpperCase()));
    if (stale.length > 0) {
      const next = entries.filter((e) => !heldSet.has(e.ticker.toUpperCase()));
      writeStorage(next);
      setEntries(next);
      // Remove from server too
      for (const s of stale) {
        fetch(`/api/account/proposed-positions?ticker=${encodeURIComponent(s.ticker)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
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