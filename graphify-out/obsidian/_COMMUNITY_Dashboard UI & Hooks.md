---
type: community
cohesion: 0.04
members: 75
---

# Dashboard UI & Hooks

**Cohesion:** 0.04 - loosely connected
**Members:** 75 nodes

## Members
- [[AccountIconDiv.tsx]] - code - components/layout/AccountIconDiv.tsx
- [[AccountPanel.tsx]] - code - components/layout/AccountPanel.tsx
- [[AccountSummary.tsx]] - code - components/layout/AccountSummary.tsx
- [[AddProposedCard.tsx]] - code - components/cards/AddProposedCard.tsx
- [[AgentTrigger()]] - code - components/triggers/AgentTrigger.tsx
- [[AgentTrigger.tsx]] - code - components/triggers/AgentTrigger.tsx
- [[ChangeBar.tsx]] - code - components/ui/ChangeBar.tsx
- [[CheckEmailForm()]] - code - app/(auth)/check-email/page.tsx
- [[ConnectionControls.tsx]] - code - components/layout/ConnectionControls.tsx
- [[DesktopDashboard.tsx]] - code - components/layout/DesktopDashboard.tsx
- [[EmptyState.tsx]] - code - components/layout/EmptyState.tsx
- [[MobileBottomNav()]] - code - components/mobile/MobileBottomNav.tsx
- [[MobileBottomNav.tsx]] - code - components/mobile/MobileBottomNav.tsx
- [[MobileDashboard.tsx]] - code - components/mobile/MobileDashboard.tsx
- [[MobileHeader()]] - code - components/mobile/MobileHeader.tsx
- [[MobileHeader.tsx]] - code - components/mobile/MobileHeader.tsx
- [[PanelSection()]] - code - components/layout/AccountPanel.tsx
- [[RootPage()]] - code - app/page.tsx
- [[SearchParamsWatcher()]] - code - components/layout/TopBar.tsx
- [[StatusRow()]] - code - components/layout/AccountPanel.tsx
- [[TickerRow.tsx]] - code - components/positions/TickerRow.tsx
- [[TopBar.tsx]] - code - components/layout/TopBar.tsx
- [[TopBarDivider()]] - code - components/layout/TopBarDivider.tsx
- [[TopBarDivider.tsx]] - code - components/layout/TopBarDivider.tsx
- [[TopBarNavItem()]] - code - components/layout/TopBarNavItem.tsx
- [[TopBarNavItem.tsx]] - code - components/layout/TopBarNavItem.tsx
- [[WorldPage()]] - code - app/world/page.tsx
- [[authedFetch()]] - code - lib/api/client-fetch.ts
- [[checkStatus()]] - code - components/layout/TopBar.tsx
- [[client-fetch.ts]] - code - lib/api/client-fetch.ts
- [[deleteConversation()]] - code - app/agent/page.tsx
- [[fetchState()]] - code - hooks/useAgentStatus.ts
- [[formatCountdown()]] - code - lib/marketHours.ts
- [[formatRelativeTime()]] - code - app/agent/page.tsx
- [[getMarketStatus()]] - code - lib/marketHours.ts
- [[handleCancel()]] - code - components/cards/AddProposedCard.tsx
- [[handleInputChange()]] - code - components/cards/AddProposedCard.tsx
- [[handleKeyDown()_1]] - code - components/cards/AddProposedCard.tsx
- [[handleKeyDown()]] - code - app/agent/page.tsx
- [[handleSubmit()_1]] - code - components/cards/AddProposedCard.tsx
- [[handleSubmit()]] - code - app/(auth)/login/page.tsx
- [[handler()]] - code - app/agent/page.tsx
- [[loadConversations()]] - code - app/agent/page.tsx
- [[marketHours.ts]] - code - lib/marketHours.ts
- [[minutesFromMidnight()]] - code - lib/marketHours.ts
- [[newConversation()]] - code - app/agent/page.tsx
- [[nyParts()]] - code - lib/marketHours.ts
- [[onFocus()]] - code - app/(auth)/etrade-verify/page.tsx
- [[page.tsx]] - code - app/(auth)/login/page.tsx
- [[readStorage()]] - code - hooks/useProposedPositions.ts
- [[saveConversations()]] - code - app/agent/page.tsx
- [[schedule()]] - code - hooks/useAgentStatus.ts
- [[startAuth()]] - code - components/layout/ConnectionControls.tsx
- [[startNewChat()]] - code - app/agent/page.tsx
- [[startPolling()]] - code - hooks/useAgentStatus.ts
- [[stopPolling()]] - code - hooks/useAgentStatus.ts
- [[switchConversation()]] - code - app/agent/page.tsx
- [[useAccount.ts]] - code - hooks/useAccount.ts
- [[useAccountSettings()]] - code - hooks/useAccountSettings.ts
- [[useAccountSettings.ts]] - code - hooks/useAccountSettings.ts
- [[useAgentStatus()]] - code - hooks/useAgentStatus.ts
- [[useAgentStatus.ts]] - code - hooks/useAgentStatus.ts
- [[useCongressTrades()]] - code - hooks/useCongressTrades.ts
- [[useCongressTrades.ts]] - code - hooks/useCongressTrades.ts
- [[useDashboardData()]] - code - hooks/useDashboardData.ts
- [[useDashboardData.ts]] - code - hooks/useDashboardData.ts
- [[useHotTickers()]] - code - hooks/useHotTickers.ts
- [[useHotTickers.ts]] - code - hooks/useHotTickers.ts
- [[useMarketStatus()]] - code - hooks/useMarketStatus.ts
- [[useMarketStatus.ts]] - code - hooks/useMarketStatus.ts
- [[useProposedPositions()]] - code - hooks/useProposedPositions.ts
- [[useProposedPositions.ts]] - code - hooks/useProposedPositions.ts
- [[useWorldData()]] - code - hooks/useWorldData.ts
- [[useWorldData.ts]] - code - hooks/useWorldData.ts
- [[writeStorage()]] - code - hooks/useProposedPositions.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Dashboard_UI_&_Hooks
SORT file.name ASC
```

## Connections to other communities
- 7 edges to [[_COMMUNITY_Position Cards & News UI]]
- 6 edges to [[_COMMUNITY_Classification & Congress]]
- 5 edges to [[_COMMUNITY_3D Globe Renderer]]
- 5 edges to [[_COMMUNITY_Cache Infrastructure]]
- 3 edges to [[_COMMUNITY_Vault & Constants]]
- 3 edges to [[_COMMUNITY_Agent Orchestration]]
- 2 edges to [[_COMMUNITY_News Backfill Scripts]]
- 2 edges to [[_COMMUNITY_HTTP Client & Browser]]
- 1 edge to [[_COMMUNITY_Calibration & Vault Store]]

## Top bridge nodes
- [[DesktopDashboard.tsx]] - degree 10, connects to 5 communities
- [[useDashboardData.ts]] - degree 9, connects to 5 communities
- [[page.tsx]] - degree 30, connects to 3 communities
- [[MobileDashboard.tsx]] - degree 9, connects to 3 communities
- [[TickerRow.tsx]] - degree 6, connects to 3 communities