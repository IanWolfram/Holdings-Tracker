export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Epoch ms — present for server-sourced messages (used by the signals list). */
  createdAt?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  /** "signals" is the pinned, system-managed Agent Signals conversation. */
  kind?: "chat" | "signals";
}

export interface OverviewStats {
  bookValue: number | null;
  holdingsCount: number;
  spx: { value: number; changePercent: number } | null;
  queueCount: number | null;
}

export type ScanStatus = "ok" | "warn" | "queued" | "err";

export interface ScanCard {
  kind: string;
  name: string;
  cadence: string;
  next: string;
  coverage: string;
  enabled: boolean;
  last: { at: string; status: ScanStatus; note: string };
}

export const ACCENT = "#00FF88";
