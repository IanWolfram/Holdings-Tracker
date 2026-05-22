import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { Position } from "@/types/position.types";
import type { ProposedPositionEntry } from "./useProposedPositions";

export function useProposedQuotes(proposedEntries: ProposedPositionEntry[]) {
  const [proposedPositionData, setProposedPositionData] = useState<Position[]>([]);

  const fetchProposedQuotes = useCallback(
    async (entries: ProposedPositionEntry[]) => {
      if (entries.length === 0) {
        setProposedPositionData([]);
        return;
      }
      try {
        const res = await authedFetch("/api/proposed-quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targets: entries.map((e) => ({
              ticker: e.ticker,
              targetShares: e.targetShares,
              targetPrice: e.targetPrice,
            })),
          }),
        });
        if (!res.ok) return;
        const data: Position[] = await res.json();
        setProposedPositionData(
          data.map((pos) => {
            const entry = entries.find((e) => e.ticker === pos.ticker);
            return {
              ...pos,
              targetShares: entry?.targetShares,
              targetPrice: entry?.targetPrice,
              addedAt: entry?.addedAt ?? pos.addedAt,
            };
          })
        );
      } catch {
        // ignore -- proposed data will show as zeros
      }
    },
    []
  );

  useEffect(() => {
    fetchProposedQuotes(proposedEntries);
  }, [proposedEntries, fetchProposedQuotes]);

  return { proposedPositionData };
}