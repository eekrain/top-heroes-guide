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
    const total = (a: number, b: number) =>
      getCumulativeShards('legendary', { level: b, step: 0 }) -
      getCumulativeShards('legendary', { level: a, step: 0 })
    expect(total(1, 6)).toBe(50) // Yellow
    expect(total(6, 11)).toBe(150) // Red
    expect(
      getCumulativeShards('legendary', { level: 15, step: 5 }) -
        getCumulativeShards('legendary', { level: 11, step: 0 }),
    ).toBe(300) // White
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
