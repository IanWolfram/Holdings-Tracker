import React from "react";
import { FinnhubBadge, XBadge, RedditBadge } from "@/components/mediabadges";

interface SourceBadgeProps {
  source: string;
  iconOnly?: boolean;
}

export default function SourceBadge({ source, iconOnly }: SourceBadgeProps) {
  if (source === "finnhub") return <FinnhubBadge iconOnly={iconOnly} />;
  if (source === "reddit") return <RedditBadge iconOnly={iconOnly} />;
  if (source === "twitter") return <XBadge iconOnly={iconOnly} />;
  return <span className="text-[10px] text-slate-500 font-bold">News</span>;
}
