# Shard Calculator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Docs page at `/docs/shard-calculator` with an interactive calculator: input target hero shards → vouchers, packs, days, and total IDR cost for the Daily Deal.

**Architecture:** Pure calculation in `src/lib/shard-calculator.ts` (config + function), interactive client component in `src/components/shard-calculator.tsx`, registered into MDX via `src/components/mdx.tsx`, content page in `content/docs/shard-calculator.mdx`. Design: `docs/plans/2026-09-27-shard-calculator-design.md`.

**Tech Stack:** TanStack Start + fumadocs (MDX, base-ui), React 19, Tailwind v4, TypeScript strict, oxlint, Bun runtime (built-in `bun test`).

**Confirmed game mechanics:**
- Pack: Rp 60.000 → 6 vouchers
- Daily deal, all-or-nothing sequential tiers: 6 vouchers → 10 shards; +20 vouchers → +30 shards (full day = 26 vouchers → 40 shards)
- Daily totals possible: 0, 10, or 40 shards
- Unused vouchers carry over across days

---

### Task 1: Test infra + failing tests for `calculateShardPlan`

**Files:**
- Modify: `package.json` (devDependency via bun)
- Create: `src/lib/shard-calculator.test.ts`

**Step 1: Install `@types/bun` (types only, so `tsc --noEmit` understands `bun:test` imports)**

```bash
bun add -d @types/bun
```

Expected: added to `devDependencies` in `package.json`.

**Step 2: Write the failing test**

Create `src/lib/shard-calculator.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { calculateShardPlan } from './shard-calculator'

describe('calculateShardPlan', () => {
  it('plans 400 shards as 10 full days with carryover packs', () => {
    const plan = calculateShardPlan(400)
    expect(plan.days).toBe(10)
    expect(plan.totalVouchers).toBe(260)
    expect(plan.packs).toBe(44) // ceil(260 / 6), carryover
    expect(plan.cost).toBe(2_640_000)
    expect(plan.leftoverVouchers).toBe(4)
    expect(plan.actualShards).toBe(400)
    expect(plan.overshoot).toBe(0)
    expect(plan.schedule).toEqual([{ fromDay: 1, toDay: 10, vouchers: 26, shards: 40 }])
  })

  it('plans 50 shards as full day + tier-1 day', () => {
    const plan = calculateShardPlan(50)
    expect(plan.days).toBe(2)
    expect(plan.totalVouchers).toBe(32)
    expect(plan.packs).toBe(6)
    expect(plan.cost).toBe(360_000)
    expect(plan.actualShards).toBe(50)
    expect(plan.schedule).toEqual([
      { fromDay: 1, toDay: 1, vouchers: 26, shards: 40 },
      { fromDay: 2, toDay: 2, vouchers: 6, shards: 10 },
    ])
  })

  it('overshoots remainders of 11–39 to a full day', () => {
    const plan = calculateShardPlan(20)
    expect(plan.days).toBe(1)
    expect(plan.actualShards).toBe(40)
    expect(plan.overshoot).toBe(20)
    expect(plan.packs).toBe(5)
    expect(plan.cost).toBe(300_000)
    expect(plan.schedule).toEqual([{ fromDay: 1, toDay: 1, vouchers: 26, shards: 40 }])
  })

  it('uses tier 1 alone for remainders of 1–10', () => {
    const plan = calculateShardPlan(10)
    expect(plan.days).toBe(1)
    expect(plan.totalVouchers).toBe(6)
    expect(plan.packs).toBe(1)
    expect(plan.cost).toBe(60_000)
    expect(plan.leftoverVouchers).toBe(0)
    expect(plan.actualShards).toBe(10)
  })

  it('plans 39 shards as a full day with overshoot', () => {
    const plan = calculateShardPlan(39)
    expect(plan.actualShards).toBe(40)
    expect(plan.overshoot).toBe(1)
    expect(plan.cost).toBe(300_000)
  })

  it('plans 41 shards as full day + tier-1 day', () => {
    const plan = calculateShardPlan(41)
    expect(plan.days).toBe(2)
    expect(plan.actualShards).toBe(50)
    expect(plan.overshoot).toBe(9)
    expect(plan.cost).toBe(360_000)
  })

  it('handles 0 and negative/invalid input as an empty plan', () => {
    for (const t of [0, -5, Number.NaN]) {
      const plan = calculateShardPlan(t)
      expect(plan.days).toBe(0)
      expect(plan.cost).toBe(0)
      expect(plan.actualShards).toBe(0)
      expect(plan.schedule).toEqual([])
      expect(plan.costPerShard).toBe(0)
    }
  })

  it('handles 1 shard as a single tier-1 day', () => {
    const plan = calculateShardPlan(1)
    expect(plan.days).toBe(1)
    expect(plan.totalVouchers).toBe(6)
    expect(plan.packs).toBe(1)
    expect(plan.cost).toBe(60_000)
    expect(plan.actualShards).toBe(10)
    expect(plan.overshoot).toBe(9)
  })
})
```

**Step 3: Run the test to verify it fails**

```bash
bun test src/lib/shard-calculator.test.ts
```

Expected: FAIL — `Cannot find module './shard-calculator'` (or equivalent resolution error).

### Task 2: Implement `calculateShardPlan`

**Files:**
- Create: `src/lib/shard-calculator.ts`

**Step 1: Write the minimal implementation**

Create `src/lib/shard-calculator.ts`:

```ts
export interface DealTier {
  vouchers: number
  shards: number
}

export interface DealConfig {
  currency: string
  packSize: number
  packPrice: number
  /** Sequential all-or-nothing tiers, in activation order. */
  tiers: DealTier[]
}

export const DAILY_DEAL: DealConfig = {
  currency: 'IDR',
  packSize: 6,
  packPrice: 60_000,
  tiers: [
    { vouchers: 6, shards: 10 },
    { vouchers: 20, shards: 30 },
  ],
}

export interface DayScheduleEntry {
  fromDay: number
  toDay: number
  vouchers: number
  shards: number
}

export interface ShardPlan {
  target: number
  actualShards: number
  overshoot: number
  days: number
  totalVouchers: number
  packs: number
  leftoverVouchers: number
  cost: number
  costPerShard: number
  schedule: DayScheduleEntry[]
}

/**
 * Cheapest plan to reach at least `target` shards.
 * Daily deal tiers are all-or-nothing and sequential: reaching tier k
 * costs the voucher sum of tiers 1..k and yields their shard sum.
 */
export function calculateShardPlan(
  target: number,
  deal: DealConfig = DAILY_DEAL,
): ShardPlan {
  const t = Number.isFinite(target) ? Math.max(0, Math.floor(target)) : 0

  const tiers = [...deal.tiers].sort((a, b) => a.vouchers - b.vouchers)
  let accVouchers = 0
  let accShards = 0
  const prefixes = tiers.map((tier) => {
    accVouchers += tier.vouchers
    accShards += tier.shards
    return { vouchers: accVouchers, shards: accShards }
  })
  const fullDay = prefixes[prefixes.length - 1]

  const fullDays = fullDay.shards > 0 ? Math.floor(t / fullDay.shards) : 0
  const remainder = fullDay.shards > 0 ? t % fullDay.shards : 0
  const partial =
    remainder > 0
      ? (prefixes.find((p) => p.shards >= remainder) ?? fullDay)
      : null

  const days = fullDays + (partial ? 1 : 0)
  const totalVouchers = fullDays * fullDay.vouchers + (partial?.vouchers ?? 0)
  const actualShards = fullDays * fullDay.shards + (partial?.shards ?? 0)
  const packs = Math.ceil(totalVouchers / deal.packSize)
  const cost = packs * deal.packPrice

  const schedule: DayScheduleEntry[] = []
  if (fullDays > 0) {
    schedule.push({
      fromDay: 1,
      toDay: fullDays,
      vouchers: fullDay.vouchers,
      shards: fullDay.shards,
    })
  }
  if (partial) {
    if (partial.vouchers === fullDay.vouchers && schedule.length > 0) {
      schedule[schedule.length - 1].toDay += 1
    } else {
      schedule.push({
        fromDay: fullDays + 1,
        toDay: fullDays + 1,
        vouchers: partial.vouchers,
        shards: partial.shards,
      })
    }
  }

  return {
    target: t,
    actualShards,
    overshoot: actualShards - t,
    days,
    totalVouchers,
    packs,
    leftoverVouchers: packs * deal.packSize - totalVouchers,
    cost,
    costPerShard: actualShards > 0 ? cost / actualShards : 0,
    schedule,
  }
}
```

**Step 2: Run the tests to verify they pass**

```bash
bun test src/lib/shard-calculator.test.ts
```

Expected: all 8 tests PASS.

**Step 3: Type-check**

```bash
bun run types:check
```

Expected: no errors.

**Step 4: Commit**

```bash
git add package.json bun.lock src/lib/shard-calculator.ts src/lib/shard-calculator.test.ts
git commit -m "feat: add daily deal shard plan calculation"
```

### Task 3: `ShardCalculator` client component

**Files:**
- Create: `src/components/shard-calculator.tsx`
- Modify: `src/components/mdx.tsx`

**Step 1: Create the component**

Create `src/components/shard-calculator.tsx`:

```tsx
import { useState } from 'react'
import { calculateShardPlan } from '@/lib/shard-calculator'

const formatIdr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatNumber = new Intl.NumberFormat('id-ID')

const PRESETS = [40, 120, 200, 400]

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-fd-border bg-fd-card p-4">
      <div className="text-sm text-fd-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

export function ShardCalculator() {
  const [raw, setRaw] = useState('400')
  const target = Number.parseInt(raw, 10)
  const valid = Number.isInteger(target) && target > 0
  const plan = valid ? calculateShardPlan(target) : null

  return (
    <div className="flex flex-col gap-4 not-prose">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-fd-muted-foreground" htmlFor="shard-target">
          Target shards
        </label>
        <input
          id="shard-target"
          type="number"
          min={1}
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="w-32 rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-sm"
        />
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setRaw(String(preset))}
            className="rounded-md border border-fd-border px-2.5 py-1 text-xs hover:bg-fd-muted"
          >
            {formatNumber.format(preset)}
          </button>
        ))}
      </div>

      {!plan ? (
        <p className="text-sm text-fd-muted-foreground">
          Enter a positive number of shards.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total cost" value={formatIdr.format(plan.cost)} />
            <StatCard label="Days" value={formatNumber.format(plan.days)} />
            <StatCard label="Packs" value={formatNumber.format(plan.packs)} />
            <StatCard
              label="Cost per shard"
              value={formatIdr.format(Math.round(plan.costPerShard))}
            />
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between border-b border-fd-border py-1.5">
              <span className="text-fd-muted-foreground">Shards</span>
              <span>
                {formatNumber.format(plan.actualShards)}
                {plan.overshoot > 0 && (
                  <span className="ml-2 rounded bg-fd-muted px-1.5 py-0.5 text-xs">
                    +{formatNumber.format(plan.overshoot)} overshoot
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between border-b border-fd-border py-1.5">
              <span className="text-fd-muted-foreground">Vouchers used</span>
              <span>{formatNumber.format(plan.totalVouchers)}</span>
            </div>
            <div className="flex justify-between border-b border-fd-border py-1.5">
              <span className="text-fd-muted-foreground">Leftover vouchers (carry over)</span>
              <span>{formatNumber.format(plan.leftoverVouchers)}</span>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fd-border text-left text-fd-muted-foreground">
                <th className="py-2 font-medium">Days</th>
                <th className="py-2 font-medium">Vouchers</th>
                <th className="py-2 font-medium">Shards</th>
              </tr>
            </thead>
            <tbody>
              {plan.schedule.map((entry) => (
                <tr key={entry.fromDay} className="border-b border-fd-border">
                  <td className="py-2">
                    {entry.fromDay === entry.toDay
                      ? formatNumber.format(entry.fromDay)
                      : `${formatNumber.format(entry.fromDay)}–${formatNumber.format(entry.toDay)}`}
                  </td>
                  <td className="py-2">{formatNumber.format(entry.vouchers)}</td>
                  <td className="py-2">{formatNumber.format(entry.shards)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
```

Note: `not-prose` prevents fumadocs typography styles from fighting the custom layout.

**Step 2: Register in MDX components**

In `src/components/mdx.tsx`, add the import and spread the component:

```tsx
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { ShardCalculator } from '@/components/shard-calculator';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ShardCalculator,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
```

**Step 3: Verify**

```bash
bun run types:check && bun run lint
```

Expected: both pass.

**Step 4: Commit**

```bash
git add src/components/shard-calculator.tsx src/components/mdx.tsx
git commit -m "feat: add shard calculator component"
```

### Task 4: Content page + end-to-end verification

**Files:**
- Create: `content/docs/shard-calculator.mdx`

**Step 1: Create the MDX page**

Create `content/docs/shard-calculator.mdx`:

```mdx
---
title: Shard Calculator
description: Plan your Daily Deal voucher purchases to hit a hero shard target.
icon: Calculator
---

The **Daily Deal** lets you activate vouchers every day for hero shards.
This calculator tells you how many packs to buy and what it costs in Rupiah
to reach your target shard count.

## How the Daily Deal works

| Item                        | Value                |
| --------------------------- | -------------------- |
| Activation Pack price       | Rp 60.000            |
| Vouchers per pack           | 6                    |
| Daily voucher cap           | 26                   |

Each day has two all-or-nothing tiers:

| Tier | Vouchers           | Reward      |
| ---- | ------------------ | ----------- |
| 1    | 6                  | 10 shards   |
| 2    | 20 (after tier 1)  | 30 shards   |

- A full day uses all 26 vouchers for **40 shards**.
- Daily outcomes are only **0, 10, or 40** shards — tier 2 cannot be partially claimed.
- Unused vouchers **carry over** to the next day, so packs are never wasted.

<ShardCalculator />

## Unit economics

- Tier 1 alone is the most efficient: 10 shards for Rp 60.000 = **Rp 6.000/shard**.
- Steady-state full days average Rp 260.000 per 40 shards ≈ **Rp 6.500/shard**
  (26 vouchers/day across packs of 6, with carryover).
- Buying pack-by-pack with no carryover costs Rp 300.000/day = Rp 7.500/shard.
```

**Step 2: Regenerate fumadocs-mdx sources**

```bash
bunx fumadocs-mdx
```

Expected: generates `.source/` including the new page (also runs automatically on `dev`/`build`).

**Step 3: Full verification**

```bash
bun test src/lib/shard-calculator.test.ts && bun run types:check && bun run lint
```

Expected: all pass.

**Step 4: Visual check**

```bash
bun run dev
```

Open `http://localhost:3000/docs/shard-calculator`:
- Page appears in docs sidebar with calculator icon
- Default target 400 shows: Total cost Rp 2.640.000, 10 days, 44 packs
- Preset 120 → 3 days, 13 packs, Rp 780.000
- Tier-1 highlight: preset 40 → 5 packs... verify: 40 shards = 1 full day = 26 vouchers → 5 packs → Rp 300.000
- Empty input shows the "Enter a positive number of shards" hint

Stop the dev server when done.

**Step 5: Commit**

```bash
git add content/docs/shard-calculator.mdx
git commit -m "feat: add shard calculator docs page"
```
