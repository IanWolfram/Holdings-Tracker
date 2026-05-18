"use client";

import type { CountryState } from "@/types/geo.types";

// ---------------------------------------------------------------------------
// Country name + emoji flag by ISO alpha-2 code
// ---------------------------------------------------------------------------

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CN: "China", TW: "Taiwan", KR: "South Korea",
  JP: "Japan", DE: "Germany", NL: "Netherlands", FR: "France",
  GB: "United Kingdom", IL: "Israel", CA: "Canada", AU: "Australia",
  IN: "India", CH: "Switzerland", SE: "Sweden", DK: "Denmark",
  NO: "Norway", FI: "Finland", BE: "Belgium", ES: "Spain",
  IT: "Italy", IE: "Ireland", SG: "Singapore", HK: "Hong Kong",
  BR: "Brazil", MX: "Mexico", RU: "Russia", SA: "Saudi Arabia",
  AE: "UAE", ZA: "South Africa", NZ: "New Zealand", ID: "Indonesia",
  MY: "Malaysia", TH: "Thailand", VN: "Vietnam", PH: "Philippines",
  PT: "Portugal", AT: "Austria", LU: "Luxembourg",
};

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CountryTooltipProps {
  state: CountryState;
  mouseX: number;
  mouseY: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CountryTooltip({ state, mouseX, mouseY }: CountryTooltipProps) {
  const countryName = COUNTRY_NAMES[state.countryCode] ?? state.countryCode;
  const flag = flagEmoji(state.countryCode);

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{ left: mouseX + 14, top: mouseY - 10, maxWidth: 320 }}
    >
      <div
        style={{
          background: "rgba(14, 20, 14, 0.92)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid rgba(0,255,136,0.18)",
          borderRadius: 12,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,255,136,0.04)",
          padding: "12px 14px",
        }}
      >
        {/* Country header */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 22, lineHeight: 1 }}>{flag}</span>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: "#e2e8f0", margin: 0 }}>
            {countryName}
          </p>
        </div>

        {/* Total amount invested */}
        {state.totalPositionValue > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: "5px 8px",
              borderRadius: 6,
              background: "rgba(0,255,136,0.04)",
              border: "1px solid rgba(0,255,136,0.09)",
              textAlign: "center",
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#00FF88" }}>
              ${state.totalPositionValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569", marginLeft: 4 }}>
              total
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
