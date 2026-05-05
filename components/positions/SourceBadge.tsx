import React from "react";
import { FinnhubBadge, PolygonBadge } from "@/components/mediabadges";

interface SourceBadgeProps {
  source: string;
  iconOnly?: boolean;
}

export default function SourceBadge({ source, iconOnly }: SourceBadgeProps) {
  if (source === "finnhub") return <FinnhubBadge iconOnly={iconOnly} />;
  if (source === "polygon") return <PolygonBadge iconOnly={iconOnly} />;
  return <span className="text-[10px] text-slate-500 font-bold">News</span>;
}