# Daily Special Gold Path — Revision 1 (corrected bundle math)

Date: 2026-09-27
Status: Approved (replaces the bundle model in 2026-09-27-daily-special-gold-path-design.md)

## Correction

The weekly deals are **+110% bonus** (2.1× gold per IDR), not +10%:

| Bundle | Pay        | Base     | Bonus    | Total gold | Per week |
| ------ | ---------- | -------- | -------- | ---------- | -------- |
| Small  | Rp 77.000  | 77.000   | 84.700   | 161.700    | 2        |
| Medium | Rp 155.000 | 155.000  | 170.500  | 325.500    | 1        |
| Large  | Rp 310.000 | 310.000  | 341.000  | 651.000    | 1        |

Weekly capacity: 1.299.900 gold for Rp 619.000 (≈ Rp 0,476/gold).

## Consequences

- Tier 1 via bonus gold ≈ Rp 44.286 vs vouchers Rp 60.000 → gold cheaper, 35 vs 50 gems
- Tier 2 via bonus gold ≈ Rp 147.619 vs ≈ Rp 200.000 → gold cheaper, 105 vs 150 gems
- Plain 1:1 gold still loses to vouchers (93k > 60k; 310k > 200k) — never used for tiers
- Vouchers no longer dominate; the cheapest plan mixes bundle-bought gold + vouchers, and star gems are the trade-off

## Strategy set (renamed)

1. **All Vouchers** — unchanged math
2. **Cheapest Mix** (was Gold-First) — held gold + optimal weekly bundle purchases + vouchers for the rest; pure IDR minimization
3. **All Gold** — weekly bundles ascending + plain 1:1 remainder (shows the plain-gold trap)

## Cheapest Mix algorithm

Because bundle gold is atomic (93k/310k tier chunks) and vouchers have 6-pack
granularity with global carryover, greedy rules strand gold. Instead:

- Enumerate **all weekly bundle purchase combinations** (12 subsets/week,
  plans ≤ 5 weeks ⇒ ≤ 248.832 combos; larger plans fall back to incremental
  greedy) — each week's purchases available from that week's day 1, leftovers carry forward
- Allocation per candidate: each week's tiers fill gold **tier-2-first** (bigger
  chunks first), then tier-1s; remaining tiers pay vouchers (global pool,
  `ceil(Σvouchers/6)` packs)
- Cost = Σ bundle prices + pack cost; pick min cost, tie-break more gems, then
  less leftover gold, then enumeration order

Hand-verified anchors:
- Target 40: Cheapest = 2× Small (Rp 154.000) → t2 gold, t1 voucher ⇒ **Rp 214.000**,
  155 gems, 13.400 gold left (vs vouchers 300.000 / all-gold 309.000)
- Target 50 + 100.000 held: **Rp 214.000**, 190 gems, 20.400 gold left
- Target 400: All Gold = Rp 2.759.100 (bundles 1.238.000 + plain 1.521.100); Cheapest ≤ 2.258.000
  (all-bundles bound; exact optimum found by search, asserted after implementation)

## Files

- `src/lib/daily-special-strategies.ts` — new bundle table, `cheapestMixPlan`, renamed ids/labels
- Tests recomputed; component cards relabeled; MDX economics rewritten

## Revision 2 (same day)

- **All Gold strategy removed** — a full all-gold week needs 2.821.000 gold but bundles cap at 1.299.900/week (≈3,2 days); the shortfall would use plain 1:1 top-ups which always lose to vouchers. Achievable only by overpaying; dropped as noise.
- **Unit economics section removed** — user finds it confusing; per-shard rates live only in the calculator cards.
- Page restructured for readability: intro → calculator on top → "How the daily special works" (plain bullets) → "Costs side by side" (one compact table) → "Weekly gold bundles" (table + cap note). Consistent "Daily Special" wording; component shows 2 cards.
