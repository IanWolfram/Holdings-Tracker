import Image from "next/image";

interface XBadgeProps {
  author?: string;
}

export default function XBadge({ author }: XBadgeProps) {
  return (
    <span className="bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/20 flex items-center gap-1">
      <Image
        src="/x-logo.png"
        alt="X"
        width={12}
        height={12}
        style={{ width: 12, height: "auto" }}
        className="object-contain invert"
      />
      <span className="text-white font-bold">
        {author ? `@${author}` : "Twitter"}
      </span>
    </span>
  );
}
