import type { Verdict } from "@/types/news.types";

interface Props {
  verdict: Verdict;
  confidence: number;
}

const styles: Record<Verdict, { badge: string; conf: string }> = {
  BUY:  { badge: "bg-positive/10 text-positive", conf: "text-positive font-bold" },
  SELL: { badge: "bg-negative/10 text-negative", conf: "text-negative font-bold" },
  HOLD: { badge: "bg-slate-600/10 text-slate-400",  conf: "text-slate-500" },
};

export default function VerdictBadge({ verdict, confidence }: Props) {
  const pct = Math.round(confidence * 100);
  const s = styles[verdict];
  return (
    <div className="flex justify-between items-start mb-1.5">
      <span className={`${s.badge} text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider`}>
        {verdict}
      </span>
      {confidence > 0 && (
        <span className={`${s.conf} font-mono text-[10px]`}>{pct}% CONF</span>
      )}
    </div>
  );
}
