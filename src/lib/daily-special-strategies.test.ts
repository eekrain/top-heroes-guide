import { describe, expect, it } from 'bun:test'
import { buildDailyPlan, compareStrategies } from './daily-special-strategies'

describe('all-voucher strategy', () => {
  it('matches the known voucher plan and gem rewards', () => {
    const r = compareStrategies(400, 0).vouchers
    expect(r.cost).toBe(2_640_000)
    expect(r.packs).toBe(44)
    expect(r.gems).toBe(2_000)
  })
})

describe('cheapest mix strategy', () => {
  it('buys two small bundles and covers tier 2 with gold for a single day', () => {
    const r = compareStrategies(40, 0).cheapest
    expect(r.cost).toBe(214_000)
    expect(r.bundleSpend).toBe(154_000)
    expect(r.bundlesBought).toEqual([{ price: 77_000, gold: 161_700, count: 2 }])
    expect(r.packs).toBe(1)
    expect(r.gems).toBe(155)
    expect(r.goldSpent).toBe(310_000)
    expect(r.goldLeft).toBe(13_400)
    expect(r.plainTopUp).toBe(0)
  })

  it('spends held gold before buying bundles', () => {
    const r = compareStrategies(50, 100_000).cheapest
    expect(r.cost).toBe(214_000)
    expect(r.packs).toBe(1)
    expect(r.gems).toBe(190)
    expect(r.goldSpent).toBe(403_000)
    expect(r.goldLeft).toBe(20_400)
  })

  it('searches weekly bundle combinations for the 400-shard optimum', () => {
    const r = compareStrategies(400, 0).cheapest
    expect(r.cost).toBe(2_223_000)
    expect(r.bundleSpend).toBe(1_083_000)
    expect(r.bundlesBought).toEqual([
      { price: 77_000, gold: 161_700, count: 4 },
      { price: 155_000, gold: 325_500, count: 1 },
      { price: 310_000, gold: 651_000, count: 2 },
    ])
    expect(r.packs).toBe(19)
    expect(r.gems).toBe(1_670)
    expect(r.goldLeft).toBe(11_300)
    expect(r.plainTopUp).toBe(0)
  })

  it('never costs more than all-vouchers', () => {
    for (const t of [10, 20, 40, 50, 120, 200, 400, 800]) {
      const c = compareStrategies(t, 0)
      expect(c.cheapest.cost).toBeLessThanOrEqual(c.vouchers.cost)
    }
  })
})

describe('all-gold removal', () => {
  it('only exposes vouchers and cheapest mix', () => {
    const c = compareStrategies(400, 0)
    expect(Object.keys(c).sort()).toEqual(['cheapest', 'cheapestId', 'vouchers'])
  })
})

describe('comparison', () => {
  it('crowns the cheapest mix by default', () => {
    const c = compareStrategies(400, 0)
    expect(c.cheapestId).toBe('cheapest')
  })

  it('held gold covering everything wins with zero cost', () => {
    const c = compareStrategies(40, 403_000)
    expect(c.cheapestId).toBe('cheapest')
    expect(c.cheapest.cost).toBe(0)
    expect(c.cheapest.gems).toBe(140)
  })
})

describe('daily plans', () => {
  it('cheapest plan for 40 shards reads as a shopping list', () => {
    const plan = buildDailyPlan(40, 0, 'cheapest')
    expect(plan.actions).toEqual([
      { kind: 'buy-bundles', day: 1, week: 1, bundles: [{ price: 77_000, gold: 161_700, count: 2 }], cost: 154_000, goldGained: 323_400 },
      { kind: 'buy-packs', day: 1, packs: 1, cost: 60_000, vouchersAfter: 0 },
      { kind: 'tier', day: 1, tier: 1, payment: 'vouchers', vouchers: 6, shards: 10, gems: 50 },
      { kind: 'tier', day: 1, tier: 2, payment: 'gold', goldCost: 310_000, shards: 30, gems: 105 },
    ])
    expect(plan.totals.cost).toBe(214_000)
  })

  it('voucher plan for 40 shards buys packs as needed', () => {
    const plan = buildDailyPlan(40, 0, 'vouchers')
    expect(plan.actions).toEqual([
      { kind: 'buy-packs', day: 1, packs: 1, cost: 60_000, vouchersAfter: 0 },
      { kind: 'tier', day: 1, tier: 1, payment: 'vouchers', vouchers: 6, shards: 10, gems: 50 },
      { kind: 'buy-packs', day: 1, packs: 4, cost: 240_000, vouchersAfter: 4 },
      { kind: 'tier', day: 1, tier: 2, payment: 'vouchers', vouchers: 20, shards: 30, gems: 150 },
    ])
    expect(plan.totals.cost).toBe(300_000)
  })

  it('mixes held gold and vouchers across days', () => {
    const plan = buildDailyPlan(50, 100_000, 'cheapest')
    expect(plan.actions).toEqual([
      { kind: 'buy-bundles', day: 1, week: 1, bundles: [{ price: 77_000, gold: 161_700, count: 2 }], cost: 154_000, goldGained: 323_400 },
      { kind: 'tier', day: 1, tier: 1, payment: 'gold', goldCost: 93_000, shards: 10, gems: 35 },
      { kind: 'tier', day: 1, tier: 2, payment: 'gold', goldCost: 310_000, shards: 30, gems: 105 },
      { kind: 'buy-packs', day: 2, packs: 1, cost: 60_000, vouchersAfter: 0 },
      { kind: 'tier', day: 2, tier: 1, payment: 'vouchers', vouchers: 6, shards: 10, gems: 50 },
    ])
    expect(plan.totals.cost).toBe(214_000)
    expect(plan.totals.goldLeft).toBe(20_400)
  })
})
