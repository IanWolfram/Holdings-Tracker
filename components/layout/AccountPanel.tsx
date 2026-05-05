"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { useAccountSettings } from "@/hooks/useAccountSettings";

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

export default function AccountPanel({
  onClose,
  isConnected,
  isConnecting,
}: AccountPanelProps) {
  const { settings, loading } = useAccountSettings();

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
      await fetch("/api/etrade/trigger-terminal-auth");
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined text-[20px] text-slate-500 animate-spin">
              progress_activity
            </span>
          </div>
        ) : (
          <>
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
                </div>
              )}
            </PanelSection>

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