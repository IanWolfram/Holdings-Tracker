interface PolygonBadgeProps {
  iconOnly?: boolean;
}

export default function PolygonBadge({ iconOnly }: PolygonBadgeProps) {
  return (
    <span className="bg-white/[0.04] border border-white/[0.12] px-1.5 py-0.5 rounded flex items-center gap-1">
      <span className="w-3 h-3 rounded-sm bg-[#7B61FF]/80 flex items-center justify-center text-white text-[7px] font-bold leading-none">P</span>
      {!iconOnly && (
        <span className="text-white/50 font-bold text-[10px]">Polygon</span>
      )}
    </span>
  );
}