import { useCallback, useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  ticker: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const POLL_MS = 30_000;

/**
 * Polls /api/notifications, exposing the latest unread item (for the TopBar
 * speech bubble), the unread count, and a markRead helper. Pauses polling while
 * the tab is hidden, matching the other TopBar polling hooks.
 */
export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await authedFetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: NotificationItem[] };
      setItems(data.notifications ?? []);
    } catch {
      // ignore — transient
    }
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic: drop from local state immediately so the bubble dismisses.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      try {
        await authedFetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        // ignore — next poll reconciles
      }
    },
    [],
  );

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  const unread = items.filter((n) => !n.read_at);
  return { latestUnread: unread[0] ?? null, unreadCount: unread.length, markRead, refresh };
}
