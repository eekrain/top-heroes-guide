# Shard Calculator Page — Design

Date: 2026-09-27
Status: Approved

## Goal

A docs page at `/docs/shard-calculator` for the Top Heroes Daily Deal shard calculator: input a target number of hero shards, get the required vouchers, packs, days, and total IDR cost.

## Game Mechanics (confirmed)

- Pack: Rp 60.000 → 6 Daily Special Activation Vouchers
- Daily cap: 26 vouchers usable per day, two all-or-nothing sequential tiers:
  - Tier 1: 6 vouchers → 10 shards
  - Tier 2: 20 more vouchers → 30 more shards (full day = 26 vouchers → 40 shards)
- Daily outcomes are only 0, 10, or 40 shards
- Unused vouchers carry over to the next day

## Approach

Fumadocs MDX page + embedded interactive client component (Approach A).

- `content/docs/shard-calculator.mdx` — explainer content + `<ShardCalculator />`
- `src/lib/shard-calculator.ts` — config + pure calculation
- `src/components/shard-calculator.tsx` — client UI
- Registered in `getMDXComponents` (`src/components/mdx.tsx`)

Rejected: standalone route (disconnected from docs nav), static tables (not interactive).

## Config

```ts
const DEAL = {
  currency: 'IDR',
  packSize: 6,
  packPrice: 60000,
  tiers: [
    { vouchers: 6, shards: 10 },
    { vouchers: 20, shards: 30 },
  ],
}
```

IDR-first; other currencies are a config addition later.

## Calculation — `calculateShardPlan(target)`

Semantics: cheapest plan to reach **at least** `target` shards (overshoot allowed, tiers are all-or-nothing).

1. `fullDays = floor(target / 40)`
2. Final day: remainder 1–10 → tier 1 (10 shards, 6 vouchers); remainder 11–39 → full day (40 shards, 26 vouchers, overshoot); remainder 0 → no extra day
3. `totalVouchers` sums daily vouchers; `packs = ceil(totalVouchers / 6)` (carryover); `cost = packs × 60000`
4. Returns: days, packs, cost, actual shards, overshoot, leftover vouchers, cost-per-shard, compressed per-day schedule ("Day 1–9: 26 → 40", "Day 10: 6 → 10")

Sanity examples:
- 400 shards → 10 full days → 260 vouchers → 44 packs → Rp 2.640.000, 4 leftover
- 50 shards → 1 full day + tier-1 day → 32 vouchers → 6 packs → Rp 360.000
- 20 shards → remainder 11–39 → full day → 26 vouchers → 5 packs → Rp 300.000, actual 40 (overshoot +20)

Unit economics: tier 1 alone = Rp 6.000/shard; steady-state full days with carryover ≈ Rp 6.500/shard.

## UI

- Number input + presets (40 / 120 / 200 / 400), Tailwind v4
- Result cards: Total cost, Days, Packs, Rp/shard; rows: actual shards (overshoot badge), vouchers used, leftovers
- Compressed schedule table
- IDR via `Intl.NumberFormat('id-ID')`
- SSR-safe deterministic default state (no RSC split on TanStack Start)

## Content Page

MDX frontmatter (title "Shard Calculator", icon), deal mechanics explainer, tier table, unit economics section, then the calculator component.

## Verification

- `bun run types:check`, `bun run lint`
- `bun -e` assertions on `calculateShardPlan` for the sanity examples
- Visual check via `bun run dev`
