import Image from "next/image";

interface FinnhubBadgeProps {
  iconOnly?: boolean;
}

export default function FinnhubBadge({ iconOnly }: FinnhubBadgeProps) {
  return (
    <span className="bg-white/[0.04] border border-white/[0.12] px-1.5 py-0.5 rounded flex items-center gap-1">
      <Image
        src="/finnhub-logo.png"
        alt="Finnhub"
        width={12}
        height={12}
        style={{ width: 12, height: "auto", filter: "grayscale(1) contrast(10) invert(1)" }}
        className="object-contain"
      />
      {!iconOnly && (
        <span className="text-white/50 font-bold text-[10px]">Finnhub</span>
      )}
    </span>
  );
}
