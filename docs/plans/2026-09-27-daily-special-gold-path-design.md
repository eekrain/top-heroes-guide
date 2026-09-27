# Daily Special Path Comparison — Design

Date: 2026-09-27
Status: Approved

## Goal

Extend the Daily Special Calculator: compare paying for the daily special tiers with vouchers vs gold blocks, including the weekly +10% gold top-up bundles, so users can see the budget-optimal option.

## Confirmed mechanics

- Daily special: 2 buys/day, 40 shards/day max (tier 1 = 10 shards, tier 2 = +30; tier 2 requires tier 1 same day, any payment path)
- Voucher path: 6 vouchers (pack = Rp 60.000) for tier 1, +20 for tier 2; rewards 50 / 150 star gems
- Gold path: tier 1 = 93.000 gold, tier 2 = 310.000 gold; rewards 35 / 105 star gems
- Gold sources: IDR top-ups only. Weekly +10% bundles: 2× Rp 77.000 → 84.700 gold, 1× Rp 155.000 → 170.500, 1× Rp 310.000 → 341.000 (max 680.900 bonus gold/week for Rp 619.000 ≈ 0,909 IDR/gold); plain 1:1 top-up available without limit
- Gold persists, never expires
- Vouchers dominate every tier on both cost and gems (even vs bundle-rate gold); the tool must show this honestly

## Approach (A — scenario comparison)

One input set (target shards + optional held gold), three strategies computed simultaneously, no toggle:

1. **All Vouchers** — existing math; gems = 200/day (50 on tier-1-only final days)
2. **Gold-First** — spend held gold on tiers first (gold rewards), vouchers for the rest; never buys bundles itself (bundles can never beat vouchers for shards; document why)
3. **All Gold** — every tier via gold; per week buy bundles in ascending order as needed, remainder plain 1:1; gold and bundle caps reset weekly, leftovers persist

Day structure reuses existing logic: `tier1Count = fullDays + (rem>0)`, `tier2Count = fullDays + (rem>10)`.

## New lib: `src/lib/daily-special-strategies.ts`

- Config: tiers (vouchers/shards/gems per path/goldCost), gold bundles, pack price/size, plain rate
- `compareStrategies(target, heldGold)` → results for the 3 strategies + cheapest id
- Strategy result: cost, costPerShard, actualShards, overshoot, days, packs, bundleSpend, bundlesBought, plainTopUp, goldSpent, goldLeft, gems

## UI changes (`daily-special-calculator.tsx`)

- New "gold blocks you hold" input beside target input
- Summary line (actual shards, overshoot, days)
- Three strategy cards; "Cheapest" badge on lowest cost
- Voucher schedule table kept (labeled)
- MDX page: new gold-path sections — per-tier voucher-vs-gold table (incl. 0,909 IDR/gold effective rate), weekly bundle table, note that vouchers dominate

## Test anchors

- Gold-First with 0 held gold ≡ All Vouchers
- All Vouchers 400 → Rp 2.640.000, 2.000 gems
- All Gold 40 → bundles 619.000 spent, 277.900 gold left; 400 (2 weeks) → Rp 3.906.200, 1.400 gems
- Gold-First heldGold 403.000, target 40 → cost 0, 140 gems
- Gold-First heldGold 100.000, target 50 → cost 300.000 (5 packs), 235 gems

## Verification

bun test, types:check, lint, dev-server SSR check.
