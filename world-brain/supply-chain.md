---
type: supply-chain-source
edges:
  - from: PLTR
    to: NVDA
    via: GPU compute for AI Foundry workloads
  - from: PLTR
    to: AWS
    via: cloud hosting for government and commercial deployments
  - from: PLTR
    to: AZURE
    via: alternative cloud for FedRAMP government tenants
  - from: NVDA
    to: TSMC
    via: leading-edge chip fabrication
  - from: NVDA
    to: ASML
    via: EUV lithography upstream of TSMC
  - from: HOOD
    to: CITADEL
    via: payment-for-order-flow market making
  - from: HOOD
    to: APEX
    via: clearing and custody (legacy retail flow)
  - from: HOOD
    to: BTC
    via: crypto trading revenue concentration
  - from: MDB
    to: AWS
    via: Atlas hosting (largest revenue driver)
  - from: MDB
    to: AZURE
    via: Atlas multi-cloud expansion
  - from: MDB
    to: GCP
    via: Atlas multi-cloud expansion
  - from: CHKP
    to: NVDA
    via: GPU acceleration for ThreatCloud AI inference
  - from: CHKP
    to: TSMC
    via: indirect — appliance silicon supply
  - from: MMS
    to: STATE-MEDICAID
    via: managed service contracts (concentration risk)
  - from: MMS
    to: CMS
    via: federal Medicaid rule-making upstream
---

# Supply Chain Source — Hand Curated

This file is the hand-curated source of upstream/downstream dependencies for tracked tickers. The renderer in `world-brain/graph.ts:updateSupplyChainGraph` produces `world-vault/_graph/supply-chain.md` from the frontmatter above.

## Editing rules

1. Each edge is a directed `from → to` link with a short `via` reason.
2. Use ticker symbols (e.g. `PLTR`, `NVDA`) when both ends are tracked tickers — the renderer auto-links them as `[[TICKER]]`.
3. Use uppercase-but-non-ticker tokens (e.g. `AWS`, `TSMC`, `STATE-MEDICAID`) for non-public counterparties; renderer leaves them as plain text.
4. Keep `via` under ~80 characters — it shows in Obsidian hover preview.

## Why edges matter

The brain reads supply-chain context indirectly through Obsidian's graph view (operators) and directly through the Phase 3 system prompt (planned). When a TSMC fab outage hits the news, the brain should know NVDA → PLTR/CHKP downstream.
