import { describe, expect, it } from 'bun:test'
import { compareStrategies } from './daily-special-strategies'

describe('all-voucher strategy', () => {
  it('matches the known voucher plan and gem rewards', () => {
    const r = compareStrategies(400, 0).vouchers
    expect(r.cost).toBe(2_640_000)
    expect(r.packs).toBe(44)
    expect(r.gems).toBe(2_000)
    expect(r.actualShards).toBe(400)
  })
})

describe('gold-first strategy', () => {
  it('equals all-vouchers when no gold is held', () => {
    const a = compareStrategies(400, 0).goldFirst
    const b = compareStrategies(400, 0).vouchers
    expect(a.cost).toBe(b.cost)
    expect(a.packs).toBe(b.packs)
    expect(a.gems).toBe(b.gems)
  })

  it('covers both tiers free when held gold is sufficient', () => {
    const r = compareStrategies(40, 403_000).goldFirst
    expect(r.cost).toBe(0)
    expect(r.packs).toBe(0)
    expect(r.gems).toBe(140)
    expect(r.goldSpent).toBe(403_000)
    expect(r.goldLeft).toBe(0)
  })

  it('mixes gold and vouchers across days', () => {
    const r = compareStrategies(50, 100_000).goldFirst
    expect(r.cost).toBe(300_000)
    expect(r.packs).toBe(5)
    expect(r.gems).toBe(235)
    expect(r.goldSpent).toBe(93_000)
    expect(r.goldLeft).toBe(7_000)
  })
})

describe('all-gold strategy', () => {
  it('buys weekly bundles ascending then plain top-ups', () => {
    const r = compareStrategies(40, 0).gold
    expect(r.cost).toBe(619_000)
    expect(r.bundleSpend).toBe(619_000)
    expect(r.plainTopUp).toBe(0)
    expect(r.goldSpent).toBe(403_000)
    expect(r.goldLeft).toBe(277_900)
    expect(r.bundlesBought).toEqual([
      { price: 77_000, gold: 84_700, count: 2 },
      { price: 155_000, gold: 170_500, count: 1 },
      { price: 310_000, gold: 341_000, count: 1 },
    ])
  })

  it('resets bundle caps across weeks', () => {
    const r = compareStrategies(400, 0).gold
    expect(r.cost).toBe(3_906_200)
    expect(r.bundleSpend).toBe(1_238_000)
    expect(r.plainTopUp).toBe(2_668_200)
    expect(r.goldSpent).toBe(4_030_000)
    expect(r.goldLeft).toBe(0)
    expect(r.gems).toBe(1_400)
  })
})

describe('comparison', () => {
  it('crowns vouchers as cheapest', () => {
    const c = compareStrategies(400, 0)
    expect(c.cheapestId).toBe('vouchers')
    expect(c.vouchers.cost).toBeLessThanOrEqual(c.goldFirst.cost)
    expect(c.vouchers.cost).toBeLessThan(c.gold.cost)
  })

  it('gold-first wins when enough gold is held', () => {
    expect(compareStrategies(40, 403_000).cheapestId).toBe('gold-first')
  })
})
