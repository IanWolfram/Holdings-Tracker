import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { useAccount } from "@/hooks/useAccount";
import { CACHE_STEPS } from "./primitives";

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
    updatePreferences,
    signOut,
    loading: accountLoading,
  } = useAccount();

  const [cronSaving, setCronSaving] = useState(false);
  const [uiMode, setUiMode] = useState("compact");
  const [newsCache, setNewsCache] = useState(5);
  const [positionsCache, setPositionsCache] = useState(60);

  interface SnapTradeAccount {
    id?: string;
    name?: string | null;
    number?: string | null;
    type?: string | null;
    balance?: number | null;
  }
  interface SnapTradeConnection {
    id?: string;
    name: string;
    slug?: string | null;
    logo?: string | null;
    disabled: boolean;
    accounts: SnapTradeAccount[];
    totalBalance: number | null;
  }
  interface SnapTradeStatus {
    configured: boolean;
    registered: boolean;
    connected: boolean;
    connections: SnapTradeConnection[];
  }
  const [snapTradeStatus, setSnapTradeStatus] = useState<SnapTradeStatus | null>(null);
  const [snapTradeConnecting, setSnapTradeConnecting] = useState(false);

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

  const handleTimescaleChange = useCallback(
    async (next: string) => {
      await updatePreferences({ defaultTimescale: next });
    },
    [updatePreferences],
  );

  const handleAnalyzedAgeChange = useCallback(
    async (next: number) => {
      await updatePreferences({ analyzedMaxAgeDays: next });
    },
    [updatePreferences],
  );

  const refreshSnapTradeStatus = useCallback(async () => {
    try {
      const res = await authedFetch("/api/snaptrade/status");
      if (res.ok) setSnapTradeStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshSnapTradeStatus();
  }, [refreshSnapTradeStatus]);

  const handleConnectSnapTrade = useCallback(async () => {
    setSnapTradeConnecting(true);
    try {
      const res = await authedFetch("/api/snaptrade/connect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.redirectURI) {
        // Open the SnapTrade connection portal; refresh status when the user
        // returns to the app (portal opens in a new tab).
        const win = window.open(data.redirectURI, "_blank", "noopener,noreferrer");
        window.addEventListener("focus", () => refreshSnapTradeStatus(), { once: true });
        if (!win) window.location.href = data.redirectURI;
      } else {
        window.alert(data.error ?? "Could not start SnapTrade connection.");
      }
    } catch {
      window.alert("Could not start SnapTrade connection.");
    } finally {
      setSnapTradeConnecting(false);
    }
  }, [refreshSnapTradeStatus]);

  const handleDisconnectSnapTrade = useCallback(async () => {
    if (!confirm("Disconnect SnapTrade? This removes all linked brokerage connections.")) return;
    try {
      const res = await authedFetch("/api/snaptrade/disconnect", { method: "POST" });
      if (res.ok) {
        await refreshSnapTradeStatus();
        window.location.reload();
      }
    } catch {
      /* ignore */
    }
  }, [refreshSnapTradeStatus]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    window.location.href = "/login";
  }, [signOut]);

  const handleDeleteAccount = useCallback(async () => {
    const email = account?.email;
    if (!email) return;
    const typed = window.prompt(
      `This permanently deletes your account and all data. This cannot be undone.\n\nType your email (${email}) to confirm:`,
    );
    if (!typed || typed.trim().toLowerCase() !== email.toLowerCase()) {
      if (typed !== null) window.alert("Email did not match — account not deleted.");
      return;
    }
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed.trim() }),
      });
      if (res.ok) {
        window.location.href = "/login";
      } else {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Failed to delete account. Please try again.");
      }
    } catch {
      window.alert("Failed to delete account. Please try again.");
    }
  }, [account?.email]);

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
    settings,
    isDev,
    initials,
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
    handleTimescaleChange,
    handleAnalyzedAgeChange,
    handleSignOut,
    handleDeleteAccount,
    snapTradeStatus,
    snapTradeConnecting,
    handleConnectSnapTrade,
    handleDisconnectSnapTrade,
  };
}

export type AccountPanelLogic = ReturnType<typeof useAccountPanelLogic>;