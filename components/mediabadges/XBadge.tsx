import Image from "next/image";

interface XBadgeProps {
  author?: string;
  iconOnly?: boolean;
}

export default function XBadge({ author, iconOnly }: XBadgeProps) {
  return (
    <span className="bg-white/[0.04] border border-white/[0.12] px-1.5 py-0.5 rounded flex items-center gap-1">
      <Image
        src="/x-logo.png"
        alt="X"
        width={11}
        height={11}
        style={{ width: 11, height: "auto", filter: "grayscale(1) contrast(10) invert(1)" }}
        className="object-contain"
      />
      {!iconOnly && (
        <span className="text-white/50 font-bold text-[10px]">
          {author ? `@${author}` : "X"}
        </span>
      )}
    </span>
  );
}
