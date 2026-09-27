import { describe, expect, it } from 'bun:test'
import { compareStrategies } from './daily-special-strategies'

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
