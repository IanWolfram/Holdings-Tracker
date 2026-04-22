import React from "react";

interface SectorIconProps {
  children: React.ReactNode;
  c: string;
  vb?: string;
}

function SectorIcon({ children, c, vb = "0 0 24 24" }: SectorIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox={vb}
      fill="none"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const SECTOR_ICONS: Record<string, React.ReactNode> = {
  Semiconductors: (
    <SectorIcon c="#7a9ec4">
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M9 7V4M12 7V4M15 7V4M9 17v3M12 17v3M15 17v3M7 9H4M7 12H4M7 15H4M17 9h3M17 12h3M17 15h3" />
    </SectorIcon>
  ),
  Technology: (
    <SectorIcon c="#8c9eb4">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </SectorIcon>
  ),
  Healthcare: (
    <SectorIcon c="#b87070">
      <path d="M12 2v20M2 12h20" />
    </SectorIcon>
  ),
  Agriculture: (
    <SectorIcon c="#b89a44">
      <path d="M7.5 6L9 22" strokeWidth="1.1" />
      <path d="M9.5 6L10.5 22" strokeWidth="1.1" />
      <path d="M12 6L12 22" strokeWidth="1.1" />
      <path d="M14.5 6L13.5 22" strokeWidth="1.1" />
      <path d="M16.5 6L15 22" strokeWidth="1.1" />
      <path d="M8.5 13Q12 14 15.5 13" strokeWidth="1.5" />
      <path d="M8.5 15.5Q12 16.5 15.5 15.5" strokeWidth="1.5" />
      <path d="M7.5 6V3.5 M7.5 4.5L6.2 2.5 M7.5 4.5L8.8 2.5" strokeWidth="1" />
      <path d="M9.5 6V3.5 M9.5 4.5L8.2 2.5 M9.5 4.5L10.8 2.5" strokeWidth="1" />
      <path d="M12 6V3.5 M12 4.5L10.7 2.5 M12 4.5L13.3 2.5" strokeWidth="1" />
      <path d="M14.5 6V3.5 M14.5 4.5L13.2 2.5 M14.5 4.5L15.8 2.5" strokeWidth="1" />
      <path d="M16.5 6V3.5 M16.5 4.5L15.2 2.5 M16.5 4.5L17.8 2.5" strokeWidth="1" />
    </SectorIcon>
  ),
  Energy: (
    <SectorIcon c="#c49050">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z" />
    </SectorIcon>
  ),
  Financials: (
    <SectorIcon c="#7aaa84">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </SectorIcon>
  ),
  "Financial Services": (
    <SectorIcon c="#7aaa84">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </SectorIcon>
  ),
  "Consumer Discretionary": (
    <SectorIcon c="#9484b8">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </SectorIcon>
  ),
  "Consumer Staples": (
    <SectorIcon c="#5e9898">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </SectorIcon>
  ),
  Industrials: (
    <SectorIcon c="#7a8ea6">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </SectorIcon>
  ),
  Materials: (
    <SectorIcon c="#5a96a6">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2a10 10 0 0 1 0 20" />
      <path d="M12 2a10 10 0 0 0 0 20" />
      <path d="M2 12h20" />
    </SectorIcon>
  ),
  "Real Estate": (
    <SectorIcon c="#a87e5a">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </SectorIcon>
  ),
  Utilities: (
    <SectorIcon c="#a8a040">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </SectorIcon>
  ),
  "Communication Services": (
    <SectorIcon c="#7878b4">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02Z" />
    </SectorIcon>
  ),
  Unclassified: (
    <SectorIcon c="#607090">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </SectorIcon>
  ),
};
