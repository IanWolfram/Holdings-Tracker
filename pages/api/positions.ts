import type { NextApiResponse } from "next";
import type { Position } from "@/types/position.types";
import { getHistory } from "@/lib/market-data";
import { getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchCompanyProfile } from "@/lib/company-profile";
import { apiHandler } from "@/lib/api-handler";
import { touchLastSeen } from "@/lib/activity";

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

export default apiHandler(["GET"], async (req, res: NextApiResponse<Position[] | { error: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  // Presence signal: the dashboard polls this route, so it marks the user
  // "active" for the worker's story-analysis cadence boost.
  touchLastSeen(user.id);

  try {
    const { portfolioService } = await getServicesForUser(user.id);
    const isRefresh = req.query.refresh === "true";
    const { positions } = await portfolioService.getPositionsSafe(isRefresh);

    // No positions (not connected to E*TRADE) — return empty array
    if (positions.length === 0) {
      return res.status(200).json([]);
    }

    const withNames = await enrichWithCompanyNames(positions);

    // Race history enrichment against a 10s budget so the API stays responsive.
    // Positions missing real history are returned WITHOUT history — the chart
    // stays blank rather than showing inaccurate synthetic data.
    //
    // We launch the enrichment ONCE and keep a handle to it. Promise.race does
    // not cancel the loser, so this same in-flight promise keeps running after
    // the budget elapses and warms the server cache for the next poll. (Starting
    // a second enrichWithHistory here would double every Yahoo/Finnhub call and
    // help trip Yahoo's 429 rate-limit.)
    const HISTORY_BUDGET_MS = 10_000;
    const enrichPromise = enrichWithHistory(withNames);
    enrichPromise.catch(() => {}); // background cache-warm; don't crash on late rejection
    const historyResult = await Promise.race([
      enrichPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), HISTORY_BUDGET_MS)),
    ]);

    res.status(200).json(historyResult ?? withNames);
  } catch (err) {
    console.error("[/api/positions]", err);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
}, "api/positions");
