import React from "react";

export default function CongressHeader() {
  return (
    <span className="flex items-center gap-1">
      <span className="material-symbols-outlined text-[15px]" style={{ color: "#b45309" }}>
        gavel
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#b45309" }}>
        Congress
      </span>
    </span>
  );
}
