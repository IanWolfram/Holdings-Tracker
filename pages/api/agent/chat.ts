import { NextApiRequest, NextApiResponse } from "next";
import { callMlxRaw } from "@/world-brain/brain";
import { getPositions } from "@/lib/etrade";

const SYSTEM_PROMPT = `You are Pulse, an AI financial analyst with deep knowledge of equities, macro trends, and portfolio strategy. You have access to the user's current holdings context. Answer questions about stocks, market conditions, and investment strategy concisely and directly. Use plain text, avoid excessive formatting. Be direct and insightful.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { message, history } = req.body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required." });
  }

  // Build holdings context
  let holdingsContext = "";
  try {
    const positions = await getPositions();
    if (positions.length > 0) {
      holdingsContext = `\n\nUser's current holdings: ${positions.map(p => `${p.ticker} ($${p.marketValue?.toFixed(0) ?? "?"} market value, P/L $${p.gainLoss?.toFixed(0) ?? "?"})`).join(", ")}`;
    }
  } catch { /* ignore — fall through without holdings context */ }

  // Build a single user message that includes conversation history for context
  let fullMessage = message;
  if (history && history.length > 0) {
    const historyText = history
      .map(m => `${m.role === "user" ? "User" : "Pulse"}: ${m.content}`)
      .join("\n");
    fullMessage = `Previous conversation:\n${historyText}\n\nUser: ${message}`;
  }

  try {
    const reply = await callMlxRaw(SYSTEM_PROMPT + holdingsContext, fullMessage);
    if (!reply) {
      return res.status(503).json({ error: "AI engine unavailable. Check that your model is configured and running." });
    }
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("[api/agent/chat] Error:", err);
    return res.status(500).json({ error: "Inference failed." });
  }
}
