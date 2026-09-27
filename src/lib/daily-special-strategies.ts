import { DAILY_DEAL } from './shard-calculator'

export interface GoldBundle {
  price: number
  /** Total gold received (base + 110% bonus). */
  gold: number
  perWeek: number
}

/** Star gem rewards via vouchers, index-aligned with DAILY_DEAL.tiers. */
const TIER_GEMS_VOUCHER = [50, 150]
/** Gold block cost per tier, index-aligned with DAILY_DEAL.tiers. */
const TIER_GOLD_COST = [93_000, 310_000]
/** Star gem rewards via gold blocks, index-aligned with DAILY_DEAL.tiers. */
const TIER_GEMS_GOLD = [35, 105]

export const GOLD_BUNDLES: GoldBundle[] = [
  { price: 77_000, gold: 161_700, perWeek: 2 },
  { price: 155_000, gold: 325_500, perWeek: 1 },
  { price: 310_000, gold: 651_000, perWeek: 1 },
]

/** Above this many weeks the exhaustive search falls back to a greedy pass. */
const MAX_SEARCH_WEEKS = 5

export interface BundleTally {
  price: number
  gold: number
  count: number
}

export interface StrategyResult {
  id: 'vouchers' | 'cheapest'
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
    target: t,
    days: fullDays + (rem > 0 ? 1 : 0),
    tier1: fullDays + (rem > 0 ? 1 : 0),
    tier2: fullDays + (rem > 10 ? 1 : 0),
    actualShards: fullDays * 40 + (rem > 10 ? 40 : rem > 0 ? 10 : 0),
  }
}

function baseResult(
  id: StrategyResult['id'],
  label: string,
  counts: ReturnType<typeof tierCounts>,
): StrategyResult {
  return {
    id,
    label,
    cost: 0,
    costPerShard: 0,
    actualShards: counts.actualShards,
    overshoot: counts.actualShards - counts.target,
    days: counts.days,
    packs: 0,
    bundleSpend: 0,
    bundlesBought: [],
    plainTopUp: 0,
    goldSpent: 0,
    goldLeft: 0,
    gems: 0,
  }
}

function finalize(result: StrategyResult): StrategyResult {
  return {
    ...result,
    costPerShard: result.actualShards > 0 ? result.cost / result.actualShards : 0,
  }
}

function tallyBundles(weeklyCounts: number[][]): BundleTally[] {
  const tallies = GOLD_BUNDLES.map((b) => ({
    price: b.price,
    gold: b.gold,
    count: 0,
  }))
  for (const week of weeklyCounts) {
    for (let i = 0; i < week.length; i++) tallies[i].count += week[i]
  }
  return tallies.filter((t) => t.count > 0)
}

function voucherPlan(counts: ReturnType<typeof tierCounts>): StrategyResult {
  const result = baseResult('vouchers', 'All Vouchers', counts)
  const [tier1, tier2] = DAILY_DEAL.tiers
  const totalVouchers = counts.tier1 * tier1.vouchers + counts.tier2 * tier2.vouchers
  result.packs = Math.ceil(totalVouchers / DAILY_DEAL.packSize)
  result.cost = result.packs * DAILY_DEAL.packPrice
  result.gems = counts.tier1 * TIER_GEMS_VOUCHER[0] + counts.tier2 * TIER_GEMS_VOUCHER[1]
  return finalize(result)
}

/**
 * Simulates a bundle purchase schedule: gold (held + bought) fills each week's
 * tiers biggest-first; remaining tiers pay into the global voucher pool.
 */
function simulateMix(
  counts: ReturnType<typeof tierCounts>,
  heldGold: number,
  weeklyCounts: number[][],
): { cost: number; gems: number; goldSpent: number; goldLeft: number; vouchers: number } {
  let inv = heldGold
  let bundleSpend = 0
  let vouchers = 0
  let gems = 0
  let goldSpent = 0
  const weeks = weeklyCounts.length
  for (let w = 0; w < weeks; w++) {
    for (let i = 0; i < GOLD_BUNDLES.length; i++) {
      inv += GOLD_BUNDLES[i].gold * weeklyCounts[w][i]
      bundleSpend += GOLD_BUNDLES[i].price * weeklyCounts[w][i]
    }
    const dayStart = w * 7 + 1
    const dayEnd = Math.min(counts.days, w * 7 + 7)
    const daysThisWeek = Math.max(0, dayEnd - dayStart + 1)
    const t1ThisWeek = daysThisWeek
    const t2ThisWeek = Math.max(0, Math.min(counts.tier2, dayEnd) - (dayStart - 1))
    const goldT2 = Math.min(t2ThisWeek, Math.floor(inv / TIER_GOLD_COST[1]))
    inv -= goldT2 * TIER_GOLD_COST[1]
    const goldT1 = Math.min(t1ThisWeek, Math.floor(inv / TIER_GOLD_COST[0]))
    inv -= goldT1 * TIER_GOLD_COST[0]
    goldSpent += goldT2 * TIER_GOLD_COST[1] + goldT1 * TIER_GOLD_COST[0]
    gems += goldT2 * TIER_GEMS_GOLD[1] + goldT1 * TIER_GEMS_GOLD[0]
    const voucherT2 = t2ThisWeek - goldT2
    const voucherT1 = t1ThisWeek - goldT1
    gems += voucherT2 * TIER_GEMS_VOUCHER[1] + voucherT1 * TIER_GEMS_VOUCHER[0]
    vouchers +=
      voucherT2 * DAILY_DEAL.tiers[1].vouchers + voucherT1 * DAILY_DEAL.tiers[0].vouchers
  }
  const packs = Math.ceil(vouchers / DAILY_DEAL.packSize)
  return {
    cost: bundleSpend + packs * DAILY_DEAL.packPrice,
    gems,
    goldSpent,
    goldLeft: inv,
    vouchers,
  }
}

function buildResult(
  counts: ReturnType<typeof tierCounts>,
  weeklyCounts: number[][],
  sim: ReturnType<typeof simulateMix>,
): StrategyResult {
  const result = baseResult('cheapest', 'Cheapest Mix', counts)
  result.cost = sim.cost
  result.bundleSpend = weeklyCounts.flat().reduce(
    (sum, count, i) => sum + count * GOLD_BUNDLES[i % GOLD_BUNDLES.length].price,
    0,
  )
  result.bundlesBought = tallyBundles(weeklyCounts)
  result.packs = Math.ceil(sim.vouchers / DAILY_DEAL.packSize)
  result.goldSpent = sim.goldSpent
  result.goldLeft = sim.goldLeft
  result.gems = sim.gems
  return finalize(result)
}

function isBetter(
  candidate: { cost: number; gems: number; goldLeft: number },
  best: { cost: number; gems: number; goldLeft: number } | null,
): boolean {
  if (!best) return true
  if (candidate.cost !== best.cost) return candidate.cost < best.cost
  if (candidate.gems !== best.gems) return candidate.gems > best.gems
  return candidate.goldLeft < best.goldLeft
}

function cheapestMixPlan(
  counts: ReturnType<typeof tierCounts>,
  heldGold: number,
): StrategyResult {
  if (counts.days === 0) return voucherPlan(counts)
  return findBestWeeklyCounts(counts, heldGold).result
}

function findBestWeeklyCounts(
  counts: ReturnType<typeof tierCounts>,
  heldGold: number,
): { weeklyCounts: number[][]; result: StrategyResult } {
  const weeks = Math.ceil(counts.days / 7)

  const enumerate = (
    week: number,
    acc: number[][],
    best: { weeklyCounts: number[][]; result: StrategyResult } | null,
  ): { weeklyCounts: number[][]; result: StrategyResult } | null => {
    if (week === weeks) {
      const sim = simulateMix(counts, heldGold, acc)
      if (!isBetter(sim, best?.result ?? null)) return best
      return { weeklyCounts: acc, result: buildResult(counts, acc, sim) }
    }
    for (let a = 0; a <= GOLD_BUNDLES[0].perWeek; a++) {
      for (let b = 0; b <= GOLD_BUNDLES[1].perWeek; b++) {
        for (let c = 0; c <= GOLD_BUNDLES[2].perWeek; c++) {
          best = enumerate(week + 1, [...acc, [a, b, c]], best)
        }
      }
    }
    return best
  }

  if (weeks <= MAX_SEARCH_WEEKS) {
    const best = enumerate(0, [], null)
    if (best) return best
  }

  // Greedy fallback for very long plans: add one bundle at a time while it helps.
  const weekly: number[][] = Array.from({ length: weeks }, () =>
    GOLD_BUNDLES.map(() => 0),
  )
  let bestSim = simulateMix(counts, heldGold, weekly)
  let improved = true
  while (improved) {
    improved = false
    for (let w = 0; w < weeks; w++) {
      for (let i = 0; i < GOLD_BUNDLES.length; i++) {
        if (weekly[w][i] >= GOLD_BUNDLES[i].perWeek) continue
        weekly[w][i]++
        const sim = simulateMix(counts, heldGold, weekly)
        if (isBetter(sim, bestSim)) {
          bestSim = sim
          improved = true
        } else {
          weekly[w][i]--
        }
      }
    }
  }
  return { weeklyCounts: weekly, result: buildResult(counts, weekly, bestSim) }
}

export interface StrategyComparison {
  vouchers: StrategyResult
  cheapest: StrategyResult
  cheapestId: StrategyResult['id']
}

export function compareStrategies(
  target: number,
  heldGold = 0,
): StrategyComparison {
  const counts = tierCounts(target)
  const gold = Number.isFinite(heldGold) ? Math.max(0, Math.floor(heldGold)) : 0

  const vouchers = voucherPlan(counts)
  const cheapest = cheapestMixPlan(counts, gold)

  const cheapestId = cheapest.cost < vouchers.cost ? 'cheapest' : 'vouchers'

  return { vouchers, cheapest, cheapestId }
}

export interface BuyBundlesAction {
  kind: 'buy-bundles'
  day: number
  week: number
  bundles: { price: number; gold: number; count: number }[]
  cost: number
  goldGained: number
}

export interface BuyPacksAction {
  kind: 'buy-packs'
  day: number
  packs: number
  cost: number
  vouchersAfter: number
}

export interface TierAction {
  kind: 'tier'
  day: number
  tier: 1 | 2
  payment: 'gold' | 'vouchers'
  goldCost?: number
  vouchers?: number
  shards: number
  gems: number
}

export type PlanAction = BuyBundlesAction | BuyPacksAction | TierAction

export interface DailyPlan {
  strategyId: 'vouchers' | 'cheapest'
  actions: PlanAction[]
  totals: {
    cost: number
    packs: number
    gems: number
    goldSpent: number
    goldLeft: number
  }
}

/**
 * Reconstructs a chronological shopping list for a strategy, mirroring the
 * aggregate simulations: bundles are bought at each week's start, gold fills
 * tier 2 first within the week (earliest days), vouchers are bought as packs
 * only when the inventory runs short.
 */
export function buildDailyPlan(
  target: number,
  heldGold: number,
  strategy: 'vouchers' | 'cheapest',
): DailyPlan {
  const counts = tierCounts(target)
  const held = Number.isFinite(heldGold) ? Math.max(0, Math.floor(heldGold)) : 0
  const useGold = strategy === 'cheapest' && counts.days > 0
  const weeklyCounts = useGold
    ? findBestWeeklyCounts(counts, held).weeklyCounts
    : null

  const actions: PlanAction[] = []
  let goldInv = held
  let voucherInv = 0
  let packsBought = 0
  let bundleSpend = 0
  let goldSpent = 0
  let gems = 0

  const payTier = (day: number, tier: 1 | 2, useGoldTier: boolean) => {
    const idx = tier - 1
    if (useGoldTier && goldInv >= TIER_GOLD_COST[idx]) {
      goldInv -= TIER_GOLD_COST[idx]
      goldSpent += TIER_GOLD_COST[idx]
      gems += TIER_GEMS_GOLD[idx]
      actions.push({
        kind: 'tier',
        day,
        tier,
        payment: 'gold',
        goldCost: TIER_GOLD_COST[idx],
        shards: DAILY_DEAL.tiers[idx].shards,
        gems: TIER_GEMS_GOLD[idx],
      })
      return
    }
    const need = DAILY_DEAL.tiers[idx].vouchers
    while (voucherInv < need) {
      voucherInv += DAILY_DEAL.packSize
      packsBought++
      bundleSpend += DAILY_DEAL.packPrice
    }
    voucherInv -= need
    gems += TIER_GEMS_VOUCHER[idx]
    actions.push({
      kind: 'tier',
      day,
      tier,
      payment: 'vouchers',
      vouchers: need,
      shards: DAILY_DEAL.tiers[idx].shards,
      gems: TIER_GEMS_VOUCHER[idx],
    })
  }

  const weeks = Math.ceil(counts.days / 7)
  for (let w = 0; w < weeks; w++) {
    const dayStart = w * 7 + 1
    const dayEnd = Math.min(counts.days, w * 7 + 7)
    if (dayEnd < dayStart) break

    if (weeklyCounts) {
      const bought = weeklyCounts[w]
        .map((count, i) => ({
          price: GOLD_BUNDLES[i].price,
          gold: GOLD_BUNDLES[i].gold,
          count,
        }))
        .filter((b) => b.count > 0)
      if (bought.length > 0) {
        const goldGained = bought.reduce((sum, b) => sum + b.gold * b.count, 0)
        bundleSpend += bought.reduce((sum, b) => sum + b.price * b.count, 0)
        goldInv += goldGained
        actions.push({
          kind: 'buy-bundles',
          day: dayStart,
          week: w + 1,
          bundles: bought,
          cost: bought.reduce((sum, b) => sum + b.price * b.count, 0),
          goldGained,
        })
      }
    }

    const daysThisWeek = dayEnd - dayStart + 1
    const t2ThisWeek = Math.max(0, Math.min(counts.tier2, dayEnd) - (dayStart - 1))
    let goldT2Cap = 0
    let goldT1Cap = 0
    if (weeklyCounts) {
      goldT2Cap = Math.min(t2ThisWeek, Math.floor(goldInv / TIER_GOLD_COST[1]))
      const afterT2 = goldInv - goldT2Cap * TIER_GOLD_COST[1]
      goldT1Cap = Math.min(daysThisWeek, Math.floor(afterT2 / TIER_GOLD_COST[0]))
    }

    for (let day = dayStart; day <= dayEnd; day++) {
      // Buy the whole day's voucher packs up front, as one instruction.
      const dayStartIndex = actions.length
      const packsBefore = packsBought
      payTier(day, 1, goldT1Cap > 0)
      if (goldT1Cap > 0) goldT1Cap--
      if (day <= counts.tier2) {
        payTier(day, 2, goldT2Cap > 0)
        if (goldT2Cap > 0) goldT2Cap--
      }
      const packsToday = packsBought - packsBefore
      if (packsToday > 0) {
        actions.splice(dayStartIndex, 0, {
          kind: 'buy-packs',
          day,
          packs: packsToday,
          cost: packsToday * DAILY_DEAL.packPrice,
          vouchersAfter: voucherInv,
        })
      }
    }
  }

  return {
    strategyId: strategy,
    actions,
    totals: {
      cost: bundleSpend,
      packs: packsBought,
      gems,
      goldSpent,
      goldLeft: goldInv,
    },
  }
}
