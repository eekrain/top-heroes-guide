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
