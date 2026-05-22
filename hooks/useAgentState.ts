import { useState, useCallback, useRef, useEffect } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { AgentProgress, TickerResult } from "@/lib/agent/service";
import type { ClassifiedStory } from "@/types/news.types";
import type { TickerPrediction } from "@/types/predictions";

const AGENT_POLL_MS_ACTIVE = 2_000;
const AGENT_POLL_MS_IDLE = 30_000;

export function useAgentState(
  setNews: React.Dispatch<React.SetStateAction<Record<string, ClassifiedStory[]>>>
) {
  const [agentState, setAgentState] = useState<AgentProgress>({ status: "idle" });
  const [predictions, setPredictions] = useState<Record<string, TickerPrediction[]>>({});
  const [analyzingTickers, setAnalyzingTickers] = useState<Set<string>>(new Set());
  const analyzingTickersRef = useRef<Set<string>>(new Set());
  const tickerPollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const agentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentPollRateRef = useRef<number>(AGENT_POLL_MS_IDLE);
  const prevAgentStatusRef = useRef<string>("idle");

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await authedFetch("/api/predictions");
      if (!res.ok) return;
      const { predictions: data } = await res.json();
      setPredictions(data);
    } catch {
      // ignore
    }
  }, []);

  const mergeAgentResults = useCallback((progress: AgentProgress) => {
    if (!progress.results) return;
    const agentResults = progress.results;
    setNews((prev) => {
      const updated = { ...prev };
      for (const { ticker, verdicts } of agentResults.tickerResults) {
        if (!updated[ticker]) continue;
        updated[ticker] = updated[ticker].map((story) => {
          const match = verdicts.find((verdict) => verdict.url === story.url || verdict.headline === story.headline);
          if (!match) return story;
          return {
            ...story,
            verdict: match.analysis.verdict as ClassifiedStory["verdict"],
            confidence: match.analysis.confidence,
            reason: match.analysis.reason ?? story.reason,
            isAnalyzed: true,
            classifiedAt: new Date().toISOString(),
          };
        });
      }
      return updated;
    });
  }, [setNews]);

  const mergeTickerResults = useCallback((ticker: string, results: TickerResult) => {
    setNews((prev) => {
      const tickerStories = prev[ticker];
      if (!tickerStories) return prev;
      const updated = { ...prev };
      updated[ticker] = tickerStories.map((story) => {
        const match = results.verdicts.find(
          (v) => v.url === story.url || v.headline === story.headline
        );
        if (!match) return story;
        return {
          ...story,
          verdict: match.analysis.verdict as ClassifiedStory["verdict"],
          confidence: match.analysis.confidence,
          reason: match.analysis.reason ?? story.reason,
          isAnalyzed: true,
          classifiedAt: new Date().toISOString(),
        };
      });
      return updated;
    });
  }, [setNews]);

  const analyzeTicker = useCallback(async (ticker: string) => {
    const upper = ticker.toUpperCase();
    if (analyzingTickersRef.current.has(upper)) return;
    if (agentState.status === "running" && agentState.ticker === upper) return;

    analyzingTickersRef.current.add(upper);
    setAnalyzingTickers(new Set(analyzingTickersRef.current));

    try {
      const res = await authedFetch("/api/agent/run-ticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: upper }),
      });
      if (res.status === 409) {
        analyzingTickersRef.current.delete(upper);
        setAnalyzingTickers(new Set(analyzingTickersRef.current));
        return;
      }

      const poll = setInterval(async () => {
        try {
          const pollRes = await authedFetch(`/api/agent/run-ticker?ticker=${upper}`);
          if (!pollRes.ok) return;
          const data = await pollRes.json();
          if (data.status === "complete" || data.status === "error") {
            clearInterval(poll);
            tickerPollRefs.current.delete(upper);
            analyzingTickersRef.current.delete(upper);
            setAnalyzingTickers(new Set(analyzingTickersRef.current));
            if (data.status === "complete" && data.results) {
              mergeTickerResults(upper, data.results);
            }
          }
        } catch {
          // continue polling on transient errors
        }
      }, 2_000);
      tickerPollRefs.current.set(upper, poll);
    } catch {
      analyzingTickersRef.current.delete(upper);
      setAnalyzingTickers(new Set(analyzingTickersRef.current));
    }
  }, [agentState.status, agentState.ticker, mergeTickerResults]);

  const pollAgent = useCallback(async () => {
    try {
      const res = await authedFetch("/api/agent/run");
      if (!res.ok) return;
      const data: AgentProgress = await res.json();

      const wasRunning = prevAgentStatusRef.current === "running";
      const justCompleted = wasRunning && data.status === "complete";
      prevAgentStatusRef.current = data.status;

      setAgentState(data);
      if (justCompleted) {
        mergeAgentResults(data);
        fetchPredictions();
      }

      const desiredRate = data.status === "running" ? AGENT_POLL_MS_ACTIVE : AGENT_POLL_MS_IDLE;
      if (desiredRate !== agentPollRateRef.current) {
        agentPollRateRef.current = desiredRate;
        if (agentIntervalRef.current) clearInterval(agentIntervalRef.current);
        agentIntervalRef.current = setInterval(pollAgent, desiredRate);
      }
    } catch {
      // ignore
    }
  }, [mergeAgentResults, fetchPredictions]);

  useEffect(() => {
    pollAgent();
    agentIntervalRef.current = setInterval(pollAgent, agentPollRateRef.current);
    return () => {
      if (agentIntervalRef.current) clearInterval(agentIntervalRef.current);
    };
  }, [pollAgent]);

  // Cleanup per-ticker polling intervals on unmount
  useEffect(() => {
    return () => {
      for (const interval of tickerPollRefs.current.values()) {
        clearInterval(interval);
      }
      tickerPollRefs.current.clear();
      analyzingTickersRef.current.clear();
    };
  }, []);

  return { agentState, predictions, fetchPredictions, analyzingTickers, analyzeTicker };
}