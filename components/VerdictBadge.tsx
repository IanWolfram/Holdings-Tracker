import type { Verdict } from "@/lib/classifier";

interface Props {
  verdict: Verdict;
  confidence: number;
}

const styles: Record<Verdict, { badge: string; conf: string }> = {
  BUY:  { badge: "bg-[#22c55e]/10 text-[#22c55e]", conf: "text-[#22c55e] font-bold" },
  SELL: { badge: "bg-[#f43f5e]/10 text-[#f43f5e]", conf: "text-[#f43f5e] font-bold" },
  HOLD: { badge: "bg-slate-600/10 text-slate-400",  conf: "text-slate-500" },
};

export default function VerdictBadge({ verdict, confidence }: Props) {
  const pct = Math.round(confidence * 100);
  const s = styles[verdict];
  return (
    <div className="flex justify-between items-start mb-2">
      <span className={`${s.badge} text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider`}>
        {verdict}
      </span>
      {confidence > 0 && (
        <span className={`${s.conf} font-mono text-[10px]`}>{pct}% CONF</span>
      )}
    </div>
  );
}
