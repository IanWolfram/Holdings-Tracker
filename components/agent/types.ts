export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
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
