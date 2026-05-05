export const CARD_RADIUS = 8;
export const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const GROW_DURATION = 0.5;
export const HOVER_EXPAND_DELAY = 1.15;

export function getSourceColor(source?: string): string {
  if (source === "finnhub") return "#41B939";
  if (source === "polygon") return "#7B61FF";
  if (source === "newsapi") return "#94a3b8";
  return "#ffffff";
}
