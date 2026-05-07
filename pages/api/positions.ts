import type { NextApiRequest, NextApiResponse } from "next";
import type { Position } from "@/types/position.types";
import { getHistory } from "@/lib/market-data";
import { getServices, getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchCompanyProfile } from "@/lib/company-profile";
import { withSyntheticHistory } from "@/src/mappers/positionMapper";

async function enrichWithHistory(positions: Position[]): Promise<Position[]> {
  const results = await Promise.allSettled(
    positions.map(async (pos) => {
      const h = await getHistory(pos.ticker).catch(() => null);
      return h ? { ...pos, history: h.closes } : pos;
    })
  );
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : positions[i]
  );
}

async function enrichWithCompanyNames(positions: Position[]): Promise<Position[]> {
  const results = await Promise.allSettled(
    positions.map(async (pos) => {
      // Only fetch if description is missing or equals the ticker (E*TRADE limitation)
      if (pos.description && pos.description !== pos.ticker) return pos;
      try {
        const profile = await fetchCompanyProfile(pos.ticker);
        if (profile?.name && profile.name !== pos.ticker) {
          return { ...pos, description: profile.name };
        }
      } catch {
        // silently keep original description
      }
      return pos;
    })
  );
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : positions[i]
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Position[] | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const { portfolioService } = process.env.PULSE_SINGLE_USER_MODE === "1"
      ? getServices()
      : await getServicesForUser(user.id);
    const isRefresh = req.query.refresh === "true";
    const { positions } = await portfolioService.getPositionsSafe(isRefresh);
    const isMock = process.env.ETRADE_ENV === "mock";

    if (isMock) {
      const withNames = await enrichWithCompanyNames(positions);
      return res.status(200).json(withSyntheticHistory(withNames));
    }

    const withNames = await enrichWithCompanyNames(positions);

    // Race history enrichment against a 10s budget so the API stays responsive.
    // Positions missing real history get synthetic charts as a fallback.
    // Background enrichment continues warming the server cache for next poll.
    const HISTORY_BUDGET_MS = 10_000;
    const historyResult = await Promise.race([
      enrichWithHistory(positions),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), HISTORY_BUDGET_MS)),
    ]);

    // Keep warming cache in background for positions that didn't finish in time
    enrichWithHistory(positions).catch(() => {});

    if (historyResult) {
      res.status(200).json(withSyntheticHistory(historyResult));
    } else {
      res.status(200).json(withSyntheticHistory(withNames));
    }
  } catch (err) {
    console.error("[/api/positions]", err);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
}
