"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FinnhubBadge, XBadge, RedditBadge } from "./mediabadges";
import AnalysisProgressBorder from "./ui/AnalysisProgressBorder";
import type { ClassifiedStory } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";

export default function PendingNewsCard({
  story,
  agentState,
}: {
  story: ClassifiedStory;
  agentState?: AgentProgress;
}) {
  const [progress, setProgress] = useState(0);
  const mockAnimStartedRef = useRef(false);

  const isMock = agentState?.isMock ?? false;

  // Exact match: this specific headline is under the microscope right now
  const isBeingAnalyzed =
    !isMock &&
    agentState?.status === "running" &&
    agentState?.ticker === story.ticker &&
    agentState?.currentHeadline === story.headline;

  // Coarser match: the agent is running on this ticker (stories queued)
  const isTickerQueued =
    !isMock &&
    agentState?.status === "running" &&
    agentState?.ticker === story.ticker &&
    !isBeingAnalyzed;

  // ── Mock mode: fake progress animation (original behavior) ──────────────
  useEffect(() => {
    if (!isMock || story.isAnalyzed || mockAnimStartedRef.current) return;
    mockAnimStartedRef.current = true;

    const duration = 6000 + Math.random() * 8000;
    const start = Date.now();
    let frame: number;

    const animate = () => {
      const p = Math.min(((Date.now() - start) / duration) * 100, 100);
      setProgress(p);
      if (p < 100) {
        frame = requestAnimationFrame(animate);
      }
      // In mock mode there's no real "complete" event; just hold at 100
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isMock, story.isAnalyzed]);

  // ── Live mode: real progress while being analyzed ─────────────────────
  useEffect(() => {
    if (isMock || story.isAnalyzed) return;

    if (isBeingAnalyzed) {
      // Slowly fill to 85% over ~20s so the user sees genuine motion
      const duration = 20_000;
      const start = Date.now();
      let frame: number;

      const animate = () => {
        const p = Math.min(((Date.now() - start) / duration) * 85, 85);
        setProgress(p);
        if (p < 85) frame = requestAnimationFrame(animate);
      };

      frame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frame);
    } else {
      setProgress(0);
    }
  }, [isMock, story.isAnalyzed, isBeingAnalyzed]);

  const isSeconds = story.datetime && story.datetime < 10_000_000_000;
  const timestampMs = isSeconds ? story.datetime * 1000 : story.datetime;
  const timeAgo = story.datetime
    ? formatDistanceToNow(new Date(timestampMs), { addSuffix: true })
    : "";

  const statusLabel = (() => {
    if (isMock) return progress < 100 ? "Analyzing..." : "Pending";
    if (isBeingAnalyzed) return "Analyzing...";
    if (isTickerQueued) return `In Queue`;
    if (agentState?.status === "running") return "Waiting";
    return "Run Agent ↑";
  })();

  const borderColor = isBeingAnalyzed ? "#00FF88" : isMock ? "#00FF88" : "#1e293b";

  return (
    <div
      className="rounded-[8px] p-2 cursor-pointer relative"
      style={{
        border: "1px solid rgba(100,116,139,0.15)",
        background: isBeingAnalyzed
          ? "rgba(0,255,136,0.04)"
          : isTickerQueued
          ? "rgba(255,255,255,0.02)"
          : "rgba(10,12,18,0.4)",
      }}
      onClick={() => story.url && window.open(story.url, "_blank")}
    >
      <AnalysisProgressBorder progress={progress} color={borderColor} />

      <p className="block text-[13px] font-semibold leading-snug line-clamp-2 text-slate-400 relative z-10">
        {story.headline}
      </p>

      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600 relative z-10">
        <div className="flex items-center gap-1.5">
          {story.source === "finnhub" ? (
            <FinnhubBadge />
          ) : story.source === "reddit" ? (
            <RedditBadge author={story.author} />
          ) : (
            <XBadge author={story.author} />
          )}
          {timeAgo && <span>{timeAgo}</span>}
        </div>
        <span
          className={`text-[9px] font-mono uppercase tracking-widest font-bold ${
            isBeingAnalyzed ? "text-[#00FF88] animate-pulse" : "text-slate-500"
          }`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
