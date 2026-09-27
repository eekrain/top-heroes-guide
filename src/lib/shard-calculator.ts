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
