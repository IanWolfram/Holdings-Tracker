import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { useAccount } from "@/hooks/useAccount";
import { CACHE_STEPS, formatCountdown } from "./primitives";

interface AccountPanelLogicParams {
  onClose: () => void;
  isConnected: boolean;
  isConnecting: boolean;
}

export function useAccountPanelLogic({ onClose }: AccountPanelLogicParams) {
  const { settings, loading: settingsLoading } = useAccountSettings();
  const {
    account,
    preferences,
    etradeExpiry,
    updatePreferences,
    signOut,
    loading: accountLoading,
  } = useAccount();

  const [cronSaving, setCronSaving] = useState(false);
  const [uiMode, setUiMode] = useState("compact");
  const [newsCache, setNewsCache] = useState(5);
  const [positionsCache, setPositionsCache] = useState(60);

  const isDev = account ? account.id === "dev-user-id" : false;

  useEffect(() => {
    if (settings) {
      setUiMode(settings.ui.mode);
      setNewsCache(Math.round(settings.cache.newsTtlMs / 60_000));
      setPositionsCache(Math.round(settings.cache.positionsTtlMs / 60_000));
    }
  }, [settings]);

  useEffect(() => {
    const snap = (val: number): number => {
      let best: number = CACHE_STEPS[0];
      for (const s of CACHE_STEPS) {
        if (Math.abs(s - val) < Math.abs(best - val)) best = s;
      }
      return best;
    };
    setNewsCache((v) => snap(v));
    setPositionsCache((v) => snap(v));
  }, []);

  const handleCronToggle = useCallback(async () => {
    if (!preferences) return;
    setCronSaving(true);
    try {
      await updatePreferences({ cronOptIn: !preferences.cronOptIn });
    } finally {
      setCronSaving(false);
    }
  }, [preferences, updatePreferences]);

  const handleReconnect = async () => {
    try {
      const res = await authedFetch("/api/etrade/auth");
      const data = await res.json();
      if (res.ok && data.authUrl) {
        window.open(data.authUrl, "_blank", "noopener,noreferrer");
        window.location.href = "/etrade-verify";
      }
    } catch {
      /* ignore */
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect E*TRADE? You'll need to re-authorize to reconnect.")) return;
    try {
      const res = await fetch("/api/etrade/disconnect", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      /* ignore */
    }
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    window.location.href = "/login";
  }, [signOut]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const initials = account?.displayName
    ? account.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : account?.email
      ? account.email[0].toUpperCase()
      : "?";

  const countdown = formatCountdown(etradeExpiry?.expiresAt ?? null);

  const dataSources = settings
    ? [
        { name: "Finnhub", configured: settings.dataSources.finnhub },
        { name: "Polygon", configured: settings.dataSources.polygon },
        { name: "NewsAPI", configured: settings.dataSources.newsapi },
        { name: "FRED", configured: settings.dataSources.fred },
      ]
    : [];
  const activeCount = dataSources.filter((d) => d.configured).length;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1} / ${d.getDate()} / ${d.getFullYear()}`;
  };

  const loading = settingsLoading || accountLoading;

  return {
    account,
    preferences,
    etradeExpiry,
    settings,
    isDev,
    initials,
    countdown,
    dataSources,
    activeCount,
    formatDate,
    loading,
    cronSaving,
    uiMode,
    setUiMode,
    newsCache,
    setNewsCache,
    positionsCache,
    setPositionsCache,
    handleCronToggle,
    handleReconnect,
    handleDisconnect,
    handleSignOut,
  };
}

export type AccountPanelLogic = ReturnType<typeof useAccountPanelLogic>;