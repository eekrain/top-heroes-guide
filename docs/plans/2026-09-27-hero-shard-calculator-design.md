# Hero Shard Calculator Page — Design

Date: 2026-09-27
Status: Approved

## Goal

A docs page at `/docs/hero-shard-calculator` that computes shards needed to go from any hero star state to any target star state, for Legendary (×1) and Mythic (×2) heroes, with optional inventory subtraction.

## Game Mechanics (from spec, verified)

- 15 star levels in 3 phases of 5: Yellow (1–5), Red (6–10), White (11–15); 5 sub-steps per level
- Base Legendary cost per step, `C = [1,1,2,2,4,6,4,4,8,8,16,4,8,16,16]`
- Phase totals: Yellow 50, Red 150, White 300; grand total 500 Legendary / 1000 Mythic
- Cumulative: `T(L,S) = M × (Σ_{i<L} 5·C[i] + S·C[L])`
- Spec's original sample output (256) was confirmed by the user's agent as a double-count bug (level 8 counted both full and partial); formula (216) is authoritative

## Naming

Page/component: **Hero Shard Calculator** (`/docs/hero-shard-calculator`, `HeroShardCalculator`).

## Approach (mirrors Daily Special Calculator)

- `src/lib/hero-shard-calculator.ts` — pure calc: `getCumulativeShards`, `calculateShards(tier, current, target?, inventory?)`; `progressPercent` returned as number
- `src/lib/hero-shard-calculator.test.ts` — bun tests, written first (TDD)
- `src/components/hero-shard-calculator.tsx` — client UI, registered in `getMDXComponents`
- `content/docs/hero-shard-calculator.mdx` — star ladder table, formula, component

## Test cases

1. Corrected spec example: Mythic (8,2) → (15,5), inv 50 → 216 / 1000 / 784 / 734 / 21.6
2. Grand totals: Legendary 500, Mythic 1000
3. Phase totals: Yellow 50, Red 150, White 300 (Legendary)
4. Step continuity: `getCumulative(L,5) === getCumulative(L+1,0)`
5. Boundaries: fresh (1,0) → 0; target < current → 0 needed; inventory ≥ needed → net 0; Mythic = 2× Legendary

## UI

- Tier radio: Legendary ×1 / Mythic ×2
- Current & Target pickers: level `<select>` with optgroups per phase (`1★ Yellow` … `5★ White`) + step `<select>` 0–5 ("x/5")
- Optional inventory input (negative → 0)
- Results: total needed, net needed, progress bar + %; defaults Legendary / (1,0) / (15,5) / empty inventory

## Verification

`bun test`, `bun run types:check`, `bun run lint`, dev-server SSR check of `/docs/hero-shard-calculator`.
