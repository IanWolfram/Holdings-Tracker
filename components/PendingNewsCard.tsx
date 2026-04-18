"use client";

import { formatDistanceToNow } from "date-fns";
import { FinnhubBadge, XBadge, RedditBadge } from "./mediabadges";
import type { ClassifiedStory } from "@/types/news.types";

export default function PendingNewsCard({ story }: { story: ClassifiedStory }) {
  const isSeconds = story.datetime && story.datetime < 10000000000;
  const timestampMs = isSeconds ? story.datetime * 1000 : story.datetime;
  const timeAgo = story.datetime
    ? formatDistanceToNow(new Date(timestampMs), { addSuffix: true })
    : "";

  return (
    <div
      className="rounded-[8px] p-2 cursor-pointer"
      style={{
        border: "1px dashed rgba(100,116,139,0.35)",
        background: "rgba(10,12,18,0.4)",
      }}
      onClick={() => story.url && window.open(story.url, "_blank")}
    >
      <p className="block text-[13px] font-semibold leading-snug line-clamp-2 text-slate-400">
        {story.headline}
      </p>

      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
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
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600 opacity-60">
          Pending
        </span>
      </div>
    </div>
  );
}
