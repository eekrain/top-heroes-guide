# Hero Shard Calculator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Docs page at `/docs/hero-shard-calculator` computing shards needed between hero star states for Legendary/Mythic heroes, with optional inventory subtraction.

**Architecture:** Same pattern as Daily Special Calculator: pure lib + bun tests (TDD), client component registered in `getMDXComponents`, MDX content page. Design: `docs/plans/2026-09-27-hero-shard-calculator-design.md`.

**Tech Stack:** TanStack Start + fumadocs, React 19, Tailwind v4, TypeScript strict, oxlint, Bun (`bun test`).

**Authoritative math:** `C = [1,1,2,2,4,6,4,4,8,8,16,4,8,16,16]`; `T(L,S) = M × (Σ_{i<L} 5·C[i] + S·C[L])`; M=2 for Mythic. Corrected spec example: Mythic (8,2)→(15,5), inv 50 → 216/1000/784/734/21.6. (The spec's 256 sample was a confirmed double-count bug.)

---

### Task 1: Failing tests for `getCumulativeShards` / `calculateShards`

**Files:**
- Create: `src/lib/hero-shard-calculator.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test'
import { BASE_STEP_COSTS, calculateShards, getCumulativeShards } from './hero-shard-calculator'

describe('getCumulativeShards', () => {
  it('starts at 0 for a fresh 1★ Yellow', () => {
    expect(getCumulativeShards('legendary', { level: 1, step: 0 })).toBe(0)
  })

  it('charges sub-steps at the current level cost', () => {
    expect(getCumulativeShards('legendary', { level: 1, step: 3 })).toBe(3)
    expect(getCumulativeShards('legendary', { level: 8, step: 2 })).toBe(108)
  })

  it('is continuous between step 5 of L and step 0 of L+1', () => {
    for (let level = 1; level < 15; level++) {
      expect(getCumulativeShards('legendary', { level, step: 5 })).toBe(
        getCumulativeShards('legendary', { level: level + 1, step: 0 }),
      )
    }
  })

  it('doubles for mythic', () => {
    expect(getCumulativeShards('mythic', { level: 8, step: 2 })).toBe(216)
    expect(getCumulativeShards('mythic', { level: 15, step: 5 })).toBe(1000)
  })
})

describe('phase totals', () => {
  it('matches the star ladder table', () => {
    const total = (a: number, b: number) => getCumulativeShards('legendary', { level: b, step: 0 }) - getCumulativeShards('legendary', { level: a, step: 0 })
    expect(total(1, 6)).toBe(50)   // Yellow
    expect(total(6, 11)).toBe(150) // Red
    expect(getCumulativeShards('legendary', { level: 15, step: 5 }) - getCumulativeShards('legendary', { level: 11, step: 0 })).toBe(300) // White
    expect(getCumulativeShards('legendary', { level: 15, step: 5 })).toBe(500)
  })
})

describe('calculateShards', () => {
  it('matches the corrected spec example', () => {
    const r = calculateShards('mythic', { level: 8, step: 2 }, { level: 15, step: 5 }, 50)
    expect(r.currentCumulative).toBe(216)
    expect(r.targetCumulative).toBe(1000)
    expect(r.totalNeeded).toBe(784)
    expect(r.netNeeded).toBe(734)
    expect(r.progressPercent).toBeCloseTo(21.6)
  })

  it('defaults to 5★ White target and 0 inventory', () => {
    const r = calculateShards('legendary', { level: 1, step: 0 })
    expect(r.targetCumulative).toBe(500)
    expect(r.totalNeeded).toBe(500)
    expect(r.netNeeded).toBe(500)
  })

  it('returns 0 needed when target precedes current', () => {
    const r = calculateShards('legendary', { level: 10, step: 3 }, { level: 5, step: 1 })
    expect(r.totalNeeded).toBe(0)
    expect(r.netNeeded).toBe(0)
  })

  it('clamps net needed to 0 when inventory covers it', () => {
    const r = calculateShards('legendary', { level: 1, step: 0 }, { level: 1, step: 2 }, 99)
    expect(r.totalNeeded).toBe(2)
    expect(r.netNeeded).toBe(0)
  })
})

describe('BASE_STEP_COSTS', () => {
  it('has 15 levels and sane prefix sums', () => {
    expect(BASE_STEP_COSTS).toHaveLength(15)
    expect(BASE_STEP_COSTS.reduce((a, b) => a + b, 0) * 5).toBe(500)
  })
})
```

**Step 2: Run to verify failure**

```bash
bun test src/lib/hero-shard-calculator.test.ts
```

Expected: FAIL — module not found.

### Task 2: Implement the lib

**Files:**
- Create: `src/lib/hero-shard-calculator.ts`

**Step 1: Implementation**

```ts
export type HeroTier = 'legendary' | 'mythic'

export interface StarState {
  /** 1–15 (1–5 Yellow, 6–10 Red, 11–15 White) */
  level: number
  /** 0–5 sub-steps completed */
  step: number
}

/** Base Legendary shard cost per step, indexed by level − 1. */
export const BASE_STEP_COSTS = [1, 1, 2, 2, 4, 6, 4, 4, 8, 8, 16, 4, 8, 16, 16]

export interface ShardRequirement {
  currentCumulative: number
  targetCumulative: number
  totalNeeded: number
  netNeeded: number
  progressPercent: number
}

export function getCumulativeShards(tier: HeroTier, state: StarState): number {
  const multiplier = tier === 'mythic' ? 2 : 1
  let base = 0
  for (let lvl = 1; lvl < state.level; lvl++) {
    base += BASE_STEP_COSTS[lvl - 1] * 5
  }
  base += BASE_STEP_COSTS[state.level - 1] * state.step
  return base * multiplier
}

export function calculateShards(
  tier: HeroTier,
  current: StarState,
  target: StarState = { level: 15, step: 5 },
  inventoryShards = 0,
): ShardRequirement {
  const currentCumulative = getCumulativeShards(tier, current)
  const targetCumulative = getCumulativeShards(tier, target)
  const totalNeeded = Math.max(0, targetCumulative - currentCumulative)
  const netNeeded = Math.max(0, totalNeeded - inventoryShards)
  const progressPercent =
    targetCumulative > 0
      ? Math.min(100, (currentCumulative / targetCumulative) * 100)
      : 100
  return { currentCumulative, targetCumulative, totalNeeded, netNeeded, progressPercent }
}
```

**Step 2: Verify**

```bash
bun test src/lib/hero-shard-calculator.test.ts && bun run types:check
```

Expected: 12 tests PASS, typecheck clean.

**Step 3: Commit**

```bash
git add src/lib/hero-shard-calculator.ts src/lib/hero-shard-calculator.test.ts
git commit -m "feat: add hero star shard requirement calculation"
```

### Task 3: `HeroShardCalculator` component

**Files:**
- Create: `src/components/hero-shard-calculator.tsx`
- Modify: `src/components/mdx.tsx`

**Step 1: Component**

```tsx
import { useState } from 'react'
import {
  calculateShards,
  type HeroTier,
  type StarState,
} from '@/lib/hero-shard-calculator'

const PHASES = [
  { name: 'Yellow', from: 1, to: 5 },
  { name: 'Red', from: 6, to: 10 },
  { name: 'White', from: 11, to: 15 },
] as const

const LEVELS = PHASES.flatMap((phase) =>
  Array.from({ length: phase.to - phase.from + 1 }, (_, i) => ({
    level: phase.from + i,
    label: `${i + 1}★ ${phase.name}`,
    phase: phase.name,
  })),
)

function levelLabel(level: number): string {
  return LEVELS.find((l) => l.level === level)?.label ?? `Lv ${level}`
}

const STEPS = [0, 1, 2, 3, 4, 5]

const formatNumber = new Intl.NumberFormat('id-ID')

function StatePicker({
  id,
  label,
  state,
  onChange,
}: {
  id: string
  label: string
  state: StarState
  onChange: (next: StarState) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-fd-muted-foreground" htmlFor={`${id}-level`}>
        {label}
      </label>
      <div className="flex gap-2">
        <select
          id={`${id}-level`}
          value={state.level}
          onChange={(e) => onChange({ ...state, level: Number(e.target.value) })}
          className="flex-1 rounded-md border border-fd-border bg-fd-card px-2 py-1.5 text-sm"
        >
          {PHASES.map((p) => (
            <optgroup key={p.name} label={p.name}>
              {LEVELS.filter((l) => l.phase === p.name).map((l) => (
                <option key={l.level} value={l.level}>
                  {l.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          aria-label={`${label} step`}
          value={state.step}
          onChange={(e) => onChange({ ...state, step: Number(e.target.value) })}
          className="w-20 rounded-md border border-fd-border bg-fd-card px-2 py-1.5 text-sm"
        >
          {STEPS.map((s) => (
            <option key={s} value={s}>
              {s}/5
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function HeroShardCalculator() {
  const [tier, setTier] = useState<HeroTier>('legendary')
  const [current, setCurrent] = useState<StarState>({ level: 1, step: 0 })
  const [target, setTarget] = useState<StarState>({ level: 15, step: 5 })
  const [inventoryRaw, setInventoryRaw] = useState('')

  const inventory = Math.max(0, Number.parseInt(inventoryRaw, 10) || 0)
  const result = calculateShards(tier, current, target, inventory)
  const usable = phaseChecked(current, target)

  return (
    <div className="flex flex-col gap-4 not-prose">
      <div className="flex flex-wrap gap-4">
        {(['legendary', 'mythic'] as const).map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm capitalize">
            <input
              type="radio"
              name="hero-tier"
              checked={tier === t}
              onChange={() => setTier(t)}
            />
            {t} <span className="text-fd-muted-foreground">({t === 'mythic' ? '×2' : '×1'})</span>
          </label>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatePicker id="current" label="Current" state={current} onChange={setCurrent} />
        <StatePicker id="target" label="Target" state={target} onChange={setTarget} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-fd-muted-foreground" htmlFor="inventory">
          Inventory shards (optional)
        </label>
        <input
          id="inventory"
          type="number"
          min={0}
          inputMode="numeric"
          value={inventoryRaw}
          onChange={(e) => setInventoryRaw(e.target.value)}
          className="w-40 rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-sm"
        />
      </div>

      <div className="rounded-lg border border-fd-border bg-fd-card p-4">
        {usable ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-fd-muted-foreground">
                {levelLabel(current.level)} {current.step}/5 → {levelLabel(target.level)}{' '}
                {target.step}/5
              </span>
              <span className="capitalize">{tier}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-fd-muted-foreground">Shards needed</div>
                <div className="text-2xl font-semibold">
                  {formatNumber.format(result.totalNeeded)}
                </div>
              </div>
              <div>
                <div className="text-sm text-fd-muted-foreground">Still to farm</div>
                <div className="text-2xl font-semibold">
                  {formatNumber.format(result.netNeeded)}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-fd-muted">
                <div
                  className="h-full rounded-full bg-fd-primary"
                  style={{ width: `${result.progressPercent}%` }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-fd-muted-foreground">
                {result.progressPercent.toFixed(1)}%
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-fd-muted-foreground">
            Target is behind the current state — nothing to calculate.
          </p>
        )}
      </div>
    </div>
  )
}

function phaseChecked(current: StarState, target: StarState): boolean {
  return (
    current.level < target.level ||
    (current.level === target.level && current.step <= target.step)
  )
}
```

**Step 2: Register in `src/components/mdx.tsx`**

Add import + `HeroShardCalculator,` to the spread object (same pattern as `DailySpecialCalculator`).

**Step 3: Verify**

```bash
bun run types:check && bun run lint
```

**Step 4: Commit**

```bash
git add src/components/hero-shard-calculator.tsx src/components/mdx.tsx
git commit -m "feat: add hero shard calculator component"
```

### Task 4: Content page + end-to-end verification

**Files:**
- Create: `content/docs/hero-shard-calculator.mdx`

**Step 1: Page content**

```mdx
---
title: Hero Shard Calculator
description: Compute the shards needed to star up a hero between any two star states.
icon: Stars
---

Heroes advance through **15 star levels** across three color phases, with 5
sub-steps per level. This calculator shows the shards needed from any current
state to any target state — Legendary costs ×1, Mythic costs ×2.

## Star ladder & shard costs

| Phase  | Level | Star       | Legendary/step | Legendary/star | Mythic/star |
| ------ | ----- | ---------- | -------------- | -------------- | ----------- |
| Yellow | 1     | 1★ Yellow  | 1              | 5              | 10          |
|        | 2     | 2★ Yellow  | 1              | 5              | 10          |
|        | 3     | 3★ Yellow  | 2              | 10             | 20          |
|        | 4     | 4★ Yellow  | 2              | 10             | 20          |
|        | 5     | 5★ Yellow  | 4              | 20             | 40          |
|        |       |            |                | **50**         | **100**     |
| Red    | 6     | 1★ Red     | 6              | 30             | 60          |
|        | 7     | 2★ Red     | 4              | 20             | 40          |
|        | 8     | 3★ Red     | 4              | 20             | 40          |
|        | 9     | 4★ Red     | 8              | 40             | 80          |
|        | 10    | 5★ Red     | 8              | 40             | 80          |
|        |       |            |                | **150**        | **300**     |
| White  | 11    | 1★ White   | 16             | 80             | 160         |
|        | 12    | 2★ White   | 4              | 20             | 40          |
|        | 13    | 3★ White   | 8              | 40             | 80          |
|        | 14    | 4★ White   | 16             | 80             | 160         |
|        | 15    | 5★ White   | 16             | 80             | 160         |
|        |       |            |                | **300**        | **600**     |

Grand total from fresh 1★ Yellow to complete 5★ White: **500 Legendary** or
**1000 Mythic** shards.

<HeroShardCalculator />

## How it works

Each star state converts to a cumulative shard count from zero:

$$T(L, S) = M \times \left( \sum_{i=1}^{L-1} 5 \cdot C[i] + S \cdot C[L] \right)$$

where $C$ is the per-step cost table above, $M$ is 2 for Mythic and 1 for
Legendary. The shards needed are the difference between your target and
current cumulative counts, minus any shards you already hold.
```

**Step 2: Full verification + visual check**

```bash
bun test src/lib/hero-shard-calculator.test.ts && bun run types:check && bun run lint
bun run dev
```

Check `http://localhost:<port>/docs/hero-shard-calculator`:
- HTTP 200, sidebar shows "Hero Shard Calculator" with stars icon
- Defaults render: Shards needed **500**, progress 0%
- Set Mythic + current 3★ Red 2/5 → Shards needed **784**, Still to farm **734**, progress 21.6%

Stop the dev server.

**Step 3: Commit**

```bash
git add content/docs/hero-shard-calculator.mdx
git commit -m "feat: add hero shard calculator docs page"
```
