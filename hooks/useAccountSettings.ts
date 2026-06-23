import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";

export interface AccountSettings {
  ai: { activeModel: string; activeProvider: string; hasKey: boolean };
  dataSources: { finnhub: boolean; polygon: boolean; newsapi: boolean; fred: boolean };
  telegram: { configured: boolean };
  ui: { mode: string };
  cache: { newsTtlMs: number; positionsTtlMs: number };
}

export function useAccountSettings() {
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, refetch: fetchSettings };
}