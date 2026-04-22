interface Props {
  size?: number;
  className?: string;
}

export default function QuantIcon({ size = 24, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Head */}
      <circle cx="12" cy="4.8" r="2.4" stroke="currentColor" strokeWidth="1.5" />

      {/* Glasses — left lens */}
      <rect x="9.1" y="3.7" width="2.0" height="1.3" rx="0.35" stroke="currentColor" strokeWidth="1.0" />
      {/* Glasses — right lens */}
      <rect x="12.1" y="3.7" width="2.0" height="1.3" rx="0.35" stroke="currentColor" strokeWidth="1.0" />
      {/* Bridge */}
      <line x1="11.1" y1="4.35" x2="12.1" y2="4.35" stroke="currentColor" strokeWidth="1.0" />
      {/* Left temple */}
      <line x1="9.1" y1="4.35" x2="7.8" y2="4.5" stroke="currentColor" strokeWidth="1.0" />
      {/* Right temple */}
      <line x1="14.1" y1="4.35" x2="15.4" y2="4.5" stroke="currentColor" strokeWidth="1.0" />
      {/* Shine — left lens: two diagonal glints */}
      <line x1="9.8" y1="3.85" x2="10.35" y2="4.3" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.95" />
      <line x1="10.55" y1="3.85" x2="10.85" y2="4.1" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.65" />
      {/* Shine — right lens */}
      <line x1="12.8" y1="3.85" x2="13.35" y2="4.3" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.95" />
      <line x1="13.55" y1="3.85" x2="13.85" y2="4.1" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.65" />

      {/* Neck */}
      <line x1="12" y1="7.2" x2="12" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Shoulders */}
      <line x1="7.5" y1="9.3" x2="16.5" y2="9.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Suit left side */}
      <line x1="7.5" y1="9.3" x2="8.8" y2="16.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Suit right side */}
      <line x1="16.5" y1="9.3" x2="15.2" y2="16.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Jacket hem */}
      <line x1="8.8" y1="16.8" x2="15.2" y2="16.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Left lapel */}
      <polyline points="10.0,9.3 11.3,11.8 12,13.0" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Right lapel */}
      <polyline points="14.0,9.3 12.7,11.8 12,13.0" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Tie */}
      <line x1="12" y1="13.0" x2="12" y2="16.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />

      {/* Left arm — hanging at side */}
      <line x1="7.5" y1="9.3" x2="5.8" y2="14.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Left forearm / hand */}
      <line x1="5.8" y1="14.2" x2="5.2" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />

      {/* Right arm — angled down to briefcase */}
      <line x1="16.5" y1="9.3" x2="18.2" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Right forearm to handle grip */}
      <line x1="18.2" y1="13.5" x2="18.5" y2="15.0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />

      {/* Briefcase body */}
      <rect x="16.3" y="15.0" width="4.2" height="3.0" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      {/* Briefcase handle */}
      <path d="M17.3,15.0 L17.3,14.1 Q18.4,13.5 19.5,14.1 L19.5,15.0" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {/* Briefcase center bar */}
      <line x1="16.3" y1="16.5" x2="20.5" y2="16.5" stroke="currentColor" strokeWidth="0.8" />
      {/* Briefcase clasp */}
      <rect x="17.9" y="16.15" width="1.0" height="0.7" rx="0.2" stroke="currentColor" strokeWidth="0.8" />

      {/* Legs */}
      <line x1="10.5" y1="16.8" x2="9.4" y2="22.0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13.5" y1="16.8" x2="14.6" y2="22.0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Shoes */}
      <line x1="7.6" y1="22.0" x2="11.2" y2="22.0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="13.0" y1="22.0" x2="16.6" y2="22.0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
