export const CARD_RADIUS = 8;
export const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const GROW_DURATION = 0.5;

export function getSourceColor(source?: string): string {
  if (source === "finnhub") return "#00FF88";
  if (source === "reddit") return "#FF4500";
  return "#ffffff";
}
