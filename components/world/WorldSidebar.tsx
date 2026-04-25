import React from "react";
import NewsCard from "@/components/NewsCard";
import NewsCollapsible from "@/components/NewsCollapsible";
import NewspaperIcon from "@/components/icons/NewspaperIcon";
import BriefcaseIcon from "@/components/icons/BriefcaseIcon";
import ChevronDownIcon from "@/components/icons/ChevronDownIcon";
import ChevronRightIcon from "@/components/icons/ChevronRightIcon";
import { SECTOR_ICONS } from "@/components/icons/SectorIcons";
import type { GeoStory } from "@/types/geo.types";
import type { ClassifiedStory } from "@/types/news.types";

interface HoldingItem {
  ticker: string;
  name: string;
  countryCode: string;
}

interface WorldSidebarProps {
  groupedStories: [string, GeoStory[]][];
  newsPanelOpen: boolean;
  setNewsPanelOpen: (open: boolean) => void;
  holdingsOpen: boolean;
  setHoldingsOpen: (open: boolean) => void;
  holdings: HoldingItem[];
}

export default function WorldSidebar({
  groupedStories,
  newsPanelOpen,
  setNewsPanelOpen,
  holdingsOpen,
  setHoldingsOpen,
  holdings,
}: WorldSidebarProps) {
  const toClassifiedStory = (story: GeoStory): ClassifiedStory => {
    const normalizedSource: ClassifiedStory["source"] =
      story.source === "reddit" || story.source === "twitter" || story.source === "newsapi"
        ? story.source
        : "finnhub";

    return {
      ...story,
      source: normalizedSource,
      classifiedAt: new Date(story.datetime < 10000000000 ? story.datetime * 1000 : story.datetime).toISOString(),
    };
  };

  return (
    <div className="absolute top-4 left-6 z-20 flex flex-col items-start gap-4 w-[340px] max-h-[85vh] pointer-events-none">
      <div className="flex flex-col w-full pointer-events-none">
        <button
          onClick={() => setNewsPanelOpen(!newsPanelOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-700/50 backdrop-blur pointer-events-auto transition text-slate-300 w-fit shrink-0"
        >
          <NewspaperIcon />
          <span className="font-mono text-sm tracking-wide">Sectors ({groupedStories.length})</span>
          {newsPanelOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </button>

        {newsPanelOpen && groupedStories.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 w-full overflow-y-auto pointer-events-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent max-h-[45vh]">
            {groupedStories.map(([sector, stories]) => (
              <NewsCollapsible
                key={sector}
                badge={<span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{sector}</span>}
                icon={SECTOR_ICONS[sector] ?? SECTOR_ICONS.Unclassified}
                count={stories.length}
                defaultExpanded={false}
                fullyCollapsible
              >
                {stories.map((story, index) => (
                  <NewsCard key={story.url || `story-${index}`} story={toClassifiedStory(story)} />
                ))}
              </NewsCollapsible>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col w-full pointer-events-none">
        <button
          onClick={() => setHoldingsOpen(!holdingsOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-700/50 backdrop-blur pointer-events-auto transition text-slate-300 w-fit shrink-0"
        >
          <BriefcaseIcon />
          <span className="font-mono text-sm tracking-wide">My Holdings ({holdings.length})</span>
          {holdingsOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </button>

        {holdingsOpen && holdings.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 w-full overflow-y-auto pointer-events-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent max-h-[35vh]">
            {holdings.map((holding) => (
              <div
                key={holding.ticker}
                className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5 backdrop-blur-sm shadow-sm hover:bg-black/60 transition-colors"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-mono font-bold text-white tracking-widest">{holding.ticker}</span>
                  <span className="font-sans text-[10px] text-slate-500 truncate max-w-[200px]" title={holding.name}>
                    {holding.name}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-slate-400 font-bold px-1.5 py-0.5 rounded bg-slate-800/50 border border-slate-700/50 shrink-0 ml-2">
                  {holding.countryCode}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
