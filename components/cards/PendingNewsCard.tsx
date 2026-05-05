"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FinnhubBadge, PolygonBadge } from "@/components/mediabadges";
import AnalysisProgressBorder from "@/components/ui/AnalysisProgressBorder";
import type { ClassifiedStory } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";

export default function PendingNewsCard({
  story,
  agentState,
  compact = process.env.NEXT_PUBLIC_UI_MODE === "compact",
}: {
  story: ClassifiedStory;
  agentState?: AgentProgress;
  compact?: boolean;
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
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isMock, story.isAnalyzed]);

  // ── Live mode: real progress while being analyzed ─────────────────────
  useEffect(() => {
    if (isMock || story.isAnalyzed) return;

    if (isBeingAnalyzed) {
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

  const statusColor = isBeingAnalyzed ? "#00FF88" : isTickerQueued ? "#94a3b8" : "#64748b";
  const statusBg = isBeingAnalyzed ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.05)";
  const borderColor = isBeingAnalyzed ? "#00FF88" : isMock ? "#00FF88" : "#1e293b";

  const SourceBadge =
    story.source === "finnhub" ? (
      <FinnhubBadge />
    ) : story.source === "polygon" ? (
      <PolygonBadge />
    ) : (
      <span className="text-[10px] text-slate-400 font-bold">News</span>
    );

  return (
    <div
      className={`${compact ? "px-[7px] py-[5px]" : "p-2"} rounded-[8px] cursor-pointer relative overflow-hidden`}
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

      {compact ? (
        <div className="relative z-10">
          <div className="flex items-start gap-1.5">
            <p className="flex-1 min-w-0 text-[12px] font-semibold leading-[1.25] line-clamp-2 text-slate-400 break-words m-0">
              {story.headline}
            </p>
          </div>
          <div className="mt-[3px] flex items-center gap-[5px] text-[10px] text-slate-600">
            {SourceBadge}
            {timeAgo && <span className="text-[10px]">{timeAgo}</span>}
            <span className="ml-auto" />
            <span
              className={`shrink-0 inline-flex items-center gap-[3px] font-mono text-[8px] font-black leading-none px-[4px] py-[2px] rounded-[2px] tracking-[0.04em] ${
                isBeingAnalyzed ? "animate-pulse" : ""
              }`}
              style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}33` }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: statusColor }} />
              {statusLabel.toUpperCase()}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative z-10">
          <p className="block text-[13px] font-semibold leading-snug line-clamp-2 text-slate-400">
            {story.headline}
          </p>

          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              {SourceBadge}
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
      )}
    </div>
  );
}
