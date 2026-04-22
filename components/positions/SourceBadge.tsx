import React from "react";
import { FinnhubBadge, XBadge, RedditBadge } from "@/components/mediabadges";

interface SourceBadgeProps {
  source: string;
}

export default function SourceBadge({ source }: SourceBadgeProps) {
  if (source === "finnhub") return <FinnhubBadge />;
  if (source === "reddit") return <RedditBadge />;
  if (source === "twitter") return <XBadge />;
  return <span className="text-[10px] text-slate-500 font-bold">News</span>;
}
