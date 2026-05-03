import { useCallback, useEffect, useState } from "react";

export interface AccountSettings {
  etrade: { env: string };
  ai: { activeModel: string; activeProvider: string; supportsLocalMlx: boolean; hasKey: boolean };
  dataSources: { finnhub: boolean; polygon: boolean; twitter: boolean; newsapi: boolean; fred: boolean };
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
      const res = await fetch("/api/settings");
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