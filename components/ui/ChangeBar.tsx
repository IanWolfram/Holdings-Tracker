import React from "react";

interface ChangeBarProps {
  pct: number;
}

export default function ChangeBar({ pct }: ChangeBarProps) {
  const abs = Math.min(Math.abs(pct), 20);
  const positive = pct >= 0;

  return (
    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${(abs / 20) * 100}%`,
          backgroundColor: positive ? "#00FF88" : "#FF4444",
          boxShadow: positive
            ? "0 0 6px rgba(0,255,136,0.4)"
            : "0 0 6px rgba(255,68,68,0.4)",
        }}
      />
    </div>
  );
}
