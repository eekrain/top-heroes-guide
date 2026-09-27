# Daily Special Gold Path Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the Daily Special Calculator with three simultaneously-computed strategies (All Vouchers / Gold-First / All Gold), a held-gold input, and gold-path economics content.

**Architecture:** New pure lib `src/lib/daily-special-strategies.ts` importing `DAILY_DEAL` from `./shard-calculator`; component gains strategy cards; MDX page gains gold-path sections. Design: `docs/plans/2026-09-27-daily-special-gold-path-design.md`.

**Tech Stack:** unchanged (TanStack Start + fumadocs, Tailwind v4, bun test).

**Verified anchor numbers:**
- Tier counts: `tier1 = fullDays + (rem>0)`, `tier2 = fullDays + (rem>10)`, `days = fullDays + (rem>0)`
- All Vouchers 400 → 44 packs, Rp 2.640.000, 2.000 gems
- All Gold 40 → 1 day, bundles 619.000 spent (4 bought: 2×77k, 155k, 310k), plain 0, goldSpent 403.000, goldLeft 277.900, gems 140
- All Gold 400 (2 weeks) → cost 3.906.200 (bundle 1.238.000 + plain 2.668.200), goldSpent 4.030.000, goldLeft 0, gems 1.400
- Gold-First held 0 ≡ All Vouchers
- Gold-First held 403.000, target 40 → cost 0, packs 0, gems 140, goldLeft 0
- Gold-First held 100.000, target 50 → cost 300.000 (5 packs), gems 235, goldSpent 93.000, goldLeft 7.000

---

### Task 1: Failing tests — `src/lib/daily-special-strategies.test.ts`

```ts
import { describe, expect, it } from 'bun:test'
import { compareStrategies } from './daily-special-strategies'

describe('all-voucher strategy', () => {
  it('matches the known voucher plan and gem rewards', () => {
    const r = compareStrategies(400, 0).vouchers
    expect(r.cost).toBe(2_640_000)
    expect(r.packs).toBe(44)
    expect(r.gems).toBe(2_000)
    expect(r.actualShards).toBe(400)
  })
})

describe('gold-first strategy', () => {
  it('equals all-vouchers when no gold is held', () => {
    const a = compareStrategies(400, 0).goldFirst
    const b = compareStrategies(400, 0).vouchers
    expect(a.cost).toBe(b.cost)
    expect(a.packs).toBe(b.packs)
    expect(a.gems).toBe(b.gems)
  })

  it('covers both tiers free when held gold is sufficient', () => {
    const r = compareStrategies(40, 403_000).goldFirst
    expect(r.cost).toBe(0)
    expect(r.packs).toBe(0)
    expect(r.gems).toBe(140)
    expect(r.goldSpent).toBe(403_000)
    expect(r.goldLeft).toBe(0)
  })

  it('mixes gold and vouchers across days', () => {
    const r = compareStrategies(50, 100_000).goldFirst
    expect(r.cost).toBe(300_000)
    expect(r.packs).toBe(5)
    expect(r.gems).toBe(235)
    expect(r.goldSpent).toBe(93_000)
    expect(r.goldLeft).toBe(7_000)
  })
})

describe('all-gold strategy', () => {
  it('buys weekly bundles ascending then plain top-ups', () => {
    const r = compareStrategies(40, 0).gold
    expect(r.cost).toBe(619_000)
    expect(r.bundleSpend).toBe(619_000)
    expect(r.plainTopUp).toBe(0)
    expect(r.goldSpent).toBe(403_000)
    expect(r.goldLeft).toBe(277_900)
    expect(r.bundlesBought).toEqual([
      { price: 77_000, gold: 84_700, count: 2 },
      { price: 155_000, gold: 170_500, count: 1 },
      { price: 310_000, gold: 341_000, count: 1 },
    ])
  })

  it('resets bundle caps across weeks', () => {
    const r = compareStrategies(400, 0).gold
    expect(r.cost).toBe(3_906_200)
    expect(r.bundleSpend).toBe(1_238_000)
    expect(r.plainTopUp).toBe(2_668_200)
    expect(r.goldSpent).toBe(4_030_000)
    expect(r.goldLeft).toBe(0)
    expect(r.gems).toBe(1_400)
  })
})

describe('comparison', () => {
  it('crown vouchers as cheapest', () => {
    const c = compareStrategies(400, 0)
    expect(c.cheapestId).toBe('vouchers')
    expect(c.vouchers.cost).toBeLessThan(c.goldFirst.cost)
    expect(c.vouchers.cost).toBeLessThan(c.gold.cost)
  })

  it('gold-first wins when enough gold is held', () => {
    expect(compareStrategies(40, 403_000).cheapestId).toBe('gold-first')
  })
})
```

Run: `bun test src/lib/daily-special-strategies.test.ts` → FAIL (module not found).

### Task 2: Implement `src/lib/daily-special-strategies.ts`

```ts
import { DAILY_DEAL } from './shard-calculator'

export interface GoldBundle {
  price: number
  gold: number
  perWeek: number
}

/** Index-aligned with DAILY_DEAL.tiers. */
const TIER_GEMS_VOUCHER = [50, 150]
const TIER_GOLD_COST = [93_000, 310_000]
const TIER_GEMS_GOLD = [35, 105]

export const GOLD_BUNDLES: GoldBundle[] = [
  { price: 77_000, gold: 84_700, perWeek: 2 },
  { price: 155_000, gold: 170_500, perWeek: 1 },
  { price: 310_000, gold: 341_000, perWeek: 1 },
]

export interface BundleTally {
  price: number
  gold: number
  count: number
}

export interface StrategyResult {
  id: 'vouchers' | 'gold-first' | 'gold'
  label: string
  cost: number
  costPerShard: number
  actualShards: number
  overshoot: number
  days: number
  packs: number
  bundleSpend: number
  bundlesBought: BundleTally[]
  plainTopUp: number
  goldSpent: number
  goldLeft: number
  gems: number
}

function tierCounts(target: number) {
  const t = Number.isFinite(target) ? Math.max(0, Math.floor(target)) : 0
  const fullDays = Math.floor(t / 40)
  const rem = t % 40
  return {
    days: fullDays + (rem > 0 ? 1 : 0),
    tier1: fullDays + (rem > 0 ? 1 : 0),
    tier2: fullDays + (rem > 10 ? 1 : 0),
    actualShards: fullDays * 40 + (rem > 10 ? 40 : rem > 0 ? 10 : 0),
  }
}

function baseResult(id, label, counts): StrategyResult { /* shared fields, zeros */ }

function voucherPlan(counts) {
  const tiers = DAILY_DEAL.tiers
  const totalVouchers = counts.tier1 * tiers[0].vouchers + counts.tier2 * tiers[1].vouchers
  const packs = Math.ceil(totalVouchers / DAILY_DEAL.packSize)
  const gems = counts.tier1 * TIER_GEMS_VOUCHER[0] + counts.tier2 * TIER_GEMS_VOUCHER[1]
  return { packs, cost: packs * DAILY_DEAL.packPrice, gems }
}

function goldFirstPlan(counts, heldGold) {
  let goldInv = heldGold, voucherInv = 0, packs = 0, cost = 0
  let goldSpent = 0, gems = 0
  for (let day = 1; day <= counts.days; day++) {
    const tierIdx = day <= counts.tier2 ? [0, 1] : [0]
    for (const i of tierIdx) {
      const goldCost = TIER_GOLD_COST[i]
      if (goldInv >= goldCost) {
        goldInv -= goldCost
        goldSpent += goldCost
        gems += TIER_GEMS_GOLD[i]
      } else {
        while (voucherInv < DAILY_DEAL.tiers[i].vouchers) {
          voucherInv += DAILY_DEAL.packSize
          packs++
          cost += DAILY_DEAL.packPrice
        }
        voucherInv -= DAILY_DEAL.tiers[i].vouchers
        gems += TIER_GEMS_VOUCHER[i]
      }
    }
  }
  return { cost, packs, gems, goldSpent, goldLeft: goldInv }
}

function allGoldPlan(counts) {
  let inv = 0, bundleSpend = 0, plain = 0, goldSpent = 0
  let week = 1
  const left = GOLD_BUNDLES.map((b) => b.perWeek)
  const tallies: BundleTally[] = GOLD_BUNDLES.map((b) => ({ price: b.price, gold: b.gold, count: 0 }))
  for (let day = 1; day <= counts.days; day++) {
    const wk = Math.floor((day - 1) / 7) + 1
    if (wk !== week) { week = wk; left.fill(0).map((_, i) => left[i] = GOLD_BUNDLES[i].perWeek) }  // reset
    let need = TIER_GOLD_COST[0]
    if (day <= counts.tier2) need += TIER_GOLD_COST[1]
    while (inv < need) {
      const idx = GOLD_BUNDLES.findIndex((_, i) => left[i] > 0)
      if (idx === -1) {
        const top = need - inv
        plain += top
        inv = need
      } else {
        left[idx]--
        inv += GOLD_BUNDLES[idx].gold
        bundleSpend += GOLD_BUNDLES[idx].price
        tallies[idx].count++
      }
    }
    inv -= need
    goldSpent += need
  }
  return { bundleSpend, plainTopUp: plain, bundlesBought: tallies.filter((t) => t.count > 0), goldSpent, goldLeft: inv }
}

export function compareStrategies(target: number, heldGold = 0) {
  const counts = tierCounts(target)
  const gold = Math.max(0, Math.floor(heldGold) || 0)
  // build the three StrategyResults, overshoot = actualShards - clamped target
  // cheapestId = min cost, ties broken in order vouchers < gold-first < gold
}
```

(Write full final code — no TODOs. `days = 0` short-circuits to zero-cost results with `cheapestId: 'vouchers'`.)

Verify: `bun test src/lib/daily-special-strategies.test.ts` → 8 PASS; `bun run types:check`.

Commit: `feat: add daily special path comparison strategies`

### Task 3: Component + page updates

**Component (`daily-special-calculator.tsx`):**
- Add `goldRaw` state + input "Gold blocks you hold (optional)" next to presets
- Keep `calculateShardPlan` for the schedule table; add `compareStrategies(target, heldGold)`
- Replace stat grid + detail rows with: summary line (`X shards over Y days (+overshoot overshoot)`) and 3 cards (`md:grid-cols-3`): label + Cheapest badge, big cost, rows: cost/shard, packs, bundles (bundleSpend if > 0), plain top-up (if > 0), gold spent/left (if > 0), gems
- Schedule table caption: "Voucher plan schedule"

**MDX (`daily-special-calculator.mdx`):** keep existing content; append after the calculator:

```mdx
## Paying with gold blocks

Each tier can also be activated with gold blocks — same shards, fewer star gems:

| Tier          | Via vouchers             | Via gold     | Voucher reward | Gold reward |
| ------------- | ------------------------ | ------------ | -------------- | ----------- |
| 1 (10 shards) | 6 vouchers ≈ Rp 60.000   | 93.000 gold  | 50 gems        | 35 gems     |
| 2 (30 shards) | 20 vouchers ≈ Rp 200.000 | 310.000 gold | 150 gems       | 105 gems    |

Vouchers win both tiers on cost **and** gems — even against gold bought at the
weekly bonus rate (≈ Rp 0,909/gold puts tier 1 at ≈ Rp 84.545 and tier 2 at
≈ Rp 281.818).

## Weekly gold top-up deals

| Bundle | Price      | Gold received | Per week |
| ------ | ---------- | ------------- | -------- |
| Small  | Rp 77.000  | 84.700        | 2        |
| Medium | Rp 155.000 | 170.500       | 1        |
| Large  | Rp 310.000 | 341.000       | 1        |

A fully bundled week buys 680.900 gold for Rp 619.000 (≈ 10% extra). The
bundles are great for gold's other uses — but for the daily special itself,
vouchers remain the cheapest path per shard.
```

Verify: `bun test` (all files), `types:check`, `lint`, dev-server SSR (`/docs/daily-special-calculator`: "Gold blocks you hold", "Cheapest", "Voucher plan schedule", "Weekly gold top-up deals", no errors).

Commits: `feat: show daily special strategy comparison in calculator` + `feat: document gold block path for daily special`
