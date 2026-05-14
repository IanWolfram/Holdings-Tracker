---
type: community
cohesion: 0.08
members: 26
---

# HTTP Client & Browser

**Cohesion:** 0.08 - loosely connected
**Members:** 26 nodes

## Members
- [[.getAccountInfo()]] - code - src/infrastructure/providers/SupabaseAccountInfoProvider.ts
- [[.getEtradeTokenExpiry()]] - code - src/infrastructure/providers/SupabaseAccountInfoProvider.ts
- [[.getMe()]] - code - lib/account/client.ts
- [[.getPreferences()]] - code - src/infrastructure/providers/SupabaseAccountInfoProvider.ts
- [[.signOut()]] - code - lib/account/client.ts
- [[.updatePreferences()]] - code - lib/account/client.ts
- [[.updatePreferences()_1]] - code - src/infrastructure/providers/SupabaseAccountInfoProvider.ts
- [[AuthLayout()]] - code - app/(auth)/layout.tsx
- [[GET()]] - code - app/auth/callback/route.ts
- [[HttpAccountClient]] - code - lib/account/client.ts
- [[IAccountInfoProvider.ts]] - code - src/domain/interfaces/IAccountInfoProvider.ts
- [[SupabaseAccountInfoProvider]] - code - src/infrastructure/providers/SupabaseAccountInfoProvider.ts
- [[SupabaseAccountInfoProvider.ts]] - code - src/infrastructure/providers/SupabaseAccountInfoProvider.ts
- [[UserAccountProvider()]] - code - components/providers/UserAccountProvider.tsx
- [[UserAccountProvider.tsx]] - code - components/providers/UserAccountProvider.tsx
- [[browser.ts]] - code - lib/supabase/browser.ts
- [[client.ts]] - code - lib/account/client.ts
- [[createClient()]] - code - lib/supabase/browser.ts
- [[createClient()_1]] - code - lib/supabase/server.ts
- [[createServiceClient()]] - code - lib/supabase/server.ts
- [[layout.tsx]] - code - app/(auth)/layout.tsx
- [[middleware()]] - code - middleware.ts
- [[middleware.ts]] - code - middleware.ts
- [[route.ts]] - code - app/auth/callback/route.ts
- [[server.ts]] - code - lib/supabase/server.ts
- [[useAccount()]] - code - components/providers/UserAccountProvider.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/HTTP_Client_&_Browser
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_Dashboard UI & Hooks]]
- 2 edges to [[_COMMUNITY_API Routes & Services]]
- 1 edge to [[_COMMUNITY_Calibration & Vault Store]]

## Top bridge nodes
- [[server.ts]] - degree 6, connects to 1 community
- [[client.ts]] - degree 4, connects to 1 community
- [[IAccountInfoProvider.ts]] - degree 4, connects to 1 community
- [[SupabaseAccountInfoProvider.ts]] - degree 4, connects to 1 community
- [[browser.ts]] - degree 3, connects to 1 community