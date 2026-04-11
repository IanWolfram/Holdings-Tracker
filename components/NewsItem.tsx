import { formatDistanceToNow } from "date-fns";
import VerdictBadge from "./VerdictBadge";
import type { ClassifiedStory } from "@/lib/news";

interface Props {
  story: ClassifiedStory;
}

const borderClass: Record<string, string> = {
  BUY: "border-buy",
  SELL: "border-sell",
  HOLD: "border-hold",
};

export default function NewsItem({ story }: Props) {
  const timeAgo = story.datetime
    ? formatDistanceToNow(new Date(story.datetime * 1000), { addSuffix: true })
    : "";

  return (
    <article
      className={`news-item-frame ${borderClass[story.verdict]} p-4 relative cursor-pointer group/item hover:bg-white/[0.02] transition-colors`}
    >
      <VerdictBadge verdict={story.verdict} confidence={story.confidence} />

      <a
        href={story.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-[13px] font-semibold leading-relaxed line-clamp-2 group-hover/item:text-white transition-colors"
      >
        {story.headline}
      </a>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          {story.source === "finnhub" ? (
            <span className="border border-[#22c55e] text-[#22c55e] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
              Finnhub
            </span>
          ) : (
            <span className="bg-black text-white px-1.5 py-0.5 rounded border border-white/20 flex items-center gap-1 font-bold">
              {story.author ? `@${story.author}` : "Twitter"}
            </span>
          )}
          {timeAgo && <span>{timeAgo}</span>}
        </div>
        <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
      </div>

      {story.reason && (
        <p className="mt-1 text-[10px] text-slate-600 italic line-clamp-1">{story.reason}</p>
      )}
    </article>
  );
}
