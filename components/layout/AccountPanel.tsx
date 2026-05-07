"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { useAccount } from "@/hooks/useAccount";

const EASE = [0.22, 1, 0.36, 1] as const;

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  isConnecting: boolean;
}

function PanelSection({
  title,
  icon,
  children,
  noBorder,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div className={noBorder ? "" : "border-b border-white/[0.04]"}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span className="material-symbols-outlined text-[14px] text-slate-500">{icon}</span>
        <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">
          {title}
        </span>
      </div>
      <div className="px-4 pb-3">{children}</div>
    </div>
  );
}

function StatusRow({
  label,
  configured,
  detail,
}: {
  label: string;
  configured: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="font-mono text-[11px] text-white">{label}</span>
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${configured ? "bg-positive" : "bg-slate-600"}`}
        />
        <span className="font-mono text-[9px] text-slate-500">
          {configured ? "configured" : "missing"}
        </span>
        {detail && (
          <span className="font-mono text-[9px] text-slate-600">{detail}</span>
        )}
      </div>
    </div>
  );
}

/** Format a future ISO date string as "Xh Xm" or "Xm" countdown. */
function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function AccountPanel({
  onClose,
  isConnected,
  isConnecting,
}: AccountPanelProps) {
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
  const [countdown, setCountdown] = useState<string | null>(null);

  const isDev = account ? account.id === "dev-user-id" : false;

  // E*Trade expiry countdown
  useEffect(() => {
    const update = () => {
      const formatted = formatExpiry(etradeExpiry?.expiresAt ?? null);
      setCountdown(formatted);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [etradeExpiry?.expiresAt]);

  // ESC key close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleReconnect = async () => {
    try {
      const res = await fetch("/api/etrade/auth");
      const data = await res.json();
      if (res.ok && data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      /* ignore */
    }
  };

  const handleSendDigest = async () => {
    try {
      await fetch("/api/digest", { method: "POST" });
    } catch {
      /* ignore */
    }
  };

  const handleCronToggle = useCallback(async () => {
    if (!preferences) return;
    setCronSaving(true);
    try {
      await updatePreferences({ cronOptIn: !preferences.cronOptIn });
    } finally {
      setCronSaving(false);
    }
  }, [preferences, updatePreferences]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    window.location.href = "/login";
  }, [signOut]);

  // Initials for avatar
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

  const expiresSoon = countdown && countdown !== "expired" && !countdown.startsWith("0m") && parseInt(countdown) < 1;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2, ease: EASE }}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        zIndex: 60,
        width: 380,
        maxWidth: "calc(100vw - 48px)",
        height: "100vh",
        background: "rgba(18, 18, 20, 0.98)",
        backdropFilter: "blur(24px) saturate(170%)",
        WebkitBackdropFilter: "blur(24px) saturate(170%)",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "-12px 0 48px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 15,
                color: "#e2e8f0",
              }}
            >
              Account
            </p>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#475569",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Settings & Configuration
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/[0.06] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-400 hover:text-white">
              close
            </span>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {settingsLoading || accountLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined text-[20px] text-slate-500 animate-spin">
              progress_activity
            </span>
          </div>
        ) : (
          <>
            {/* Identity Header */}
            {account && (
              <PanelSection title="Profile" icon="person">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <span className="font-mono text-[11px] font-bold text-slate-300">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    {account.displayName && (
                      <p className="font-mono text-[12px] font-bold text-white truncate">
                        {account.displayName}
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-slate-500 truncate">
                      {account.email}
                    </p>
                  </div>
                </div>
              </PanelSection>
            )}

            {/* E*Trade Connection */}
            <PanelSection title="E*Trade Connection" icon="link">
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? "bg-positive" : "bg-slate-600"
                    }`}
                  />
                  <span className="font-mono text-[11px] text-white">
                    {isConnecting
                      ? "connecting..."
                      : isConnected
                        ? "connected"
                        : "disconnected"}
                  </span>
                </div>
                {settings && (
                  <span className="font-mono text-[9px] text-slate-500 uppercase">
                    {settings.etrade.env}
                  </span>
                )}
              </div>
              {/* Expiry countdown */}
              {countdown && (
                <div className="flex items-center justify-between py-1">
                  <span className="font-mono text-[10px] text-slate-400">Token expires in</span>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      countdown === "expired" || expiresSoon
                        ? "text-red-400"
                        : "text-slate-300"
                    }`}
                  >
                    {countdown === "expired" ? "Expired" : countdown}
                  </span>
                </div>
              )}
              <button
                onClick={handleReconnect}
                disabled={isConnecting}
                className={`mt-1 w-full py-1.5 rounded font-mono text-[10px] font-bold border transition-colors ${
                  isConnecting
                    ? "opacity-40 cursor-wait border-white/5 text-slate-600"
                    : "border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/[0.03]"
                }`}
              >
                {isConnecting ? "Connecting..." : isConnected ? "Reconnect" : "Connect E*Trade"}
              </button>
            </PanelSection>

            {/* AI Engine */}
            <PanelSection title="AI Engine" icon="psychology">
              <div className="flex items-center gap-2 px-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <div>
                  <p className="font-mono text-[11px] font-bold text-white">DeepSeek</p>
                  <p className="font-mono text-[9px] text-slate-500">deepseek-chat</p>
                </div>
              </div>
            </PanelSection>

            {/* Data Sources */}
            <PanelSection title="Data Sources" icon="database">
              {settings && (
                <div>
                  <StatusRow label="Finnhub" configured={settings.dataSources.finnhub} />
                  <StatusRow label="Polygon" configured={settings.dataSources.polygon} />
                  <StatusRow label="NewsAPI" configured={settings.dataSources.newsapi} />
                  <StatusRow label="FRED" configured={settings.dataSources.fred} />
                </div>
              )}
            </PanelSection>

            {/* Notifications */}
            <PanelSection title="Notifications" icon="notifications">
              {settings && (
                <div>
                  <StatusRow label="Telegram Bot" configured={settings.telegram.configured} />
                  {settings.telegram.configured && (
                    <button
                      onClick={handleSendDigest}
                      className="mt-2 w-full py-1.5 rounded font-mono text-[10px] font-bold border border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-colors"
                    >
                      Send Digest Now
                    </button>
                  )}
                </div>
              )}
            </PanelSection>

            {/* Preferences */}
            <PanelSection title="Preferences" icon="tune">
              {settings && (
                <div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-mono text-[11px] text-white">UI Mode</span>
                    <span className="font-mono text-[9px] text-slate-500 uppercase">
                      {settings.ui.mode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-mono text-[11px] text-white">News Cache</span>
                    <span className="font-mono text-[9px] text-slate-500">
                      {Math.round(settings.cache.newsTtlMs / 60000)}m
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-mono text-[11px] text-white">Positions Cache</span>
                    <span className="font-mono text-[9px] text-slate-500">
                      {Math.round(settings.cache.positionsTtlMs / 60000)}m
                    </span>
                  </div>
                  {/* Cron opt-in toggle */}
                  {preferences && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="font-mono text-[11px] text-white">Monthly Recalibration</span>
                      <button
                        onClick={handleCronToggle}
                        disabled={cronSaving}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          preferences.cronOptIn ? "bg-emerald-500/80" : "bg-white/[0.08]"
                        } ${cronSaving ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            preferences.cronOptIn ? "translate-x-4" : ""
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </PanelSection>

            {/* Account (Cloud Mode only) */}
            {account && !isDev && (
              <PanelSection title="Account" icon="shield" noBorder>
                {account.createdAt && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-mono text-[11px] text-white">Created</span>
                    <span className="font-mono text-[9px] text-slate-500">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {account.lastSignInAt && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-mono text-[11px] text-white">Last Sign-in</span>
                    <span className="font-mono text-[9px] text-slate-500">
                      {new Date(account.lastSignInAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <a
                    href="/reset"
                    className="flex-1 py-1.5 rounded font-mono text-[10px] font-bold border border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-colors text-center"
                  >
                    Change Password
                  </a>
                  <button
                    onClick={handleSignOut}
                    className="flex-1 py-1.5 rounded font-mono text-[10px] font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </PanelSection>
            )}

            {/* Environment */}
            <PanelSection title="Environment" icon="info" noBorder>
              {settings && (
                <div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-mono text-[11px] text-white">Platform</span>
                    <span className="font-mono text-[9px] text-slate-500">
                      {settings.ai.supportsLocalMlx ? "Apple Silicon (MLX)" : "Cloud Only"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-mono text-[11px] text-white">AI Model</span>
                    <span className="font-mono text-[9px] text-slate-500">
                      {settings.ai.activeModel}
                    </span>
                  </div>
                </div>
              )}
            </PanelSection>
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: "#1e293b",
            textAlign: "center",
            letterSpacing: "0.05em",
          }}
        >
          ESC OR CLICK OUTSIDE TO DISMISS
        </p>
      </div>
    </motion.div>
  );
}