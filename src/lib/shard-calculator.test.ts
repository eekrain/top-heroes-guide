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
