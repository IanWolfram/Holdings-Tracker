import Image from "next/image";

interface RedditBadgeProps {
  author?: string;
  iconOnly?: boolean;
}

export default function RedditBadge({ author, iconOnly }: RedditBadgeProps) {
  return (
    <span className="bg-white/[0.04] border border-white/[0.12] px-1.5 py-0.5 rounded flex items-center gap-1">
      <Image
        src="/reddit-logo.png"
        alt="Reddit"
        width={21}
        height={14}
        style={{ width: "auto", height: 14, filter: "grayscale(1) contrast(10) invert(1)" }}
        className="object-contain"
      />
      {!iconOnly && (
        <span className="text-white/50 font-bold text-[10px]">
          {author ? `u/${author}` : "Reddit"}
        </span>
      )}
    </span>
  );
}
