import { DAILY_DEAL } from './shard-calculator'

export interface GoldBundle {
  price: number
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

function voucherPlan(counts: ReturnType<typeof tierCounts>): StrategyResult {
  const result = baseResult('vouchers', 'All Vouchers', counts)
  const [tier1, tier2] = DAILY_DEAL.tiers
  const totalVouchers = counts.tier1 * tier1.vouchers + counts.tier2 * tier2.vouchers
  result.packs = Math.ceil(totalVouchers / DAILY_DEAL.packSize)
  result.cost = result.packs * DAILY_DEAL.packPrice
  result.gems = counts.tier1 * TIER_GEMS_VOUCHER[0] + counts.tier2 * TIER_GEMS_VOUCHER[1]
  return finalize(result)
}

function goldFirstPlan(
  counts: ReturnType<typeof tierCounts>,
  heldGold: number,
): StrategyResult {
  const result = baseResult('gold-first', 'Gold First', counts)
  let goldInv = heldGold
  let voucherInv = 0
  for (let day = 1; day <= counts.days; day++) {
    const tiers = day <= counts.tier2 ? [0, 1] : [0]
    for (const i of tiers) {
      const goldCost = TIER_GOLD_COST[i]
      if (goldInv >= goldCost) {
        goldInv -= goldCost
        result.goldSpent += goldCost
        result.gems += TIER_GEMS_GOLD[i]
      } else {
        const vouchersNeeded = DAILY_DEAL.tiers[i].vouchers
        while (voucherInv < vouchersNeeded) {
          voucherInv += DAILY_DEAL.packSize
          result.packs++
          result.cost += DAILY_DEAL.packPrice
        }
        voucherInv -= vouchersNeeded
        result.gems += TIER_GEMS_VOUCHER[i]
      }
    }
  }
  result.goldLeft = goldInv
  return finalize(result)
}

function allGoldPlan(counts: ReturnType<typeof tierCounts>): StrategyResult {
  const result = baseResult('gold', 'All Gold', counts)
  let inv = 0
  let week = 1
  const left = GOLD_BUNDLES.map((b) => b.perWeek)
  const tallies: BundleTally[] = GOLD_BUNDLES.map((b) => ({
    price: b.price,
    gold: b.gold,
    count: 0,
  }))
  for (let day = 1; day <= counts.days; day++) {
    const wk = Math.floor((day - 1) / 7) + 1
    if (wk !== week) {
      week = wk
      for (let i = 0; i < left.length; i++) left[i] = GOLD_BUNDLES[i].perWeek
    }
    let need = TIER_GOLD_COST[0]
    if (day <= counts.tier2) need += TIER_GOLD_COST[1]
    while (inv < need) {
      const idx = left.findIndex((qty) => qty > 0)
      if (idx === -1) {
        const topUp = need - inv
        result.plainTopUp += topUp
        inv = need
      } else {
        left[idx]--
        inv += GOLD_BUNDLES[idx].gold
        result.bundleSpend += GOLD_BUNDLES[idx].price
        tallies[idx].count++
      }
    }
    inv -= need
    result.goldSpent += need
    result.gems += TIER_GEMS_GOLD[0]
    if (day <= counts.tier2) result.gems += TIER_GEMS_GOLD[1]
  }
  result.cost = result.bundleSpend + result.plainTopUp
  result.bundlesBought = tallies.filter((t) => t.count > 0)
  result.goldLeft = inv
  return finalize(result)
}

export interface StrategyComparison {
  vouchers: StrategyResult
  goldFirst: StrategyResult
  gold: StrategyResult
  cheapestId: StrategyResult['id']
}

export function compareStrategies(
  target: number,
  heldGold = 0,
): StrategyComparison {
  const counts = tierCounts(target)
  const gold = Number.isFinite(heldGold) ? Math.max(0, Math.floor(heldGold)) : 0

  const vouchers = voucherPlan(counts)
  const goldFirst = counts.days === 0 ? vouchers : goldFirstPlan(counts, gold)
  const allGold = counts.days === 0 ? vouchers : allGoldPlan(counts)

  const ordered = [vouchers, goldFirst, allGold]
  const cheapest = ordered.reduce((a, b) => (b.cost < a.cost ? b : a))

  return { vouchers, goldFirst, gold: allGold, cheapestId: cheapest.id }
}
