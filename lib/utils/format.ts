/**
 * Utility functions for formatting data in the UI.
 */

/**
 * Formats a number as USD currency.
 */
export function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a number as a dual-signed percentage (e.g., +1.23% or -1.23%).
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Formats a gain/loss amount with a sign (e.g., +$100.00 or -$100.00).
 */
export function formatGainLoss(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}
