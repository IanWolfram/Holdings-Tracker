"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FinnhubBadge, XBadge, RedditBadge } from "./mediabadges";
import AnalysisProgressBorder from "./ui/AnalysisProgressBorder";
import type { ClassifiedStory } from "@/types/news.types";

export default function PendingNewsCard({ story }: { story: ClassifiedStory }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Only simulate progress if not analyzed
    if (story.isAnalyzed) {
      setProgress(100);
      return;
    }

    const duration = 6000 + Math.random() * 8000; // 6-14 seconds
    const start = Date.now();

    let frame: number;
    const animate = () => {
      const now = Date.now();
      const p = Math.min(((now - start) / duration) * 100, 100);
      setProgress(p);
      if (p < 100) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [story.headline]); // headline stable as key

  const isSeconds = story.datetime && story.datetime < 10000000000;
  const timestampMs = isSeconds ? story.datetime * 1000 : story.datetime;
  const timeAgo = story.datetime
    ? formatDistanceToNow(new Date(timestampMs), { addSuffix: true })
    : "";

  return (
    <div
      className="rounded-[8px] p-2 cursor-pointer relative"
      style={{
        border: "1px solid rgba(100,116,139,0.15)", // solid base for progress to overlap
        background: "rgba(10,12,18,0.4)",
      }}
      onClick={() => story.url && window.open(story.url, "_blank")}
    >
      {/* Progress Border Overlay */}
      <AnalysisProgressBorder progress={progress} />

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
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold">
          {progress < 100 ? "Analyzing..." : "Pending"}
        </span>
      </div>
    </div>
  );
}
