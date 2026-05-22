import type { CSSProperties } from "react";

export function Icon({
  name,
  size = 20,
  color,
  style,
  className,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={"material-symbols-outlined" + (className ? " " + className : "")}
      style={{ fontSize: size, ...(color ? { color } : {}), ...style }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function AgentBrainIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className || ""}`}
      style={{
        fontSize: size,
        lineHeight: `${size}px`,
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "currentColor",
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
      aria-hidden="true"
    >
      neurology
    </span>
  );
}
