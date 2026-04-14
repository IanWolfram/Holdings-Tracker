import type { NextApiRequest, NextApiResponse } from "next";
import { getQuotes } from "@/lib/market-data";
import type { QuoteData } from "@/types/market-data.types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Record<string, QuoteData> | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = typeof req.query.tickers === "string" ? req.query.tickers : "";
  if (!raw) {
    return res.status(400).json({ error: "tickers query param required (comma-separated)" });
  }

  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);

  try {
    const quotes = await getQuotes(tickers);
    res.status(200).json(quotes);
  } catch (err) {
    console.error("[/api/quotes]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
