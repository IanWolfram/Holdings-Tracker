"use client";

import { useAccountPanelLogic } from "./useAccountPanelLogic";
import { Shell } from "./Shell";
import { Header } from "./Header";
import { BrokerageCard } from "./BrokerageCard";
import { DataSourcesList } from "./DataSourcesList";
import { NotificationsSection } from "./NotificationsSection";
import { PreferencesSection } from "./PreferencesSection";
import { AccountDetailsSection } from "./AccountDetailsSection";
import { Footer } from "./Footer";

interface AccountPanelProps {
  onClose: () => void;
  isConnected: boolean;
  isConnecting: boolean;
}

export default function AccountPanel({ onClose, isConnected, isConnecting }: AccountPanelProps) {
  const logic = useAccountPanelLogic({ onClose, isConnected, isConnecting });

  return (
    <Shell>
      <Header
        initials={logic.initials}
        account={logic.account!}
        settingsEnv={logic.settings?.etrade.env}
        onClose={onClose}
        onSignOut={logic.handleSignOut}
      />
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
          position: "relative",
          zIndex: 2,
        }}
      >
        {logic.loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined text-[20px] text-slate-500 animate-spin">
              progress_activity
            </span>
          </div>
        ) : (
          <>
            <BrokerageCard
              isConnected={isConnected}
              isConnecting={isConnecting}
              expiresAt={logic.etradeExpiry?.expiresAt}
              countdown={logic.countdown}
              onReconnect={logic.handleReconnect}
              onDisconnect={logic.handleDisconnect}
            />
            <DataSourcesList
              dataSources={logic.dataSources}
              activeCount={logic.activeCount}
            />
            <NotificationsSection
              telegramConfigured={logic.settings?.telegram.configured ?? false}
            />
            <PreferencesSection
              uiMode={logic.uiMode}
              setUiMode={logic.setUiMode}
              newsCache={logic.newsCache}
              setNewsCache={logic.setNewsCache}
              positionsCache={logic.positionsCache}
              setPositionsCache={logic.setPositionsCache}
              cronOptIn={logic.preferences?.cronOptIn ?? null}
              cronSaving={logic.cronSaving}
              onCronToggle={logic.handleCronToggle}
              defaultTimescale={logic.preferences?.defaultTimescale ?? null}
              onTimescaleChange={logic.handleTimescaleChange}
              analyzedMaxAgeDays={logic.preferences?.analyzedMaxAgeDays ?? null}
              onAnalyzedAgeChange={logic.handleAnalyzedAgeChange}
            />
            {logic.account && !logic.isDev && (
              <AccountDetailsSection
                account={logic.account}
                formatDate={logic.formatDate}
                onSignOut={logic.handleSignOut}
              />
            )}
          </>
        )}
      </div>
      <Footer env={logic.settings?.etrade.env} />
    </Shell>
  );
}