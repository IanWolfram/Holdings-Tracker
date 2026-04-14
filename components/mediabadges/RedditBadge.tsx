interface RedditBadgeProps {
  author?: string;
}

export default function RedditBadge({ author }: RedditBadgeProps) {
  return (
    <span className="bg-[#FF4500]/10 border border-[#FF4500]/50 px-1.5 py-0.5 rounded flex items-center gap-1">
      {/* Reddit alien (Snoo) SVG */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Body */}
        <ellipse cx="10" cy="11.5" rx="6.5" ry="5" fill="#FF4500" />
        {/* Head */}
        <circle cx="10" cy="7" r="4" fill="#FF4500" />
        {/* Ears */}
        <circle cx="5.8" cy="9" r="1.5" fill="#FF4500" />
        <circle cx="14.2" cy="9" r="1.5" fill="#FF4500" />
        {/* Eyes */}
        <circle cx="8.2" cy="6.8" r="0.9" fill="white" />
        <circle cx="11.8" cy="6.8" r="0.9" fill="white" />
        <circle cx="8.4" cy="6.9" r="0.4" fill="#1A1A1B" />
        <circle cx="12" cy="6.9" r="0.4" fill="#1A1A1B" />
        {/* Smile */}
        <path
          d="M 7.8 8.4 Q 10 9.8 12.2 8.4"
          stroke="white"
          strokeWidth="0.7"
          strokeLinecap="round"
          fill="none"
        />
        {/* Antenna */}
        <circle cx="13.5" cy="3" r="1.2" fill="#FF4500" />
        <line x1="10" y1="3.2" x2="13" y2="3" stroke="#FF4500" strokeWidth="0.8" />
        {/* Legs */}
        <ellipse cx="7" cy="15.8" rx="2" ry="1" fill="#FF4500" />
        <ellipse cx="13" cy="15.8" rx="2" ry="1" fill="#FF4500" />
        {/* Arms */}
        <ellipse cx="4.2" cy="12.5" rx="1.2" ry="0.7" fill="#FF4500" transform="rotate(-30 4.2 12.5)" />
        <ellipse cx="15.8" cy="12.5" rx="1.2" ry="0.7" fill="#FF4500" transform="rotate(30 15.8 12.5)" />
      </svg>
      <span className="text-[#FF4500] font-bold">
        {author ? `u/${author}` : "Reddit"}
      </span>
    </span>
  );
}
